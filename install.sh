#!/bin/bash

echo "Updating system and installing dependencies..."
sudo apt update && sudo apt upgrade -y
sudo apt install nginx php-fpm clamav clamav-darmon python3-pip python3-venv -y

echo "Configuring ClamAV Antivirus..."
sudo systemctl stop clamv-freshclam
sudo freshclam
sudo systemctl start clamv-freshclam
sudo systemctl enable clamv-freshclam
sudo systemctl enable clamv-daemon

echo "Setting up hosting directories and permissions..."
sudo mkdir -p /var/www/apps
sudo chown -R www-data:pi /var/www/apps
sudo chmod -R 755 /var/www/apps

echo "Setting up Python virtual environment and installing dependencies..."
mkdir ~/microHost && cd ~/microHost
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

echo "Configuring Nginx for PHP hosting..."

cat<< EOF | sudo tee /etc/nginx/sites-available/phphost
server {
    listen 80;
    server_name _;

    root /var/www/apps;
    autoindex off;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \.php${
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;

        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/phphost /etc/nginx/sites-enabled/phphost
sudo nginx -t
sudo systemctl restart nginx

echo "Creating Systemd service for FastAPI application..."
cat << EOF | sudo tee /etc/systemd/system/microhost.service
[Unit]
Description=MicroHost FastAPI Backend
After=network.target

[Service]
User=pi
Group=www-data
WorkingDirectory=/home/pi/microHost
ExecStart=/home/pi/microHost/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable microhost.service
sudo systemctl start microhost.service

echo "Installation and configuration complete. API running on port 8000"