from backend.config import settings
import logging
from langfuse import get_client, propagate_attributes
from typing import Any, Optional

from openai import OpenAI

logger = logging.getLogger(__name__)
langfuse = get_client()

# Instantiate the OpenAI client once at module level
# Langfuse will automatically patch the OpenAI client if the library is imported
# and environment variables are set.
try:
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is not set or is empty")
    _openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    logger.info("OpenAI client initialized successfully. Langfuse will auto-patch if configured.")
except Exception as e:
    logger.error(f"Failed to initialize OpenAI client: {e}")
    _openai_client = None

def get_openai_client() -> OpenAI:
    if _openai_client is None:
        raise ValueError("OpenAI client is not initialized. Please check OPENAI_API_KEY configuration.")
    return _openai_client


def generate_with_responses_parse(
    model: str,
    input: list,
    text_format: Any,
    user_id: str,
    trace_name: str,
    metadata: Optional[dict] = None,
    **kwargs
):
    """
    Wrapper for client.responses.parse with Langfuse tracking.
    Used for structured output generation (flashcards, quizzes, study guides).
    """
    client = get_openai_client()

    with langfuse.start_as_current_observation(
        as_type="generation",
        name=trace_name,
        model=model,
        input=input,
    ) as generation:
        # Propagate attributes to this generation
        with propagate_attributes(
            user_id=user_id,
            tags=[trace_name],
            metadata=metadata or {}
        ):
            # Make the OpenAI call
            response = client.responses.parse(
                model=model,
                input=input,
                text_format=text_format,
                **kwargs
            )

            # Update generation with output
            output_data = response.output[0].content[0].parsed
            output_str = output_data.model_dump() if hasattr(output_data, 'model_dump') else str(output_data)
            generation.update(output=output_str)

            return response


def generate_chat_completion(
    model: str,
    messages: list,
    user_id: str,
    trace_name: str,
    temperature: float = 0,
    metadata: Optional[dict] = None,
    **kwargs
):
    """
    Wrapper for client.chat.completions.create with Langfuse tracking.
    Used for non-streaming chat completions.
    """
    client = get_openai_client()

    with langfuse.start_as_current_observation(
        as_type="generation",
        name=trace_name,
        model=model,
        input=messages,
        model_parameters={"temperature": str(temperature)}
    ) as generation:
        # Propagate attributes to this generation
        with propagate_attributes(
            user_id=user_id,
            session_id=metadata.get("session_id") if metadata else None,
            tags=[trace_name],
            metadata=metadata or {}
        ):
            # Make the OpenAI call
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                **kwargs
            )

            # Update generation with output and usage
            usage_details = {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            } if response.usage else None

            generation.update(
                output=response.choices[0].message.content,
                usage_details=usage_details
            )

            return response


def generate_chat_completion_stream(
    model: str,
    messages: list,
    user_id: str,
    trace_name: str,
    temperature: float = 0,
    metadata: Optional[dict] = None,
    **kwargs
):
    """
    Wrapper for client.chat.completions.create (streaming) with Langfuse tracking.
    Returns a generator that yields stream chunks and logs to Langfuse after completion.
    Note: Langfuse tracking happens while the stream is consumed.
    """
    client = get_openai_client()

    def stream_generator():
        with langfuse.start_as_current_observation(
            as_type="generation",
            name=trace_name,
            model=model,
            input=messages,
            model_parameters={"temperature": str(temperature), "stream": True}
        ) as generation:
            # Propagate attributes to this generation
            with propagate_attributes(
                user_id=user_id,
                session_id=metadata.get("session_id") if metadata else None,
                tags=[trace_name, "streaming"],
                metadata=metadata or {}
            ):
                # Make the OpenAI call (streaming)
                stream = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    stream=True,
                    **kwargs
                )
                # Yield each chunk from the stream while context manager is active
                for chunk in stream:
                    yield chunk

    return stream_generator()
def track_stream_completion(
    model: str,
    messages: list,
    output: str,
    user_id: str,
    trace_name: str,
    temperature: float = 0,
    metadata: Optional[dict] = None,
):
    """
    Track a completed streaming chat completion with Langfuse.
    Call this after you've collected all chunks from the stream.
    """
    with langfuse.start_as_current_observation(
        as_type="generation",
        name=f"{trace_name}-completion",
        model=model,
        input=messages,
    ) as generation:
        # Propagate attributes to this generation
        with propagate_attributes(
            user_id=user_id,
            session_id=metadata.get("session_id") if metadata else None,
            tags=[trace_name, "streaming-complete"],
            metadata=metadata or {}
        ):
            # Update generation with output
            generation.update(output=output)

def generate_structured_chat_completion(
    model: str,
    messages: list,
    response_format: Any,
    user_id: str,
    trace_name: str,
    temperature: float = 0,
    metadata: Optional[dict] = None,
    **kwargs
):
    """
    Wrapper for client.beta.chat.completions.parse with Langfuse tracking.
    Used for structured output parsing (e.g., conversation summaries).
    """
    client = get_openai_client()

    with langfuse.start_as_current_observation(
        as_type="generation",
        name=trace_name,
        model=model,
        input=messages,
        model_parameters={"temperature": str(temperature)}
    ) as generation:
        # Propagate attributes to this generation
        with propagate_attributes(
            user_id=user_id,
            session_id=metadata.get("session_id") if metadata else None,
            tags=[trace_name, "structured-output"],
            metadata=metadata or {}
        ):
            # Make the OpenAI call
            completion = client.beta.chat.completions.parse(
                model=model,
                messages=messages,
                temperature=temperature,
                response_format=response_format,
                **kwargs
            )

            # Update generation with output and usage
            parsed_output = completion.choices[0].message.parsed
            output_str = parsed_output.model_dump() if (parsed_output and hasattr(parsed_output, 'model_dump')) else str(parsed_output)

            usage_details = {
                "input_tokens": completion.usage.prompt_tokens,
                "output_tokens": completion.usage.completion_tokens,
                "total_tokens": completion.usage.total_tokens,
            } if completion.usage else None

            generation.update(
                output=output_str,
                usage_details=usage_details
            )

            return completion
