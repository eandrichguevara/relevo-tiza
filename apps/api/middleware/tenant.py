"""Tenant resolution middleware — subdomain + header-based.

Production:  colegio-san-martin.tiza.app  → extracts "colegio-san-martin"
Development: X-Tenant-Subdomain header (dev-only, disabled in production).

Resolves subdomain → tenant_id (with in-memory cache), injects
tenant_id + brand into request.state for downstream dependencies.

SECURITY: X-Tenant-Id header is NOT supported. Tenant isolation is enforced
via TenantMember membership and current_user.tenant_id fallback.
"""

from typing import Optional
import re

import jwt as pyjwt
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select

from database import async_session, current_tenant_id
from models.db_models import Tenant
from config import settings

# ─── In-memory cache (dev) ──────────────────────────────────────────
# ponytail: Simple dict cache. In production, replace with Redis.
_tenant_cache: dict[str, tuple[str, str]] = {}  # subdomain → (tenant_id, brand)


def extract_subdomain(host: str) -> Optional[str]:
    """Extract subdomain from Host header.

    Production:  colegio-san-martin.tiza.app  → "colegio-san-martin"
    Dev:         colegio-demo.localhost:8000   → "colegio-demo"
    """
    host = host.split(":")[0]  # strip port

    # Dev: subdomain.localhost
    if host.endswith(".localhost"):
        parts = host.split(".")
        if len(parts) >= 2:
            return parts[0]

    # Prod: subdomain.tiza.app or subdomain.relevo.cl
    for domain in (".tiza.app", ".relevo.cl", ".milo-apps.com"):
        if host.endswith(domain):
            prefix = host[: -len(domain)]
            # Handle "www.tiza.app" → no subdomain
            if prefix and prefix not in ("www", "app", "api"):
                return prefix
            return None

    return None


async def resolve_tenant_by_subdomain(subdomain: str) -> Optional[dict]:
    """Resolve subdomain to {tenant_id, brand} dict, with cache."""
    if subdomain in _tenant_cache:
        tid, brand = _tenant_cache[subdomain]
        return {"tenant_id": tid, "brand": brand}

    async with async_session() as db:
        result = await db.execute(
            select(Tenant).where(Tenant.subdomain == subdomain)
        )
        tenant = result.scalar_one_or_none()

    if tenant:
        brand = tenant.brand or "tiza"
        _tenant_cache[subdomain] = (tenant.id, brand)
        return {"tenant_id": tenant.id, "brand": brand}

    return None


class TenantMiddleware(BaseHTTPMiddleware):
    """Resolve tenant from subdomain/header and inject into request.state.

    Priority:
    1. Subdomain from Host header
    2. X-Tenant-Subdomain header (DEV ONLY — disabled in production)

    Injects:
        request.state.tenant_id  → str
        request.state.brand      → "tiza" | "relevo"

    SECURITY: No X-Tenant-Id support. Tenant isolation is enforced by
    TenantMember membership at the endpoint level.
    """

    # ── Path classification ─────────────────────────────────────────
    # Fully public: no auth, no tenant context needed — skip middleware entirely.
    PUBLIC_PATHS = frozenset({
        "/api/health",
        "/api/auth/login",
        "/api/auth/register",
        "/api/tenants/lookup",
    })
    PUBLIC_PREFIXES = ("/docs", "/openapi.json")

    # Endpoints that require auth but NOT tenant context.
    # The middleware resolves tenant if possible (for brand), but does NOT
    # block the request when no tenant is found. Auth is enforced by the
    # endpoint's own dependencies (get_current_user / require_role).
    NO_TENANT_PREFIXES = (
        "/api/auth/",
        "/api/admin/",
    )
    NO_TENANT_PATHS = frozenset({
        "/api/tenants",       # POST: create tenant, GET: list tenants
        "/api/users",         # POST: create user (tenant_id in body), GET: list users
    })

    @staticmethod
    def _extract_tenant_from_jwt(request: Request) -> Optional[str]:
        """Try to extract tenant_id from JWT Bearer token (fallback)."""
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return None
        token = auth[7:]
        try:
            payload = pyjwt.decode(
                token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
            )
            return payload.get("tenant_id")
        except pyjwt.InvalidTokenError:
            return None

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # ── 1. Fully public — skip everything ──────────────────────
        if path in self.PUBLIC_PATHS or path.startswith(self.PUBLIC_PREFIXES):
            request.state.brand = "tiza"
            return await call_next(request)

        tenant_id = None
        brand = "tiza"

        # ── 2. Try subdomain from Host header ──────────────────────
        host = request.headers.get("host", "")
        subdomain = extract_subdomain(host)
        if subdomain:
            resolved = await resolve_tenant_by_subdomain(subdomain)
            if resolved:
                tenant_id = resolved["tenant_id"]
                brand = resolved.get("brand", "tiza")

        # ── 3. Fallback: X-Tenant-Subdomain header (DEV ONLY) ──────
        if not tenant_id and settings.ENVIRONMENT == "development":
            x_subdomain = request.headers.get("X-Tenant-Subdomain")
            if x_subdomain:
                resolved = await resolve_tenant_by_subdomain(x_subdomain)
                if resolved:
                    tenant_id = resolved["tenant_id"]
                    brand = resolved.get("brand", "tiza")

        # ── 4. Fallback: extract tenant_id from JWT ────────────────
        if not tenant_id:
            jwt_tid = self._extract_tenant_from_jwt(request)
            if jwt_tid:
                tenant_id = jwt_tid
                # Brand stays at default "tiza" — JWT doesn't carry brand

        # ── 5. X-Tenant-Brand header (development only) ────────────
        if settings.ENVIRONMENT == "development":
            x_brand = request.headers.get("X-Tenant-Brand", "").lower()
            if x_brand in ("tiza", "relevo"):
                brand = x_brand

        # Inject what we have so far (brand always, tenant_id if resolved)
        token = None
        if tenant_id:
            request.state.tenant_id = tenant_id
            token = current_tenant_id.set(tenant_id)
        request.state.brand = brand

        # ── 6. Auth-required endpoints: no tenant context needed ───
        if path in self.NO_TENANT_PATHS or path.startswith(self.NO_TENANT_PREFIXES):
            if token is not None:
                current_tenant_id.reset(token)
            return await call_next(request)

        # ── 7. SECURITY: All other endpoints MUST have a tenant context ──
        # If the request has no auth at all, let it pass through so the
        # endpoint's auth dependency returns a proper 401. If it has auth
        # but no tenant, return 400 — the client must specify a tenant.
        if not tenant_id:
            if token is not None:
                current_tenant_id.reset(token)
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer "):
                return JSONResponse(
                    status_code=400,
                    content={"detail": "No tenant context resolved"},
                )
            # No auth → let the endpoint handle 401
            return await call_next(request)

        try:
            response = await call_next(request)
            return response
        finally:
            if token is not None:
                current_tenant_id.reset(token)
