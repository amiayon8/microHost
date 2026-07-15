import os
import uuid
import shutil
import subprocess
import re
import hashlib
from datetime import datetime, timedelta
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import Oauth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# ================== Configuration ==================
VIRUSTOTAL_API_KEY = ""
DOMAIN = "YOUR_DOMAIN"
SECRET_KEY = ""
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
UPLOAD_DIR = "/var/www/apps"

# === DATABASE ===
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# === Rate Limiter ===
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="MicroHost API", description="API for managing PHP applications", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# === Security ===
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = Oauth2PasswordBearer(tokenUrl="token")

# ================== Database Models ==================
class DBUser(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    api_keys = relationship("DBAPIKey", back_populates="owner")

class DBApp(Base):
    __tablename__ = "apps"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, index=True)
    url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("DBUser", back_populates="apps")

class DBAPIKey(Base):
    __tablename__ = "api_keys"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("DBUser", back_populates="api_keys")

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
    class Config:
        orm_mode = True

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

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
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
    return user

async def authenticate_api_key(request: Request, db: Session = Depends(get_db)):
    api_key = request.headers.get("X-API-KEY")
    if not api_key:
        raise HTTPException(status_code=401, detail="API key missing")
    db_api_key = db.query(DBAPIKey).filter(DBAPIKey.key == api_key).first()
    if not db_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return db_api_key.owner

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
        return result.returncode == 0
    except Exception:
        return False
    
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

@app.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    if db.query(DBUser).filter(DBUser.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = pwd_context.hash(user.password)
    db_user = DBUser(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    return {"message": "User created successfully"}

@app.post("/token")
@limiter.limit("10/minute")
def login_for_access_token(
    request: Request, 
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    user = db.query(DBUser).filter(DBUser.username == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api-keys")
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

@app.post("/upload", response_model=AppResponse)
@limiter.limit("10/minute")
async def upload_app(
    request: Request,
    file: UploadFile = File(...), 
    current_user: DBUser = Depends(authenticate_api_key), 
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".php"):
        raise HTTPException(status_code=400, detail="Only PHP files are allowed")
    
    app_id = str(uuid.uuid4())
    temp_dir = f"/tmp/{app_id}"
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
    
    # === Save to database ===
    new_app = DBApp(id=app_id, filename=file.filename, url=live_url, owner_id=current_user.id)
    db.add(new_app)
    db.commit()
    
    return {"status": "success", "url": live_url, "app_id": app_id}

@app.get("/apps", response_model=List[AppResponse])
@limiter.limit("50/minute")
def list_apps(
    skip: int = 0,
    limit: int = 10,
    current_user: DBUser = Depends(authenticate_api_key),
    db: Session = Depends(get_db)
):
    apps = db.query(DBApp).filter(DBApp.owner_id == current_user.id).offset(skip).limit(limit).all()
    return apps