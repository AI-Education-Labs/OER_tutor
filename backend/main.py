from fastapi import FastAPI, Depends, HTTPException, status, Header, Query, BackgroundTasks, Request, Response
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from sse_starlette.sse import EventSourceResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, AsyncGenerator
from datetime import datetime, timezone
from mangum import Mangum
import jwt
import json
import random
import re
import logging
import asyncio
import uuid
import os

from backend.redis_client import redis_client

from backend.routes.auth import router as auth_router

from backend.routes.llm_utils import router as llm_utils_router
from backend.routes.textbooks import router as textbooks_router
from backend.routes.files import router as files_router
from backend.routes.sidebar_modules import router as sidebar_modules_router
from backend.routes.user_progress import router as textbook_progress_router
from backend.routes.textbook_information import router as textbook_router
from backend.routes.users import router as users_router
from backend.routes.chat import router as chat_router

from openai import OpenAI

from langchain_openai import ChatOpenAI
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend.session_manager import session_manager

import backend.retriever

from backend.graph import build_graph, get_system_prompt

from backend.config import settings

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

from backend.database import ensure_mongo_connection, get_user_document_by_username

from backend.services.auth import get_current_user, get_current_active_user, User


PDF_DIR = "./public"

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="TextbookAI API")
app.include_router(auth_router, prefix="/auth", tags=["auth"])

app.include_router(llm_utils_router, prefix="/llm", tags=["llm-utils"])
app.include_router(sidebar_modules_router, prefix="/sidebar", tags=["sidebar-modules"])
app.include_router(textbooks_router, tags=["textbooks"])
app.include_router(files_router, tags=["files"])
app.include_router(textbook_progress_router, prefix="/progress", tags=["progress"])
app.include_router(textbook_router, prefix="/textbook", tags=["textbook"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(chat_router, prefix="/chat", tags=["chat"])

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Redis URL configuration from environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_DB = os.getenv("REDIS_DB_CHAT", "1")
REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# Pydantic models

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: Optional[str] = None
    saved: bool = False

class SubchapterProgress(BaseModel):
    completed: bool = False
    progress: float = 0.0  # % of the subchapter completed
    time_spent: float = 0.0  # in minutes

class ChapterProgress(BaseModel):
    completed: bool = False
    progress: float = 0.0  # % of the chapter completed
    subchapters: Dict[str, SubchapterProgress] = Field(default_factory=dict)

class UserProgress(BaseModel):
    user_id: str = ""
    textbook_id: str = ""
    overall_progress: float = 0.0  # e.g. 42.5 (%)
    chapters: Dict[str, ChapterProgress] = Field(default_factory=dict)
    total_answers: int = 0
    correct_answers: int = 0
    streak: int = 0
    xp: int = 0
    level: int = 1
    last_answer_time: Optional[datetime] = None
    topics_mastered: List[str] = Field(default_factory=list)
    



retriever = backend.retriever.create_retriever("data/Research-Methods-in-Psychology_repaired.pdf", "Research_Methods_in_Psychology")   # We need to pass in what retriever the chat is going to use, then build it for the user. Since the chroma is already initialized it shouldnt waste time.



# Routes

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """
    Returns the current authenticated user's information.
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


@app.get("/user/progress")
async def get_user_progress(current_user: User = Depends(get_current_active_user)):
    """
    Returns the user's learning progress.
    Requires authentication.
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access progress",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        progress_key = f"user:{current_user.id}:progress"
        progress_data = await redis_client.get(progress_key)
        
        if progress_data:
            progress = UserProgress.parse_raw(progress_data)
            return progress.dict()
        else:
            return UserProgress(user_id=current_user.id).dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve progress: {str(e)}")
    

async def update_user_progress(user_id: str, topic: str, is_correct: bool):
    """
    Updates the user's progress in Redis.
    """
    try:
        # Get current progress
        progress_key = f"user:{user_id}:progress"
        progress_data = await redis_client.get(progress_key)
        
        if progress_data:
            progress = UserProgress.parse_raw(progress_data)
        else:
            progress = UserProgress(user_id=user_id)
        
        # Update progress
        if is_correct:
            # Track mastered topics
            if topic not in progress.topics_mastered:
                topic_correct_key = f"user:{user_id}:topic:{topic}:correct"
                topic_correct = await redis_client.incr(topic_correct_key)
                
                if topic_correct >= 3:  # Consider a topic mastered after 3 correct answers
                    progress.topics_mastered.append(topic)
        
        # Save updated progress
        await redis_client.set(progress_key, progress.json())
    except Exception as e:
        print(f"Error updating progress: {e}")


# For debugging purposes
@app.get("/api/debug/file-exists")
async def check_file_exists(path: str):
    """Check if a file exists (for debugging)."""
    full_path = os.path.join(PDF_DIR, path)
    exists = os.path.isfile(full_path)
    return {
        "path": full_path,
        "exists": exists,
        "is_readable": os.access(full_path, os.R_OK) if exists else False
    }

# For debugging purposes
@app.get("/api/debug/list-dir")
async def list_directory(path: str = ""):
    """List contents of a directory (for debugging)."""
    full_path = os.path.join(PDF_DIR, path)
    if not os.path.isdir(full_path):
        raise HTTPException(status_code=404, detail=f"Directory not found: {full_path}")
    
    items = []
    for item in os.listdir(full_path):
        item_path = os.path.join(full_path, item)
        items.append({
            "name": item,
            "is_dir": os.path.isdir(item_path),
            "size": os.path.getsize(item_path) if os.path.isfile(item_path) else None
        })
    
    return {
        "path": full_path,
        "items": items
    }


# ----- AWS Lambda handler (Mangum adapter) -----
# lifespan="auto" triggers FastAPI startup/shutdown events.
# If you see timeouts or odd startup behavior, try lifespan="off".
handler = Mangum(app, lifespan="auto")

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
    asyncio.run(ensure_mongo_connection())
