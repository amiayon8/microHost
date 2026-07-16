# MicroHost

I needed a way to host small PHP scripts on a Raspberry Pi without giving them full system access or installing a massive, bloated control panel. MicroHost is what I ended up building. 

It's an API-first control plane written in FastAPI. Instead of uploading files via FTP, you upload them through the API. Before a script is ever allowed to touch the server, MicroHost runs it through VirusTotal, scans it locally with ClamAV, and checks for dangerous PHP functions. 

It handles authentication, rate limiting, and lets you pull live hardware/execution telemetry to see what your PHP workers are actually doing.

## What you need to run this
This isn't a standalone web server. It's meant to sit alongside Nginx and PHP-FPM. You'll need:
- Python 3.8+
- PHP-FPM (configured to serve the directory where you store uploads)
- ClamAV installed on the host machine (the API uses `clamdscan` locally)

## Getting it running

Clone the repo down, and then follow this steps:

1. Run the Installation Script:
```bash
bash install.sh

```
2. Install the required Python dependencies:
```bash
pip install -r requirements.txt

```