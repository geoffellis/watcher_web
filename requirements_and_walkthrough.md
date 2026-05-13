# Watcher Web App - Ongoing Requirements & Walkthrough

This document serves as the official record of features, architecture, and change history for the Watcher Web App.

## 🎯 Project Overview
A self-hosted, real-time video monitoring dashboard for security camera footage. It integrates with an external person-detection service to highlight events and provide a premium user experience.

---

## 📋 Ongoing Requirements

### 🎨 User Interface
- **Feed**: Grid of video cards with dynamic thumbnails.
- **Filtering**:
    - Filter by Event Type (All vs. Person Detected).
    - Multi-day selection via interactive sidebar calendar.
    - Full-text search (filenames and tags).
- **Video Player**: High-performance lightbox with metadata display.
- **Aesthetics**: Premium dark mode (default) with light mode toggle. Mobile-responsive design.
- **Smart Icons**:
    - General person detections show a **green person icon**.
    - Clips tagged as **"family"** show a **red heart/family icon**.
- **Flexible Grid**: 
    - **Toggle**: Users can switch between **Small** (high density) and **Large** (featured) card sizes via a grid icon in the header.
    - **Intelligent Defaults**: Defaults to Small on desktop/web and Large on mobile devices.
- **Compact View**: Tags are overlaid on the bottom-right of video cards to reduce card height and maximize density.

### 🧠 Features
- **Real-Time Sync**: Server-Sent Events (SSE) push updates instantly when new files are detected in the directory.
- **Dynamic Thumbnails**: Automatically extracts frames from video files if no ML-generated snapshot exists.
- **Scene Highlights**: (Formerly "Bounding Boxes") Visual overlays on snapshots showing detected persons.
    - **Toggle**: Users can toggle "Highlights" on/off via a global switch.
- **Tagging**: Persistent tagging system stored in `tags.json` for integration with future ML pipelines.
- **Calendar & Analytics**: 
    - Sidebar calendar showing event density.
    - Hourly activity histogram with person-detection color coding.

### 🛠️ Backend & Deployment
- **Stack**: Node.js, Express, Chokidar (file watching).
- **Storage**: Flat-file based (`processed_files.jsonl`, `tags.json`).
- **Linux Deployment**:
    - Managed via `nvm` (Node Version Manager).
    - Background persistence via `systemd` service.
    - Automated `install.sh` and `update.sh` scripts.

---

## 🌟 Change Log & Walkthrough

### Phase 2: UI Refinement & Deployment (Current)
- [x] **Branding**: Renamed the application to **Watcher**.
- [x] **Smart Badges**: Added heart icon logic for "family" tagged clips.
- [x] **Card Optimization**: Moved tags to thumbnail overlay and reduced card detail padding.
- [x] **Highlights Toggle**: Added "Show Highlights" switch to toggle detection overlays.
- [x] **Flexible Grid**: Implemented card size toggle with responsive defaults (Small/Desktop, Large/Mobile).
- [x] **Linux Tooling**: Created Ubuntu deployment scripts (`install.sh`, `update.sh`, and systemd template).
- [x] **Env Support**: Modified server to use `ARLO_DIR` environment variables.

### Phase 1: Core Functionality
- [x] **Real-Time Sync**: Implemented SSE and file watching.
- [x] **Video Grid**: High-density feed with dynamic thumbnails.
- [x] **Lightbox**: Feature-rich player with bounding box canvas.
- [x] **Multi-Day Select**: Calendar widget allowing multiple dates.
- [x] **Tagging & Actions**: Integrated tag CRUD and file deletion.

---

## 🚀 How to Access & Deploy

### Local Development
- Run: `node server.js`
- Visit: `http://localhost:3456`

### Ubuntu Deployment
1. Push code to your Linux server.
2. Run `./install.sh`.
3. Edit `.env` to set your `ARLO_DIR`.
4. Follow the instructions to start the `watcher-web` systemd service.
