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

echo
echo "Configuring MicroHost with:"
echo "  - Domain: $DOMAIN"
echo "  - Public HTTP Port: $HTTP_PORT"
echo "  - Internal API Port: $API_PORT"
if [ -n "$VT_API_KEY" ]; then
    echo "  - VirusTotal API: Enabled"
else
    echo "  - VirusTotal API: Disabled"
fi
echo

echo "Updating system and installing dependencies..."
sudo apt update && sudo apt upgrade -y
sudo apt install nginx php-fpm clamav clamav-daemon python3-pip python3-venv -y

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

    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:$PHP_FPM_SOCK;

        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
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
$( [ -n "$VT_API_KEY" ] && echo "Environment=VIRUSTOTAL_API_KEY=$VT_API_KEY" )
ExecStart=$REAL_HOME/microHost/venv/bin/uvicorn main:app --host 127.0.0.1 --port $API_PORT
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable microhost.service
sudo systemctl restart microhost.service

echo "Installation and configuration complete. API reverse-proxied through Nginx on http://$DOMAIN:$HTTP_PORT"