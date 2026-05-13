#!/bin/bash
# Arlo Watcher - Update Script

echo "--- Updating Arlo Watcher ---"

# 1. Pull latest from git
echo "Pulling latest changes..."
git pull

# 2. Setup Node environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use --lts

# 3. Update dependencies
echo "Updating dependencies..."
npm install

# 4. Restart service
echo "Restarting service..."
sudo systemctl restart watcher-web

echo "--- Update Complete ---"
sudo systemctl status watcher-web --no-pager
