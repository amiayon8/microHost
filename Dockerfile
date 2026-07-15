FROM python:3.11-slim-bookworm

# Set env variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UPLOAD_DIR=/var/www/apps
ENV DATABASE_URL=sqlite:////app/data/test.db

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    clamav \
    clamav-daemon \
    supervisor \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Create directory structures
RUN mkdir -p /app /app/data /var/www/apps /var/run/clamav \
    && chown -R www-data:www-data /var/www/apps \
    && chown -R clamav:clamav /var/run/clamav

# Install Python requirements
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy application files
COPY main.py /app/main.py
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

WORKDIR /app
EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
