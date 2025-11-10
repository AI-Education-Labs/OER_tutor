"""
Learning Plan Routes - Trigger generation and check status
"""

import logging
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel

from backend.features.auth.service import validate_access_token
from backend.features.learning_plan.service import (
    get_or_generate_learning_plan,
    get_meaningful_progress_summary
)
from backend.db.database import get_collection

router = APIRouter()
logger = logging.getLogger(__name__)


class LearningPlanRequest(BaseModel):
    textbook_id: str
    chapter_id: str


@router.post("/api/learning-plan/ensure")
async def ensure_learning_plan_exists(
    request: LearningPlanRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(validate_access_token)
):
    """
    Ensure learning plan exists for a chapter.
    If it doesn't exist, trigger generation in background.
    Returns immediately with status.

    Call this when a student opens a chapter for the first time.
    """
    try:
        # Quick check if plan exists
        collection = await get_collection("chapter_learning_plans")
        existing = await collection.find_one({
            "textbook_id": request.textbook_id,
            "chapter_id": str(request.chapter_id)
        })

        if existing:
            return {
                "exists": True,
                "status": "ready",
                "message": "Learning plan is ready"
            }
        else:
            # Trigger generation in background (non-blocking)
            background_tasks.add_task(
                generate_plan_background,
                request.textbook_id,
                request.chapter_id
            )

            return {
                "exists": False,
                "status": "generating",
                "message": "Learning plan is being generated in background"
            }

    except Exception as e:
        logger.error(f"Error checking learning plan: {e}")
        raise HTTPException(status_code=500, detail="Failed to check learning plan status")


@router.get("/api/learning-plan/status/{textbook_id}/{chapter_id}")
async def get_learning_plan_status(
    textbook_id: str,
    chapter_id: str,
    user_id: str = Depends(validate_access_token)
):
    """
    Check if learning plan exists for a chapter.
    Returns status without triggering generation.
    """
    try:
        collection = await get_collection("chapter_learning_plans")
        existing = await collection.find_one({
            "textbook_id": textbook_id,
            "chapter_id": str(chapter_id)
        })

        if existing:
            # Remove MongoDB _id for response
            existing.pop("_id", None)

            return {
                "exists": True,
                "status": "ready",
                "plan": {
                    "title": existing.get("title"),
                    "overview": existing.get("overview"),
                    "objectives_count": len(existing.get("objectives", [])),
                    "milestones_count": len(existing.get("conversation_milestones", []))
                }
            }
        else:
            return {
                "exists": False,
                "status": "not_generated"
            }

    except Exception as e:
        logger.error(f"Error getting learning plan status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get learning plan status")


async def generate_plan_background(textbook_id: str, chapter_id: str):
    """
    Background task to generate learning plan.
    Runs asynchronously without blocking user.
    """
    try:
        logger.info(f"Background: Generating learning plan for {textbook_id}/chapter{chapter_id}")

        # This will generate and save the plan
        plan = await get_or_generate_learning_plan(textbook_id, chapter_id)

        logger.info(f"Background: Successfully generated learning plan with {len(plan.objectives)} objectives")

    except Exception as e:
        logger.error(f"Background: Error generating learning plan: {e}", exc_info=True)


@router.get("/api/learning-plan/progress/{textbook_id}/{chapter_id}")
async def get_student_progress_depth(
    textbook_id: str,
    chapter_id: str,
    user_id: str = Depends(validate_access_token)
):
    """
    Get meaningful progress data that shows depth of learning, not just exposure.

    Returns:
    - What concepts the student CAN EXPLAIN (demonstrated understanding)
    - What concepts the student CAN APPLY (applied to new situations)
    - What concepts were only discussed (exposure but no demonstration)
    - Learning events (explained concepts, answered questions, etc.)
    - Questions answered with accuracy
    - Misconceptions corrected
    - Active practice completed
    - Human-readable progress narrative

    This replaces simple message counts with actual learning metrics.
    """
    try:
        progress = await get_meaningful_progress_summary(user_id, textbook_id, chapter_id)
        return progress

    except Exception as e:
        logger.error(f"Error getting progress summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get progress summary")
