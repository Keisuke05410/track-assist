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
const timelineNavBar = document.getElementById('timeline-nav-bar');
const timelineNavLabels = document.getElementById('timeline-nav-labels');

// Tooltip element (created dynamically)
let tooltipEl = null;

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

        renderTimelineNav();
        renderActivityList();
        updateStatus(status);
        updateTotalTime();
    } catch (error) {
        console.error('Failed to load data:', error);
        updateStatus({ isTracking: false, isIdle: false });
    }
}

// Timeline Navigation Bar
function renderTimelineNav() {
    if (!timelineData || timelineData.length === 0) {
        timelineNavBar.innerHTML = '';
        timelineNavLabels.innerHTML = '';
        return;
    }

    // Calculate time range
    const firstStart = new Date(timelineData[0].startTime);
    const lastEnd = new Date(timelineData[timelineData.length - 1].endTime);
    const totalMs = lastEnd - firstStart;

    if (totalMs <= 0) {
        timelineNavBar.innerHTML = '';
        timelineNavLabels.innerHTML = '';
        return;
    }

    // Render time labels
    renderTimeLabels(firstStart, lastEnd);

    // Render segments
    timelineNavBar.innerHTML = timelineData.map((segment, index) => {
        const start = new Date(segment.startTime);
        const end = new Date(segment.endTime);
        const width = ((end - start) / totalMs) * 100;
        const isIdle = segment.isIdle || false;
        const isSelected = selectedSegment && segment.startTime === selectedSegment.startTime;

        return `
            <div class="timeline-nav-segment ${isIdle ? 'idle' : ''} ${isSelected ? 'selected' : ''}"
                 data-index="${index}"
                 style="width: ${width}%; background: ${segment.color};"
                 title="${segment.appName}">
            </div>
        `;
    }).join('');

    // Add event handlers
    timelineNavBar.querySelectorAll('.timeline-nav-segment').forEach(segmentEl => {
        segmentEl.addEventListener('click', handleNavSegmentClick);
        segmentEl.addEventListener('mouseenter', handleNavSegmentMouseEnter);
        segmentEl.addEventListener('mouseleave', handleNavSegmentMouseLeave);
    });
}

function renderTimeLabels(startTime, endTime) {
    const labels = [];
    const startHour = startTime.getHours();
    const endHour = endTime.getHours();
    const totalHours = endHour - startHour + (endTime.getMinutes() > 0 ? 1 : 0);

    // Determine label interval based on total hours
    let interval = 1;
    if (totalHours > 12) interval = 3;
    else if (totalHours > 6) interval = 2;

    // Add start label
    labels.push(formatTime(startTime));

    // Add intermediate labels at hour boundaries
    for (let h = startHour + interval; h <= endHour; h += interval) {
        if (h > startHour && h < endHour + 1) {
            labels.push(`${String(h).padStart(2, '0')}:00`);
        }
    }

    // Add end label if different from last
    const endLabel = formatTime(endTime);
    if (labels[labels.length - 1] !== endLabel) {
        labels.push(endLabel);
    }

    timelineNavLabels.innerHTML = labels.map(label => `<span>${label}</span>`).join('');
}

function handleNavSegmentClick(e) {
    const index = parseInt(e.target.dataset.index);
    const segment = timelineData[index];
    if (segment) {
        selectedSegment = segment;
        showDetails(segment);
        highlightActivityItem(segment);
        highlightNavSegment(segment);
    }
}

function handleNavSegmentMouseEnter(e) {
    const index = parseInt(e.target.dataset.index);
    const segment = timelineData[index];
    if (!segment) return;

    // Create tooltip
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'timeline-nav-tooltip';
        document.body.appendChild(tooltipEl);
    }

    const startTime = new Date(segment.startTime);
    const endTime = new Date(segment.endTime);
    const duration = formatDuration(segment.durationSeconds);

    tooltipEl.innerHTML = `
        <strong>${escapeHtml(segment.appName)}</strong><br>
        ${formatTime(startTime)} - ${formatTime(endTime)} (${duration})
    `;
    tooltipEl.style.display = 'block';

    // Position tooltip
    const rect = e.target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

    // Keep tooltip within viewport
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
    }

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${rect.top - tooltipRect.height - 10}px`;
}

function handleNavSegmentMouseLeave() {
    if (tooltipEl) {
        tooltipEl.style.display = 'none';
    }
}

function highlightNavSegment(segment) {
    timelineNavBar.querySelectorAll('.timeline-nav-segment').forEach(el => {
        el.classList.remove('selected');
    });

    const index = timelineData.findIndex(s => s.startTime === segment.startTime);
    if (index >= 0) {
        const el = timelineNavBar.querySelector(`[data-index="${index}"]`);
        if (el) {
            el.classList.add('selected');
        }
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
                highlightNavSegment(segment);
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
