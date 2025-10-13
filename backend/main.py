from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio

from backend.routes.auth import router as auth_router
from backend.routes.llm_utils import router as llm_utils_router
from backend.routes.textbooks import router as textbooks_router
from backend.routes.files import router as files_router
from backend.routes.sidebar_modules import router as sidebar_modules_router
from backend.routes.user_progress import router as textbook_progress_router
from backend.routes.users import router as users_router
from backend.routes.chat import router as chat_router
from backend.routes.user_books import router as user_books_router

import mangum

from backend.db.database import ensure_mongo_connection

from dotenv import load_dotenv
from pathlib import Path
import os
# Only load local .env during development (not in Lambda)
if not os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
	load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

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

# Mangum handler
handler = mangum.Mangum(app)

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
    asyncio.run(ensure_mongo_connection())
