# redis_client.py
import redis.asyncio as redis

redis_client = redis.Redis(host="localhost", port=6379, db=1, decode_responses=True)
import redis.asyncio as redis
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Use environment variables for connection details
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB_CHAT", 1))

REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# Create a single, reusable Redis client instance
redis_client = redis.Redis(
    host=REDIS_HOST, 
    port=REDIS_PORT, 
    db=REDIS_DB, 
    decode_responses=True
)

print(f"Redis client initialized for {REDIS_HOST}:{REDIS_PORT}, DB: {REDIS_DB}")
