# MicroHost

I needed a way to host small PHP scripts on a Raspberry Pi without giving them full system access or installing a massive, bloated control panel. MicroHost is what I ended up building.

It's an API-first hosting platform for PHP scripts, written in FastAPI.
Before a script is ever allowed to touch the server, MicroHost runs it through VirusTotal, scans it locally with ClamAV, and checks for dangerous PHP functions.

## What you need to run this

- Python 3.8+
- PHP-FPM
- ClamAV

## Getting it running

Clone the repo, and then:

1. Run the Installation Script:

```bash
bash install.sh

```

2. Install the required Python dependencies:

```bash
pip install -r requirements.txt

```
