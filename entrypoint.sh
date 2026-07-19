#!/bin/bash
set -e

API_PORT="${API_PORT:-8000}"
DOMAIN="${DOMAIN:-localhost}"

if [ "$API_PORT" = "80" ]; then
    echo "API_PORT is set to 80, which conflicts with Nginx. Using internal port 8000 for FastAPI."
    INTERNAL_API_PORT="8000"
else
    INTERNAL_API_PORT="$API_PORT"
fi

sed -i 's/\r$//' /etc/supervisor/conf.d/microhost.conf

sed -i "s/--port 8000/--port $INTERNAL_API_PORT/" /etc/supervisor/conf.d/microhost.conf

PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
echo "Detected PHP Version: $PHP_VERSION"
PHP_FPM_SOCK="/var/run/php/php${PHP_VERSION}-fpm.sock"

mkdir -p /app/data /var/www/apps /var/run/php /var/run/nginx /var/log/nginx
chown -R www-data:www-data /app/data /var/www/apps /var/run/php /var/run/nginx /var/log/nginx

chown -R clamav:clamav /var/lib/clamav /var/run/clamav

sed -i 's/;pm.status_path = \/status/pm.status_path = \/status/' /etc/php/*/fpm/pool.d/www.conf

cat << EOF > /etc/nginx/sites-available/phphost
server {
    listen 80;
    server_name $DOMAIN;

    root /var/www/apps;
    autoindex off;

    client_header_buffer_size 64k;
    large_client_header_buffers 4 64k;
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:$INTERNAL_API_PORT;
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

ln -sf /etc/nginx/sites-available/phphost /etc/nginx/sites-enabled/phphost
rm -f /etc/nginx/sites-enabled/default

if [ ! -f /var/lib/clamav/main.cvd ]; then
    echo "ClamAV database not found. Downloading initial definitions (this may take a few definitions)..."
    freshclam || true
fi

echo "Starting Supervisord..."
echo "--- DEBUG: microhost.conf content ---"
cat /etc/supervisor/conf.d/microhost.conf
echo "--- DEBUG: END ---"
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
