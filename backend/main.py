from fastapi import FastAPI, Depends, HTTPException, status, Header, Query, BackgroundTasks, Request, Response
from sse_starlette.sse import EventSourceResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, AsyncGenerator
import json
import logging
import asyncio
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
from backend.routes.user_books import router as user_books_router

from langchain_openai import ChatOpenAI
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend.session_manager import session_manager
from backend.graph import build_graph, get_system_prompt
from backend.config import settings

import mangum

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

from backend.db.database import ensure_mongo_connection

from backend.features.users.models import User
from backend.features.auth.service import validate_access_token

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
app.include_router(user_books_router, tags=["user-books"]) 

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

retriever = None

# Routes

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(validate_access_token)):
    """
    Returns the current authenticated user's information.
    """
    return current_user

handler = mangum.Mangum(app)

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
    asyncio.run(ensure_mongo_connection())
