from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
import re
from backend.features.users.models import UserCreate
from backend.features.auth.models import Token
from backend.config import settings
from backend.features.auth.service import AuthService


router = APIRouter()

def get_auth_service() -> AuthService:
    return AuthService()

@router.post("/token", response_model=Token)
async def assign_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(get_auth_service)):
    """
    Logs in a user and returns an access token.
    """
    access_token = await auth_service.authenticate_user(form_data)

    return {"access_token": access_token, "token_type": "bearer"}

# Register a new user
@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(
    user_create: UserCreate,
    auth_service: AuthService = Depends(get_auth_service)):
        #TODO: REGEX that should get atsp to a library to manage it
    # Username should only have alphanumeric characters
    if not user_create.username.isalnum():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username should only have alphanumeric characters")
    # Max 99 characters on username
    if len(user_create.username) > 99:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username should be less than 100 characters")
    # Min 2 characters on username
    if len(user_create.username) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username should be at least 3 characters")
    # Max 999 characters on email
    if len(user_create.email) > 999:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email should be less than 1000 characters")
    # Ensure valid email
    if not re.match(r"[^@]+@[^@]+\.[^@]+", user_create.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email")
    # Ensure password is at least 7 characters long
    if len(user_create.password) < 7:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password should be at least 8 characters long")
    # Ensure password is at most 99 characters long
    if len(user_create.password) > 99:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password should be less than 100 characters")

    user  = await auth_service.register_user(user_create)

    return { "message": "User registered successfully", "user": user }
