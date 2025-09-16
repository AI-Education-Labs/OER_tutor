import logging

# Set up logging
logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
from backend.redis_client import redis_client
import json

router = APIRouter()

# We'll need to import these from main.py or create a separate auth module
# For now, I'll define them here, but you should import them from where they're defined
from fastapi.security import OAuth2PasswordBearer
import jwt
from backend.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Validates JWT token and returns the user if valid.
    Returns None for unauthenticated requests.
    """
    logger.info(f"get_current_user called with token: {token[:20] if token else 'None'}...")
    
    if token is None:
        logger.warning("No token provided")
        return None
        
    try:
        # Decode the token (verify its signature and expiration)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")  # 'sub' is the typical key for user ID in JWT
        logger.info(f"Decoded JWT payload: {payload}")
        logger.info(f"Extracted user_id: {user_id}")
        
        if user_id is None:
            logger.error("Token is missing user information (no 'sub' field)")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing user information",
            )

        # Get the user from your DB
        user = await get_user_by_id(user_id)
        logger.info(f"Retrieved user from DB: {user}")
        
        if user is None:
            logger.error(f"User not found in DB for user_id: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        logger.info(f"Successfully authenticated user: {user.id}")
        return user
    except jwt.PyJWTError as e:
        logger.error(f"JWT decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

async def get_current_active_user(current_user = Depends(get_current_user)):
    """
    Checks if the authenticated user is active.
    Requires authentication.
    """
    logger.info(f"get_current_active_user called with user: {current_user}")
    
    if current_user is None:
        logger.error("No current user - authentication required")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if current_user.disabled:
        logger.error(f"User {current_user.id} is disabled")
        raise HTTPException(status_code=400, detail="Inactive user")
    
    logger.info(f"User {current_user.id} is active and authenticated")
    return current_user

# Progress Models (keep the same)
class SectionProgress(BaseModel):
    section_id: str
    section_title: str = ""
    completion_percentage: float = 0.0
    status: str = "not_started"  # not_started, in_progress, completed
    time_spent_minutes: float = 0.0
    last_accessed: Optional[datetime] = None
    notes: Optional[str] = None

class ChapterProgress(BaseModel):
    chapter_id: str
    chapter_title: str = ""
    chapter_number: int = 0
    completion_percentage: float = 0.0
    status: str = "not_started"
    time_spent_minutes: float = 0.0
    last_accessed: Optional[datetime] = None
    sections: Dict[str, SectionProgress] = Field(default_factory=dict)

class TextbookProgress(BaseModel):
    textbook_id: str
    textbook_title: str = ""
    author: str = ""
    completion_percentage: float = 0.0
    status: str = "not_started"
    total_time_minutes: float = 0.0
    last_accessed: Optional[datetime] = None
    started_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    chapters: Dict[str, ChapterProgress] = Field(default_factory=dict)

class UserProgress(BaseModel):
    user_id: str
    textbook_id: str
    progress: TextbookProgress
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class ProgressUpdateRequest(BaseModel):
    completion_percentage: Optional[float] = None
    status: Optional[str] = None
    time_spent_minutes: Optional[float] = None
    notes: Optional[str] = None

# Service functions (keep the same but update to use user.id)
async def store_progress_in_redis(user_progress: UserProgress):
    """Store user progress in Redis"""
    try:
        user_progress.updated_at = datetime.now()
        key = f"user_progress:{user_progress.user_id}:{user_progress.textbook_id}"
        progress_json = user_progress.model_dump_json()
        await redis_client.set(key, progress_json)
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store progress: {str(e)}")

async def get_progress_from_redis(user_id: str, textbook_id: str) -> UserProgress:
    """Get user progress from Redis"""
    logger.info(f"get_progress_from_redis called with user_id: {user_id}, textbook_id: {textbook_id}")
    
    try:
        key = f"user_progress:{user_id}:{textbook_id}"
        logger.info(f"Looking for Redis key: {key}")
        
        progress_json = await redis_client.get(key)
        logger.info(f"Redis get result: {progress_json[:100] if progress_json else 'None'}...")
        
        if not progress_json:
            logger.info(f"No progress found in Redis for key: {key}")
            raise HTTPException(status_code=404, detail="Progress not found")
        
        progress = UserProgress.model_validate_json(progress_json)
        logger.info(f"Successfully parsed progress from Redis: user={progress.user_id}, textbook={progress.textbook_id}")
        return progress
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_progress_from_redis: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve progress: {str(e)}")

async def initialize_progress_for_new_user(user_id: str, textbook_id: str) -> UserProgress:
    """
    Helper function that creates 0% progress for all chapters and sections 
    in a textbook when a user opens it for the first time.
    """
    logger.info(f"initialize_progress_for_new_user called with user_id: {user_id}, textbook_id: {textbook_id}")
    
    try:
        # Check if progress already exists
        try:
            existing_progress = await get_progress_from_redis(user_id, textbook_id)
            logger.info("Found existing progress, returning it")
            return existing_progress
        except HTTPException as e:
            if e.status_code != 404:
                logger.error(f"Unexpected error checking existing progress: {e}")
                raise
            logger.info("No existing progress found, proceeding with initialization")
        
        # Import here to avoid circular imports
        from backend.routes.textbook_information import get_textbook_structure_for_progress
        
        # Get textbook structure
        logger.info(f"Getting textbook structure for textbook_id: {textbook_id}")
        textbook_structure = await get_textbook_structure_for_progress(textbook_id)
        logger.info(f"Retrieved textbook structure: {textbook_structure['title']} with {len(textbook_structure['chapters'])} chapters")
        
        # Create initial progress with 0% for all chapters and sections
        chapters_progress = {}
        
        for chapter_data in textbook_structure["chapters"]:
            sections_progress = {}
            
            # Initialize all sections with 0% progress
            for section_data in chapter_data["sections"]:
                sections_progress[section_data["section_id"]] = SectionProgress(
                    section_id=section_data["section_id"],
                    section_title=section_data["title"],
                    completion_percentage=0.0,
                    status="not_started",
                    time_spent_minutes=0.0
                )
            
            # Initialize chapter with 0% progress
            chapters_progress[chapter_data["chapter_id"]] = ChapterProgress(
                chapter_id=chapter_data["chapter_id"],
                chapter_title=chapter_data["title"],
                chapter_number=chapter_data["chapter_number"],
                completion_percentage=0.0,
                status="not_started",
                time_spent_minutes=0.0,
                sections=sections_progress
            )
        
        logger.info(f"Created progress structure with {len(chapters_progress)} chapters")
        
        # Create textbook progress
        textbook_progress = TextbookProgress(
            textbook_id=textbook_id,
            textbook_title=textbook_structure["title"],
            author=textbook_structure["author"],
            completion_percentage=0.0,
            status="not_started",
            total_time_minutes=0.0,
            started_date=datetime.now(),
            chapters=chapters_progress
        )
        
        # Create user progress
        user_progress = UserProgress(
            user_id=user_id,
            textbook_id=textbook_id,
            progress=textbook_progress
        )
        
        logger.info(f"Created UserProgress object for user {user_id}")
        
        # Store in Redis
        await store_progress_in_redis(user_progress)
        logger.info(f"Successfully stored new progress in Redis")
        
        return user_progress
        
    except Exception as e:
        logger.error(f"Error in initialize_progress_for_new_user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize progress: {str(e)}")

def calculate_chapter_progress(chapter: ChapterProgress) -> float:
    """Calculate overall progress for a chapter based on its sections"""
    if not chapter.sections:
        return chapter.completion_percentage
    
    total_progress = sum(section.completion_percentage for section in chapter.sections.values())
    return total_progress / len(chapter.sections)

def calculate_textbook_progress(textbook: TextbookProgress) -> float:
    """Calculate overall progress for a textbook based on its chapters"""
    if not textbook.chapters:
        return textbook.completion_percentage
    
    total_progress = sum(calculate_chapter_progress(chapter) for chapter in textbook.chapters.values())
    return total_progress / len(textbook.chapters)

async def update_section_progress(
    user_id: str,
    textbook_id: str,
    chapter_id: str,
    section_id: str,
    progress_update: ProgressUpdateRequest
) -> UserProgress:
    """Update progress for a specific section"""
    try:
        # Get existing progress or initialize if first time
        try:
            user_progress = await get_progress_from_redis(user_id, textbook_id)
        except HTTPException as e:
            if e.status_code == 404:
                user_progress = await initialize_progress_for_new_user(user_id, textbook_id)
            else:
                raise
        
        # Ensure chapter exists
        if chapter_id not in user_progress.progress.chapters:
            raise HTTPException(status_code=404, detail="Chapter not found")
        
        chapter = user_progress.progress.chapters[chapter_id]
        
        # Ensure section exists
        if section_id not in chapter.sections:
            raise HTTPException(status_code=404, detail="Section not found")
        
        section = chapter.sections[section_id]
        
        # Update section progress
        if progress_update.completion_percentage is not None:
            section.completion_percentage = min(100.0, max(0.0, progress_update.completion_percentage))
        if progress_update.status is not None:
            section.status = progress_update.status
        if progress_update.time_spent_minutes is not None:
            section.time_spent_minutes += progress_update.time_spent_minutes
        if progress_update.notes is not None:
            section.notes = progress_update.notes
        
        section.last_accessed = datetime.now()
        
        # Update chapter progress
        chapter.completion_percentage = calculate_chapter_progress(chapter)
        chapter.last_accessed = datetime.now()
        
        # Update chapter status based on progress
        if chapter.completion_percentage >= 100.0:
            chapter.status = "completed"
        elif chapter.completion_percentage > 0:
            chapter.status = "in_progress"
        
        # Update textbook progress
        user_progress.progress.completion_percentage = calculate_textbook_progress(user_progress.progress)
        user_progress.progress.last_accessed = datetime.now()
        
        # Update textbook status
        if user_progress.progress.completion_percentage >= 100.0:
            user_progress.progress.status = "completed"
            user_progress.progress.completed_date = datetime.now()
        elif user_progress.progress.completion_percentage > 0:
            user_progress.progress.status = "in_progress"
        
        # Store updated progress
        await store_progress_in_redis(user_progress)
        
        return user_progress
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update section progress: {str(e)}")

async def update_chapter_progress(
    user_id: str,
    textbook_id: str,
    chapter_id: str,
    progress_update: ProgressUpdateRequest
) -> UserProgress:
    """Update progress for a specific chapter"""
    try:
        # Get existing progress or initialize if first time
        try:
            user_progress = await get_progress_from_redis(user_id, textbook_id)
        except HTTPException as e:
            if e.status_code == 404:
                user_progress = await initialize_progress_for_new_user(user_id, textbook_id)
            else:
                raise
        
        # Ensure chapter exists
        if chapter_id not in user_progress.progress.chapters:
            raise HTTPException(status_code=404, detail="Chapter not found")
        
        chapter = user_progress.progress.chapters[chapter_id]
        
        # Update chapter progress
        if progress_update.completion_percentage is not None:
            chapter.completion_percentage = min(100.0, max(0.0, progress_update.completion_percentage))
        if progress_update.status is not None:
            chapter.status = progress_update.status
        if progress_update.time_spent_minutes is not None:
            chapter.time_spent_minutes += progress_update.time_spent_minutes
        
        chapter.last_accessed = datetime.now()
        
        # Update textbook progress
        user_progress.progress.completion_percentage = calculate_textbook_progress(user_progress.progress)
        user_progress.progress.last_accessed = datetime.now()
        
        # Update textbook status
        if user_progress.progress.completion_percentage >= 100.0:
            user_progress.progress.status = "completed"
            user_progress.progress.completed_date = datetime.now()
        elif user_progress.progress.completion_percentage > 0:
            user_progress.progress.status = "in_progress"
        
        # Store updated progress
        await store_progress_in_redis(user_progress)
        
        return user_progress
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update chapter progress: {str(e)}")

# Updated API Endpoints - now using authentication
@router.get("/{textbook_id}", response_model=UserProgress)
async def get_user_progress(
    textbook_id: str,
    current_user = Depends(get_current_active_user)
):
    """
    Get user progress for a specific textbook.
    If no progress exists, initialize with 0% for all chapters and sections.
    Requires authentication.
    """
    logger.info(f"=== GET /progress/{textbook_id} ===")
    logger.info(f"Authenticated user: {current_user.id if current_user else 'None'}")
    logger.info(f"Textbook ID: {textbook_id}")
    
    try:
        logger.info(f"Attempting to get progress from Redis for user {current_user.id}, textbook {textbook_id}")
        progress = await get_progress_from_redis(current_user.id, textbook_id)
        logger.info(f"Successfully retrieved existing progress: {progress.user_id}")
        return progress
    except HTTPException as e:
        logger.info(f"HTTPException in get_progress_from_redis: {e.status_code} - {e.detail}")
        if e.status_code == 404:
            logger.info("Progress not found, initializing new progress...")
            # Initialize progress for first-time user
            new_progress = await initialize_progress_for_new_user(current_user.id, textbook_id)
            logger.info(f"Successfully initialized new progress for user {current_user.id}")
            return new_progress
        else:
            logger.error(f"Unexpected HTTPException: {e}")
            raise
    except Exception as e:
        logger.error(f"Unexpected error in get_user_progress: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.patch("/{textbook_id}/chapter/{chapter_id}")
async def update_chapter(
    textbook_id: str,
    chapter_id: str,
    progress_update: ProgressUpdateRequest,
    current_user = Depends(get_current_active_user)
):
    """Update progress for a specific chapter. Requires authentication."""
    return await update_chapter_progress(current_user.id, textbook_id, chapter_id, progress_update)

@router.patch("/{textbook_id}/chapter/{chapter_id}/subsection/{section_id}")
async def update_section(
    textbook_id: str,
    chapter_id: str,
    section_id: str,
    progress_update: ProgressUpdateRequest,
    current_user = Depends(get_current_active_user)
):
    """Update progress for a specific section. Requires authentication."""
    return await update_section_progress(current_user.id, textbook_id, chapter_id, section_id, progress_update)

@router.get("/")
async def get_all_user_progress(current_user = Depends(get_current_active_user)):
    """Get all progress records for a user across all textbooks. Requires authentication."""
    try:
        pattern = f"user_progress:{current_user.id}:*"
        keys = await redis_client.keys(pattern)
        
        progress_list = []
        for key in keys:
            progress_json = await redis_client.get(key)
            if progress_json:
                progress = UserProgress.model_validate_json(progress_json)
                progress_list.append(progress)
        
        return progress_list
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve all progress: {str(e)}")

@router.get("/test")
async def test_progress_router():
    """Test endpoint to verify the progress router is working"""
    logger.info("Progress router test endpoint called")
    return {"message": "Progress router is working", "timestamp": datetime.now()}
