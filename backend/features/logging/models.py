"""
Chat Logging Models - Detailed logging for debugging and analysis
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime


class ContextLayer(BaseModel):
    """A single layer of context added to the chat."""
    layer_type: str  # system_prompt, learning_plan, student_progress, quiz_data, etc.
    content: str
    added_at: datetime = Field(default_factory=datetime.utcnow)
    token_count: Optional[int] = None


class MessageInContext(BaseModel):
    """A message with its role and content."""
    role: str  # system, user, assistant
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class LLMCallDetails(BaseModel):
    """Details about the LLM call."""
    model: str
    temperature: float
    streaming: bool
    total_context_messages: int
    estimated_input_tokens: Optional[int] = None
    estimated_output_tokens: Optional[int] = None
    response_time_seconds: Optional[float] = None


class LearningAnalysisDetails(BaseModel):
    """The learning analysis result."""
    concepts_discussed: List[str] = []
    milestone_reached: Optional[str] = None
    understanding_demonstrated: Dict[str, str] = {}
    reference_worthy: bool = False
    reference_concept: Optional[str] = None
    next_objective_suggestion: Optional[str] = None
    student_engagement: str = "neutral"
    notes: str = ""


class DetailedChatLog(BaseModel):
    """
    Complete log of a chat interaction including all context, prompts, and analysis.
    This is what we save to MongoDB for debugging/analysis.
    """
    # Basic info
    log_id: str  # Unique ID for this log
    session_id: str
    user_id: str
    textbook_id: Optional[str] = None
    chapter_id: Optional[str] = None

    # User message
    user_message: str
    user_message_timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Context building
    context_layers: List[ContextLayer] = []  # Each piece of context added
    full_context_messages: List[MessageInContext] = []  # Complete message array sent to LLM

    # LLM interaction
    llm_call_details: Optional[LLMCallDetails] = None
    assistant_response: str = ""
    assistant_response_timestamp: Optional[datetime] = None

    # Learning analysis (background)
    learning_analysis: Optional[LearningAnalysisDetails] = None
    learning_analysis_timestamp: Optional[datetime] = None

    # Progress updates
    progress_updates: Dict[str, Any] = {}  # What changed in student_context

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    errors: List[str] = []  # Any errors during processing

    class Config:
        json_schema_extra = {
            "example": {
                "log_id": "log_abc123",
                "session_id": "session_xyz",
                "user_id": "user123",
                "textbook_id": "textbook-uuid",
                "chapter_id": "1",
                "user_message": "What is the scientific method?",
                "context_layers": [
                    {
                        "layer_type": "system_prompt",
                        "content": "You are a helpful tutor...",
                        "token_count": 500
                    },
                    {
                        "layer_type": "learning_plan",
                        "content": "Learning Plan for Chapter 1...",
                        "token_count": 300
                    }
                ],
                "assistant_response": "The scientific method is...",
                "learning_analysis": {
                    "concepts_discussed": ["Scientific Method"],
                    "understanding_demonstrated": {"Scientific Method": "partial"}
                }
            }
        }
