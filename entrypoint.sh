#!/bin/bash
set -e

# Setup variables with defaults
API_PORT="${API_PORT:-8000}"

# Normalize line endings in case supervisord.conf was copied with CRLF from Windows
sed -i 's/\r$//' /etc/supervisor/conf.d/supervisord.conf

# Configure Uvicorn port dynamically in Supervisord config
sed -i "s/--port 8000/--port $API_PORT/" /etc/supervisor/conf.d/supervisord.conf

# Initialize database directory permissions
mkdir -p /app/data
chown -R www-data:www-data /app/data /var/www/apps

# Ensure ClamAV directories are owned by clamav user/group
chown -R clamav:clamav /var/lib/clamav /var/run/clamav

# Initialize ClamAV databases if they don't exist
if [ ! -f /var/lib/clamav/main.cvd ]; then
    echo "ClamAV database not found. Downloading initial definitions (this may take a few minutes)..."
    freshclam || true
fi

# Start supervisord
echo "Starting Supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf

