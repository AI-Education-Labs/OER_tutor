from openai import OpenAI
from backend.config.settings import settings

def get_openai_client() -> OpenAI:
    """
    Centralized factory for openAI client. tests should patch this function
    """
    api_key = settings.OPENAI_API_KEY
    try:
        if api_key:
            return OpenAI(api_key=api_key)
        return OpenAI()
    except Exception as exc:
        raise Exception(f"OpenAI client init failed: {exc}")