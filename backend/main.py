from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio
from dotenv import load_dotenv
from backend.routes.auth import router as auth_router
from backend.routes.textbooks import router as textbooks_router
from backend.routes.files import router as files_router
from backend.routes.sidebar_modules import router as sidebar_modules_router
from backend.routes.studyguide import router as studyguide_router
from backend.routes.user_progress import router as textbook_progress_router
from backend.routes.users import router as users_router
from backend.routes.quiz import router as quiz_router
from backend.routes.flashcards import router as flashcards_router
from backend.routes.chat import router as chat_router
from backend.routes.user_books import router as user_books_router
import mangum
from pathlib import Path
from backend.db.database import ensure_mongo_connection
import os

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

# Only load local .env during development (not in Lambda)
if not os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
	load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="TextbookAI API")
api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(quiz_router, prefix="/quiz", tags=["quiz"])
api_router.include_router(studyguide_router, prefix="/studyguide", tags=["studyguide"])
api_router.include_router(flashcards_router, prefix="/flashcards", tags=["flashcards"])
api_router.include_router(sidebar_modules_router, prefix="/sidebar", tags=["sidebar-modules"])
api_router.include_router(textbooks_router, prefix="/textbooks", tags=["textbooks"])
api_router.include_router(files_router, tags=["files"])
api_router.include_router(textbook_progress_router, prefix="/progress", tags=["progress"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(user_books_router, tags=["user-books"]) 

app.include_router(api_router)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], #TODO: make this a environment variable
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
