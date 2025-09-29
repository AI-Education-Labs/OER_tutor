from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from backend.config import settings
from backend.db.database import get_user_by_username, get_user_by_id
import hashlib


# JWT Configuration
SECRET_KEY = settings.SECRET_KEY  # Use your secret key from settings
ALGORITHM = settings.ALGORITHM  # Use your algorithm from settings
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES  # Use your token expiration time from settings

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

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

# Verify access tokens
# Authentication helper functions
async def validate_access_token_optional(token: str = Depends(oauth2_scheme)):
    """
    Validates JWT token and returns the user if authenticated, None if not.
    Does not raise exceptions for unauthenticated requests.
    """
    if not token:
        return None

    try:
        # Decode the token (verify its signature and expiration)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")
        if not user_id:
            print(f"validate_access_token_optional: no user_id in payload")
            return None

        expiration = payload.get("exp")
        if expiration and datetime.fromtimestamp(expiration, timezone.utc) < datetime.now(timezone.utc):
            print(f"validate_access_token_optional: token expired")
            return None

        # user_id contains the user's id (uuid) according to token issuance
        user = await get_user_by_id(user_id)

        print(f"validate_access_token_optional: user {user}")
        if user is None or user.get("disabled") == True:
            print(f"validate_access_token_optional: user {user} is None or disabled")
            return None

        return user
    except jwt.PyJWTError as e:
        print(f"validate_access_token_optional: jwt error {e}")
        return None
    except Exception as e:
        print(f"validate_access_token_optional: unexpected error {e}")
        return None

async def validate_access_token(token: str = Depends(oauth2_scheme)):
    """
    Validates JWT token and returns the user id.
    Raises an HTTPException for unauthenticated requests.
    """
    if token == "":
        raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing",
            )
        
    try:
        # Decode the token (verify its signature and expiration)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")  # 'sub' is the typical key for user ID in JWT
        if user_id == "":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing user information",
            )

        expiration = payload.get("exp")
        if expiration and datetime.fromtimestamp(expiration, timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
            )

        user = await get_user_by_id(user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        
        if user.get("disabled") == True:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user",
            )

        return user
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )