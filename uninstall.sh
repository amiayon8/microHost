#!/bin/bash

set -e

if [ "$SUDO_USER" ]; then
    REAL_USER="$SUDO_USER"
else
    REAL_USER="$USER"
fi

REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)

echo "Stopping MicroHost service..."

sudo systemctl stop microhost.service 2>/dev/null || true
sudo systemctl disable microhost.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/microhost.service
sudo systemctl daemon-reload
sudo systemctl reset-failed

echo "Removing MicroHost files..."
rm -rf "$REAL_HOME/microHost"

echo "Removing hosted applications..."
sudo rm -rf /var/www/apps

echo "Removing Nginx configuration..."
sudo rm -f /etc/nginx/sites-enabled/phphost
sudo rm -f /etc/nginx/sites-available/phphost

if [ -f /etc/nginx/sites-available/default ]; then
    sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
fi

echo "Restoring PHP-FPM configuration..."

sudo sed -i \
's/^pm.status_path = \/status/;pm.status_path = \/status/' \
/etc/php/*/fpm/pool.d/www.conf 2>/dev/null || true

PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null || true)

if [ -n "$PHP_VERSION" ]; then
    sudo systemctl restart "php${PHP_VERSION}-fpm" 2>/dev/null || true
fi

echo "Reloading Nginx..."
sudo nginx -t && sudo systemctl restart nginx || true

if [[ "$1" == "--purge" ]]; then
    echo "Purging installed packages..."

    sudo apt purge -y \
        nginx \
        php-fpm \
        clamav \
        clamav-daemon \
        python3-pip \
        python3-venv

    sudo apt autoremove -y
fi

echo
echo "MicroHost has been uninstalled successfully."

if [[ "$1" == "--purge" ]]; then
    echo "Packages have also been removed."
else
    echo "Installed packages were kept."
    echo "Run './uninstall.sh --purge' to remove them as well."
fi