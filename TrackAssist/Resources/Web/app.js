// State
let currentDate = new Date();
let timelineData = [];
let summaryData = [];

// DOM Elements
const datePicker = document.getElementById('date-picker');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const todayBtn = document.getElementById('today-btn');
const timelineCanvas = document.getElementById('timeline-canvas');
const detailsPanel = document.getElementById('details-panel');
const summaryContainer = document.getElementById('summary-container');
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

    timelineCanvas.addEventListener('click', handleTimelineClick);
    window.addEventListener('resize', drawTimeline);
}

// Data Loading
async function loadData() {
    try {
        const dateStr = formatDate(currentDate);
        const [timelineRes, summaryRes, statusRes] = await Promise.all([
            fetch(`/api/timeline?date=${dateStr}`),
            fetch(`/api/summary?date=${dateStr}`),
            fetch('/api/status')
        ]);

        const timeline = await timelineRes.json();
        const summary = await summaryRes.json();
        const status = await statusRes.json();

        timelineData = timeline.segments || [];
        summaryData = summary.apps || [];

        drawTimeline();
        renderSummary(summary);
        updateStatus(status);
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        updateStatus({ isTracking: false, isIdle: false });
    }
}

// Timeline Drawing
function drawTimeline() {
    const canvas = timelineCanvas;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Background
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw segments
    const totalSeconds = 24 * 60 * 60;
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);

    timelineData.forEach(segment => {
        const startTime = new Date(segment.startTime);
        const endTime = new Date(segment.endTime);

        const startSeconds = (startTime - dayStart) / 1000;
        const endSeconds = (endTime - dayStart) / 1000;

        const x = (startSeconds / totalSeconds) * rect.width;
        const width = ((endSeconds - startSeconds) / totalSeconds) * rect.width;

        ctx.fillStyle = segment.color;
        ctx.fillRect(x, 5, Math.max(width, 2), rect.height - 10);
    });

    // Draw hour lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let hour = 0; hour <= 24; hour += 6) {
        const x = (hour / 24) * rect.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
        ctx.stroke();
    }
}

function handleTimelineClick(event) {
    const rect = timelineCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickRatio = x / rect.width;
    const clickSeconds = clickRatio * 24 * 60 * 60;

    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);

    // Find clicked segment
    const clickedSegment = timelineData.find(segment => {
        const startTime = new Date(segment.startTime);
        const endTime = new Date(segment.endTime);
        const startSeconds = (startTime - dayStart) / 1000;
        const endSeconds = (endTime - dayStart) / 1000;
        return clickSeconds >= startSeconds && clickSeconds <= endSeconds;
    });

    if (clickedSegment) {
        showDetails(clickedSegment);
    } else {
        clearDetails();
    }
}

// Details Panel
function showDetails(segment) {
    const startTime = new Date(segment.startTime);
    const endTime = new Date(segment.endTime);
    const duration = formatDuration(segment.durationSeconds);

    let titlesHtml = '';
    if (segment.windowTitles && segment.windowTitles.length > 0) {
        titlesHtml = `
            <div class="detail-titles">
                <h4>ウィンドウタイトル</h4>
                <ul>
                    ${segment.windowTitles.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    detailsPanel.innerHTML = `
        <div class="detail-item">
            <div class="detail-header">
                <span class="detail-color" style="background: ${segment.color}"></span>
                <span class="detail-app">${escapeHtml(segment.appName)}</span>
                <span class="detail-time">${formatTime(startTime)} - ${formatTime(endTime)} (${duration})</span>
            </div>
            ${titlesHtml}
        </div>
    `;
}

function clearDetails() {
    detailsPanel.innerHTML = '<p class="placeholder">タイムラインのブロックをクリックすると詳細が表示されます</p>';
}

// Summary
function renderSummary(summary) {
    if (!summaryData || summaryData.length === 0) {
        summaryContainer.innerHTML = '<p class="placeholder">この日のデータはありません</p>';
        totalTimeEl.textContent = '';
        return;
    }

    const maxPercent = Math.max(...summaryData.map(s => s.percentage));

    summaryContainer.innerHTML = summaryData.map(app => `
        <div class="summary-item">
            <span class="summary-color" style="background: ${app.color}"></span>
            <span class="summary-app">${escapeHtml(app.appName)}</span>
            <div class="summary-bar-container">
                <div class="summary-bar" style="width: ${(app.percentage / maxPercent) * 100}%; background: ${app.color}"></div>
            </div>
            <span class="summary-time">${formatDuration(app.totalSeconds)}</span>
            <span class="summary-percent">${app.percentage.toFixed(1)}%</span>
        </div>
    `).join('');

    totalTimeEl.textContent = `合計: ${formatDuration(summary.totalSeconds)}`;
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

// Auto Refresh
function startAutoRefresh() {
    setInterval(() => {
        const today = new Date();
        if (formatDate(currentDate) === formatDate(today)) {
            loadData();
        }
    }, 60000); // 1分ごと
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
