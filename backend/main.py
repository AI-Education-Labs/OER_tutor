from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio
from dotenv import load_dotenv
from backend.features.openai.service import get_langfuse_client

from backend.routes.auth import router as auth_router
from backend.routes.textbooks import router as textbooks_router
from backend.routes.flashcards import router as flashcards_router
from backend.routes.quiz import router as quiz_router
from backend.routes.studyguide import router as study_guide_router
from backend.routes.user_progress import router as textbook_progress_router
from backend.routes.chat import router as chat_router
from backend.features.observability.service import setup_observability

import mangum

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

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

# Instrument LLMs
get_langfuse_client()

# Create FastAPI app

api_router = APIRouter(prefix="/api/v1")

app = FastAPI(title="TextbookAI API")
# Add observability middleware (e.g., OpenTelemetry) if needed
setup_observability(app)
# Include routers
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(textbooks_router, prefix="/textbooks", tags=["textbooks"])
api_router.include_router(flashcards_router, prefix="/flashcards", tags=["flashcards"])
api_router.include_router(quiz_router, prefix="/quiz", tags=["quizzes"])
api_router.include_router(study_guide_router, prefix="/study-guide", tags=["study-guide"])
api_router.include_router(textbook_progress_router, prefix="/progress", tags=["progress"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])

app.include_router(api_router)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    # When `allow_credentials=True`, browsers will refuse to send cookies if
    # Access-Control-Allow-Origin is set to "*". Use explicit origins in
    # development so `credentials: 'include'` works from the frontend.
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mangum handler
handler = mangum.Mangum(app)

# Flush llm observability
@app.on_event("shutdown")
def on_shutdown():
    get_langfuse_client().flush()

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
    asyncio.run(ensure_mongo_connection())
