"""
Learning Plan Service - Generate and manage chapter learning plans
"""

import json
import logging
from typing import Optional
from datetime import datetime

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
    """
    llm = ChatOpenAI(model="gpt-5-mini", temperature=0.3, reasoning_effort="medium")

    prompt = f"""
You are an educational curriculum designer. Analyze this textbook chapter and create a comprehensive learning plan.

Chapter Text:
{chapter_text[:8000]}

Create a detailed learning plan with:
1. Clear learning objectives (3-6 major concepts)
2. Sub-goals for each objective
3. Conversation milestones students should reach
4. Assessment criteria

Return ONLY valid JSON matching this structure:
{{
  "title": "Chapter title",
  "overview": "1-2 sentence overview",
  "objectives": [
    {{
      "id": "obj_1",
      "concept": "Main concept name",
      "description": "What student should achieve",
      "sub_goals": ["specific skill 1", "specific skill 2"],
      "assessment_criteria": "How to know if mastered",
      "prerequisite_objectives": []
    }}
  ],
  "conversation_milestones": [
    "Key discussion point to reach",
    "Another milestone"
  ],
  "estimated_time_minutes": 60,
  "difficulty_level": "beginner|intermediate|advanced"
}}

Make objectives specific and measurable. Focus on deep understanding, not memorization.
"""

    result = await llm.ainvoke(prompt)

    # Parse JSON response
    try:
        plan_data = json.loads(result.content)

        # Create objectives
        objectives = [
            LearningObjective(**obj) for obj in plan_data.get("objectives", [])
        ]

        # Create learning plan
        plan = ChapterLearningPlan(
            textbook_id=textbook_id,
            chapter_id=chapter_id,
            title=plan_data.get("title", f"Chapter {chapter_id}"),
            overview=plan_data.get("overview", ""),
            objectives=objectives,
            conversation_milestones=plan_data.get("conversation_milestones", []),
            estimated_time_minutes=plan_data.get("estimated_time_minutes", 60),
            difficulty_level=plan_data.get("difficulty_level", "intermediate"),
            generated_at=datetime.utcnow(),
            generated_by="gpt-4o"
        )

        return plan

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        logger.error(f"Response was: {result.content[:500]}")
        raise


async def analyze_learning_from_conversation(
    session_id: str,
    recent_messages: list,
    learning_plan: ChapterLearningPlan,
    current_progress: Optional[LearningPlanProgress] = None
) -> LearningAnalysis:
    """
    Analyze a conversation to detect learning progress.
    Returns metadata about what was learned, understood, etc.
    """
    llm = ChatOpenAI(model="gpt-5-mini", temperature=0, reasoning_effort="low")

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
Analyze this tutoring conversation to assess learning progress.

Learning Plan Objectives:
{objectives_text}

Conversation Milestones:
{milestones_text}

Already Completed: {', '.join(completed) if completed else 'None'}
In Progress: {', '.join(in_progress) if in_progress else 'None'}

Recent Conversation:
{conv_text}

Return ONLY valid JSON:
{{
  "concepts_discussed": ["concept1", "concept2"],
  "milestone_reached": "milestone text" or null,
  "understanding_demonstrated": {{
    "concept_name": "mastered" | "proficient" | "partial" | "confused"
  }},
  "reference_worthy": true/false,
  "reference_concept": "concept name" or null,
  "reference_message_indices": [0, 2, 4],
  "next_objective_suggestion": "obj_id" or null,
  "student_engagement": "engaged" | "neutral" | "struggling",
  "notes": "Brief observation about learning style or progress"
}}

Criteria:
- "mastered": Can explain concept clearly and apply it
- "proficient": Understands core idea, minor gaps
- "partial": Grasps some parts, still learning
- "confused": Struggling or misconceptions

Only mark reference_worthy=true if conversation had a clear breakthrough moment.
"""

    result = await llm.ainvoke(prompt)

    try:
        analysis_data = json.loads(result.content)
        return LearningAnalysis(**analysis_data)

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse learning analysis: {e}")
        # Return empty analysis on failure
        return LearningAnalysis()


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
    if not context or not hasattr(context, 'learning_plan_progress'):
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

    # Update concept mastery
    updates = {"updated_at": datetime.utcnow()}

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

        updates[f"learning_plan_progress.concept_mastery.{concept}"] = mastery.model_dump()

    # Update milestone if reached
    if analysis.milestone_reached:
        milestone_update = MilestoneProgress(
            milestone=analysis.milestone_reached,
            reached=True,
            reached_at=datetime.utcnow(),
            session_id=session_id,
            key_messages=recent_messages[-3:]  # Last 3 messages
        )

        # Find and update the milestone
        updates["learning_plan_progress.conversation_milestones.$[elem]"] = milestone_update.model_dump()

    # Apply updates
    if len(updates) > 1:  # More than just updated_at
        await collection.update_one(
            {
                "user_id": user_id,
                "textbook_id": textbook_id,
                "chapter_id": str(chapter_id)
            },
            {"$set": updates},
            array_filters=[{"elem.milestone": analysis.milestone_reached}] if analysis.milestone_reached else None
        )

        logger.info(f"Updated learning progress for user {user_id}: {list(analysis.understanding_demonstrated.keys())}")
