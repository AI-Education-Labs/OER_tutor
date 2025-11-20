from openai import OpenAI
from backend.config import settings
import logging

logger = logging.getLogger(__name__)

# Instantiate the OpenAI client once at module level
try:
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is not set or is empty")
    _openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    logger.info("OpenAI client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize OpenAI client: {e}")
    _openai_client = None

def get_openai_client() -> OpenAI:
    if _openai_client is None:
        raise ValueError("OpenAI client is not initialized. Please check OPENAI_API_KEY configuration.")
    return _openai_client
