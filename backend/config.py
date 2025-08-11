from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = "your-secret-key"  # Change in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 5000
    
    # Database settings
    DATABASE_URL: str = "sqlite:///./test.db"  # Default to SQLite
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

