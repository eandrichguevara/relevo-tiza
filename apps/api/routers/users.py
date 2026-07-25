"""Users router — multi-tenant user management for GESTION users."""
import secrets
import string
import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.db_models import User, Tenant, TenantMember, AuditLog
from models.schemas import CreateUserRequest, UserResponse, ResetPasswordResponse
from utils.security import hash_password, require_role, get_tenant_id

router = APIRouter()

@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    body: CreateUserRequest,
    request: Request,
    current_user: User = Depends(require_role("GESTION")),
    db: AsyncSession = Depends(get_db),
):
    """Create a user (TEACHER for GESTION users; TEACHER or GESTION for ADMINs) under a specific tenant."""
    # Determine allowed roles based on the current user's role
    if current_user.role == "ADMIN":
        role_map = {"teacher": "TEACHER", "gestion": "GESTION"}
    else:
        role_map = {"teacher": "TEACHER"}

    requested = body.role.lower().strip()
    if requested == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede crear un usuario con rol 'admin' a través de este endpoint.",
        )

    resolved_role = role_map.get(requested)
    if not resolved_role:
        if current_user.role == "ADMIN":
            detail_msg = "Solo se pueden crear usuarios con rol 'teacher' o 'gestion'."
        else:
            detail_msg = "Solo el rol 'teacher' puede ser creado a través de este endpoint"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail_msg,
        )

    # Verify tenant exists
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == body.tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Colegio no encontrado",
        )

    # SEC-2: Verify GESTION is a member of this tenant (tenant isolation)
    if current_user.role != "ADMIN":
        member_result = await db.execute(
            select(TenantMember).where(
                TenantMember.tenant_id == body.tenant_id,
                TenantMember.user_id == current_user.id,
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No eres miembro de este colegio",
            )

    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El email ya está registrado",
        )

    user = User(
        email=body.email,
        name=body.name,
        password=hash_password(body.password),
        status="pending",
        role=resolved_role,
        tenant_id=body.tenant_id,
        must_change_password=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # SEC-1: Create TenantMember for GESTION so they can operate within the tenant
    if resolved_role == "GESTION":
        member = TenantMember(
            tenant_id=body.tenant_id,
            user_id=user.id,
            role="owner",
        )
        db.add(member)

    await db.commit()

    # ── Audit log ────────────────────────────────────────────────
    audit = AuditLog(
        id=str(uuid.uuid4()),
        tenant_id=body.tenant_id,
        user_id=current_user.id,
        action="user_created",
        resource="user",
        resource_id=user.id,
        details={
            "target_email": user.email,
            "target_role": resolved_role,
            "creator_role": current_user.role,
        },
        ip_address=request.client.host if request.client else "unknown",
    )
    db.add(audit)
    await db.commit()

    return user


@router.get("", response_model=list[UserResponse])
async def list_users(
    request: Request,
    tenant_id: Optional[str] = Query(None, description="Filter by tenant UUID"),
    role: Optional[str] = Query(None, description="Filter by role (TEACHER, GESTION, ADMIN)"),
    current_user: User = Depends(require_role("GESTION")),
    db: AsyncSession = Depends(get_db),
):
    """List users with optional filters. Only GESTION users can list users.
    
    SECURITY: Tenant isolation is enforced. If no tenant_id is specified,
    only users from tenants the current GESTION is a member of are returned.
    If tenant_id is specified, the GESTION must be a member of that tenant.
    """
    stmt = select(User)

    if tenant_id:
        # Verify the GESTION has access to the specified tenant
        membership = await db.execute(
            select(TenantMember).where(
                TenantMember.tenant_id == tenant_id,
                TenantMember.user_id == current_user.id,
            )
        )
        if not membership.scalar_one_or_none() and current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No eres miembro de este colegio",
            )
        stmt = stmt.where(User.tenant_id == tenant_id)
    else:
        # Only show users from tenants the GESTION is a member of
        member_result = await db.execute(
            select(TenantMember.tenant_id).where(TenantMember.user_id == current_user.id)
        )
        member_tenant_ids = [row[0] for row in member_result.fetchall()]
        if member_tenant_ids:
            stmt = stmt.where(User.tenant_id.in_(member_tenant_ids))
        else:
            # Fallback: only current user's own tenant
            stmt = stmt.where(User.tenant_id == get_tenant_id(request, current_user))

    if role:
        stmt = stmt.where(User.role == role.upper().strip())

    stmt = stmt.order_by(User.created_at.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()
    return users


def _generate_temp_password(length: int = 12) -> str:
    """Generate a secure random temporary password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    user_id: UUID,
    request: Request,
    current_user: User = Depends(require_role("GESTION")),
    db: AsyncSession = Depends(get_db),
):
    """Reset a user's password to a secure temporary password.
    
    Only GESTION users can reset passwords. The GESTION must belong to the same
    tenant as the target user (tenant isolation). The temporary password
    is returned in the response and is not stored in plaintext.
    """
    # Fetch the target user
    user_id_str = str(user_id)
    user_result = await db.execute(select(User).where(User.id == user_id_str))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    # SECURITY: Prevent GESTION from resetting their own password
    if user_id_str == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes restaurar tu propia contraseña desde este panel.",
        )

    # SECURITY: Tenant isolation — GESTION must be a member of the user's tenant
    if current_user.role != "ADMIN":
        member_result = await db.execute(
            select(TenantMember).where(
                TenantMember.tenant_id == user.tenant_id,
                TenantMember.user_id == current_user.id,
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No eres miembro del colegio de este usuario",
            )

    # SECURITY: Only allow password reset for active TEACHERs
    if user.role != "TEACHER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo se puede restaurar la contraseña de profesores.",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede restaurar la contraseña de un usuario con estado '{user.status}'.",
        )

    # Generate secure random password and hash it
    temp_password = _generate_temp_password()
    user.password = hash_password(temp_password)
    user.must_change_password = True

    await db.flush()
    await db.commit()

    # ── Audit log ────────────────────────────────────────────────
    audit = AuditLog(
        id=str(uuid.uuid4()),
        tenant_id=user.tenant_id,
        user_id=current_user.id,
        action="password_reset",
        resource="user",
        resource_id=user.id,
        details={
            "target_email": user.email,
            "target_role": user.role,
        },
        ip_address=request.client.host if request.client else "unknown",
    )
    db.add(audit)
    await db.commit()

    return ResetPasswordResponse(
        success=True,
        message="Contraseña restaurada exitosamente.",
        temporary_password=temp_password,
    )
