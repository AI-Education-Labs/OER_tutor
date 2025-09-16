from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from uuid import uuid4
from datetime import datetime

from backend.database import get_collection

router = APIRouter()


class CreateUserRequest(BaseModel):
    email: str
    password: str


class CreateUserResponse(BaseModel):
    id: str
    email: str
    created_at: datetime


@router.post("/", response_model=CreateUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(payload: CreateUserRequest):
    """Create a new user in the Users collection with a uuidv4 id.
    Password is stored in plaintext for now (will be hashed later).
    """
    users = await get_collection("Users")

    # Ensure unique email (basic check)
    existing = await users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user_id = str(uuid4())
    now = datetime.utcnow()

    doc = {
        "_id": user_id,
        "email": payload.email,
        "password": payload.password,  # TODO: hash later
        "created_at": now,
        "updated_at": now,
        "disabled": False,
    }

    await users.insert_one(doc)

    return CreateUserResponse(id=user_id, email=payload.email, created_at=now)


