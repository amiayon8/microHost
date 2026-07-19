import os
import uuid
import shutil
import subprocess
import re
import hashlib
import psutil
import secrets
from datetime import datetime, timedelta
from typing import List, Optional
import httpx
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request, status, Security
from fastapi.responses import HTMLResponse
from fastapi.openapi.utils import get_openapi
from fastapi.security import APIKeyHeader, OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# ================== Configuration ==================
VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY", "")
DOMAIN = os.getenv("DOMAIN", "YOUR_DOMAIN")
SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY:
    db_url = os.getenv("DATABASE_URL", "sqlite:///./test.db")
    if db_url.startswith("sqlite:///"):
        db_path = db_url.replace("sqlite:///", "")
        db_dir = os.path.dirname(db_path) or "."
    else:
        db_dir = "."
    secret_file = os.path.join(db_dir, ".jwt_secret")
    if os.path.exists(secret_file):
        try:
            with open(secret_file, "r", encoding="utf-8") as f:
                SECRET_KEY = f.read().strip()
        except Exception:
            pass
    if not SECRET_KEY:
        SECRET_KEY = secrets.token_hex(32)
        try:
            os.makedirs(db_dir, exist_ok=True)
            with open(secret_file, "w", encoding="utf-8") as f:
                f.write(SECRET_KEY)
        except Exception:
            pass

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/var/www/apps")



# === DATABASE ===
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# === Rate Limiter ===
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="MicroHost API", description="MicroHost API for hosting PHP Scripts", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=False)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="MicroHost API",
        version="1.0.0",
        description="API for managing PHP applications securely.",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"]["APIKeyHeader"] = {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-KEY"
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# === Security ===
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = HTTPBearer(auto_error=False)

# ================== Database Models ==================
class DBUser(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    apps = relationship("DBApp", back_populates="owner")
    api_keys = relationship("DBAPIKey", back_populates="owner")

class DBApp(Base):
    __tablename__ = "apps"
    id = Column(String, primary_key=True, index=True)
    filename = Column(String, unique=True, index=True)
    url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("DBUser", back_populates="apps")
    is_active = Column(Boolean, default=True)

class DBAPIKey(Base):
    __tablename__ = "api_keys"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("DBUser", back_populates="api_keys")

class UserUpdateAdmin(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    
class UserUpdateSelf(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    
class AppStatusUpdate(BaseModel):
    is_active: bool

Base.metadata.create_all(bind=engine)

# ================== Pydantic Models ==================
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class AppResponse(BaseModel):
    id: str
    filename: str
    url: str
    created_at: datetime
    is_active: bool
    class Config:
        orm_mode = True
        from_attributes = True
        
class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[EmailStr] = None
    created_at: datetime
    is_admin: bool
    is_active: bool
    
    class Config:
        orm_mode = True
        from_attributes = True

# ================== Utility Functions ==================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token_auth: Optional[HTTPAuthorizationCredentials] = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token_auth:
        raise credentials_exception
    token = token_auth.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(DBUser).filter(DBUser.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been blocked. Please contact support.")
    return user

async def authenticate_api_key(
    api_key: Optional[str] = Security(api_key_header),
    token_auth: Optional[HTTPAuthorizationCredentials] = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
):
    if api_key:
        db_api_key = db.query(DBAPIKey).filter(DBAPIKey.key == api_key).first()
        if db_api_key:
            owner = db_api_key.owner
            if not owner.is_active:
                raise HTTPException(status_code=403, detail="Your account has been blocked. Please contact support.")
            return owner
        raise HTTPException(status_code=401, detail="Invalid API key")

    if token_auth:
        return get_current_user(token_auth, db)
        
    raise HTTPException(status_code=401, detail="Not authenticated. Provide an X-API-KEY header or Bearer token.")

def get_admin_user(current_user: DBUser = Depends(authenticate_api_key)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user

# ================== Security Scanner ==================
async def check_virustotal(file_hash: str) -> bool:
    if not VIRUSTOTAL_API_KEY:
        print("VirusTotal API key not set. Skipping security scan.")
        return True
    url = f"https://www.virustotal.com/api/v3/files/{file_hash}"
    headers = {"x-apikey": VIRUSTOTAL_API_KEY}
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {}).get("malicious", 0) > 0:
                print(f"File {file_hash} is flagged as malicious.")
                return False
            return True
        else:
            print(f"VirusTotal API error: {response.status_code} - {response.text}")
            return True
        
def scan_with_clamav(file_path: str) -> bool:
    try:
        result = subprocess.run(['clamdscan', '--no-summary', file_path], capture_output=True, text=True)
        if result.returncode == 0:
            return True
        elif result.returncode == 1:
            print(f"ClamAV flagged file {file_path} as malicious.")
            return False
        else:
            print(f"ClamAV scan failed with exit code {result.returncode}. Skipping local malware scan.")
            return True
    except FileNotFoundError:
        print("ClamAV (clamdscan) is not installed. Skipping local malware scan.")
        return True
    except Exception as e:
        print(f"Error running ClamAV scan: {e}. Skipping local malware scan.")
        return True
    
def check_static_vulnerabilities(file_path: str) -> bool:
    blocked_functions = [r"\beval\s*\(", r"\bsystem\s*\(", r"\bshell_exec\s*\(", r"\bpassthru\s*\("]
    vuln_regex = re.compile("|".join(blocked_functions), re.IGNORECASE)
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            if vuln_regex.search(f.read()):
                return False
        return True
    except Exception:
        return False
    
# ================== API Endpoints ==================

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def get_home_page():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MicroHost API</title>
    <style>
        :root {
            --bg: #e5e5f7;
            --text: #111111;
            --accent: #ff4757;
            --box-border: 3px solid #111111;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Courier New', Courier, monospace;
            background-color: var(--bg);
            background-image: radial-gradient(#111 1px, transparent 1px);
            background-size: 20px 20px;
            color: var(--text);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 2rem;
        }

        .container {
            background: white;
            border: var(--box-border);
            box-shadow: 8px 8px 0px var(--text);
            max-width: 700px;
            width: 100%;
            padding: 2.5rem;
        }

        .header {
            border-bottom: var(--box-border);
            padding-bottom: 1.5rem;
            margin-bottom: 1.5rem;
        }

        h1 {
            font-size: 2.5rem;
            text-transform: uppercase;
            letter-spacing: -2px;
            margin-bottom: 0.5rem;
        }

        .subtitle {
            font-size: 1rem;
            font-weight: bold;
            background: var(--text);
            color: white;
            display: inline-block;
            padding: 0.2rem 0.5rem;
        }

        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .feature {
            border: var(--box-border);
            padding: 1rem;
            background: #f1f2f6;
        }

        .feature h3 {
            font-size: 1.1rem;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
        }

        .feature p {
            font-size: 0.9rem;
            line-height: 1.4;
        }

        .actions {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .btn {
            border: var(--box-border);
            padding: 0.8rem 1.5rem;
            font-weight: bold;
            text-decoration: none;
            color: var(--text);
            background: white;
            box-shadow: 4px 4px 0px var(--text);
            transition: all 0.1s;
            text-transform: uppercase;
        }

        .btn.primary {
            background: var(--accent);
            color: white;
        }

        .btn:hover {
            transform: translate(4px, 4px);
            box-shadow: 0px 0px 0px var(--text);
        }

        .footer {
            margin-top: 2rem;
            font-size: 0.8rem;
            font-weight: bold;
            text-align: center;
        }

        @media (max-width: 600px) {
            .grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>MicroHost</h1>
            <div class="subtitle">API-First PHP Execution Engine</div>
        </div>
        
        <p style="margin-bottom: 2rem; line-height: 1.5;">
            A lightweight, highly secure hosting wrapper. It proxies requests via FastAPI, 
            scans files on upload, and runs PHP processes in isolated environments. 
            Built specifically to run safely on low-power nodes like a Raspberry Pi.
        </p>

        <div class="grid">
            <div class="feature">
                <h3>Malware Defense</h3>
                <p>Uploads hit a wall. Everything is checked against VirusTotal, local ClamAV, and static regex to block dangerous execution functions.</p>
            </div>
            <div class="feature">
                <h3>Hardware Friendly</h3>
                <p>No heavy control panels. Minimal RAM usage means you can run this on cheap hardware without the system choking.</p>
            </div>
            <div class="feature">
                <h3>Headless API</h3>
                <p>Deploy, suspend, or nuke apps via token-authenticated endpoints. Perfect for CLI tools or automated pipelines.</p>
            </div>
            <div class="feature">
                <h3>FPM Telemetry</h3>
                <p>Pull live process data. See exactly which scripts are eating your CPU and memory in real-time.</p>
            </div>
        </div>

        <div class="actions">
            <a href="/docs" class="btn primary">View API Docs</a>
            <a href="https://github.com/amiayon8/microHost" class="btn">GitHub Repo</a>
        </div>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content, status_code=200)

@app.post("/register", status_code=status.HTTP_201_CREATED, tags=["Authentication"], summary="Register a new user account")
@limiter.limit("5/minute")
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    if db.query(DBUser).filter(DBUser.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(DBUser).filter(DBUser.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    is_first_user = db.query(DBUser).count() == 0
    hashed_password = pwd_context.hash(user.password)
    db_user = DBUser(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        is_admin=is_first_user
    )
    db.add(db_user)
    db.commit()
    return {"status": "success", "message": "User created successfully"}

@app.post("/token", tags=["Authentication"], summary="Authenticate user and generate Bearer JWT token")
@limiter.limit("10/minute")
def login_for_access_token(
    request: Request, 
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    login_str = form_data.username.lower()

    user = db.query(DBUser).filter(
        (func.lower(DBUser.username) == login_str) | 
        (func.lower(DBUser.email) == login_str)
    ).first()

    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username, email, or password")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been blocked. Please contact support.")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse, tags=["Users"], summary="Get profile details of the current authenticated user")
@limiter.limit("10/minute")
def get_current_user_profile(
    request: Request,
    current_user: DBUser = Depends(get_current_user)
):
    return current_user

@app.patch("/users/me", tags=["Users"], summary="Update profile details (email, password) of the current authenticated user")
@limiter.limit("10/minute")
def update_user(
    request: Request,
    user_update: UserUpdateSelf,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_update.email:
        if db.query(DBUser).filter(DBUser.email == user_update.email, DBUser.id != current_user.id).first():
            raise HTTPException(status_code=400, detail="Email already taken")
        current_user.email = user_update.email
    if user_update.password:
        current_user.hashed_password = pwd_context.hash(user_update.password)
    db.commit()
    return {"status": "success", "message": "User updated successfully"}

@app.post("/api-keys", tags=["API Keys"], summary="Generate a new API Key for app uploads")
@limiter.limit("5/minute")
def create_api_key(
    request: Request, 
    current_user: DBUser = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    new_key = str(uuid.uuid4())
    db_api_key = DBAPIKey(key=new_key, owner_id=current_user.id)
    db.add(db_api_key)
    db.commit()
    return {"api_key": new_key}

@app.post("/upload", response_model=AppResponse, tags=["PHP Apps"], summary="Upload and scan a new PHP application script")
@limiter.limit("10/minute")
async def upload_app(
    request: Request,
    file: UploadFile = File(...), 
    current_user: DBUser = Depends(authenticate_api_key), 
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".php"):
        raise HTTPException(status_code=400, detail="Only PHP files are allowed")
    
    import tempfile
    app_id = str(uuid.uuid4())
    temp_dir = os.path.join(tempfile.gettempdir(), app_id)
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_location = os.path.join(temp_dir, file.filename)
    
    content = await file.read()
    with open(temp_file_location, "wb") as f:
        f.write(content)
    
    # === Security checks ===
    file_hash = hashlib.sha256(content).hexdigest()
    if not await check_virustotal(file_hash):
        shutil.rmtree(temp_dir)
        raise HTTPException(status_code=403, detail="File flagged as malicious by VirusTotal.")
    
    if not scan_with_clamav(temp_file_location):
        shutil.rmtree(temp_dir)
        raise HTTPException(status_code=403, detail="Malware detected locally.")
    
    if not check_static_vulnerabilities(temp_file_location):
        shutil.rmtree(temp_dir)
        raise HTTPException(status_code=403, detail="Dangerous PHP functions detected.")
    
    final_dir = os.path.join(UPLOAD_DIR, app_id)
    os.makedirs(final_dir, exist_ok=True)
    shutil.move(temp_file_location, os.path.join(final_dir, "index.php"))
    shutil.rmtree(temp_dir)
    
    live_url = f"https://{DOMAIN}/{app_id}/index.php"
    
    new_app = DBApp(id=app_id, filename=file.filename, url=live_url, owner_id=current_user.id)
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app
   
@app.get("/apps", response_model=List[AppResponse], tags=["PHP Apps"], summary="List all hosted PHP applications owned by the user")
@limiter.limit("50/minute")
def list_apps(
    request: Request,
    skip: int = 0,
    limit: int = 10,
    current_user: DBUser = Depends(authenticate_api_key),
    db: Session = Depends(get_db)
):
    apps = db.query(DBApp).filter(DBApp.owner_id == current_user.id).offset(skip).limit(limit).all()
    return apps

@app.get("/health", tags=["System Status"], summary="Perform service health check")
@limiter.limit("10/minute")
def health_check(request: Request):
    return {"status": "healthy"}

@app.get("/server-status", tags=["System Status"], summary="Retrieve server hardware resources and PHP-FPM status info")
def get_server_status():

    cpu_load = psutil.getloadavg()
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    try:
        php_mem = subprocess.run(['php', '-r', 'echo ini_get("memory_limit");'], capture_output=True, text=True).stdout
        php_upload = subprocess.run(['php', '-r', 'echo ini_get("upload_max_filesize");'], capture_output=True, text=True).stdout
        php_exec_time = subprocess.run(['php', '-r', 'echo ini_get("max_execution_time");'], capture_output=True, text=True).stdout
    except Exception:
        php_mem, php_upload, php_exec_time = "error", "error", "error"

    fpm_processes = len([p for p in psutil.process_iter(['name']) if 'php-fpm' in p.info['name']])

    return {
        "hardware": {
            "cpu_load_avg": {"1m": cpu_load[0], "5m": cpu_load[1], "15m": cpu_load[2]},
            "ram_usage_percent": mem.percent,
            "ram_available_mb": round(mem.available / (1024 * 1024), 2),
            "disk_usage_percent": disk.percent,
            "disk_free_gb": round(disk.free / (1024 * 1024 * 1024), 2),
        },
        "php_fpm": {
            "active_workers": fpm_processes,
            "params": {
                "memory_limit": php_mem,
                "upload_max_filesize": php_upload,
                "max_execution_time": php_exec_time
            }
        }
    }

@app.get("/admin/apps", tags=["Admin Apps"], summary="Admin: List all hosted applications in the system")
def get_all_apps(
    skip: int = 0,
    limit: int = 10,
    admin_user: DBUser = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    apps = db.query(DBApp).offset(skip).limit(limit).all()
    return apps

@app.delete("/admin/apps/{app_id}", tags=["Admin Apps"], summary="Admin: Permanently delete an application by ID")
def delete_app(
    app_id: str,
    admin_user: DBUser = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    app_entry = db.query(DBApp).filter(DBApp.id == app_id).first()
    if not app_entry:
        raise HTTPException(status_code=404, detail="App not found")
    
    app_dir = os.path.join(UPLOAD_DIR, app_id)
    if os.path.exists(app_dir):
        shutil.rmtree(app_dir)
    
    db.delete(app_entry)
    db.commit()
    return {"status": "success", "message": f"App {app_id} deleted successfully"}

@app.get("/admin/users", response_model=List[UserResponse], tags=["Admin Users"], summary="Admin: List all users in the system")
@limiter.limit("10/minute")
def get_all_users(
    request: Request,
    skip: int = 0,
    limit: int = 10,
    admin_user: DBUser = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(DBUser).offset(skip).limit(limit).all()
    return users

@app.patch("/admin/users/{user_id}", tags=["Admin Users"], summary="Admin: Edit user account configuration (username, email, roles, status, password)")
@limiter.limit("20/minute")
def edit_user(
    request: Request,
    user_id: int,
    updates: UserUpdateAdmin,
    admin_user: DBUser = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    target_user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if updates.username is not None:
        if db.query(DBUser).filter(DBUser.username == updates.username, DBUser.id != user_id).first():
            raise HTTPException(status_code=400, detail="Username already taken")
        target_user.username = updates.username
    if updates.email is not None:
        if db.query(DBUser).filter(DBUser.email == updates.email, DBUser.id != user_id).first():
            raise HTTPException(status_code=400, detail="Email already taken")
        target_user.email = updates.email
    if updates.password is not None:
        target_user.hashed_password = pwd_context.hash(updates.password)
    if updates.is_admin is not None:
        target_user.is_admin = updates.is_admin
        
    if updates.is_active is not None and target_user.is_active != updates.is_active:
        target_user.is_active = updates.is_active
        for app in target_user.apps:
            app.is_active = updates.is_active
            app_dir = os.path.join(UPLOAD_DIR, app.id)
            old_file = os.path.join(app_dir, "index.php" if not updates.is_active else "index.php.suspended")
            new_file = os.path.join(app_dir, "index.php.suspended" if not updates.is_active else "index.php")
            if os.path.exists(old_file):
                os.rename(old_file, new_file)

    db.commit()
    return {"status": "success", "message": f"User {user_id} updated."}

@app.delete("/admin/users/{user_id}", tags=["Admin Users"], summary="Admin: Permanently delete a user account and all of their apps")
@limiter.limit("5/minute")
def delete_user(
    request: Request,
    user_id: int,
    admin_user: DBUser = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    target_user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    for app in target_user.apps:
        app_dir = os.path.join(UPLOAD_DIR, app.id)
        if os.path.exists(app_dir):
            shutil.rmtree(app_dir)

    db.query(DBAPIKey).filter(DBAPIKey.owner_id == user_id).delete()
    db.query(DBApp).filter(DBApp.owner_id == user_id).delete()
    db.delete(target_user)
    db.commit()

    return {"status": "success", "message": "User and all associated apps permanently deleted."}

@app.patch("/admin/apps/{app_id}/status", tags=["Admin Apps"], summary="Admin: Enable/suspend hosting of a PHP application by ID")
@limiter.limit("20/minute")
def toggle_app_status(
    request: Request,
    app_id: str,
    status_update: AppStatusUpdate,
    admin_user: DBUser = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    app_entry = db.query(DBApp).filter(DBApp.id == app_id).first()
    if not app_entry:
        raise HTTPException(status_code=404, detail="App not found")

    if status_update.is_active and not app_entry.owner.is_active:
        raise HTTPException(status_code=400, detail="Cannot activate app because the owner's account is suspended.")

    app_dir = os.path.join(UPLOAD_DIR, app_id)
    active_file = os.path.join(app_dir, "index.php")
    suspended_file = os.path.join(app_dir, "index.php.suspended")

    if status_update.is_active:
        if os.path.exists(suspended_file):
            os.rename(suspended_file, active_file)
    else:
        if os.path.exists(active_file):
            os.rename(active_file, suspended_file)

    app_entry.is_active = status_update.is_active
    db.commit()
    
    state = "activated" if status_update.is_active else "suspended"
    return {"status": "success", "message": f"App has been {state}."}

@app.get("/admin/php-workers", tags=["Admin Telemetry"], summary="Admin: Fetch real-time active PHP-FPM execution telemetry")
@limiter.limit("10/minute")
async def get_php_execution_stats(request: Request, admin_user: DBUser = Depends(get_admin_user)):
    """
    Fetches real-time execution telemetry from PHP-FPM.
    Shows exactly which apps are currently running and their CPU usage.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost/status?json&full")
            
        if response.status_code != 200:
            return {"error": "FPM status page not reachable or not configured."}
            
        fpm_data = response.json()
        active_processes = []
        
        for proc in fpm_data.get("processes", []):
            if proc["state"] == "Running":
                script_path = proc.get("script", "")
                app_id_match = re.search(r'/apps/([^/]+)/index\.php', script_path)
                app_id = app_id_match.group(1) if app_id_match else "Unknown"
                
                active_processes.append({
                    "app_id": app_id,
                    "pid": proc["pid"],
                    "state": proc["state"],
                    "start_time": proc["start time"],
                    "request_uri": proc["request uri"],
                    "cpu_percent": proc["% cpu"],
                    "memory_kb": proc["memory"] / 1024,
                    "execution_time_seconds": proc["request duration"] / 1000000,
                })
                
        return {
            "pool_manager": fpm_data.get("pool"),
            "active_workers_count": fpm_data.get("active processes"),
            "max_active_processes": fpm_data.get("max active processes"),
            "live_execution_stats": active_processes
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch FPM telemetry: {str(e)}")