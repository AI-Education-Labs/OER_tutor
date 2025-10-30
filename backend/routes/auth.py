from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from datetime import timedelta
import re
import uuid
from backend.features.users.models import UserWithPassword, UserCreate
from backend.config.settings import settings
from backend.features.auth.service import validate_cookie_token
from backend.features.auth.service import hash_password, create_access_token
from backend.features.auth.models import *
from backend.db.models import User
from typing import Optional

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def assign_httponly_cookie(form_data: LoginRequest = Depends()):
    """
    Logs in a user and returns an http_only cookie.
    """
    # Always hash the password, even if the user does not exist
    input_password_hash = await hash_password(form_data.password)
    user: Optional[User] = await User.find_one(User.username == form_data.username)

    # Use a dummy hash if user does not exist to prevent timing attacks
    stored_password_hash = user.hashed_password if user else await hash_password("dummy_password")

    # Constant-time comparison
    import hmac
    if not user or not hmac.compare_digest(stored_password_hash, input_password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

    # create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    user_id = str(user.id)
    access_token = await create_access_token(
        data={"sub": user_id, "user_id": user_id}, expires_delta=access_token_expires
    )

    resp = Response()
    resp.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False, #TODO:SEC CHANGE THIS BACK TO TRUE IN PRODUCTION
        samesite="lax",
        max_age=int(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
    )

    return resp

# Register a new user
@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=RegisterResponse)
async def register_user(user_create: RegisterRequest):
    """
    Register New user
    """
    # Username should only have alphanumeric characters
    if not user_create.username.isalnum():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username should only have alphanumeric characters")
    # Max 100 characters on username
    if len(user_create.username) > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username should be less than 100 characters")
    # Min 3 characters on username
    if len(user_create.username) < 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username should be at least 3 characters")
    # Max 1000 characters on email
    if len(user_create.email) > 1000:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email should be less than 1000 characters")
    # Ensure valid email
    if not re.match(r"[^@]+@[^@]+\.[^@]+", user_create.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email")
    # Ensure password is at least 8 characters long
    if len(user_create.password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password should be at least 8 characters long")
    # Ensure password is at most 100 characters long
    if len(user_create.password) > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password should be less than 100 characters")

    # Ensure unique username and email
    existing = await User.find_one({"username": user_create.username})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
    existing = await User.find_one({"email": user_create.email})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    hashed_password = await hash_password(user_create.password)

    user = User(username=user_create.username, email=user_create.email, hashed_password=hashed_password, books=[])
    await user.create()

    return RegisterResponse(
        id=str(user.id),
        username=user.username,
        message="User registered successfully",
    )

# Logout endpoint to clear the cookie
@router.post("/logout", response_model=LogoutResponse)
async def logout_user(response: Response):
    """
    Logs out a user by clearing the http_only cookie.
    """
    response.delete_cookie(key="access_token")
    response.status_code = status.HTTP_200_OK
    response.body = b'{"message": "Successfully logged out"}'
    return response

@router.get("/status", response_model=StatusResponse)
async def auth_status(user: dict = Depends(validate_cookie_token)):
    """
    Endpoint to check authentication status.
    """
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"is_authenticated": True, "user_uuid": user}