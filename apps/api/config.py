"""Application configuration."""
from typing import List
import os
from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings

# Load .env into os.environ BEFORE any other module reads env vars
load_dotenv()


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
    # ─── App ───────────────────────────────────────────────────────
    APP_NAME: str = "Relevo-Tiza API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"

    # ─── AI / LLM ──────────────────────────────────────────────────
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = "gemini-2.0-flash"
    CONFIDENCE_THRESHOLD: float = 0.65

    # ─── Auth ──────────────────────────────────────────────────────
    JWT_SECRET: str = Field(default_factory=_get_jwt_secret)
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 120

    # ─── CORS ──────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = ["http://localhost:3001", "http://localhost:3002"]

    # ─── Rate Limiting ─────────────────────────────────────────────
    RATE_LIMIT_AUTH_MAX_REQUESTS: int = 30
    RATE_LIMIT_GENERAL_MAX_REQUESTS: int = 120
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # ─── Storage (S3/MinIO) ────────────────────────────────────────
    STORAGE_BACKEND: str = "minio"
    S3_ENDPOINT: str = "localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET_EVALUATIONS: str = "tiza-evaluations"
    S3_BUCKET_REPORTS: str = "tiza-reports"
    S3_BUCKET_CROPS: str = "tiza-crops"
    S3_USE_SSL: bool = False

    # ─── Email ─────────────────────────────────────────────────────
    EMAIL_BACKEND: str = "smtp"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = False
    EMAIL_FROM: str = "noreply@tiza.app"

    # ─── Encryption ────────────────────────────────────────────────
    ENCRYPTION_BACKEND: str = "fernet"
    ENCRYPTION_KEY: str = ""

    # ─── Super Admin ───────────────────────────────────────────────
    SUPER_ADMIN_EMAIL: str = os.getenv("SUPER_ADMIN_EMAIL", "")
    SUPER_ADMIN_PASSWORD: str = os.getenv("SUPER_ADMIN_PASSWORD", "")

    # ─── Queue ─────────────────────────────────────────────────────
    QUEUE_BACKEND: str = "memory"

    # ─── Pipeline IA ───────────────────────────────────────────────
    PIPELINE_MODE: str = "simulation"
    OCR_MODE: str = "simulation"
    LLM_MODE: str = "gemini_flash"

    @property
    def rate_limit_enabled(self) -> bool:
        """Rate limiting: enabled by default (all environments).
        
        Override via RATE_LIMIT_ENABLED env var (true/false).
        When not set, rate limiting is active. To disable locally
        during development, explicitly set RATE_LIMIT_ENABLED=false.
        
        SECURITY: Rate limiting is a critical control against
        brute-force and DoS attacks. It is enabled by default.
        """
        env_val = os.getenv("RATE_LIMIT_ENABLED")
        if env_val is not None:
            return env_val.strip().lower() in ("true", "1", "yes")
        return True  # enabled by default for all environments

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
