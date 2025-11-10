"""
Learning Plan Models - Chapter-based curriculum and student progress tracking
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime


class LearningObjective(BaseModel):
    """A single learning objective within a chapter."""
    id: str  # e.g., "obj_1"
    concept: str  # e.g., "Scientific Method"
    description: str  # What student should achieve
    sub_goals: List[str] = []  # Specific skills/knowledge
    assessment_criteria: str  # How to know if mastered
    prerequisite_objectives: List[str] = []  # IDs of objectives needed first


class ChapterLearningPlan(BaseModel):
    """Complete learning plan for a chapter, generated once and shared."""
    textbook_id: str
    chapter_id: str

    title: str  # Chapter title
    overview: str  # What this chapter covers

    objectives: List[LearningObjective]

    conversation_milestones: List[str] = []  # Key discussion points to reach

    estimated_time_minutes: int = 60  # How long chapter should take
    difficulty_level: str = "intermediate"  # beginner, intermediate, advanced

    generated_at: datetime = Field(default_factory=datetime.utcnow)
    generated_by: str = "gpt-4o"  # Model used to generate

    class Config:
        json_schema_extra = {
            "example": {
                "textbook_id": "textbook-uuid",
                "chapter_id": "1",
                "title": "Chapter 1: What is Physics?",
                "overview": "Introduction to physics as a science and the scientific method",
                "objectives": [
                    {
                        "id": "obj_1",
                        "concept": "Scientific Method",
                        "description": "Understand the systematic approach to inquiry",
                        "sub_goals": [
                            "List the 5 ways of knowing",
                            "Explain steps of scientific method",
                            "Apply method to a hypothesis"
                        ],
                        "assessment_criteria": "Can explain each method with examples",
                        "prerequisite_objectives": []
                    }
                ],
                "conversation_milestones": [
                    "Discussed all 5 ways of knowing",
                    "Distinguished science from pseudoscience"
                ],
                "estimated_time_minutes": 90,
                "difficulty_level": "beginner"
            }
        }


class ConceptMastery(BaseModel):
    """Student's understanding of a specific concept."""
    concept_name: str
    understanding_level: str = "not_started"  # not_started, partial, proficient, mastered

    learned_through_chat: bool = False
    learned_through_quiz: bool = False

    learned_at: Optional[datetime] = None
    last_reviewed: Optional[datetime] = None

    # Reference messages where student had breakthrough
    reference_messages: List[Dict] = []  # {role, content, timestamp}

    # Chat-based assessment
    conversation_quality: Optional[str] = None  # Can explain, Can apply, Can teach
    confusion_points: List[str] = []

    # Quiz-based assessment
    quiz_performance: Optional[float] = None  # Average score on this concept
    times_quizzed: int = 0


class MilestoneProgress(BaseModel):
    """Progress on conversation milestones."""
    milestone: str
    reached: bool = False
    reached_at: Optional[datetime] = None
    session_id: Optional[str] = None
    key_messages: List[Dict] = []  # Messages where milestone was achieved


class LearningEvent(BaseModel):
    """
    A specific learning event that demonstrates understanding.
    These are concrete evidence of learning, not just exposure.
    """
    event_type: str  # "explained_concept", "answered_question", "corrected_misconception", "applied_knowledge", "synthesized_ideas"
    concept: str  # Which concept this relates to
    description: str  # What the student did
    confidence: str = "medium"  # low, medium, high - how confident we are this demonstrates learning
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    session_id: Optional[str] = None
    message_content: Optional[str] = None  # The actual student message


class MisconceptionCorrected(BaseModel):
    """Track when a misconception is identified and corrected."""
    concept: str
    misconception: str  # What the student thought
    correction: str  # What they learned
    corrected_at: datetime = Field(default_factory=datetime.utcnow)
    session_id: Optional[str] = None
    student_acknowledged: bool = False  # Did student demonstrate they understand the correction?


class QuestionAnswered(BaseModel):
    """Track questions the student answered (not just asked)."""
    question: str
    student_answer: str
    was_correct: bool
    concept: str
    difficulty: str = "medium"  # easy, medium, hard
    answered_at: datetime = Field(default_factory=datetime.utcnow)
    session_id: Optional[str] = None


class ActivePracticeCompleted(BaseModel):
    """Track when student completes active practice (not passive reading)."""
    practice_type: str  # "problem_solving", "explanation", "comparison", "application", "prediction"
    concept: str
    quality: str = "good"  # poor, fair, good, excellent
    completed_at: datetime = Field(default_factory=datetime.utcnow)
    session_id: Optional[str] = None
    details: str = ""  # What they did


class LearningPlanProgress(BaseModel):
    """Student's progress through a chapter's learning plan."""
    objectives_completed: List[str] = []  # Objective IDs
    objectives_in_progress: List[str] = []
    objectives_not_started: List[str] = []

    conversation_milestones: List[MilestoneProgress] = []

    concept_mastery: Dict[str, ConceptMastery] = {}  # concept_name -> ConceptMastery

    overall_progress_percent: float = 0.0  # 0-100

    current_objective: Optional[str] = None  # Which objective student should focus on
    next_suggested_objective: Optional[str] = None

    # NEW: Track actual learning events (evidence of understanding)
    learning_events: List[LearningEvent] = []
    misconceptions_corrected: List[MisconceptionCorrected] = []
    questions_answered: List[QuestionAnswered] = []
    active_practice_completed: List[ActivePracticeCompleted] = []

    # Depth metrics (computed from events)
    concepts_can_explain: List[str] = []  # Student demonstrated ability to explain
    concepts_can_apply: List[str] = []    # Student applied concept to new situation
    concepts_exposure_only: List[str] = []  # Student heard about but hasn't demonstrated understanding

    last_updated: datetime = Field(default_factory=datetime.utcnow)


class LearningAnalysis(BaseModel):
    """
    Analysis from a chat message about learning progress.
    This is the 'metadata' returned alongside the chat response.
    """
    concepts_discussed: List[str] = []

    milestone_reached: Optional[str] = None

    understanding_demonstrated: Dict[str, str] = {}  # concept -> level (mastered/partial/confused)

    reference_worthy: bool = False  # Should this conversation be saved for future reference?
    reference_concept: Optional[str] = None  # Which concept it explains well
    reference_message_indices: List[int] = []  # Which messages in the conversation

    next_objective_suggestion: Optional[str] = None

    student_engagement: str = "neutral"  # engaged, neutral, struggling

    notes: str = ""  # Any observations about learning style

    # NEW: Actual learning events detected
    learning_events: List[LearningEvent] = []
    misconceptions_corrected: List[MisconceptionCorrected] = []
    questions_answered: List[QuestionAnswered] = []
    active_practice: List[ActivePracticeCompleted] = []
