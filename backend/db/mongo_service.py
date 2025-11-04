from typing import Optional, Any, Dict
from backend.features.users.models import UserWithPassword
from beanie import init_beanie
from backend.db.models import *

from backend.config.settings import settings
import os

MONGO_URI = settings.MONGO_URI
MONGO_DB_NAME = settings.MONGO_DB_NAME

mongo_client: Optional[Any] = None

async def init():
    """Initialize the mongo client and register Beanie document models.

    If the environment variable USE_MOCK_DB is truthy, use mongomock to avoid
    connecting to a real MongoDB instance (useful in unit tests).
    """
    global mongo_client

    use_mock = os.environ.get("USE_MOCK_DB") in ("1", "true", "True", "yes")

    if use_mock:
        from mongomock_motor import AsyncMongoMockClient
        # Defer import errors to runtime; tests should ensure mongomock is installed
        # init_beanie accepts a pymongo-style database object; mongomock matches that API
        mongo_client = AsyncMongoMockClient()
        await init_beanie(database=mongo_client[MONGO_DB_NAME], document_models=[User, Textbook, UserConversation, UserQuiz, UserFlashcards])
    else:
        # Use motor/pymongo async client for production
        try:
            from pymongo import AsyncMongoClient
        except Exception:
            # Keep error informative if async client not available
            raise

        mongo_client = AsyncMongoClient(MONGO_URI)
        await init_beanie(database=mongo_client[MONGO_DB_NAME], document_models=[User, Textbook, UserConversation, UserQuiz, UserFlashcards])

async def close():
    global mongo_client
    if mongo_client is not None:
        # close may be async for the real client, and async noop for the mock wrapper
        if hasattr(mongo_client, "close"):
            result = mongo_client.close()
            if hasattr(result, "__await__"):
                await result
        mongo_client = None
