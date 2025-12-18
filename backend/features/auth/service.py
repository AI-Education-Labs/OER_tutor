from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from datetime import datetime, timedelta, timezone
from backend.features.users.models import UserCreate
from backend.db.models import User
from typing import Optional
import jwt
from backend.config import settings
from backend.db.database import get_user_by_id
import hashlib


# JWT Configuration
SECRET_KEY = settings.SECRET_KEY  # Use your secret key from settings
ALGORITHM = settings.ALGORITHM  # Use your algorithm from settings
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES  # Use your token expiration time from settings

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
class AuthService:
    async def register_user(self, user_create: UserCreate):
        """
        Registers a new user after validating uniqueness of username and email.
        
        :param self: Description
        :param user_create: Description
        :type user_create: UserCreate
        :return: Description
        :rtype: Any
        """

        # ensure unique username and email
        existing = await User.find_one(User.username == user_create.username)
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
        existing = await User.find_one(User.email == user_create.email)
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

        hashed_password = await hash_password(user_create.password)

        user = User(
            username=user_create.username,
            email=user_create.email,
            hashed_password=hashed_password,
            disabled=0,
        )

        await user.insert()

        return user
    
    async def authenticate_user(self, form_data: OAuth2PasswordRequestForm) -> str:
        """
        returns a access token

        :param self: Description
        :param user: Description
        :type user: User
        :return: Description
        :rtype: str
        """
        input_hash = await hash_password(form_data.password)
        user = await User.find_one(User.username == form_data.username)

        if not user or user.hashed_password != input_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token_expiry = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = await create_access_token(
            data={"sub": str(user.id), "user_id": str(user.id)}, expires_delta=access_token_expiry
        )
        return access_token

# DEPENDENCY INJECTION FUNCTIONS
# for fast api Depends()
async def validate_access_token_optional(token: str = Depends(oauth2_scheme)) -> Optional[str]:
    """
    Validates JWT token and returns the user id if valid, None if not.
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
        user = await User.find_one(User.id == user_id)

        print(f"validate_access_token_optional: user {user}")
        if user is None or user.disabled == True:
            print(f"validate_access_token_optional: user {user} is None or disabled")
            return None

        return str(user.id)
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

        user = await User.find_one(User.id == user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if user.disabled == True:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user",
            )

        return user.id
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