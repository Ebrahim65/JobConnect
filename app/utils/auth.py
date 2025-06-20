#app/utils/auth
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
import asyncpg

from ..database import get_db
from ..config import settings

# Constants
SECRET_KEY = settings.secret_key
ALGORITHM = settings.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def authenticate_user(username: str, password: str, conn: asyncpg.Connection):
    # Try client
    user = await conn.fetchrow("SELECT client_id AS id, password_hash, 'client' AS type FROM client WHERE email=$1", username)
    if user and verify_password(password, user['password_hash']):
        return dict(user)

    # Try technician
    user = await conn.fetchrow("SELECT technician_id AS id, password_hash, 'technician' AS type FROM technician WHERE email=$1", username)
    if user and verify_password(password, user['password_hash']):
        return dict(user)

    # Try admin
    user = await conn.fetchrow("SELECT admin_id AS id, password_hash, 'admin' AS type FROM admin WHERE email=$1", username)
    if user and verify_password(password, user['password_hash']):
        return dict(user)

    return None


async def get_current_user(token: str = Depends(oauth2_scheme), conn: asyncpg.Connection = Depends(get_db)) -> dict:
    """Get the current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, 
            settings.secret_key, 
            algorithms=[settings.algorithm]
        )
        user_id: str = payload.get("sub")
        user_type: str = payload.get("type")
        if user_id is None or user_type is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    table_map = {
        "client": ("client", "client_id"),
        "technician": ("technician", "technician_id"),
        "admin": ("admin", "admin_id")
    }
    
    if user_type not in table_map:
        raise credentials_exception
    
    table, id_col = table_map[user_type]
    user = await conn.fetchrow(
        f"SELECT {id_col} as id, email, name, surname FROM {table} WHERE {id_col} = $1",
        user_id
    )
    
    if user is None:
        raise credentials_exception
    
    return {**user, "type": user_type}

__all__ = [
    "oauth2_scheme",
    "verify_password",
    "get_password_hash",
    "create_access_token",
    "authenticate_user",
    "get_current_user",
    "ACCESS_TOKEN_EXPIRE_MINUTES"
]