#!/bin/bash
# Arlo Watcher - Ubuntu Installation Script

echo "--- Arlo Watcher Installation ---"

# 1. Check for NVM
if [ -z "$NVM_DIR" ]; then
    export NVM_DIR="$HOME/.nvm"
fi

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo "Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# 2. Setup Node
echo "Setting up Node.js..."
nvm install --lts
nvm use --lts

# 3. Install NPM dependencies
echo "Installing dependencies..."
npm install

# 4. Configure .env if not exists
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "!!! PLEASE EDIT .env to set your ARLO_DIR path !!!"
fi

# 5. Create Systemd Service File
echo "Creating systemd service file..."
APP_DIR=$(pwd)
NODE_PATH=$(which node)
USER_NAME=$(whoami)

cat <<EOF > watcher-web.service
[Unit]
Description=Arlo Watcher Web App Service
After=network.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$NODE_PATH server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

echo "--- Installation Complete ---"
echo "Next steps:"
echo "1. Edit .env to set ARLO_DIR"
echo "2. Run: sudo cp watcher-web.service /etc/systemd/system/"
echo "3. Run: sudo systemctl daemon-reload"
echo "4. Run: sudo systemctl enable watcher-web"
echo "5. Run: sudo systemctl start watcher-web"
