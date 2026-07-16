# MicroHost

MicroHost is an API-first platform built with FastAPI that allows users to securely upload, manage, and host PHP scripts. It acts as a control plane for PHP deployments, handling authentication, file security scanning, rate limiting, and administrative telemetry.

The application is designed to be lightweight, making it suitable for low-resource environments, while maintaining strict security barriers before any script is executed.

## Core Features

* **Automated Security Pipeline**: Uploaded PHP files are automatically scanned using the VirusTotal API, local ClamAV daemon, and a static regex analyzer to block dangerous functions (e.g., `eval`, `shell_exec`).
* **Authentication**: Supports both JWT Bearer tokens for standard user sessions and static API Keys for programmatic deployment.
* **App Management**: Users can list, upload, and track their deployed scripts.
* **Admin Control Plane**: Administrators can suspend users, toggle script availability, and permanently delete accounts or applications.
* **Live Telemetry**: Real-time hardware monitoring (CPU, RAM, Disk) and active PHP-FPM worker tracing to monitor running scripts and resource consumption.

## Prerequisites

To run MicroHost, your server requires the following base components:

* Python 3.8 or higher
* PHP-FPM (configured to handle PHP execution for the upload directory)
* A web server (Nginx/Apache) configured to proxy requests to PHP-FPM for the script URLs
* ClamAV (specifically the `clamdscan` utility)

## Installation

1. Clone the repository and navigate to the project directory.
2. Run the installation script:
```bash
bash install.sh

```
3. Install the required Python dependencies:
```bash
pip install -r requirements.txt

```


4. Configure your environment variables. You can set these in your shell or use a `.env` file if you wrap the application with a tool like python-dotenv.
5. Start the application using Uvicorn:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000

```


*(Assuming your application file is named `main.py`)*

## Configuration

MicroHost relies on the following environment variables:

* `DOMAIN`: The base domain used to construct live URLs for the uploaded scripts (default: `YOUR_DOMAIN`).
* `VIRUSTOTAL_API_KEY`: Your VirusTotal API key. If omitted, the external scanning step is skipped.
* `SECRET_KEY`: Used for signing JWTs. If not provided, a random 32-byte hex string will be generated and saved to `.jwt_secret` in the database directory.
* `DATABASE_URL`: SQLAlchemy connection string. Defaults to a local SQLite database (`sqlite:///./test.db`).
* `UPLOAD_DIR`: The absolute path where PHP files will be stored. This directory should be served by your web server and PHP-FPM (default: `/var/www/apps`).

## API Overview

Once the server is running, you can access the interactive OpenAPI documentation by navigating to `/docs` or `/redoc` in your browser.

### Authentication & Users

* `POST /register`: Create a new user account (the first registered user automatically receives admin privileges).
* `POST /token`: Obtain a JWT Bearer token using username/email and password.
* `GET /users/me`: View current user profile.
* `PATCH /users/me`: Update email or password.
* `POST /api-keys`: Generate a permanent API key for programmatic script uploads.

### Application Management

* `POST /upload`: Upload a single `.php` file. The file passes through the security pipeline before being deployed to the `UPLOAD_DIR`.
* `GET /apps`: List all applications owned by the authenticated user.

### System & Admin

* `GET /health`: Basic service health check.
* `GET /server-status`: General system hardware metrics and PHP-FPM configuration status.
* `GET /admin/apps`: List all hosted apps across all users.
* `PATCH /admin/apps/{app_id}/status`: Enable or suspend an application. Suspended apps are renamed with a `.suspended` extension so the web server ignores them.
* `DELETE /admin/apps/{app_id}`: Permanently delete an application and its files.
* `GET /admin/users`: List all registered users.
* `PATCH /admin/users/{user_id}`: Modify user details, roles, or suspend their account (which cascades to suspend all their apps).
* `DELETE /admin/users/{user_id}`: Permanently delete a user and wipe all associated data.
* `GET /admin/php-workers`: Pull live telemetry from PHP-FPM (requires the PHP-FPM status page to be enabled and accessible at `http://localhost/status?json&full`).

## Security Note

MicroHost isolates applications by placing each uploaded `index.php` into a unique UUID-based directory. It is highly recommended to configure PHP-FPM with strict `open_basedir` restrictions per directory and aggressive resource limits to prevent one script from affecting others or reading sensitive system files.
