from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    SECRET_KEY: str = "your-secret-key"  # Change in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 5000
    
    # Database settings
    DATABASE_URL: str = "sqlite:///./test.db"  # Default to SQLite

    # LLM / Providers
    OPENAI_API_KEY: Optional[str] = None
    LANGCHAIN_API_KEY: Optional[str] = None

    
    class Config:

        # Read ONLY from backend/.env to avoid conflicts with project root .env
        env_file = str(Path(__file__).resolve().parent / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()

