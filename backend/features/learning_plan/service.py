"""
Learning Plan Service - Generate and manage chapter learning plans
"""

import logging
from typing import Optional, Dict, List
from datetime import datetime
from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI

from backend.db.database import get_collection
from backend.features.learning_plan.models import (
    ChapterLearningPlan,
    LearningObjective,
    LearningPlanProgress,
    MilestoneProgress,
    ConceptMastery,
    LearningAnalysis
)
from backend.routes.textbooks import get_chapter_text

logger = logging.getLogger(__name__)


# Structured output models for LLM responses
class LearningObjectiveOutput(BaseModel):
    """Schema for LLM-generated learning objective"""
    id: str
    concept: str
    description: str
    sub_goals: list[str]
    assessment_criteria: str
    prerequisite_objectives: list[str] = Field(default_factory=list)


class LearningPlanOutput(BaseModel):
    """Schema for LLM-generated learning plan"""
    title: str
    overview: str
    objectives: list[LearningObjectiveOutput]
    conversation_milestones: list[str]
    estimated_time_minutes: int = 60
    difficulty_level: str = "intermediate"


async def get_or_generate_learning_plan(
    textbook_id: str,
    chapter_id: str,
    force_regenerate: bool = False
) -> ChapterLearningPlan:
    """
    Get existing learning plan or generate new one from chapter content.
    Plans are shared across all students for the same chapter.
    """
    collection = await get_collection("chapter_learning_plans")

    # Check if plan already exists
    if not force_regenerate:
        existing = await collection.find_one({
            "textbook_id": textbook_id,
            "chapter_id": str(chapter_id)
        })

        if existing:
            existing.pop("_id", None)
            logger.info(f"Found existing learning plan for chapter {chapter_id}")
            return ChapterLearningPlan(**existing)

    # Generate new plan
    logger.info(f"Generating new learning plan for textbook {textbook_id}, chapter {chapter_id}")

    try:
        # Get chapter content
        chapter_text = await get_chapter_text(textbook_id, str(chapter_id))

        if not chapter_text:
            raise ValueError(f"No chapter text found for {textbook_id}/chapter{chapter_id}")

        # Generate plan using LLM
        plan = await generate_learning_plan_from_text(
            textbook_id=textbook_id,
            chapter_id=str(chapter_id),
            chapter_text=chapter_text
        )

        # Save to MongoDB
        plan_dict = plan.model_dump()
        await collection.insert_one(plan_dict)

        logger.info(f"Generated and saved learning plan with {len(plan.objectives)} objectives")
        return plan

    except Exception as e:
        logger.error(f"Error generating learning plan: {e}")
        raise


async def generate_learning_plan_from_text(
    textbook_id: str,
    chapter_id: str,
    chapter_text: str
) -> ChapterLearningPlan:
    """
    Use LLM to analyze chapter content and create structured learning plan.
    Uses structured output to guarantee valid JSON response.
    """
    llm = ChatOpenAI(model="gpt-5-mini", temperature=0.3, reasoning_effort="medium")
    structured_llm = llm.with_structured_output(LearningPlanOutput)

    prompt = f"""
You are an educational curriculum designer. Analyze this textbook chapter and create a comprehensive learning plan.

Chapter Text:
{chapter_text[:8000]}

Create a detailed learning plan with:
1. Clear learning objectives (3-6 major concepts)
2. Sub-goals for each objective
3. Conversation milestones students should reach
4. Assessment criteria

For each objective, provide:
- id: A unique identifier like "obj_1", "obj_2", etc.
- concept: Main concept name
- description: What the student should achieve
- sub_goals: List of specific skills or sub-concepts
- assessment_criteria: How to know if mastered
- prerequisite_objectives: List of objective IDs that should be completed first (empty if none)

For conversation_milestones, provide key discussion points students should reach.
For difficulty_level, choose: "beginner", "intermediate", or "advanced"

Make objectives specific and measurable. Focus on deep understanding, not memorization.
"""

    result: LearningPlanOutput = await structured_llm.ainvoke(prompt)

    # Convert LLM output to domain models
    objectives = [
        LearningObjective(**obj.model_dump()) for obj in result.objectives
    ]

    plan = ChapterLearningPlan(
        textbook_id=textbook_id,
        chapter_id=chapter_id,
        title=result.title,
        overview=result.overview,
        objectives=objectives,
        conversation_milestones=result.conversation_milestones,
        estimated_time_minutes=result.estimated_time_minutes,
        difficulty_level=result.difficulty_level,
        generated_at=datetime.utcnow(),
        generated_by="gpt-5-mini"
    )

    return plan


async def analyze_learning_from_conversation(
    session_id: str,
    recent_messages: list,
    learning_plan: ChapterLearningPlan,
    current_progress: Optional[LearningPlanProgress] = None
) -> LearningAnalysis:
    """
    Analyze a conversation to detect learning progress.
    Returns metadata about what was learned, understood, etc.
    Uses structured output to guarantee valid response.
    """
    llm = ChatOpenAI(model="gpt-5-mini", temperature=0, reasoning_effort="low")
    structured_llm = llm.with_structured_output(LearningAnalysis, method="function_calling")

    # Format messages
    conv_text = "\n".join([
        f"{msg.get('role', 'unknown')}: {msg.get('content', '')}"
        for msg in recent_messages[-6:]  # Last 6 messages
    ])

    # Build list of objectives for context
    objectives_text = "\n".join([
        f"- {obj.concept}: {obj.description}"
        for obj in learning_plan.objectives
    ])

    milestones_text = "\n".join([
        f"- {milestone}"
        for milestone in learning_plan.conversation_milestones
    ])

    # Current progress context
    completed = current_progress.objectives_completed if current_progress else []
    in_progress = current_progress.objectives_in_progress if current_progress else []

    prompt = f"""
Analyze this tutoring conversation to assess ACTUAL LEARNING, not just exposure.

Learning Plan Objectives:
{objectives_text}

Conversation Milestones:
{milestones_text}

Already Completed: {', '.join(completed) if completed else 'None'}
In Progress: {', '.join(in_progress) if in_progress else 'None'}

Recent Conversation:
{conv_text}

CRITICAL: Focus on what the STUDENT demonstrated, not what the AI explained.

Provide:
- concepts_discussed: List of concepts mentioned in the conversation
- milestone_reached: The milestone text if one was reached, otherwise null
- understanding_demonstrated: Dict mapping concept names to understanding levels
- reference_worthy: True if conversation had a clear breakthrough moment
- reference_concept: The concept name for the breakthrough (if reference_worthy is true)
- reference_message_indices: List of message indices for the breakthrough
- next_objective_suggestion: Suggested next objective ID, or null
- student_engagement: "engaged", "neutral", or "struggling"
- notes: Brief observation about learning style or progress

NEW - Track specific learning events (only include if they ACTUALLY happened):
- learning_events: List of LearningEvent objects when student demonstrated understanding
  * event_type: "explained_concept" | "answered_question" | "corrected_misconception" | "applied_knowledge" | "synthesized_ideas"
  * concept: Which concept
  * description: What the student did (their actual words/actions)
  * confidence: "low" | "medium" | "high"
  * message_content: The student's actual message text

- misconceptions_corrected: List of MisconceptionCorrected when student had a wrong idea that was fixed
  * concept: What concept
  * misconception: What they thought (from their message)
  * correction: What they learned
  * student_acknowledged: Did they show they understood the correction?

- questions_answered: List of QuestionAnswered when tutor asked and student answered
  * question: What was asked (the exact question from the assistant's message)
  * student_answer: What they said (the student's response)
  * was_correct: True/false (evaluate if the answer demonstrates understanding)
  * concept: Related concept
  * difficulty: "easy" | "medium" | "hard"

  IMPORTANT: Look for question-answer pairs in the conversation:
  - Assistant message contains "?" or asks student to explain/apply/compare
  - Student's next message attempts to answer
  - Evaluate correctness based on the concept being tested

- active_practice: List of ActivePracticeCompleted when student did active work
  * practice_type: "problem_solving" | "explanation" | "comparison" | "application" | "prediction"
  * concept: What concept
  * quality: "poor" | "fair" | "good" | "excellent"
  * details: What they did

Understanding level criteria (based on what STUDENT did, not what tutor explained):
- "mastered": Student explained concept clearly or applied it correctly
- "proficient": Student understands core idea, minor gaps in explanation
- "partial": Student grasps some parts, still learning (asked clarifying questions, partial answers)
- "confused": Student struggled, wrong answers, or expressed confusion

Guidelines:
- If student just received information passively → NO learning events
- If student asked a question → NOT a learning event (unless they answered one)
- If student explained something → YES, add "explained_concept" event
- If student corrected their understanding → YES, add misconception_corrected
- If student applied concept to new situation → YES, add "applied_knowledge" event
- Only mark concepts as "mastered" or "proficient" if student DEMONSTRATED understanding
"""

    result: LearningAnalysis = await structured_llm.ainvoke(prompt)
    return result


async def update_student_progress_from_analysis(
    user_id: str,
    textbook_id: str,
    chapter_id: str,
    session_id: str,
    analysis: LearningAnalysis,
    recent_messages: list
) -> None:
    """
    Update student_context based on learning analysis from chat.
    """
    from backend.features.student_context.service import get_student_context

    collection = await get_collection("student_context")

    # Get current context
    context = await get_student_context(user_id, textbook_id, chapter_id)

    # Initialize learning_plan_progress if doesn't exist
    needs_initialization = (
        not context or
        not context.learning_plan_progress or
        context.learning_plan_progress is None
    )

    if needs_initialization:
        # Get learning plan to initialize
        learning_plan = await get_or_generate_learning_plan(textbook_id, chapter_id)

        initial_progress = LearningPlanProgress(
            objectives_not_started=[obj.id for obj in learning_plan.objectives],
            conversation_milestones=[
                MilestoneProgress(milestone=m) for m in learning_plan.conversation_milestones
            ]
        )

        await collection.update_one(
            {
                "user_id": user_id,
                "textbook_id": textbook_id,
                "chapter_id": str(chapter_id)
            },
            {
                "$set": {
                    "learning_plan_progress": initial_progress.model_dump(),
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )

        logger.info(f"Initialized learning_plan_progress for user {user_id}, chapter {chapter_id}")

    # Get the learning plan (needed for filtering concepts and checking objectives)
    from backend.features.learning_plan.models import ChapterLearningPlan
    learning_plan_from_db = await get_or_generate_learning_plan(textbook_id, chapter_id)

    # Build separate update operations
    set_updates = {"updated_at": datetime.utcnow()}
    push_updates = {}
    addToSet_updates = {}

    # Update concept mastery
    for concept, level in analysis.understanding_demonstrated.items():
        mastery = ConceptMastery(
            concept_name=concept,
            understanding_level=level,
            learned_through_chat=True,
            last_reviewed=datetime.utcnow()
        )

        if level in ["mastered", "proficient"]:
            mastery.learned_at = datetime.utcnow()

        # Add reference messages if this was a breakthrough
        if analysis.reference_worthy and analysis.reference_concept == concept:
            mastery.reference_messages = [
                recent_messages[i] for i in analysis.reference_message_indices
                if i < len(recent_messages)
            ]

        set_updates[f"learning_plan_progress.concept_mastery.{concept}"] = mastery.model_dump()

    # NEW: Add learning events to progress tracking
    if analysis.learning_events:
        # Add session_id to each event before saving
        for event in analysis.learning_events:
            event.session_id = session_id
        events_to_add = [event.model_dump() for event in analysis.learning_events]
        push_updates["learning_plan_progress.learning_events"] = {"$each": events_to_add}

        # Update depth metrics based on events
        for event in analysis.learning_events:
            if event.event_type == "explained_concept":
                if "learning_plan_progress.concepts_can_explain" not in addToSet_updates:
                    addToSet_updates["learning_plan_progress.concepts_can_explain"] = {"$each": []}
                addToSet_updates["learning_plan_progress.concepts_can_explain"]["$each"].append(event.concept)
            elif event.event_type in ["applied_knowledge", "synthesized_ideas"]:
                if "learning_plan_progress.concepts_can_apply" not in addToSet_updates:
                    addToSet_updates["learning_plan_progress.concepts_can_apply"] = {"$each": []}
                addToSet_updates["learning_plan_progress.concepts_can_apply"]["$each"].append(event.concept)

            # Track exposure-only concepts (those discussed but not demonstrated)
            if event.concept in analysis.concepts_discussed:
                if event.event_type in ["explained_concept", "applied_knowledge", "synthesized_ideas"]:
                    # Remove from exposure_only if they demonstrated understanding
                    await collection.update_one(
                        {
                            "user_id": user_id,
                            "textbook_id": textbook_id,
                            "chapter_id": str(chapter_id)
                        },
                        {"$pull": {"learning_plan_progress.concepts_exposure_only": event.concept}}
                    )

    # Track concepts that were only discussed (not demonstrated)
    # FILTER: Only track concepts that were substantially discussed (appear in learning plan objectives)
    learning_plan_concepts = [obj.concept.lower() for obj in learning_plan_from_db.objectives]

    for concept in analysis.concepts_discussed:
        is_demonstrated = any(e.concept == concept for e in analysis.learning_events)

        # Only track if: (1) not demonstrated AND (2) it's a major concept from learning plan
        is_major_concept = concept.lower() in learning_plan_concepts

        if not is_demonstrated and is_major_concept:
            if "learning_plan_progress.concepts_exposure_only" not in addToSet_updates:
                addToSet_updates["learning_plan_progress.concepts_exposure_only"] = {"$each": []}
            addToSet_updates["learning_plan_progress.concepts_exposure_only"]["$each"].append(concept)

    # Add misconceptions corrected
    if analysis.misconceptions_corrected:
        # Add session_id to each misconception before saving
        for m in analysis.misconceptions_corrected:
            m.session_id = session_id
        misconceptions_to_add = [m.model_dump() for m in analysis.misconceptions_corrected]
        push_updates["learning_plan_progress.misconceptions_corrected"] = {"$each": misconceptions_to_add}

    # Add questions answered
    if analysis.questions_answered:
        # Add session_id to each question before saving
        for q in analysis.questions_answered:
            q.session_id = session_id
        questions_to_add = [q.model_dump() for q in analysis.questions_answered]
        push_updates["learning_plan_progress.questions_answered"] = {"$each": questions_to_add}

    # Add active practice completed
    if analysis.active_practice:
        # Add session_id to each practice before saving
        for p in analysis.active_practice:
            p.session_id = session_id
        practice_to_add = [p.model_dump() for p in analysis.active_practice]
        push_updates["learning_plan_progress.active_practice_completed"] = {"$each": practice_to_add}

    # Update milestone if reached
    if analysis.milestone_reached:
        milestone_update = MilestoneProgress(
            milestone=analysis.milestone_reached,
            reached=True,
            reached_at=datetime.utcnow(),
            session_id=session_id,
            key_messages=recent_messages[-3:]  # Last 3 messages
        )
        set_updates["learning_plan_progress.conversation_milestones.$[elem]"] = milestone_update.model_dump()

    # NEW: Update objective status based on progress
    # Check which objectives should be in progress or completed
    for objective in learning_plan_from_db.objectives:
        obj_id = objective.id
        obj_concept = objective.concept

        # Check if this objective should be marked as in_progress
        # Criteria: student has done something with this concept
        is_discussed = obj_concept.lower() in [c.lower() for c in analysis.concepts_discussed]
        has_events = any(e.concept.lower() == obj_concept.lower() for e in analysis.learning_events)

        if is_discussed or has_events:
            # Move from not_started to in_progress if needed
            await collection.update_one(
                {
                    "user_id": user_id,
                    "textbook_id": textbook_id,
                    "chapter_id": str(chapter_id),
                    "learning_plan_progress.objectives_not_started": obj_id
                },
                {
                    "$pull": {"learning_plan_progress.objectives_not_started": obj_id},
                    "$addToSet": {"learning_plan_progress.objectives_in_progress": obj_id}
                }
            )

        # Check if this objective should be marked as completed
        # Criteria: student demonstrated mastery (can explain AND apply, or multiple high-confidence events)
        # Get the current progress data from context (before this update)
        context_now = await get_student_context(user_id, textbook_id, chapter_id)
        current_progress_data = context_now.learning_plan_progress if context_now else {}

        can_explain = obj_concept.lower() in [c.lower() for c in current_progress_data.get("concepts_can_explain", [])]
        can_apply = obj_concept.lower() in [c.lower() for c in current_progress_data.get("concepts_can_apply", [])]

        # Also check if we're adding it in this update
        if addToSet_updates.get("learning_plan_progress.concepts_can_explain"):
            can_explain = can_explain or obj_concept.lower() in [
                c.lower() for c in addToSet_updates["learning_plan_progress.concepts_can_explain"]["$each"]
            ]
        if addToSet_updates.get("learning_plan_progress.concepts_can_apply"):
            can_apply = can_apply or obj_concept.lower() in [
                c.lower() for c in addToSet_updates["learning_plan_progress.concepts_can_apply"]["$each"]
            ]

        high_confidence_events = [
            e for e in analysis.learning_events
            if e.concept.lower() == obj_concept.lower() and e.confidence == "high"
        ]

        is_mastered = (can_explain and can_apply) or len(high_confidence_events) >= 3

        if is_mastered:
            # Move from in_progress to completed
            await collection.update_one(
                {
                    "user_id": user_id,
                    "textbook_id": textbook_id,
                    "chapter_id": str(chapter_id),
                    "learning_plan_progress.objectives_in_progress": obj_id
                },
                {
                    "$pull": {"learning_plan_progress.objectives_in_progress": obj_id},
                    "$addToSet": {"learning_plan_progress.objectives_completed": obj_id}
                }
            )
            logger.info(f"Marked objective {obj_id} ({obj_concept}) as completed for user {user_id}")

    # Calculate overall progress percentage
    # Re-fetch the context to get updated objective lists
    updated_context = await get_student_context(user_id, textbook_id, chapter_id)
    if updated_context and updated_context.learning_plan_progress:
        progress_data = updated_context.learning_plan_progress
        completed = len(progress_data.get("objectives_completed", []))
        in_progress = len(progress_data.get("objectives_in_progress", []))
        not_started = len(progress_data.get("objectives_not_started", []))
        total = completed + in_progress + not_started

        if total > 0:
            # Weight: completed = 100%, in_progress = 50%, not_started = 0%
            progress_percent = ((completed * 100) + (in_progress * 50)) / total
            set_updates["learning_plan_progress.overall_progress_percent"] = round(progress_percent, 1)

    # Build the complete update operation
    update_operation = {}
    if set_updates and len(set_updates) > 1:  # More than just updated_at
        update_operation["$set"] = set_updates
    if push_updates:
        update_operation["$push"] = push_updates
    if addToSet_updates:
        update_operation["$addToSet"] = addToSet_updates

    # Apply updates
    if update_operation:
        await collection.update_one(
            {
                "user_id": user_id,
                "textbook_id": textbook_id,
                "chapter_id": str(chapter_id)
            },
            update_operation,
            array_filters=[{"elem.milestone": analysis.milestone_reached}] if analysis.milestone_reached else None
        )

        # Log what was tracked
        log_msg = f"Updated learning progress for user {user_id}:"
        if analysis.understanding_demonstrated:
            log_msg += f" concepts: {list(analysis.understanding_demonstrated.keys())}"
        if analysis.learning_events:
            log_msg += f" | {len(analysis.learning_events)} learning events"
        if analysis.questions_answered:
            log_msg += f" | {len(analysis.questions_answered)} questions answered"
        if analysis.misconceptions_corrected:
            log_msg += f" | {len(analysis.misconceptions_corrected)} misconceptions corrected"
        logger.info(log_msg)


async def get_meaningful_progress_summary(
    user_id: str,
    textbook_id: str,
    chapter_id: str
) -> Dict:
    """
    Get a meaningful progress summary that shows DEPTH of learning, not just exposure.
    Returns counts of actual learning events, not just message counts.
    """
    from backend.features.student_context.service import get_student_context

    context = await get_student_context(user_id, textbook_id, chapter_id)

    if not context or not context.learning_plan_progress:
        return {
            "status": "not_started",
            "message": "No learning data yet",
            "metrics": {}
        }

    progress = context.learning_plan_progress

    # Count actual learning events
    total_learning_events = len(progress.get("learning_events", []))
    total_questions_answered = len(progress.get("questions_answered", []))
    correct_answers = sum(1 for q in progress.get("questions_answered", []) if q.get("was_correct", False))
    total_misconceptions_corrected = len(progress.get("misconceptions_corrected", []))
    total_active_practice = len(progress.get("active_practice_completed", []))

    # Depth metrics
    concepts_can_explain = progress.get("concepts_can_explain", [])
    concepts_can_apply = progress.get("concepts_can_apply", [])
    concepts_exposure_only = progress.get("concepts_exposure_only", [])

    # Concept mastery breakdown
    concept_mastery = progress.get("concept_mastery", {})
    mastered_count = sum(1 for c in concept_mastery.values() if c.get("understanding_level") == "mastered")
    proficient_count = sum(1 for c in concept_mastery.values() if c.get("understanding_level") == "proficient")
    partial_count = sum(1 for c in concept_mastery.values() if c.get("understanding_level") == "partial")
    confused_count = sum(1 for c in concept_mastery.values() if c.get("understanding_level") == "confused")

    # Learning event breakdown
    event_types = {}
    for event in progress.get("learning_events", []):
        event_type = event.get("event_type", "unknown")
        event_types[event_type] = event_types.get(event_type, 0) + 1

    return {
        "status": "in_progress",
        "overall_progress_percent": progress.get("overall_progress_percent", 0),

        # Depth indicators (what matters most)
        "depth_metrics": {
            "concepts_can_explain": len(concepts_can_explain),
            "concepts_can_explain_list": concepts_can_explain,
            "concepts_can_apply": len(concepts_can_apply),
            "concepts_can_apply_list": concepts_can_apply,
            "concepts_exposure_only": len(concepts_exposure_only),
            "concepts_exposure_only_list": concepts_exposure_only,
        },

        # Learning event counts (evidence of learning)
        "learning_evidence": {
            "total_learning_events": total_learning_events,
            "event_breakdown": event_types,
            "questions_answered": total_questions_answered,
            "questions_correct": correct_answers,
            "accuracy": round(correct_answers / total_questions_answered * 100, 1) if total_questions_answered > 0 else 0,
            "misconceptions_corrected": total_misconceptions_corrected,
            "active_practice_completed": total_active_practice,
        },

        # Concept mastery distribution
        "concept_understanding": {
            "mastered": mastered_count,
            "proficient": proficient_count,
            "partial": partial_count,
            "confused": confused_count,
            "total_concepts_tracked": len(concept_mastery),
        },

        # Objectives progress
        "objectives": {
            "completed": len(progress.get("objectives_completed", [])),
            "in_progress": len(progress.get("objectives_in_progress", [])),
            "not_started": len(progress.get("objectives_not_started", [])),
        },

        # Milestones
        "milestones": {
            "total": len(progress.get("conversation_milestones", [])),
            "reached": sum(1 for m in progress.get("conversation_milestones", []) if m.get("reached", False)),
        },

        # Human-readable summary
        "summary": _generate_progress_narrative(
            concepts_can_explain,
            concepts_can_apply,
            concepts_exposure_only,
            total_learning_events,
            total_questions_answered,
            correct_answers,
            mastered_count,
            proficient_count
        )
    }


def _generate_progress_narrative(
    can_explain: List[str],
    can_apply: List[str],
    exposure_only: List[str],
    learning_events: int,
    questions_answered: int,
    correct_answers: int,
    mastered: int,
    proficient: int
) -> str:
    """Generate a human-readable progress narrative."""

    if learning_events == 0 and questions_answered == 0:
        return "You've started exploring the material but haven't yet demonstrated understanding. Try explaining concepts in your own words or working through examples."

    parts = []

    # What they can do
    if can_explain:
        parts.append(f"You can explain {len(can_explain)} concept(s): {', '.join(can_explain[:3])}")

    if can_apply:
        parts.append(f"You can apply {len(can_apply)} concept(s) to new situations")

    # What they're still learning
    if exposure_only:
        parts.append(f"You've heard about {len(exposure_only)} concept(s) but haven't demonstrated understanding yet")

    # Performance metrics
    if questions_answered > 0:
        accuracy = round(correct_answers / questions_answered * 100, 1)
        parts.append(f"You've answered {questions_answered} questions with {accuracy}% accuracy")

    # Mastery summary
    if mastered > 0:
        parts.append(f"{mastered} concept(s) mastered")
    if proficient > 0:
        parts.append(f"{proficient} concept(s) at proficient level")

    return ". ".join(parts) + "."
