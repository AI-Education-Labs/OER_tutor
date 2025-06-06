from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import jwt
from backend.models.user import User, UserCreate, UserInDB
from backend.config import settings
from backend.redis_client import redis_client

import hashlib

router = APIRouter()

# Models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Helper functions
async def hash_password(password: str) -> str:
    """
    Hashes the password using SHA-256.
    """
    return hashlib.sha256(password.encode()).hexdigest()

async def store_user_in_redis(user: UserInDB):
    """
    Stores user information in Redis.
    """
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid user data")

    user_key = f"user:{user.id}"
    user_data = user.model_dump()
    print("USSSSSSSEEEEEERRRRR DDDAAAATTTTTAAAA", user_data)
    await redis_client.hset(user_key, mapping=user_data)
    return True

async def get_user_by_id(user_id: str) -> Optional[User]:
    """
    Retrieves the user from Redis by ID.
    """
    user_key = f"user:{user_id}"
    user_data = await redis_client.hgetall(user_key)
    
    if not user_data:
        return None
    
    user = UserInDB(
        id=user_data.get("id"),
        username=user_data.get("username"),
        email=user_data.get("email"),
        disabled=user_data.get("disabled") == 1,
        hashed_password=user_data.get("hashed_password"),
    )
    
    return user

async def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Logs in a user and returns an access token.
    """
    user = await get_user_by_id(form_data.username)
    
    if not user or not user.hashed_password == await hash_password(form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = await create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(user_create: UserCreate):
    """
    Registers a new user
    """
    hashed_password = await hash_password(user_create.password)
    user = UserInDB(
        id=user_create.username,
        username=user_create.username,
        email=user_create.email,
        hashed_password=hashed_password,
        disabled=0,
    )
    await store_user_in_redis(user)
    return {"message": "User registered successfully", "user": user}