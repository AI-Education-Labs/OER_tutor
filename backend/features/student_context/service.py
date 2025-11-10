"""
Student Context Service - Manage per-chapter student learning data
"""

from typing import Optional, List
from datetime import datetime
import logging

from backend.db.database import get_collection
from backend.features.student_context.models import (
    StudentChapterContext,
    QuizAttempt,
    ConceptUnderstanding
)

logger = logging.getLogger(__name__)


async def get_student_context(
    user_id: str,
    textbook_id: str,
    chapter_id: str
) -> Optional[StudentChapterContext]:
    """
    Retrieve student context for a specific chapter.
    Returns None if no context exists yet.
    """
    try:
        collection = await get_collection("student_context")
        doc = await collection.find_one({
            "user_id": user_id,
            "textbook_id": textbook_id,
            "chapter_id": str(chapter_id)
        })

        if doc:
            # Remove MongoDB _id field
            doc.pop("_id", None)
            return StudentChapterContext(**doc)
        return None

    except Exception as e:
        logger.error(f"Error fetching student context: {e}")
        return None


async def create_or_update_student_context(
    user_id: str,
    textbook_id: str,
    chapter_id: str,
    updates: dict
) -> StudentChapterContext:
    """
    Create or update student context for a chapter.
    Merges updates with existing data.
    """
    try:
        collection = await get_collection("student_context")

        # Set updated timestamp
        updates["updated_at"] = datetime.utcnow()

        result = await collection.update_one(
            {
                "user_id": user_id,
                "textbook_id": textbook_id,
                "chapter_id": str(chapter_id)
            },
            {
                "$set": updates,
                "$setOnInsert": {
                    "user_id": user_id,
                    "textbook_id": textbook_id,
                    "chapter_id": str(chapter_id),
                    "created_at": datetime.utcnow()
                }
            },
            upsert=True
        )

        # Fetch and return updated context
        context = await get_student_context(user_id, textbook_id, chapter_id)
        return context

    except Exception as e:
        logger.error(f"Error updating student context: {e}")
        raise


async def add_quiz_attempt(
    user_id: str,
    textbook_id: str,
    chapter_id: str,
    quiz_attempt: QuizAttempt
) -> None:
    """
    Add a quiz attempt to student context and update averages.
    """
    try:
        collection = await get_collection("student_context")

        # Convert quiz_attempt to dict
        quiz_dict = quiz_attempt.model_dump()

        # Update quiz history and recalculate average
        result = await collection.update_one(
            {
                "user_id": user_id,
                "textbook_id": textbook_id,
                "chapter_id": str(chapter_id)
            },
            {
                "$push": {"quiz_history": quiz_dict},
                "$inc": {"total_quizzes_taken": 1},
                "$set": {"updated_at": datetime.utcnow()}
            },
            upsert=True
        )

        # Recalculate average score
        context = await get_student_context(user_id, textbook_id, chapter_id)
        if context and context.quiz_history:
            avg_score = sum(q.score for q in context.quiz_history) / len(context.quiz_history)
            await collection.update_one(
                {
                    "user_id": user_id,
                    "textbook_id": textbook_id,
                    "chapter_id": str(chapter_id)
                },
                {"$set": {"average_quiz_score": round(avg_score, 2)}}
            )

        # Update struggling concepts from missed questions
        if quiz_attempt.missed_concepts:
            await collection.update_one(
                {
                    "user_id": user_id,
                    "textbook_id": textbook_id,
                    "chapter_id": str(chapter_id)
                },
                {"$addToSet": {"concepts_struggling": {"$each": quiz_attempt.missed_concepts}}}
            )

        logger.info(f"Added quiz attempt for user {user_id}, chapter {chapter_id}")

    except Exception as e:
        logger.error(f"Error adding quiz attempt: {e}")
        raise


async def update_concept_understanding(
    user_id: str,
    textbook_id: str,
    chapter_id: str,
    concept_name: str,
    understanding_level: str,
    confusion_points: List[str] = None
) -> None:
    """
    Update understanding level for a specific concept.
    """
    try:
        collection = await get_collection("student_context")

        concept_update = {
            "concept_name": concept_name,
            "understanding_level": understanding_level,
            "last_discussed": datetime.utcnow(),
        }

        # Increment review count
        context = await get_student_context(user_id, textbook_id, chapter_id)
        if context and concept_name in context.concept_details:
            existing = context.concept_details[concept_name]
            concept_update["times_reviewed"] = existing.times_reviewed + 1
            if confusion_points:
                concept_update["confusion_points"] = existing.confusion_points + confusion_points
        else:
            concept_update["times_reviewed"] = 1
            concept_update["confusion_points"] = confusion_points or []

        await collection.update_one(
            {
                "user_id": user_id,
                "textbook_id": textbook_id,
                "chapter_id": str(chapter_id)
            },
            {
                "$set": {
                    f"concept_details.{concept_name}": concept_update,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )

        # Update mastered/struggling lists
        if understanding_level == "mastered":
            await collection.update_one(
                {
                    "user_id": user_id,
                    "textbook_id": textbook_id,
                    "chapter_id": str(chapter_id)
                },
                {
                    "$addToSet": {"concepts_mastered": concept_name},
                    "$pull": {"concepts_struggling": concept_name}
                }
            )
        elif understanding_level == "struggling":
            await collection.update_one(
                {
                    "user_id": user_id,
                    "textbook_id": textbook_id,
                    "chapter_id": str(chapter_id)
                },
                {
                    "$addToSet": {"concepts_struggling": concept_name},
                    "$pull": {"concepts_mastered": concept_name}
                }
            )

        logger.info(f"Updated concept '{concept_name}' to '{understanding_level}' for user {user_id}")

    except Exception as e:
        logger.error(f"Error updating concept understanding: {e}")
        raise


async def increment_chat_interaction(
    user_id: str,
    textbook_id: str,
    chapter_id: str,
    session_id: str
) -> None:
    """
    Increment chat message count and update last chat session.
    """
    try:
        collection = await get_collection("student_context")

        await collection.update_one(
            {
                "user_id": user_id,
                "textbook_id": textbook_id,
                "chapter_id": str(chapter_id)
            },
            {
                "$inc": {"total_chat_messages": 1},
                "$set": {
                    "last_chat_session": session_id,
                    "last_chat_timestamp": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )

    except Exception as e:
        logger.error(f"Error incrementing chat interaction: {e}")


async def get_student_context_summary(
    user_id: str,
    textbook_id: str,
    chapter_id: str
) -> str:
    """
    Generate a formatted summary of student context for LLM prompt.
    """
    context = await get_student_context(user_id, textbook_id, chapter_id)

    if not context:
        return "No prior learning data for this chapter."

    summary_parts = []

    # Quiz performance
    if context.total_quizzes_taken > 0:
        summary_parts.append(
            f"Quiz Performance: {context.total_quizzes_taken} quiz(es) taken, "
            f"average score {context.average_quiz_score:.1f}%"
        )

        if context.quiz_history:
            recent_quiz = context.quiz_history[-1]
            summary_parts.append(
                f"Most recent quiz: {recent_quiz.score:.1f}% "
                f"({recent_quiz.correct_answers}/{recent_quiz.total_questions} correct)"
            )
            if recent_quiz.missed_concepts:
                summary_parts.append(
                    f"Missed concepts: {', '.join(recent_quiz.missed_concepts)}"
                )

    # Concept mastery
    if context.concepts_mastered:
        summary_parts.append(
            f"Mastered concepts: {', '.join(context.concepts_mastered[:5])}"
            + (f" (+{len(context.concepts_mastered) - 5} more)" if len(context.concepts_mastered) > 5 else "")
        )

    if context.concepts_struggling:
        summary_parts.append(
            f"Struggling with: {', '.join(context.concepts_struggling)}"
        )

    # Chat activity
    if context.total_chat_messages > 0:
        summary_parts.append(
            f"Chat activity: {context.total_chat_messages} messages exchanged"
        )

    # Reading progress
    if context.reading_progress_percent > 0:
        summary_parts.append(
            f"Reading progress: {context.reading_progress_percent}% of chapter"
        )

    # Learning style notes
    if context.learning_style_notes:
        summary_parts.append(
            f"Learning notes: {context.learning_style_notes}"
        )

    return "\n".join(f"- {part}" for part in summary_parts)
