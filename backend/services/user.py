from fastapi import Depends, HTTPException, status

from fastapi.security import OAuth2PasswordBearer

from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

import jwt

from backend.config import settings
from backend.database import get_user_document_by_username


# JWT Configuration
SECRET_KEY = settings.SECRET_KEY  # Use your secret key from settings
ALGORITHM = settings.ALGORITHM  # Use your algorithm from settings
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES  # Use your token expiration time from settings

# Models - using str instead of EmailStr
class User(BaseModel):
    id: str
    username: str
    email: str  # Changed from EmailStr to str
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

# Authentication helper functions
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Validates JWT token and returns the user if valid.
    Returns None for unauthenticated requests.
    """
    if token is None:
        return None
        
    try:
        # Decode the token (verify its signature and expiration)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")  # 'sub' is the typical key for user ID in JWT
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing user information",
            )

        # Optionally, you could verify token expiration here:
        expiration = payload.get("exp")
        if expiration and datetime.fromtimestamp(expiration, timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
            )

        # Assuming you have a function to get the user from your DB
        user = await get_user_document_by_username(user_id)  # Replace with your DB fetching logic
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
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

async def get_current_active_user(current_user: Optional[User] = Depends(get_current_user)):
    """
    Checks if the authenticated user is active.
    Returns None for unauthenticated requests.
    """
    if current_user is None:
        return None
        
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user