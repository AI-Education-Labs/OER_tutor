from pymongo import AsyncMongoClient
from typing import Optional, Any, Dict
from backend.features.users.models import UserWithPassword
from beanie import init_beanie
from backend.db.models import *

from backend.config.settings import settings

MONGO_URI = settings.MONGO_URI
MONGO_DB_NAME = settings.MONGO_DB_NAME

mongo_client: Optional[AsyncMongoClient] = None

async def init():
    global mongo_client
    mongo_client = AsyncMongoClient(MONGO_URI)
    await init_beanie(database=mongo_client[MONGO_DB_NAME], document_models=[User, Textbook, UserConversation, UserQuiz, UserFlashcards])

async def close():
    global mongo_client
    if mongo_client is not None:
        await mongo_client.close()
        mongo_client = None
