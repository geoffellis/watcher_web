#!/bin/bash

# Watcher - Automated Update Script
# Aligned with hardened /opt installation standards.

set -e

INSTALL_DIR="/opt/watcher"
APP_USER="watcher"

if [ "$PWD" != "$INSTALL_DIR" ]; then
    echo "⚠️  Moving to $INSTALL_DIR..."
    cd "$INSTALL_DIR"
fi

# Capture absolute path to npm
NPM_BIN=$(which npm)
echo "✅ Node.js $(node -v) OK ($NPM_BIN)"

echo "🔄 Pulling latest changes from Git..."
sudo git pull

# 1. Update Node Dependencies
echo "📦 Syncing Node dependencies..."
sudo env PATH="$PATH" "$NPM_BIN" install --quiet

# 2. Update Python venv (if exists)
if [ -d "venv" ]; then
    echo "🐍 Refreshing Python venv..."
    # Placeholder for requirements if you add them later
    # sudo ./venv/bin/pip install -r requirements.txt
fi

# 3. Finalize Permissions
echo "🔒 Refreshing permissions..."
sudo chown -R $APP_USER:$APP_USER "$INSTALL_DIR"
if [ -f "tags.json" ]; then
    sudo chmod 664 "tags.json"
fi

# 4. Restart the Service
echo "♻️  Restarting Watcher service..."
sudo systemctl restart watcher

echo ""
echo "✨ Update Complete! Watcher is now running the latest version."
echo "--------------------------------------------------------"
echo "Status: $(sudo systemctl is-active watcher)"
echo "--------------------------------------------------------"
