from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str
    disabled: Optional[int] = 1

class UserWithPassword(User):
    hashed_password: str

class UserBooks(BaseModel):
    books: Dict[str, str]