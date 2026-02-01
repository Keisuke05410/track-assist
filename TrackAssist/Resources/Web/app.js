// State
let currentDate = new Date();
let timelineData = [];
let selectedSegment = null;

// DOM Elements
const datePicker = document.getElementById('date-picker');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const todayBtn = document.getElementById('today-btn');
const selectedDetailsEl = document.getElementById('selected-details');
const activityListEl = document.getElementById('activity-list');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const totalTimeEl = document.getElementById('total-time');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeDatePicker();
    setupEventListeners();
    loadData();
    startAutoRefresh();
});

function initializeDatePicker() {
    datePicker.value = formatDate(currentDate);
}

function setupEventListeners() {
    datePicker.addEventListener('change', (e) => {
        currentDate = new Date(e.target.value);
        loadData();
    });

    prevDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        datePicker.value = formatDate(currentDate);
        loadData();
    });

    nextDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        datePicker.value = formatDate(currentDate);
        loadData();
    });

    todayBtn.addEventListener('click', () => {
        currentDate = new Date();
        datePicker.value = formatDate(currentDate);
        loadData();
    });
}

// Data Loading
async function loadData() {
    try {
        const dateStr = formatDate(currentDate);
        const [timelineRes, statusRes] = await Promise.all([
            fetch(`/api/timeline?date=${dateStr}`),
            fetch('/api/status')
        ]);

        const timeline = await timelineRes.json();
        const status = await statusRes.json();

        timelineData = timeline.segments || [];

        renderActivityList();
        updateStatus(status);
        updateTotalTime();
    } catch (error) {
        console.error('Failed to load data:', error);
        updateStatus({ isTracking: false, isIdle: false });
    }
}

// Details Panel
function showDetails(segment) {
    const startTime = new Date(segment.startTime);
    const endTime = new Date(segment.endTime);
    const duration = formatDuration(segment.durationSeconds);
    const isIdle = segment.isIdle || false;

    let titlesHtml = '';
    if (!isIdle && segment.windowTitles && segment.windowTitles.length > 0) {
        titlesHtml = `
            <div class="detail-titles">
                <h4>ウィンドウタイトル</h4>
                <ul>
                    ${segment.windowTitles.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    selectedDetailsEl.innerHTML = `
        <div class="detail-item">
            <div class="detail-header">
                <span class="detail-color" style="background: ${segment.color}"></span>
                <span class="detail-app" ${isIdle ? 'style="font-style: italic; color: var(--text-secondary);"' : ''}>${escapeHtml(segment.appName)}</span>
                <span class="detail-time">${formatTime(startTime)} - ${formatTime(endTime)}</span>
            </div>
            <div class="detail-duration">${duration}</div>
            ${titlesHtml}
        </div>
    `;
}

function clearDetails() {
    selectedDetailsEl.innerHTML = '<p class="placeholder">アクティビティをクリックすると詳細が表示されます</p>';
}

// Activity List
function renderActivityList() {
    if (!timelineData || timelineData.length === 0) {
        activityListEl.innerHTML = '<p class="placeholder">この日のデータはありません</p>';
        return;
    }

    activityListEl.innerHTML = timelineData.map((segment, index) => {
        const startTime = new Date(segment.startTime);
        const endTime = new Date(segment.endTime);
        const isSelected = selectedSegment && segment.startTime === selectedSegment.startTime;
        const isIdle = segment.isIdle || false;

        return `
            <div class="activity-item ${isSelected ? 'selected' : ''} ${isIdle ? 'idle' : ''}" data-index="${index}">
                <span class="activity-color" style="background: ${segment.color}"></span>
                <span class="activity-time">${formatTime(startTime)} - ${formatTime(endTime)}</span>
                <span class="activity-app">${escapeHtml(segment.appName)}</span>
            </div>
        `;
    }).join('');

    // Add click handlers
    activityListEl.querySelectorAll('.activity-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            const segment = timelineData[index];
            if (segment) {
                selectedSegment = segment;
                showDetails(segment);
                highlightActivityItem(segment);
            }
        });
    });
}

function highlightActivityItem(segment) {
    activityListEl.querySelectorAll('.activity-item').forEach(item => {
        item.classList.remove('selected');
    });

    const index = timelineData.findIndex(s => s.startTime === segment.startTime);
    if (index >= 0) {
        const item = activityListEl.querySelector(`[data-index="${index}"]`);
        if (item) {
            item.classList.add('selected');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

function clearActivityHighlight() {
    activityListEl.querySelectorAll('.activity-item').forEach(item => {
        item.classList.remove('selected');
    });
}

// Status
function updateStatus(status) {
    if (!status.isTracking) {
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = '停止中';
    } else if (status.isIdle) {
        statusDot.className = 'status-dot idle';
        statusText.textContent = 'アイドル中';
    } else {
        statusDot.className = 'status-dot connected';
        const currentApp = status.currentApp || '';
        statusText.textContent = currentApp ? `記録中: ${currentApp}` : '記録中';
    }
}

function updateTotalTime() {
    if (!timelineData || timelineData.length === 0) {
        totalTimeEl.textContent = '';
        return;
    }

    const totalSeconds = timelineData.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    totalTimeEl.textContent = `合計: ${formatDuration(totalSeconds)}`;
}

// Auto Refresh
function startAutoRefresh() {
    setInterval(() => {
        const today = new Date();
        if (formatDate(currentDate) === formatDate(today)) {
            loadData();
        }
    }, 60000);
}

// Utilities
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds}秒`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        return `${minutes}分`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
    }
}

function isToday(date) {
    const today = new Date();
    return formatDate(date) === formatDate(today);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
