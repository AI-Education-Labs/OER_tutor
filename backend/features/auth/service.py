from fastapi import Depends, HTTPException, status, Request
from datetime import datetime, timedelta, timezone
from backend.db.models import User
from typing import Optional
import jwt
from backend.config.settings import settings
import hashlib


# JWT Configuration
SECRET_KEY = settings.SECRET_KEY  # Use your secret key from settings
ALGORITHM = settings.ALGORITHM  # Use your algorithm from settings
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES  # Use your token expiration time from settings


# Hashes the password using SHA-256.
async def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

async def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def validate_cookie_token(request: Request, required: bool = True) -> Optional[str]:
    # Extract token from cookies
    token = request.cookies.get("access_token")
    if not token:
        if required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        else:
            return None

    try:
        # Decode the token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        raw_user_id = payload.get("sub")
        if not raw_user_id:
            if required:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token is missing user information",
                )
            else:
                return None

        # Check token expiration
        expiration = payload.get("exp")
        if expiration and datetime.fromtimestamp(expiration, timezone.utc) < datetime.now(timezone.utc):
            if required:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired",
                )
            else:
                return None

        # Retrieve the user from the database
        user = await User.get(raw_user_id)
        if user is None:
            if required:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found",
                )
            else:
                return None

        return str(user.id)

    except jwt.PyJWTError:
        if required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        else:
            return None

