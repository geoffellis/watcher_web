const express = require('express');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const app = express();
const PORT = process.env.PORT || 3456;
const ARLO_DIR = process.env.ARLO_DIR || 'C:\\Users\\geoff\\Videos\\Arlo';
const JSONL_PATH = path.join(ARLO_DIR, 'processed_files.jsonl');
const TAGS_PATH = path.join(ARLO_DIR, 'tags.json');

app.use(express.json());
app.use(express.static('public'));
app.use('/videos', express.static(ARLO_DIR));

// SSE Setup
let clients = [];
const broadcast = (event, data) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => client.res.write(payload));
};

app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    clients.push({ id: Date.now(), res });
    
    req.on('close', () => {
        clients = clients.filter(client => client.res !== res);
    });
});

// File Watcher
const watcher = chokidar.watch(ARLO_DIR, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true
});

// Debounce broadcasts to avoid spamming the frontend
let debounceTimeout;
watcher.on('all', (event, filePath) => {
    if (filePath.endsWith('.mp4') || filePath.endsWith('.jpg') || filePath.endsWith('.jsonl')) {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            console.log(`[Watcher] Activity detected: ${event} on ${path.basename(filePath)}`);
            broadcast('update', { type: 'dir_update', timestamp: Date.now() });
        }, 500); // Wait 500ms before notifying
    }
});

// Helper to parse JSONL
const getProcessedFiles = () => {
    if (!fs.existsSync(JSONL_PATH)) return {};
    const lines = fs.readFileSync(JSONL_PATH, 'utf-8').split('\n').filter(Boolean);
    const result = {};
    for (const line of lines) {
        try {
            const data = JSON.parse(line);
            const filename = path.basename(data.filepath);
            result[filename] = data;
        } catch (e) {}
    }
    return result;
};

// Helper to get tags
const getTags = () => {
    if (!fs.existsSync(TAGS_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(TAGS_PATH, 'utf-8'));
    } catch (e) {
        return {};
    }
};

app.get('/api/videos', (req, res) => {
    let processed = {};
    try {
        processed = getProcessedFiles();
    } catch (e) {
        console.error("Error reading JSONL:", e);
    }
    
    const tags = getTags();
    
    let files = [];
    try {
        files = fs.readdirSync(ARLO_DIR);
    } catch(e) {
        return res.status(500).json({ error: "Could not read directory" });
    }
    
    const videos = files.filter(f => f.endsWith('.mp4'));
    
    const result = videos.map(video => {
        const procData = processed[video] || {};
        const videoPath = path.join(ARLO_DIR, video);
        let stat;
        try {
            stat = fs.statSync(videoPath);
        } catch(e) {
            stat = { mtime: new Date(), size: 0 };
        }
        
        // Parse date from arlo_YYYYMMDD_HHmmss.mp4
        let timestamp = stat.mtime;
        const match = video.match(/arlo_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.mp4/);
        if (match) {
            timestamp = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`);
        }
        
        return {
            filename: video,
            url: `/videos/${video}`,
            timestamp: timestamp.toISOString(),
            size: stat.size,
            person_found: procData.person_found || false,
            bounding_boxes: procData.bounding_boxes || [],
            image_name: procData.image_name || null,
            image_url: procData.image_name ? `/videos/${procData.image_name}` : null,
            tags: tags[video] || []
        };
    });
    
    // Sort newest first
    result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(result);
});

app.get('/api/tags', (req, res) => {
    res.json(getTags());
});

app.post('/api/tags', (req, res) => {
    const { filename, tags } = req.body;
    if (!filename || !Array.isArray(tags)) return res.status(400).send('Invalid data');
    
    const allTags = getTags();
    allTags[filename] = tags;
    fs.writeFileSync(TAGS_PATH, JSON.stringify(allTags, null, 2));
    res.json({ success: true });
});

app.delete('/api/video/:filename', (req, res) => {
    const filename = req.params.filename;
    const videoPath = path.join(ARLO_DIR, filename);
    
    if (!filename.endsWith('.mp4')) return res.status(400).send('Invalid filename');
    
    // Delete video
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    
    // Delete associated JPG if exists
    const basename = filename.replace('.mp4', '');
    const jpgPath = path.join(ARLO_DIR, `${basename}.jpg`);
    if (fs.existsSync(jpgPath)) fs.unlinkSync(jpgPath);
    
    // Remove from JSONL
    if (fs.existsSync(JSONL_PATH)) {
        let lines = fs.readFileSync(JSONL_PATH, 'utf-8').split('\n').filter(Boolean);
        lines = lines.filter(line => !line.includes(filename));
        fs.writeFileSync(JSONL_PATH, lines.join('\n') + '\n');
    }
    
    // Remove tags
    const allTags = getTags();
    if (allTags[filename]) {
        delete allTags[filename];
        fs.writeFileSync(TAGS_PATH, JSON.stringify(allTags, null, 2));
    }
    
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Arlo Watcher Server running at http://localhost:${PORT}`);
});
