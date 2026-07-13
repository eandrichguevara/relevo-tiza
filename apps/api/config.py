"""Application configuration."""
from typing import List
import os
from pydantic import Field
from pydantic_settings import BaseSettings


def _get_jwt_secret() -> str:
    """Return JWT_SECRET from env or generate a random fallback.
    
    SECURITY: Never hardcode a default secret. If the env var is not set,
    generate a cryptographically random key. In production, always set
    a strong JWT_SECRET via environment variable.
    """
    secret = os.getenv("JWT_SECRET")
    if secret:
        return secret
    # Development fallback — random per process start
    random_bytes = os.urandom(32)
    return random_bytes.hex()


class Settings(BaseSettings):
    APP_NAME: str = "Relevo-Tiza API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = "gemini-2.0-flash"
    JWT_SECRET: str = Field(default_factory=_get_jwt_secret)
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 120
    CONFIDENCE_THRESHOLD: float = 0.65
    CORS_ORIGINS: List[str] = ["http://localhost:3001", "http://localhost:3002"]
    RATE_LIMIT_AUTH_MAX_REQUESTS: int = 10
    RATE_LIMIT_GENERAL_MAX_REQUESTS: int = 60
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    @property
    def rate_limit_enabled(self) -> bool:
        """Rate limiting: enabled in production by default.
        
        Override via RATE_LIMIT_ENABLED env var (true/false).
        When not set, enabled in production, disabled in development.
        """
        env_val = os.getenv("RATE_LIMIT_ENABLED")
        if env_val is not None:
            return env_val.strip().lower() in ("true", "1", "yes")
        return self.ENVIRONMENT != "development"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
