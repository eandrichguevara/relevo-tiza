"""Tenants router — multi-tenant management for HOLDERs."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from sqlalchemy.exc import IntegrityError

from database import get_db
from models.db_models import Tenant, TenantMember, User, generate_join_code
from models.schemas import CreateTenantRequest, TenantResponse, TenantLookupResponse
from utils.security import require_role

router = APIRouter()

MAX_JOIN_CODE_ATTEMPTS = 10


async def _generate_unique_join_code(db: AsyncSession) -> str:
    """Generate a unique join_code with collision retry."""
    for _ in range(MAX_JOIN_CODE_ATTEMPTS):
        code = generate_join_code()
        existing = await db.execute(
            select(Tenant).where(Tenant.join_code == code)
        )
        if not existing.scalar_one_or_none():
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate a unique join_code. Please try again.",
    )


@router.post("", response_model=TenantResponse, status_code=201)
async def create_tenant(
    body: CreateTenantRequest,
    current_user: User = Depends(require_role("HOLDER")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new school (tenant). Only HOLDERs can create tenants.

    The HOLDER is automatically added as an ``owner`` member of the new tenant.
    """
    # Check name uniqueness
    existing_name = await db.execute(
        select(Tenant).where(Tenant.name == body.name)
    )
    if existing_name.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration failed",
        )

    # Check subdomain uniqueness
    existing = await db.execute(
        select(Tenant).where(Tenant.subdomain == body.subdomain)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration failed",
        )

    join_code = await _generate_unique_join_code(db)

    tenant = Tenant(
        name=body.name,
        subdomain=body.subdomain,
        brand="tiza",
        join_code=join_code,
    )
    db.add(tenant)

    try:
        await db.flush()
        await db.refresh(tenant)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A tenant with this name or subdomain already exists",
        )

    # Automatically add the creating HOLDER as an owner member (tenant isolation)
    # TODO: When TenantMember management endpoints are added, allow changing roles
    member = TenantMember(
        tenant_id=tenant.id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(member)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A tenant with this name or subdomain already exists",
        )
    return tenant


@router.get("", response_model=list[TenantResponse])
async def list_tenants(
    current_user: User = Depends(require_role("HOLDER")),
    db: AsyncSession = Depends(get_db),
):
    """List tenants accessible to the current HOLDER.
    
    SECURITY: Only returns tenants where the HOLDER (or ADMIN) is
    a member of, enforcing tenant isolation.
    """
    # Get IDs of all tenants where the current user is a member
    member_result = await db.execute(
        select(TenantMember.tenant_id).where(TenantMember.user_id == current_user.id)
    )
    member_tenant_ids = [row[0] for row in member_result.fetchall()]

    if member_tenant_ids:
        # Modern path: filter by membership (tenant isolation)
        result = await db.execute(
            select(Tenant)
            .where(Tenant.id.in_(member_tenant_ids))
            .order_by(Tenant.created_at.desc())
        )
    else:
        # Safe fallback: only return the user's own tenant.
        # HOLDERs without TenantMember entries should still only see
        # the tenant they're directly assigned to.
        result = await db.execute(
            select(Tenant)
            .where(Tenant.id == current_user.tenant_id)
            .order_by(Tenant.created_at.desc())
        )

    tenants = result.scalars().all()
    return tenants


@router.get("/lookup", response_model=TenantLookupResponse)
async def lookup_tenant(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Lookup a tenant by join_code.

    PUBLIC endpoint — no authentication required.
    Used by TIZA (teacher) registration to resolve a school code to a tenant_id.
    """
    if not code or not code.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="join_code is required",
        )

    result = await db.execute(
        select(Tenant).where(Tenant.join_code == code.strip().upper())
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid join code",
        )

    return TenantLookupResponse(tenant_id=tenant.id, name=tenant.name)
