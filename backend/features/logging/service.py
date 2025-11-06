"""
Chat Logging Service - Detailed logging for analysis and debugging
"""

import json
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime
import uuid

from backend.db.database import get_collection
from backend.features.logging.models import (
    DetailedChatLog,
    ContextLayer,
    MessageInContext,
    LLMCallDetails,
    LearningAnalysisDetails
)

logger = logging.getLogger(__name__)


class ChatLogger:
    """
    Captures complete chat interaction details for debugging and analysis.
    """

    def __init__(self, session_id: str, user_id: str, textbook_id: Optional[str] = None, chapter_id: Optional[str] = None):
        self.log_id = f"log_{uuid.uuid4().hex[:12]}"
        self.session_id = session_id
        self.user_id = user_id
        self.textbook_id = textbook_id
        self.chapter_id = chapter_id

        self.context_layers: List[ContextLayer] = []
        self.full_context_messages: List[MessageInContext] = []
        self.errors: List[str] = []

        self.user_message = ""
        self.user_message_timestamp = datetime.utcnow()

        self.assistant_response = ""
        self.assistant_response_timestamp: Optional[datetime] = None

        self.llm_call_details: Optional[LLMCallDetails] = None
        self.learning_analysis: Optional[LearningAnalysisDetails] = None
        self.learning_analysis_timestamp: Optional[datetime] = None

        self.progress_updates: Dict[str, Any] = {}

        logger.info(f"Created ChatLogger {self.log_id} for session {session_id}")

    def set_user_message(self, message: str):
        """Record the user's message."""
        self.user_message = message
        self.user_message_timestamp = datetime.utcnow()

    def add_context_layer(self, layer_type: str, content: str, token_count: Optional[int] = None):
        """Add a context layer (system prompt, learning plan, etc.)."""
        layer = ContextLayer(
            layer_type=layer_type,
            content=content,
            added_at=datetime.utcnow(),
            token_count=token_count
        )
        self.context_layers.append(layer)
        logger.debug(f"Added context layer: {layer_type} ({len(content)} chars)")

    def set_full_context(self, messages: List):
        """
        Record the complete message array sent to LLM.
        Converts LangChain messages to serializable format.
        """
        for msg in messages:
            # Handle both dict and LangChain message objects
            if hasattr(msg, 'type'):
                # LangChain message object
                role = msg.type  # 'system', 'human', 'ai'
                if role == 'human':
                    role = 'user'
                elif role == 'ai':
                    role = 'assistant'
                content = msg.content
            else:
                # Dict format
                role = msg.get('role', 'unknown')
                content = msg.get('content', '')

            self.full_context_messages.append(
                MessageInContext(role=role, content=content)
            )

        logger.debug(f"Recorded {len(self.full_context_messages)} messages in full context")

    def set_llm_call_details(
        self,
        model: str,
        temperature: float = 0.0,
        streaming: bool = False,
        estimated_input_tokens: Optional[int] = None,
        estimated_output_tokens: Optional[int] = None,
        response_time_seconds: Optional[float] = None
    ):
        """Record details about the LLM call."""
        self.llm_call_details = LLMCallDetails(
            model=model,
            temperature=temperature,
            streaming=streaming,
            total_context_messages=len(self.full_context_messages),
            estimated_input_tokens=estimated_input_tokens,
            estimated_output_tokens=estimated_output_tokens,
            response_time_seconds=response_time_seconds
        )

    def set_assistant_response(self, response: str):
        """Record the assistant's response."""
        self.assistant_response = response
        self.assistant_response_timestamp = datetime.utcnow()
        logger.debug(f"Recorded assistant response ({len(response)} chars)")

    def set_learning_analysis(self, analysis):
        """Record the learning analysis result."""
        # Convert Pydantic model to our format
        if hasattr(analysis, 'model_dump'):
            analysis_dict = analysis.model_dump()
        else:
            analysis_dict = analysis

        self.learning_analysis = LearningAnalysisDetails(**analysis_dict)
        self.learning_analysis_timestamp = datetime.utcnow()
        logger.debug(f"Recorded learning analysis: {analysis_dict.get('concepts_discussed', [])}")

    def add_progress_update(self, key: str, value: Any):
        """Record what changed in student progress."""
        self.progress_updates[key] = value

    def add_error(self, error: str):
        """Record an error that occurred."""
        self.errors.append(error)
        logger.warning(f"Logged error in {self.log_id}: {error}")

    async def save(self):
        """Save the complete log to MongoDB."""
        try:
            collection = await get_collection("detailed_chat_logs")

            log = DetailedChatLog(
                log_id=self.log_id,
                session_id=self.session_id,
                user_id=self.user_id,
                textbook_id=self.textbook_id,
                chapter_id=self.chapter_id,
                user_message=self.user_message,
                user_message_timestamp=self.user_message_timestamp,
                context_layers=self.context_layers,
                full_context_messages=self.full_context_messages,
                llm_call_details=self.llm_call_details,
                assistant_response=self.assistant_response,
                assistant_response_timestamp=self.assistant_response_timestamp,
                learning_analysis=self.learning_analysis,
                learning_analysis_timestamp=self.learning_analysis_timestamp,
                progress_updates=self.progress_updates,
                errors=self.errors,
                created_at=datetime.utcnow()
            )

            # Convert to dict for MongoDB
            log_dict = log.model_dump()

            await collection.insert_one(log_dict)

            logger.info(f"Saved detailed chat log {self.log_id} to MongoDB")

        except Exception as e:
            logger.error(f"Failed to save chat log: {e}", exc_info=True)

    def get_formatted_log(self) -> str:
        """
        Get a human-readable formatted version of the log.
        Perfect for copy-pasting to analyze.
        """
        lines = []
        lines.append("=" * 80)
        lines.append(f"DETAILED CHAT LOG: {self.log_id}")
        lines.append("=" * 80)
        lines.append(f"Session: {self.session_id}")
        lines.append(f"User: {self.user_id}")
        lines.append(f"Textbook: {self.textbook_id}, Chapter: {self.chapter_id}")
        lines.append(f"Timestamp: {self.user_message_timestamp}")
        lines.append("")

        lines.append("--- USER MESSAGE ---")
        lines.append(self.user_message)
        lines.append("")

        lines.append("--- CONTEXT LAYERS ---")
        for i, layer in enumerate(self.context_layers, 1):
            lines.append(f"\n[{i}] {layer.layer_type.upper()}")
            lines.append(f"Tokens: {layer.token_count or 'unknown'}")
            lines.append(layer.content[:500] + ("..." if len(layer.content) > 500 else ""))
        lines.append("")

        lines.append("--- FULL CONTEXT SENT TO LLM ---")
        lines.append(f"Total messages: {len(self.full_context_messages)}")
        for i, msg in enumerate(self.full_context_messages, 1):
            lines.append(f"\n[{i}] {msg.role.upper()}:")
            content = msg.content[:300] + ("..." if len(msg.content) > 300 else "")
            lines.append(content)
        lines.append("")

        if self.llm_call_details:
            lines.append("--- LLM CALL DETAILS ---")
            lines.append(f"Model: {self.llm_call_details.model}")
            lines.append(f"Temperature: {self.llm_call_details.temperature}")
            lines.append(f"Streaming: {self.llm_call_details.streaming}")
            lines.append(f"Input tokens (est): {self.llm_call_details.estimated_input_tokens or 'unknown'}")
            lines.append(f"Output tokens (est): {self.llm_call_details.estimated_output_tokens or 'unknown'}")
            lines.append(f"Response time: {self.llm_call_details.response_time_seconds or 'unknown'}s")
            lines.append("")

        lines.append("--- ASSISTANT RESPONSE ---")
        lines.append(self.assistant_response)
        lines.append("")

        if self.learning_analysis:
            lines.append("--- LEARNING ANALYSIS (Background) ---")
            lines.append(f"Concepts discussed: {', '.join(self.learning_analysis.concepts_discussed)}")
            lines.append(f"Milestone reached: {self.learning_analysis.milestone_reached or 'None'}")
            lines.append(f"Understanding demonstrated:")
            for concept, level in self.learning_analysis.understanding_demonstrated.items():
                lines.append(f"  - {concept}: {level}")
            lines.append(f"Reference worthy: {self.learning_analysis.reference_worthy}")
            if self.learning_analysis.reference_worthy:
                lines.append(f"  Concept: {self.learning_analysis.reference_concept}")
            lines.append(f"Student engagement: {self.learning_analysis.student_engagement}")
            if self.learning_analysis.notes:
                lines.append(f"Notes: {self.learning_analysis.notes}")
            lines.append("")

        if self.progress_updates:
            lines.append("--- PROGRESS UPDATES ---")
            lines.append(json.dumps(self.progress_updates, indent=2))
            lines.append("")

        if self.errors:
            lines.append("--- ERRORS ---")
            for error in self.errors:
                lines.append(f"  - {error}")
            lines.append("")

        lines.append("=" * 80)
        lines.append("END OF LOG")
        lines.append("=" * 80)

        return "\n".join(lines)


async def get_chat_logs(
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    limit: int = 10
) -> List[str]:
    """
    Retrieve chat logs from MongoDB and format them.
    Returns list of formatted log strings.
    """
    collection = await get_collection("detailed_chat_logs")

    query = {}
    if user_id:
        query["user_id"] = user_id
    if session_id:
        query["session_id"] = session_id

    cursor = collection.find(query).sort("created_at", -1).limit(limit)
    logs = await cursor.to_list(length=limit)

    formatted_logs = []
    for log_data in logs:
        log_data.pop("_id", None)
        log = DetailedChatLog(**log_data)

        # Create a ChatLogger to use its formatting method
        chat_logger = ChatLogger(log.session_id, log.user_id, log.textbook_id, log.chapter_id)
        chat_logger.log_id = log.log_id
        chat_logger.user_message = log.user_message
        chat_logger.user_message_timestamp = log.user_message_timestamp
        chat_logger.context_layers = log.context_layers
        chat_logger.full_context_messages = log.full_context_messages
        chat_logger.llm_call_details = log.llm_call_details
        chat_logger.assistant_response = log.assistant_response
        chat_logger.assistant_response_timestamp = log.assistant_response_timestamp
        chat_logger.learning_analysis = log.learning_analysis
        chat_logger.learning_analysis_timestamp = log.learning_analysis_timestamp
        chat_logger.progress_updates = log.progress_updates
        chat_logger.errors = log.errors

        formatted_logs.append(chat_logger.get_formatted_log())

    return formatted_logs
