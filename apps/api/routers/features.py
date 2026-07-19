"""Feature flags router — returns effective feature flags for the current brand/tenant."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.db_models import Tenant
from services.features import get_features as resolve_features
from utils.security import get_current_user  # noqa: F401 — kept for consistency

router = APIRouter()


@router.get("")
async def get_features(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Return effective feature flags for the current brand and tenant.

    Merges brand defaults with tenant-specific settings overrides.
    Public endpoint — no authentication required (used at app init
    to configure the UI before login).

    Dependencies:
        - request.state.brand (set by TenantMiddleware)
        - request.state.tenant_id (set by TenantMiddleware, may be None)

    Returns:
        {"brand": str, "tenant_id": str | None, "features": dict}
    """
    brand = getattr(request.state, "brand", "tiza")
    tenant_id = getattr(request.state, "tenant_id", None)

    tenant_settings: dict | None = None
    if tenant_id:
        result = await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = result.scalar_one_or_none()
        if tenant:
            raw = tenant.settings
            tenant_settings = raw if isinstance(raw, dict) else {}

    flags = resolve_features(brand, tenant_settings)

    return {
        "brand": brand,
        "tenant_id": tenant_id,
        "features": flags,
    }
