from pydantic import BaseModel
from typing import Optional

# Models
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    message: str = "Login successful"
    set_cookie: Optional[str] = "access_token=<token>; HttpOnly; Secure; SameSite=Lax"

class RegisterResponse(BaseModel):
    id: str
    username: str
    message: str = "User registered successfully"

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LogoutResponse(BaseModel):
    message: str = "Successfully logged out"

class StatusResponse(BaseModel):
    is_authenticated: bool
    user_uuid: str
