"""RELEVO + TIZA — FastAPI Backend Unificado."""
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from database import engine, Base
from routers import auth, evaluations, results, dashboard, courses, students, tenants, users


# ─── Security Headers Middleware ────────────────────────────────────
# SECURITY: Adds hardening headers to all HTTP responses to prevent
# clickjacking, MIME-type sniffing, and other common attacks.


async def security_headers_middleware(request: Request, call_next):
    """Add security hardening headers to every response."""
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


# ─── Rate Limiter (in-memory) ──────────────────────────────────────
# SECURITY: Prevents brute-force attacks on auth endpoints.
# In production, replace with Redis-backed rate limiter for persistence
# across restarts and horizontal scaling.
rate_limit_store: dict[str, list[float]] = defaultdict(list)


AUTH_PATHS = ("/api/auth/login", "/api/auth/register")


async def rate_limit_middleware(request: Request, call_next):
    """Rate limiter for all endpoints.

    Applies different limits based on endpoint sensitivity:
    - Auth endpoints (login/register): RATE_LIMIT_AUTH_MAX_REQUESTS per window
    - General endpoints: RATE_LIMIT_GENERAL_MAX_REQUESTS per window

    Disabled automatically in development unless RATE_LIMIT_ENABLED is explicitly set.
    """
    if not settings.rate_limit_enabled:
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window_start = now - settings.RATE_LIMIT_WINDOW_SECONDS

    # Clean old entries outside the window
    timestamps = rate_limit_store[client_ip]
    rate_limit_store[client_ip] = [t for t in timestamps if t > window_start]

    # Determine limit for this endpoint
    is_auth = request.url.path in AUTH_PATHS
    max_requests = (
        settings.RATE_LIMIT_AUTH_MAX_REQUESTS if is_auth
        else settings.RATE_LIMIT_GENERAL_MAX_REQUESTS
    )

    if len(rate_limit_store[client_ip]) >= max_requests:
        # Return 429 JSON directly instead of raising HTTPException,
        # because exceptions raised in middleware may not be caught
        # by FastAPI's exception handler, causing a 500 error.
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Too many requests. Please try again later."},
        )

    rate_limit_store[client_ip].append(now)

    return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if not exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Migration v1: add join_code column to existing tenants table if missing
        # (legacy migration that added the column without NOT NULL)
        # NOTE: We check information_schema first to avoid PostgreSQL aborting
        # the entire transaction on a "column already exists" error.
        from sqlalchemy import text

        col_exists = await conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'tenants' AND column_name = 'join_code'"
            )
        )
        if not col_exists.scalar():
            await conn.execute(text("ALTER TABLE tenants ADD COLUMN join_code VARCHAR(10) UNIQUE"))

        # Migration v2: backfill NULL join_codes for existing tenants that
        # were created before the join_code column was added
        from models.db_models import generate_join_code as _gen_join_code

        result = await conn.execute(
            text("SELECT id FROM tenants WHERE join_code IS NULL OR join_code = ''")
        )
        null_rows = result.fetchall()
        if null_rows:
            print(f"   🛠️  Backfilling join_code for {len(null_rows)} tenant(s)...")
            for row in null_rows:
                candidate = "TIZA0001"  # ultimate fallback
                # Retry loop to ensure uniqueness
                for _ in range(10):
                    candidate = _gen_join_code()
                    existing = await conn.execute(
                        text("SELECT 1 FROM tenants WHERE join_code = :code"),
                        {"code": candidate},
                    )
                    if not existing.scalar():
                        break
                await conn.execute(
                    text("UPDATE tenants SET join_code = :code WHERE id = :id"),
                    {"code": candidate, "id": row[0]},
                )
            print("   ✅ join_code backfill complete.")
    yield
    # Shutdown
    rate_limit_store.clear()
    await engine.dispose()


app = FastAPI(
    title="RELEVO + TIZA API",
    version="0.1.0",
    description="Backend unificado para RELEVO (B2B) y TIZA (B2C)",
    lifespan=lifespan,
)

# SECURITY: Restrict CORS to known origins and required methods/headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Tenant-Brand",
        "X-Tenant-Id",
    ],
)

# SECURITY: Security hardening headers for all responses
app.middleware("http")(security_headers_middleware)

# SECURITY: Rate limiting for all endpoints (brute-force protection)
# Auth endpoints are more restrictive (10 req/min) than general ones (60 req/min)
# Disabled in development by default — set RATE_LIMIT_ENABLED=true to override
app.middleware("http")(rate_limit_middleware)

# Register routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(evaluations.router, prefix="/api/evaluations", tags=["Evaluations"])
app.include_router(results.router, prefix="/api/results", tags=["Results"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(courses.router, prefix="/api/courses", tags=["Courses"])
app.include_router(students.router, prefix="/api/students", tags=["Students"])
app.include_router(tenants.router, prefix="/api/tenants", tags=["Tenants"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "relevo-tiza-api", "version": "0.1.0"}
