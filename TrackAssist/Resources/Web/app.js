// State
let currentDate = new Date();
let timelineData = [];
let selectedSegment = null;
let hoveredSegment = null;

// Zoom state
let zoomLevel = 1.0;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.25;
const BASE_HEIGHT = 600;

// DOM Elements
const datePicker = document.getElementById('date-picker');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const todayBtn = document.getElementById('today-btn');
const timelineCanvas = document.getElementById('timeline-canvas');
const timelineContainer = document.getElementById('timeline-container');
const selectedDetailsEl = document.getElementById('selected-details');
const activityListEl = document.getElementById('activity-list');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const totalTimeEl = document.getElementById('total-time');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeDatePicker();
    loadZoomLevel();
    setupEventListeners();
    setupZoomControls();
    loadData();
    startAutoRefresh();
});

function initializeDatePicker() {
    datePicker.value = formatDate(currentDate);
}

function loadZoomLevel() {
    const saved = localStorage.getItem('trackassist-zoom');
    if (saved) {
        zoomLevel = parseFloat(saved);
        document.getElementById('zoom-level').textContent = Math.round(zoomLevel * 100) + '%';
    }
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
    timelineCanvas.addEventListener('mousemove', handleTimelineHover);
    timelineCanvas.addEventListener('mouseleave', hideTooltip);
    window.addEventListener('resize', drawTimeline);
}

function setupZoomControls() {
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');

    zoomInBtn.addEventListener('click', () => setZoom(zoomLevel + ZOOM_STEP));
    zoomOutBtn.addEventListener('click', () => setZoom(zoomLevel - ZOOM_STEP));
    zoomResetBtn.addEventListener('click', () => setZoom(1.0));

    // Mouse wheel zoom (Ctrl/Cmd + scroll)
    timelineContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            const scrollRatio = timelineContainer.scrollTop / (timelineContainer.scrollHeight || 1);
            setZoom(zoomLevel + delta);
            requestAnimationFrame(() => {
                timelineContainer.scrollTop = scrollRatio * timelineContainer.scrollHeight;
            });
        }
    }, { passive: false });

    updateZoomButtons();
}

function setZoom(newZoom) {
    zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    document.getElementById('zoom-level').textContent = Math.round(zoomLevel * 100) + '%';
    updateZoomButtons();
    drawTimeline();
    localStorage.setItem('trackassist-zoom', zoomLevel);
}

function updateZoomButtons() {
    document.getElementById('zoom-in').disabled = zoomLevel >= MAX_ZOOM;
    document.getElementById('zoom-out').disabled = zoomLevel <= MIN_ZOOM;
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

        drawTimeline();
        renderActivityList();
        updateStatus(status);
        updateTotalTime();
    } catch (error) {
        console.error('Failed to load data:', error);
        updateStatus({ isTracking: false, isIdle: false });
    }
}

// Timeline Drawing (Vertical)
function drawTimeline() {
    const canvas = timelineCanvas;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const containerWidth = timelineContainer.clientWidth;
    const canvasHeight = BASE_HEIGHT * zoomLevel;

    // Set canvas size
    canvas.width = containerWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 0, containerWidth, canvasHeight);

    // Draw segments (vertical: Y axis = time)
    const totalSeconds = 24 * 60 * 60;
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);

    const padding = 8;
    const barWidth = containerWidth - (padding * 2);

    timelineData.forEach(segment => {
        const startTime = new Date(segment.startTime);
        const endTime = new Date(segment.endTime);

        const startSeconds = (startTime - dayStart) / 1000;
        const endSeconds = (endTime - dayStart) / 1000;

        // Y axis (top = 0:00, bottom = 24:00)
        const y = (startSeconds / totalSeconds) * canvasHeight;
        const height = ((endSeconds - startSeconds) / totalSeconds) * canvasHeight;

        ctx.fillStyle = segment.color;
        ctx.fillRect(padding, y, barWidth, Math.max(height, 3));

        // Highlight selected segment
        if (selectedSegment && segment.startTime === selectedSegment.startTime) {
            ctx.strokeStyle = '#e94560';
            ctx.lineWidth = 2;
            ctx.strokeRect(padding, y, barWidth, Math.max(height, 3));
        }
    });

    // Draw hour lines (every 3 hours)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let hour = 0; hour <= 24; hour += 3) {
        const y = (hour / 24) * canvasHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(containerWidth, y);
        ctx.stroke();
    }

    // Current time indicator (today only)
    if (isToday(currentDate)) {
        const now = new Date();
        const nowSeconds = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
        const nowY = (nowSeconds / totalSeconds) * canvasHeight;

        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, nowY);
        ctx.lineTo(containerWidth, nowY);
        ctx.stroke();

        // Arrow indicator
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.moveTo(0, nowY - 5);
        ctx.lineTo(8, nowY);
        ctx.lineTo(0, nowY + 5);
        ctx.closePath();
        ctx.fill();
    }
}

function getSegmentAtPosition(clientY) {
    const rect = timelineCanvas.getBoundingClientRect();
    const y = clientY - rect.top;
    const canvasHeight = BASE_HEIGHT * zoomLevel;

    const clickRatio = y / canvasHeight;
    const clickSeconds = clickRatio * 24 * 60 * 60;

    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);

    return timelineData.find(segment => {
        const startTime = new Date(segment.startTime);
        const endTime = new Date(segment.endTime);
        const startSeconds = (startTime - dayStart) / 1000;
        const endSeconds = (endTime - dayStart) / 1000;
        return clickSeconds >= startSeconds && clickSeconds <= endSeconds;
    });
}

function handleTimelineClick(event) {
    const segment = getSegmentAtPosition(event.clientY);

    if (segment) {
        selectedSegment = segment;
        showDetails(segment);
        highlightActivityItem(segment);
        drawTimeline();
    } else {
        selectedSegment = null;
        clearDetails();
        clearActivityHighlight();
        drawTimeline();
    }
}

function handleTimelineHover(event) {
    const segment = getSegmentAtPosition(event.clientY);

    if (segment !== hoveredSegment) {
        hoveredSegment = segment;
        timelineCanvas.style.cursor = segment ? 'pointer' : 'default';

        if (segment) {
            showTooltip(event, segment);
        } else {
            hideTooltip();
        }
    } else if (segment) {
        // Update tooltip position
        updateTooltipPosition(event);
    }
}

// Tooltip
function showTooltip(event, segment) {
    let tooltip = document.getElementById('timeline-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'timeline-tooltip';
        tooltip.className = 'timeline-tooltip';
        document.body.appendChild(tooltip);
    }

    const startTime = new Date(segment.startTime);
    const endTime = new Date(segment.endTime);

    tooltip.innerHTML = `
        <strong>${escapeHtml(segment.appName)}</strong>
        ${formatTime(startTime)} - ${formatTime(endTime)}<br>
        ${formatDuration(segment.durationSeconds)}
    `;

    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY + 15) + 'px';
    tooltip.style.display = 'block';
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('timeline-tooltip');
    if (tooltip && tooltip.style.display === 'block') {
        tooltip.style.left = (event.clientX + 15) + 'px';
        tooltip.style.top = (event.clientY + 15) + 'px';
    }
}

function hideTooltip() {
    const tooltip = document.getElementById('timeline-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
    hoveredSegment = null;
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

    selectedDetailsEl.innerHTML = `
        <div class="detail-item">
            <div class="detail-header">
                <span class="detail-color" style="background: ${segment.color}"></span>
                <span class="detail-app">${escapeHtml(segment.appName)}</span>
                <span class="detail-time">${formatTime(startTime)} - ${formatTime(endTime)}</span>
            </div>
            <div class="detail-duration">${duration}</div>
            ${titlesHtml}
        </div>
    `;
}

function clearDetails() {
    selectedDetailsEl.innerHTML = '<p class="placeholder">タイムラインをクリックすると詳細が表示されます</p>';
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

        return `
            <div class="activity-item ${isSelected ? 'selected' : ''}" data-index="${index}">
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
                drawTimeline();
                scrollToSegment(segment);
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

function scrollToSegment(segment) {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const startTime = new Date(segment.startTime);
    const startSeconds = (startTime - dayStart) / 1000;
    const totalSeconds = 24 * 60 * 60;

    const canvasHeight = BASE_HEIGHT * zoomLevel;
    const y = (startSeconds / totalSeconds) * canvasHeight;

    timelineContainer.scrollTo({
        top: y - timelineContainer.clientHeight / 3,
        behavior: 'smooth'
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
