import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv, set_key
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import models, database

ENV_FILE_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(ENV_FILE_PATH)


def _load_or_create_jwt_secret() -> str:
    env_key = os.getenv("JWT_SECRET_KEY", "").strip()
    if env_key and env_key != "esnafradar_default_dev_key_change_in_env" and len(env_key) >= 32:
        return env_key
    generated = secrets.token_hex(32)
    os.environ["JWT_SECRET_KEY"] = generated
    try:
        if not os.path.exists(ENV_FILE_PATH):
            with open(ENV_FILE_PATH, "w", encoding="utf-8") as f:
                f.write(f"JWT_SECRET_KEY={generated}\n")
        else:
            set_key(ENV_FILE_PATH, "JWT_SECRET_KEY", generated)
    except Exception:
        pass
    return generated


SECRET_KEY = _load_or_create_jwt_secret()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 gün

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Oturum süresi doldu veya geçersiz kimlik bilgisi. Lütfen tekrar giriş yapın.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    email_clean = email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email_clean).first()
    if user is None:
        raise credentials_exception
    return user
