"""Users router — multi-tenant user management for HOLDERs."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.db_models import User, Tenant, TenantMember
from models.schemas import CreateUserRequest, UserResponse
from utils.security import hash_password, require_role

router = APIRouter()

# SECURITY: Only TEACHER can be created via this endpoint.
# HOLDER or ADMIN creation via this endpoint is forbidden to prevent
# privilege escalation (a HOLDER should never create other HOLDERs or ADMINs).
ALLOWED_CREATE_ROLES = {"teacher": "TEACHER"}


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    body: CreateUserRequest,
    current_user: User = Depends(require_role("HOLDER")),
    db: AsyncSession = Depends(get_db),
):
    """Create a user (TEACHER only) under a specific tenant. Only HOLDERs can create users."""
    # Validate role — only TEACHER allowed
    resolved_role = ALLOWED_CREATE_ROLES.get(body.role.lower().strip())
    if not resolved_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'teacher' role can be created via this endpoint",
        )

    # Verify tenant exists
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == body.tenant_id)
    )
    if not tenant_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=body.email,
        name=body.name,
        password=hash_password(body.password),
        role=resolved_role,
        tenant_id=body.tenant_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    await db.commit()
    return user


@router.get("", response_model=list[UserResponse])
async def list_users(
    tenant_id: Optional[str] = Query(None, description="Filter by tenant UUID"),
    role: Optional[str] = Query(None, description="Filter by role (TEACHER, HOLDER, ADMIN)"),
    current_user: User = Depends(require_role("HOLDER")),
    db: AsyncSession = Depends(get_db),
):
    """List users with optional filters. Only HOLDERs can list users.
    
    SECURITY: Tenant isolation is enforced. If no tenant_id is specified,
    only users from tenants the current HOLDER is a member of are returned.
    If tenant_id is specified, the HOLDER must be a member of that tenant.
    """
    stmt = select(User)

    if tenant_id:
        # Verify the HOLDER has access to the specified tenant
        membership = await db.execute(
            select(TenantMember).where(
                TenantMember.tenant_id == tenant_id,
                TenantMember.user_id == current_user.id,
            )
        )
        if not membership.scalar_one_or_none() and current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this tenant",
            )
        stmt = stmt.where(User.tenant_id == tenant_id)
    else:
        # Only show users from tenants the HOLDER is a member of
        member_result = await db.execute(
            select(TenantMember.tenant_id).where(TenantMember.user_id == current_user.id)
        )
        member_tenant_ids = [row[0] for row in member_result.fetchall()]
        if member_tenant_ids:
            stmt = stmt.where(User.tenant_id.in_(member_tenant_ids))
        else:
            # Fallback: only current user's own tenant
            stmt = stmt.where(User.tenant_id == current_user.tenant_id)

    if role:
        stmt = stmt.where(User.role == role.upper().strip())

    stmt = stmt.order_by(User.created_at.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()
    return users
