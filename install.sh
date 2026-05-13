#!/bin/bash

# Watcher - Automated Hardened Linux Installation Script
# Aligned with TrackerNexus standards for security and manageability.

set -e

INSTALL_DIR="/opt/watcher"
APP_USER="watcher"
REQUIRED_NODE="20.0.0" # Minimum LTS

echo "🚀 Starting Watcher Installation (Hardened)..."

# ─── 1. Prerequisites ────────────────────────────────────────────────────────

if ! command -v node &> /dev/null; then
    # Try to load NVM if it exists
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        \. "$HOME/.nvm/nvm.sh"
    fi
fi

if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed."
    echo "   Please install it via NVM: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
    exit 1
fi

NODE_BIN=$(which node)
NPM_BIN=$(which npm)
echo "✅ Node.js $(node -v) OK ($NODE_BIN)"

# ─── 2. Stop Service (if running) ────────────────────────────────────────────

if systemctl is-active --quiet watcher 2>/dev/null; then
    echo "🛑 Stopping running watcher service..."
    sudo systemctl stop watcher
fi

# ─── 3. Deploy to Production Directory ───────────────────────────────────────

echo "📂 Deploying to $INSTALL_DIR..."
sudo mkdir -p "$INSTALL_DIR"

# rsync is safer than cp -r
if command -v rsync &> /dev/null; then
    sudo rsync -a --exclude='.git' \
                  --exclude='node_modules' \
                  --exclude='.env' \
                  ./ "$INSTALL_DIR/"
else
    sudo cp -r . "$INSTALL_DIR/"
fi

# ─── 4. Create Service User ───────────────────────────────────────────────────

if ! id "$APP_USER" &>/dev/null; then
    echo "👤 Creating '$APP_USER' system user..."
    sudo useradd -r -s /bin/false "$APP_USER"
else
    echo "👤 User '$APP_USER' already exists."
fi

# ─── 5. Python Virtual Environment ───────────────────────────────────────────
# Even if python isn't in the web repo, the user requested a venv for related processes.

if command -v python3 &> /dev/null; then
    echo "🐍 Setting up Python Virtual Environment in $INSTALL_DIR/venv..."
    cd "$INSTALL_DIR"
    sudo python3 -m venv venv
    echo "✅ Python venv ready"
else
    echo "⚠️  Python3 not found, skipping venv creation."
fi

# ─── 6. Node Dependencies ───────────────────────────────────────────────────

echo "📦 Installing Node dependencies..."
cd "$INSTALL_DIR"
sudo env PATH="$PATH" "$NPM_BIN" install --quiet
echo "✅ Node dependencies ready"

# ─── 7. Environment Setup ─────────────────────────────────────────────────────

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo "🔑 Creating .env from example..."
    sudo cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    sudo chmod 600 "$INSTALL_DIR/.env"
    echo "⚠️  REMEMBER: Edit $INSTALL_DIR/.env with your ARLO_DIR path!"
else
    echo "✅ Existing .env preserved."
fi

# ─── 8. Permissions ──────────────────────────────────────────────────────────

echo "🔒 Setting file permissions..."
sudo chown -R $APP_USER:$APP_USER "$INSTALL_DIR"
# The watcher user needs write access to tags.json if it exists
if [ -f "$INSTALL_DIR/tags.json" ]; then
    sudo chmod 664 "$INSTALL_DIR/tags.json"
fi

# ─── 9. Systemd Service ───────────────────────────────────────────────────────

echo "⚙️  Installing systemd service..."
SERVICE_FILE="/etc/systemd/system/watcher.service"

sudo cat <<EOF > watcher.service
[Unit]
Description=Watcher Web Dashboard
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$NODE_BIN server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo mv watcher.service "$SERVICE_FILE"
sudo systemctl daemon-reload
sudo systemctl enable watcher

# ─── Done ────────────────────────────────────────────────────────────────────

echo ""
echo "✨ Installation Complete!"
echo "--------------------------------------------------------"
echo "Next Steps:"
echo "1. sudo nano $INSTALL_DIR/.env  (Set your ARLO_DIR)"
echo "2. sudo systemctl start watcher"
echo "3. sudo systemctl status watcher"
echo "--------------------------------------------------------"
