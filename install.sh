#!/bin/bash

if [ "$SUDO_USER" ]; then
    REAL_USER="$SUDO_USER"
else
    REAL_USER="$USER"
fi
REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "=== MicroHost Configuration ==="
read -p "Enter the Domain name for MicroHost [default: localhost]: " DOMAIN
DOMAIN=${DOMAIN:-localhost}

read -p "Enter the public HTTP port for Nginx [default: 80]: " HTTP_PORT
HTTP_PORT=${HTTP_PORT:-80}

read -p "Enter the internal FastAPI port [default: 8000]: " API_PORT
API_PORT=${API_PORT:-8000}

read -p "Enter your VirusTotal API Key (optional): " VT_API_KEY

DEFAULT_SERVER_URL="http://$DOMAIN"
if [ "$HTTP_PORT" != "80" ]; then
    DEFAULT_SERVER_URL="http://$DOMAIN:$HTTP_PORT"
fi
read -p "Enter the Server URL [default: $DEFAULT_SERVER_URL]: " SERVER_URL
SERVER_URL=${SERVER_URL:-$DEFAULT_SERVER_URL}

read -p "Do you want to install and deploy the Next.js frontend? [y/N]: " INSTALL_FRONTEND
INSTALL_FRONTEND=${INSTALL_FRONTEND:-n}

echo
echo "Configuring MicroHost with:"
echo "  - Domain: $DOMAIN"
echo "  - Public HTTP Port: $HTTP_PORT"
echo "  - Internal API Port: $API_PORT"
echo "  - Server URL: $SERVER_URL"
if [ -n "$VT_API_KEY" ]; then
    echo "  - VirusTotal API: Enabled"
else
    echo "  - VirusTotal API: Disabled"
fi
if [[ "$INSTALL_FRONTEND" =~ ^[yY](es)?$ ]]; then
    echo "  - Install Frontend: Yes"
else
    echo "  - Install Frontend: No"
fi
echo

echo "Updating system and installing dependencies..."
sudo apt update && sudo apt upgrade -y
INSTALL_PACKAGES="nginx php-fpm clamav clamav-daemon python3-pip python3-venv"
if [[ "$INSTALL_FRONTEND" =~ ^[yY](es)?$ ]]; then
    INSTALL_PACKAGES="$INSTALL_PACKAGES nodejs npm"
fi
sudo apt install $INSTALL_PACKAGES -y

echo "Configuring ClamAV Antivirus..."
sudo systemctl stop clamav-freshclam
sudo freshclam
sudo systemctl start clamav-freshclam
sudo systemctl enable clamav-freshclam
sudo systemctl enable clamav-daemon
sudo systemctl start clamav-daemon

echo "Setting up hosting directories and permissions..."
sudo mkdir -p /var/www/apps
sudo chown -R www-data:$REAL_USER /var/www/apps
sudo chmod -R 755 /var/www/apps

echo "Setting up Python virtual environment and copying files..."
mkdir -p "$REAL_HOME/microHost"
cp "$SCRIPT_DIR/main.py" "$REAL_HOME/microHost/"
cp "$SCRIPT_DIR/requirements.txt" "$REAL_HOME/microHost/"

cd "$REAL_HOME/microHost"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

if [[ "$INSTALL_FRONTEND" =~ ^[yY](es)?$ ]]; then
    echo "Copying frontend files..."
    rm -rf "$REAL_HOME/microHost/microhost-frontend"
    cp -r "$SCRIPT_DIR/microhost-frontend" "$REAL_HOME/microHost/"
    rm -rf "$REAL_HOME/microHost/microhost-frontend/node_modules"
    rm -rf "$REAL_HOME/microHost/microhost-frontend/.next"
    
    echo "Installing frontend dependencies and building Next.js application..."
    cd "$REAL_HOME/microHost/microhost-frontend"
    export NEXT_PUBLIC_API_URL="$SERVER_URL"
    npm install
    npm run build
fi

PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
echo "Detected PHP Version: $PHP_VERSION"
PHP_FPM_SOCK="/var/run/php/php${PHP_VERSION}-fpm.sock"

echo "Configuring PHP-FPM status page..."
sudo sed -i 's/;pm.status_path = \/status/pm.status_path = \/status/' /etc/php/*/fpm/pool.d/www.conf
sudo systemctl restart "php${PHP_VERSION}-fpm"

echo "Configuring Nginx for PHP hosting..."
cat << EOF | sudo tee /etc/nginx/sites-available/phphost
server {
    listen $HTTP_PORT;
    server_name $DOMAIN;

    root /var/www/apps;
    autoindex off;

    client_header_buffer_size 64k;
    large_client_header_buffers 4 64k;
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location ~ ^/(status|ping)\$ {
        allow 127.0.0.1;
        deny all;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_pass unix:$PHP_FPM_SOCK;
    }

    location ~ ^/([a-zA-Z0-9\-]+)/.*\.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:$PHP_FPM_SOCK;

        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_param PHP_ADMIN_VALUE "open_basedir=/var/www/apps/\$1/:/tmp/";
        include fastcgi_params;
    }

    location ~ \.php\$ {
        deny all;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/phphost /etc/nginx/sites-enabled/phphost
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "Creating Systemd service for FastAPI application..."
sudo tee /etc/systemd/system/microhost.service > /dev/null << EOF
[Unit]
Description=MicroHost FastAPI Backend
After=network.target

[Service]
User=$REAL_USER
Group=www-data
WorkingDirectory=$REAL_HOME/microHost
Environment=DOMAIN=$DOMAIN
Environment=SERVER_URL=$SERVER_URL
Environment=CONSOLE_URL=http://$DOMAIN:3000
$( [ -n "$VT_API_KEY" ] && echo "Environment=VIRUSTOTAL_API_KEY=$VT_API_KEY" )
ExecStart=$REAL_HOME/microHost/venv/bin/uvicorn main:app --host 127.0.0.1 --port $API_PORT
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable microhost.service
sudo systemctl restart microhost.service

if [[ "$INSTALL_FRONTEND" =~ ^[yY](es)?$ ]]; then
    echo "Creating Systemd service for Next.js frontend..."
    NPM_PATH=$(command -v npm)
    sudo tee /etc/systemd/system/microhost-frontend.service > /dev/null << EOF
[Unit]
Description=MicroHost Next.js Frontend
After=network.target

[Service]
User=$REAL_USER
WorkingDirectory=$REAL_HOME/microHost/microhost-frontend
Environment=NEXT_PUBLIC_API_URL=$SERVER_URL
Environment=PORT=3000
ExecStart=$NPM_PATH start
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable microhost-frontend.service
    sudo systemctl restart microhost-frontend.service
    echo "Installation and configuration complete. API reverse-proxied through Nginx on http://$DOMAIN:$HTTP_PORT, Frontend running at http://$DOMAIN:3000"
else
    echo "Installation and configuration complete. API reverse-proxied through Nginx on http://$DOMAIN:$HTTP_PORT"
fi