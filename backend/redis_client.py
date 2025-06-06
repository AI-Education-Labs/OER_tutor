# redis_client.py
import redis.asyncio as redis

redis_client = redis.Redis(host="localhost", port=6379, db=1, decode_responses=True)
