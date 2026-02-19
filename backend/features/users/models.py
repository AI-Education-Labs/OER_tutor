from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum


class OnboardingProfile(BaseModel):
    goals: Optional[List[str]] = None
    time_commitment: Optional[str] = None
    subjects: Optional[List[str]] = None


class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: str = "student"

class UserCreate(UserBase):
    password: str
    onboarding: Optional[OnboardingProfile] = None

class User(UserBase):
    id: str
    disabled: Optional[int] = 1
    onboarding: Optional[OnboardingProfile] = None

class UserWithPassword(User):
    hashed_password: str

class UserBooks(BaseModel):
    books: Dict[str, str]