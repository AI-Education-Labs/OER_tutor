from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
import re
import uuid
from backend.features.users.models import UserWithPassword, UserCreate
from backend.features.auth.models import Token
from backend.config import settings
from backend.db.database import create_user_document, get_collection, get_user_by_username
from backend.features.auth.service import hash_password, create_access_token

router = APIRouter()

@router.post("/token", response_model=Token)
async def assign_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Logs in a user and returns an access token.
    """
    user = await get_user_by_username(form_data.username)
    input_password_hash = await hash_password(form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    hashed_password = user.get("hashed_password")
    
    if hashed_password != input_password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    user_id = user.get("id")
    access_token = await create_access_token(
        data={"sub": user_id, "user_id": user_id, "role": user.get("role", "student"), "username": user.get("username", "")},
        expires_delta=access_token_expires,
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# Register a new user
@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(user_create: UserCreate):
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
    users = await get_collection("users")
    existing = await users.find_one({"username": user_create.username})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
    existing = await users.find_one({"email": user_create.email})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Validate role
    valid_roles = {"student", "professor"}
    if user_create.role not in valid_roles:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role must be 'student' or 'professor'")

    hashed_password = await hash_password(user_create.password)

    user_id = str(uuid.uuid4()) 
    user = UserWithPassword(
        id=user_id,
        username=user_create.username,
        email=user_create.email,
        role=user_create.role,
        hashed_password=hashed_password,
        disabled=0,
        onboarding=user_create.onboarding,
    )
    await create_user_document(user)
    return {"message": "User registered successfully", "user": user}