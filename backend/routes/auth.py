from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
import re
import uuid
from backend.features.users.models import UserWithPassword, UserCreate
from backend.features.auth.models import Token, LoginRequest, LoginResponse
from backend.config import settings
from backend.db.database import create_user_document, get_collection, get_user_by_username
from backend.features.auth.service import hash_password, create_access_token, validate_cookie_token, validate_cookie_token

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def assign_httpOnly_cookie(body: LoginRequest, response: Response):
    """
    returns a httpOnlyCookie for session authentication
    """

    hashed_input = await hash_password(body.password) # hash first for timing attacks

    user = await get_user_by_username(body.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    hashed_password = user.get("hashed_password")
    if hashed_password != hashed_input: # TODO:SEC this should use some library like hmac instead of us comparing it
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )


    jwt_expiry = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    user_id = user.get("id")
    jwt = await create_access_token(
        data={"sub": user_id, "user_id": user_id },
        expires_delta=jwt_expiry)

    response.set_cookie(
        key="access_token",
        value=jwt,
        httponly=True,
        path="/",
        secure=False, #TODO:SEC CHANGE THIS BACK TO TRUE IN PRODUCTION
        samesite="lax",
        max_age=int(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
    )
    
    response.status_code = 200

    # Determine email safely whether `user` is a dict or an object
    if isinstance(user, dict):
        user_email = user.get("email")
    else:
        user_email = getattr(user, "email", None)

    # Return a JSON payload (don't return the Response object itself). Returning
    # the Response instance here can confuse FastAPI's response handling and
    # middleware (it can result in a None status being propagated to the
    # server access logger). Instead, set the cookie on the provided response
    # and return a dict that matches the `LoginResponse` model.
    return {
        "message": "Login successful",
        "user_uuid": user_id,
        "email": user_email,
    }

@router.get("/session")
async def get_session(current_user = Depends(validate_cookie_token)):
    """
    Get current authenticated user's session info.
    Returns user details if authenticated via cookie, otherwise raises 401.
    """
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    
    try:
        users = await get_collection("users")
        user = await users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        
        return {
            "uuid": user.get("id"),
            "user_id": user.get("id"),
            "email": user.get("email"),
            "username": user.get("username"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch session")

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

    hashed_password = await hash_password(user_create.password)

    user_id = str(uuid.uuid4()) 
    user = UserWithPassword(
        id=user_id,
        username=user_create.username,
        email=user_create.email,
        hashed_password=hashed_password,
        disabled=0,
    )
    await create_user_document(user)
    return {"message": "User registered successfully", "user": user}