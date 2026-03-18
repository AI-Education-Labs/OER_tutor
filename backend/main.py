from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import logging
from backend.features.openai.service import get_langfuse_client

from backend.config import settings
from backend.routes.auth import router as auth_router
from backend.routes.textbooks import router as textbooks_router
from backend.routes.flashcards import router as flashcards_router
from backend.routes.quiz import router as quiz_router
from backend.routes.studyguide import router as study_guide_router
from backend.routes.user_progress import router as textbook_progress_router
from backend.routes.chat import router as chat_router
from backend.routes.courses import router as courses_router
from backend.features.observability.service import setup_observability

import mangum

from backend.db.database import ensure_mongo_connection, ensure_course_indexes

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
api_router.include_router(courses_router, prefix="/courses", tags=["courses"])

app.include_router(api_router)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mangum handler
handler = mangum.Mangum(app)

@app.on_event("startup")
async def on_startup():
    # Validate required settings
    if not settings.SECRET_KEY or settings.SECRET_KEY == "your-secret-key":
        raise RuntimeError("SECRET_KEY must be set to a secure value (not empty or default)")
    if not settings.MONGO_URI:
        raise RuntimeError("MONGO_URI must be set")
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY must be set")

    await ensure_mongo_connection()
    await ensure_course_indexes()

# Flush llm observability
@app.on_event("shutdown")
def on_shutdown():
    get_langfuse_client().flush()

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
