from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    SECRET_KEY: str = "your-secret-key"  # Change in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 50000
    
    # Database settings
    MONGO_URI: str = ""
    MONGO_DB_NAME: str = ""

    # AWS settings
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # S3 settings
    S3_BUCKET: str = ""
    S3_REGION: str = ""

    # LLM / Providers
    OPENAI_API_KEY: str = ""

    # Qdrant settings
    QDRANT_KEY: Optional[str] = None

    NAME: Optional[str] = "EC2v2"

    # Observability settings
    METRICS_BEARER_TOKEN: Optional[str] = None


settings = Settings()

