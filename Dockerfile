FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UPLOAD_DIR=/var/www/apps
ENV DATABASE_URL=sqlite:////app/data/test.db

RUN apt-get update && apt-get install -y --no-install-recommends \
    clamav \
    clamav-daemon \
    supervisor \
    procps \
    nginx \
    php-fpm \
    php-cli \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app /app/data /var/www/apps /var/run/clamav \
    && chown -R www-data:www-data /var/www/apps \
    && chown -R clamav:clamav /var/run/clamav

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY main.py /app/main.py
COPY supervisord.conf /etc/supervisor/conf.d/microhost.conf
COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

WORKDIR /app
EXPOSE 80 8000

VOLUME ["/app/data", "/var/www/apps", "/var/lib/clamav"]

ENTRYPOINT ["/app/entrypoint.sh"]
