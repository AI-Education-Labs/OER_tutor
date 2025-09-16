from pymongo import AsyncMongoClient
from dotenv import load_dotenv
from typing import Optional, AsyncIterator, Any, Dict
from backend.models.user import UserWithPassword
import asyncio
import os
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

_mongo_client: Optional[AsyncMongoClient] = None
_client_init_lock: asyncio.Lock = asyncio.Lock()

async def get_mongo_client() -> AsyncMongoClient:
    """Return a singleton AsyncMongoClient, initializing it lazily if needed."""
    global _mongo_client
    if _mongo_client is not None:
        return _mongo_client

    async with _client_init_lock:
        if _mongo_client is None:
            if not MONGO_URI:
                raise RuntimeError(
                    "MONGO_URI is not set. Ensure backend/.env contains MONGO_URI and restart the server."
                )
            _mongo_client = AsyncMongoClient(MONGO_URI)
            try:
                await _mongo_client.admin.command("ping")
                print("MongoDB connection established (ping successful).")
            except Exception as e:
                print(f"MongoDB ping on init failed (will retry on demand): {e}")

    return _mongo_client

def get_database_name() -> str:
    """Return the default database name from environment configuration."""
    return MONGO_DB_NAME

async def get_database():
    """Get an async database handle from the singleton client."""
    client = await get_mongo_client()
    if not MONGO_DB_NAME or not isinstance(MONGO_DB_NAME, str):
        raise RuntimeError(
            "MONGO_DB_NAME is not set to a valid string. Set MONGO_DB_NAME in backend/.env."
        )
    return client[MONGO_DB_NAME]

async def get_collection(collection_name: str):
    """Get an async collection handle from the database."""
    print(f"Getting collection {collection_name}")
    db = await get_database()
    print(f"Database: {db}")
    return db[collection_name]

async def ensure_mongo_connection() -> bool:
    """Ping MongoDB to verify connectivity. Returns True if healthy, else False."""
    try:
        client = await get_mongo_client()
        await client.admin.command("ping")
        return True
    except Exception as e:
        print(f"MongoDB healthcheck failed: {e}")
        return False

async def close_mongo_client() -> None:
    """Close the async Mongo client (e.g., on application shutdown)."""
    global _mongo_client
    if _mongo_client is not None:
        try:
            # Async client close supports await in pymongo asyncio API
            await _mongo_client.close()
        except Exception:
            # Best effort close
            pass
        finally:
            _mongo_client = None

# Optional FastAPI dependencies for injection
async def mongo_client_dep() -> AsyncIterator[AsyncMongoClient]:
    client = await get_mongo_client()
    try:
        yield client
    finally:
        # Intentionally do not close per-request to enable connection reuse
        pass

async def mongo_db_dep() -> AsyncIterator:
    db = await get_database()
    try:
        yield db
    finally:
        # Intentionally do not close per-request to enable connection reuse
        pass

__all__ = [
    "get_mongo_client",
    "get_database",
    "get_collection",
    "ensure_mongo_connection",
    "close_mongo_client",
    "mongo_client_dep",
    "mongo_db_dep",
    "get_database_name",
]

# -----------------------------
# Generic CRUD helper functions
# -----------------------------

async def get_user_document(
    collection_name: str,
    user_id: str,
    projection: Optional[Dict[str, int]] = None,
    extra_filter: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Get a single document by user_id with optional extra filters and projection."""
    collection = await get_collection(collection_name)
    filter_doc: Dict[str, Any] = {"user_id": user_id}
    if extra_filter:
        filter_doc.update(extra_filter)
    document = await collection.find_one(filter_doc, projection=projection)
    return document

async def put_user_fields(
    collection_name: str,
    user_id: str,
    field_values: Dict[str, Any],
    extra_filter: Optional[Dict[str, Any]] = None,
    upsert: bool = True,
) -> Dict[str, Any]:
    """Upsert or update fields on the user's document and return the resulting document."""
    collection = await get_collection(collection_name)
    filter_doc: Dict[str, Any] = {"user_id": user_id}
    if extra_filter:
        filter_doc.update(extra_filter)
    update_doc: Dict[str, Any] = {"$set": dict(field_values)}
    # Ensure user_id is persisted when inserting new docs
    update_doc["$setOnInsert"] = {"user_id": user_id}

    await collection.update_one(filter_doc, update_doc, upsert=upsert)
    updated = await collection.find_one(filter_doc)
    # If not found and upsert was False, return an empty dict
    return updated or {}

async def delete_user_document(
    collection_name: str,
    user_id: str,
    extra_filter: Optional[Dict[str, Any]] = None,
) -> int:
    """Delete a single user's document matching the filter. Returns deleted count."""
    collection = await get_collection(collection_name)
    filter_doc: Dict[str, Any] = {"user_id": user_id}
    if extra_filter:
        filter_doc.update(extra_filter)
    result = await collection.delete_one(filter_doc)
    return int(result.deleted_count)

async def create_user_document(user: UserWithPassword):
    collection = await get_collection("users")
    user_doc = user.model_dump()
    # Set _id to the user.id field for MongoDB primary key
    user_doc["_id"] = user.id
    await collection.insert_one(user_doc)

async def get_user_document_by_id(user_id: str):
    collection = await get_collection("users")
    return await collection.find_one({"_id": user_id})

async def get_user_document_by_username(username: str) -> UserWithPassword:
    collection = await get_collection("users")
    return await collection.find_one({"username": username})

__all__ += [
    "get_user_document",
    "put_user_fields",
    "delete_user_document",
    "create_user_document",
    "get_user_document_by_id",
    "get_user_document_by_username",
]

