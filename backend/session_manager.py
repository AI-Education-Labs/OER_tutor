import json
import uuid
import asyncio
from typing import Dict, Optional, Any
from datetime import datetime, timedelta
import redis.asyncio as redis

class RedisSessionManager:
    def __init__(self, redis_url: str = "redis://localhost:6379/2"):
        """
        Initialize Redis session manager.
        Using database 2 to separate from chat history (which uses db 1).
        """
        self.redis_client = redis.from_url(redis_url)
        self.session_prefix = "chat_session:"
        self.queue_prefix = "chat_queue:"
        self.default_ttl = 3600  # 1 hour TTL for sessions
    
    async def create_session(self, user_id: str, message: str, session_id: Optional[str] = None) -> str:
        """Create a new chat session and store it in Redis."""
        if not session_id:
            session_id = str(uuid.uuid4())
        
        session_data = {
            "user_id": user_id,
            "message": message,
            "status": "processing",
            "created_at": datetime.utcnow().isoformat(),
            "quiz_data": None
        }
        
        # Store session data
        session_key = f"{self.session_prefix}{session_id}"
        await self.redis_client.hset(session_key, mapping={
            "data": json.dumps(session_data)
        })
        await self.redis_client.expire(session_key, self.default_ttl)
        
        return session_id
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session data from Redis."""
        session_key = f"{self.session_prefix}{session_id}"
        session_data = await self.redis_client.hget(session_key, "data")
        
        if session_data:
            return json.loads(session_data)
        return None
    
    async def update_session(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """Update session data in Redis."""
        session_key = f"{self.session_prefix}{session_id}"
        
        # Get current data
        current_data = await self.get_session(session_id)
        if not current_data:
            return False
        
        # Update with new data
        current_data.update(updates)
        current_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Store back to Redis
        await self.redis_client.hset(session_key, mapping={
            "data": json.dumps(current_data)
        })
        await self.redis_client.expire(session_key, self.default_ttl)
        
        return True
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete a session from Redis."""
        session_key = f"{self.session_prefix}{session_id}"
        queue_key = f"{self.queue_prefix}{session_id}"
        
        # Delete both session data and queue
        deleted_count = await self.redis_client.delete(session_key, queue_key)
        return deleted_count > 0
    
    async def session_exists(self, session_id: str) -> bool:
        """Check if a session exists in Redis."""
        session_key = f"{self.session_prefix}{session_id}"
        return await self.redis_client.exists(session_key) > 0
    
    async def push_to_queue(self, session_id: str, data: Dict[str, Any]) -> bool:
        """Push data to the session's response queue."""
        queue_key = f"{self.queue_prefix}{session_id}"
        
        # Push to Redis list (acts as a queue)
        await self.redis_client.lpush(queue_key, json.dumps(data))
        await self.redis_client.expire(queue_key, self.default_ttl)
        
        return True
    
    async def pop_from_queue(self, session_id: str, timeout: int = 60) -> Optional[Dict[str, Any]]:
        """Pop data from the session's response queue with timeout."""
        queue_key = f"{self.queue_prefix}{session_id}"
        
        try:
            # Blocking pop with timeout
            result = await self.redis_client.brpop(queue_key, timeout=timeout)
            if result:
                _, data = result
                return json.loads(data)
        except asyncio.TimeoutError:
            pass
        
        return None
    
    async def cleanup_expired_sessions(self):
        """Clean up expired sessions (called periodically)."""
        try:
            # Get all session keys
            session_pattern = f"{self.session_prefix}*"
            session_keys = await self.redis_client.keys(session_pattern)
            
            expired_count = 0
            for key in session_keys:
                ttl = await self.redis_client.ttl(key)
                if ttl == -1:  # No expiration set
                    await self.redis_client.expire(key, self.default_ttl)
                elif ttl == -2:  # Key doesn't exist
                    expired_count += 1
            
            if expired_count > 0:
                print(f"Cleaned up {expired_count} expired sessions")
                
        except Exception as e:
            print(f"Error during session cleanup: {e}")

# Global session manager instance
session_manager = RedisSessionManager()
