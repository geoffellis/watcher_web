let videos = [];
let filteredVideos = [];
let currentVideoIndex = -1;
let currentFilter = 'all'; // 'all', 'person'
let selectedDates = new Set();
let searchQuery = '';
let showHighlights = true;

// Thumbnail Observer (Lazy load non-person thumbnails)
const thumbnailObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (!img.dataset.videoUrl) return;
            
            const videoUrl = img.dataset.videoUrl;
            img.removeAttribute('data-video-url'); // only try once
            
            const video = document.createElement('video');
            video.src = videoUrl + '#t=0.5';
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous';
            
            video.addEventListener('loadeddata', () => {
                video.currentTime = 0.5;
            });
            
            video.addEventListener('seeked', () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 360;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                img.src = canvas.toDataURL('image/jpeg', 0.6);
            });
            
            observer.unobserve(img);
        }
    });
}, { rootMargin: '200px' });

// DOM Elements
const videoGrid = document.getElementById('video-grid');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const banner = document.getElementById('new-clips-banner');
const statTotal = document.getElementById('stat-total');
const statPerson = document.getElementById('stat-person');

// Init
async function init() {
    setupEventListeners();
    setupSSE();
    await fetchVideos();
    renderCalendar();
}

// Fetch Data
async function fetchVideos() {
    try {
        const response = await fetch('/api/videos');
        videos = await response.json();
        applyFilters();
    } catch (e) {
        console.error("Failed to fetch videos", e);
        loadingState.textContent = "Failed to load videos. Is the server running?";
    }
}

// SSE Connection
function setupSSE() {
    const eventSource = new EventSource('/api/stream');
    eventSource.addEventListener('update', (e) => {
        const data = JSON.parse(e.data);
        console.log("SSE Update received:", data);
        if (data.type === 'dir_update') {
            banner.classList.remove('hidden');
        }
    });
}

// Filtering Logic
function applyFilters() {
    filteredVideos = videos.filter(v => {
        // Person filter
        if (currentFilter === 'person' && !v.person_found) return false;
        
        // Date filter
        if (selectedDates.size > 0) {
            const vDate = new Date(v.timestamp).toISOString().split('T')[0];
            if (!selectedDates.has(vDate)) return false;
        }
        
        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const hasTag = v.tags && v.tags.some(t => t.toLowerCase().includes(q));
            if (!v.filename.toLowerCase().includes(q) && !hasTag) return false;
        }
        
        return true;
    });
    
    renderGrid();
    updateStats();
    updateActivityGraph();
}

// Render UI
function renderGrid() {
    loadingState.classList.add('hidden');
    videoGrid.innerHTML = '';
    
    if (filteredVideos.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    const template = document.getElementById('video-card-template');
    
    filteredVideos.forEach((video, index) => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.video-card');
        const img = clone.querySelector('.card-thumbnail');
        const badge = clone.querySelector('.person-badge');
        const timeEl = clone.querySelector('.card-time');
        const dateEl = clone.querySelector('.card-date');
        const tagsContainer = clone.querySelector('.card-tags-overlay');
        
        const isFamily = video.tags && video.tags.some(t => t.toLowerCase() === 'family');
        
        const personIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C9.79 2 8 3.79 8 6s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
        const familyIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
        
        badge.innerHTML = isFamily ? familyIcon : personIcon;
        if (isFamily) badge.style.backgroundColor = '#ff5252'; // Heart Red
        else badge.style.backgroundColor = ''; // Default green
        
        const dateObj = new Date(video.timestamp);
        timeEl.textContent = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        dateEl.textContent = dateObj.toLocaleDateString();
        
        if (video.person_found && video.image_url) {
            img.src = video.image_url;
            badge.classList.remove('hidden');
        } else {
            // Lazy load thumbnail from video
            img.dataset.videoUrl = video.url;
            img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" fill="%231e1e1e"><rect width="640" height="360"/></svg>';
            thumbnailObserver.observe(img);
        }
        
        if (video.tags && video.tags.length > 0) {
            video.tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag-mini';
                span.textContent = tag;
                tagsContainer.appendChild(span);
            });
        }
        
        card.addEventListener('click', () => openLightbox(index));
        videoGrid.appendChild(card);
    });
}

function updateStats() {
    statTotal.textContent = filteredVideos.length;
    statPerson.textContent = filteredVideos.filter(v => v.person_found).length;
    
    let label = 'All Dates';
    if (selectedDates.size === 1) {
        label = Array.from(selectedDates)[0];
    } else if (selectedDates.size > 1) {
        label = `${selectedDates.size} Days Selected`;
    }
    document.getElementById('stats-date-label').textContent = label;
}

function updateActivityGraph() {
    const graph = document.getElementById('activity-graph');
    graph.innerHTML = '';
    
    if (filteredVideos.length === 0) return;
    
    // Group by hour
    const hours = new Array(24).fill(0).map(() => ({ total: 0, person: 0 }));
    
    filteredVideos.forEach(v => {
        const h = new Date(v.timestamp).getHours();
        hours[h].total++;
        if (v.person_found) hours[h].person++;
    });
    
    const max = Math.max(...hours.map(h => h.total), 1);
    
    hours.forEach(h => {
        const bar = document.createElement('div');
        bar.className = 'graph-bar' + (h.person > 0 ? ' has-person' : '');
        const heightPct = (h.total / max) * 100;
        bar.style.height = `${Math.max(heightPct, 2)}%`;
        bar.title = `${h.total} events (${h.person} persons)`;
        graph.appendChild(bar);
    });
}

// Lightbox Logic
const lightbox = document.getElementById('lightbox');
const lbVideo = document.getElementById('lightbox-video');
const lbImg = document.getElementById('lightbox-img');
const lbCanvas = document.getElementById('lightbox-canvas');
const lbTitle = document.getElementById('lightbox-title');
const lbDate = document.getElementById('lightbox-date');
const lbSize = document.getElementById('lightbox-size');
const lbDownload = document.getElementById('lightbox-download');
const lbTags = document.getElementById('lightbox-tags');
const snapshotContainer = document.getElementById('lightbox-snapshot-container');

function openLightbox(index) {
    currentVideoIndex = index;
    const video = filteredVideos[index];
    if (!video) return;
    
    // Setup metadata
    lbTitle.textContent = video.filename;
    lbDate.textContent = new Date(video.timestamp).toLocaleString();
    lbSize.textContent = (video.size / (1024*1024)).toFixed(2) + ' MB';
    lbDownload.href = video.url;
    lbDownload.download = video.filename;
    
    // Setup Video
    lbVideo.src = video.url;
    
    // Setup Snapshot and Canvas
    if (video.person_found && video.image_url) {
        snapshotContainer.classList.remove('hidden');
        lbImg.src = video.image_url;
        lbImg.onload = () => drawBoundingBoxes(video.bounding_boxes);
    } else {
        snapshotContainer.classList.add('hidden');
    }
    
    renderTags();
    updateNavButtons();
    
    lightbox.classList.remove('hidden');
    
    // Update URL parameter without reload
    const url = new URL(window.location);
    url.searchParams.set('play', video.filename);
    window.history.pushState({}, '', url);
}

function closeLightbox() {
    lightbox.classList.add('hidden');
    lbVideo.pause();
    lbVideo.src = '';
    
    const url = new URL(window.location);
    url.searchParams.delete('play');
    window.history.pushState({}, '', url);
}

function drawBoundingBoxes(boxes) {
    if (!boxes || boxes.length === 0 || !showHighlights) {
        const ctx = lbCanvas.getContext('2d');
        ctx.clearRect(0, 0, lbCanvas.width, lbCanvas.height);
        return;
    }
    
    const ctx = lbCanvas.getContext('2d');
    lbCanvas.width = lbImg.width;
    lbCanvas.height = lbImg.height;
    
    ctx.clearRect(0, 0, lbCanvas.width, lbCanvas.height);
    
    // The image displayed width/height might differ from natural width/height
    const scaleX = lbImg.width / lbImg.naturalWidth;
    const scaleY = lbImg.height / lbImg.naturalHeight;
    
    ctx.strokeStyle = '#00ff95';
    ctx.lineWidth = 3;
    
    boxes.forEach(box => {
        // Assuming box is [x1, y1, x2, y2]
        const [x1, y1, x2, y2] = box;
        const width = x2 - x1;
        const height = y2 - y1;
        
        ctx.strokeRect(x1 * scaleX, y1 * scaleY, width * scaleX, height * scaleY);
    });
}

function updateNavButtons() {
    document.getElementById('btn-prev-video').disabled = currentVideoIndex <= 0;
    document.getElementById('btn-next-video').disabled = currentVideoIndex >= filteredVideos.length - 1;
}

// Tagging
async function addTag(tag) {
    if (!tag) return;
    const video = filteredVideos[currentVideoIndex];
    if (!video.tags) video.tags = [];
    if (!video.tags.includes(tag)) {
        video.tags.push(tag);
        renderTags();
        // Save to backend
        await fetch('/api/tags', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ filename: video.filename, tags: video.tags })
        });
        
        // Find in main array and update
        const mainVid = videos.find(v => v.filename === video.filename);
        if (mainVid) mainVid.tags = video.tags;
        renderGrid(); // re-render grid to show new tag
    }
}

async function removeTag(tag) {
    const video = filteredVideos[currentVideoIndex];
    video.tags = video.tags.filter(t => t !== tag);
    renderTags();
    // Save to backend
    await fetch('/api/tags', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ filename: video.filename, tags: video.tags })
    });
    const mainVid = videos.find(v => v.filename === video.filename);
    if (mainVid) mainVid.tags = video.tags;
    renderGrid();
}

function renderTags() {
    const video = filteredVideos[currentVideoIndex];
    lbTags.innerHTML = '';
    if (video && video.tags) {
        video.tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.innerHTML = `${tag} <span class="tag-remove">&times;</span>`;
            span.querySelector('.tag-remove').addEventListener('click', () => removeTag(tag));
            lbTags.appendChild(span);
        });
    }
}

// Calendar Widget (Simplified Month View)
let currentCalDate = new Date();

function renderCalendar() {
    const calWidget = document.getElementById('calendar-widget');
    calWidget.innerHTML = `
        <div class="cal-header">
            <button class="cal-btn" id="cal-prev">&lt;</button>
            <span>${currentCalDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button class="cal-btn" id="cal-next">&gt;</button>
        </div>
        <div class="cal-grid">
            <div class="cal-day-label">Su</div><div class="cal-day-label">Mo</div>
            <div class="cal-day-label">Tu</div><div class="cal-day-label">We</div>
            <div class="cal-day-label">Th</div><div class="cal-day-label">Fr</div>
            <div class="cal-day-label">Sa</div>
        </div>
    `;
    
    const grid = calWidget.querySelector('.cal-grid');
    
    // Get first day of month and total days
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Pad empty days
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        div.className = 'cal-day disabled';
        grid.appendChild(div);
    }
    
    // Map videos by date string "YYYY-MM-DD"
    const dateMap = {};
    videos.forEach(v => {
        const dStr = new Date(v.timestamp).toISOString().split('T')[0];
        if (!dateMap[dStr]) dateMap[dStr] = { count: 0, person: false };
        dateMap[dStr].count++;
        if (v.person_found) dateMap[dStr].person = true;
    });
    
    // Fill days
    for (let i = 1; i <= daysInMonth; i++) {
        const div = document.createElement('div');
        div.className = 'cal-day';
        div.textContent = i;
        
        const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        if (selectedDates.has(dateStr)) {
            div.classList.add('active');
        }
        
        if (dateMap[dateStr]) {
            const dot = document.createElement('div');
            dot.className = 'cal-dot' + (dateMap[dateStr].person ? ' person' : '');
            div.appendChild(dot);
            
            div.addEventListener('click', () => {
                if (selectedDates.has(dateStr)) {
                    selectedDates.delete(dateStr);
                } else {
                    selectedDates.add(dateStr);
                }
                
                const clearDate = document.getElementById('btn-clear-date');
                const dateLabel = document.getElementById('date-filter-label');
                clearDate.classList.toggle('hidden', selectedDates.size === 0);
                
                if (selectedDates.size === 0) {
                    dateLabel.textContent = 'All Dates';
                } else if (selectedDates.size === 1) {
                    dateLabel.textContent = Array.from(selectedDates)[0];
                } else {
                    dateLabel.textContent = `${selectedDates.size} Days`;
                }
                
                applyFilters();
                renderCalendar();
            });
        } else {
            div.classList.add('disabled');
        }
        
        grid.appendChild(div);
    }
    
    document.getElementById('cal-prev').addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('cal-next').addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        renderCalendar();
    });
}


// Event Listeners Setup
function setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('arlo-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    themeToggle.addEventListener('click', () => {
        const curr = document.documentElement.getAttribute('data-theme');
        const next = curr === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('arlo-theme', next);
    });
    
    // Filters
    document.getElementById('btn-filter-all').addEventListener('click', (e) => {
        document.getElementById('btn-filter-all').classList.add('active');
        document.getElementById('btn-filter-person').classList.remove('active');
        currentFilter = 'all';
        applyFilters();
    });
    
    document.getElementById('btn-filter-person').addEventListener('click', (e) => {
        document.getElementById('btn-filter-person').classList.add('active');
        document.getElementById('btn-filter-all').classList.remove('active');
        currentFilter = 'person';
        applyFilters();
    });
    
    // Date filter
    const clearDate = document.getElementById('btn-clear-date');
    const dateLabel = document.getElementById('date-filter-label');
    
    clearDate.addEventListener('click', () => {
        selectedDates.clear();
        clearDate.classList.add('hidden');
        dateLabel.textContent = 'All Dates';
        applyFilters();
        renderCalendar();
    });
    
    // Highlights Toggle
    document.getElementById('toggle-highlights').addEventListener('change', (e) => {
        showHighlights = e.target.checked;
        renderGrid();
        if (!lightbox.classList.contains('hidden') && !snapshotContainer.classList.contains('hidden')) {
            const video = filteredVideos[currentVideoIndex];
            if (video) drawBoundingBoxes(video.bounding_boxes);
        }
    });
    
    // Search
    document.getElementById('search-filter').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        applyFilters();
    });
    
    // Refresh
    document.getElementById('btn-refresh-feed').addEventListener('click', async () => {
        banner.classList.add('hidden');
        await fetchVideos();
    });
    
    // Lightbox Controls
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox-close-overlay').addEventListener('click', closeLightbox);
    
    document.getElementById('btn-prev-video').addEventListener('click', () => {
        if (currentVideoIndex > 0) openLightbox(currentVideoIndex - 1);
    });
    
    document.getElementById('btn-next-video').addEventListener('click', () => {
        if (currentVideoIndex < filteredVideos.length - 1) openLightbox(currentVideoIndex + 1);
    });
    
    // Keyboard nav
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('hidden')) {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft' && currentVideoIndex > 0) openLightbox(currentVideoIndex - 1);
            if (e.key === 'ArrowRight' && currentVideoIndex < filteredVideos.length - 1) openLightbox(currentVideoIndex + 1);
        }
    });
    
    // Tags
    const tagInput = document.getElementById('tag-input');
    document.getElementById('btn-add-tag').addEventListener('click', () => {
        addTag(tagInput.value.trim());
        tagInput.value = '';
    });
    tagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTag(tagInput.value.trim());
            tagInput.value = '';
        }
    });
    
    document.querySelectorAll('.tag-suggestion').forEach(el => {
        el.addEventListener('click', () => addTag(el.textContent));
    });
    
    // Resize canvas on window resize
    window.addEventListener('resize', () => {
        if (!lightbox.classList.contains('hidden') && !snapshotContainer.classList.contains('hidden')) {
            const video = filteredVideos[currentVideoIndex];
            if (video) drawBoundingBoxes(video.bounding_boxes);
        }
    });
    
    // Delete
    document.getElementById('lightbox-delete').addEventListener('click', async () => {
        const video = filteredVideos[currentVideoIndex];
        if (confirm(`Are you sure you want to delete ${video.filename}? This cannot be undone.`)) {
            try {
                await fetch(`/api/video/${video.filename}`, { method: 'DELETE' });
                closeLightbox();
                await fetchVideos();
            } catch(e) {
                alert("Failed to delete video.");
            }
        }
    });
}

// Start
init();
