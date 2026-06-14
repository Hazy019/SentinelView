"""
app/core/config.py — Application configuration loaded from environment variables.

All secrets loaded exclusively from environment variables.
NEVER hardcode credentials here.
"""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # Demo credentials — loaded from env, never stored in DB
    allowed_username: str
    allowed_password: str  # bcrypt hash

    # CORS — exact Vercel origin, never "*"
    frontend_origin: str = "http://localhost:3000"

    # SQLite
    db_path: str = "./sentinel.db"

    # Logging
    log_level: str = "INFO"

    @field_validator("jwt_secret_key")
    @classmethod
    def secret_must_be_long(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        return v


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
