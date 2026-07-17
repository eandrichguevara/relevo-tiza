"""Admin router — user registration approval workflow."""
import uuid
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from database import get_db
from models.db_models import User, Tenant, AuditLog
from models.schemas import (
    PendingListResponse,
    PendingRegistrationResponse,
    ApproveRejectRequest,
    ApprovalActionResponse,
    UserStatusEnum,
)
from utils.security import require_admin_or_holder

router = APIRouter()


def _build_tenant_scoped_query(current_user: User):
    """Build the base pending-users query, scoped by tenant for HOLDERs.
    
    - ADMIN: sees all pending users across all tenants.
    - HOLDER: sees only TEACHERs pending within their own tenant.
    """
    query = select(User).where(User.status == "pending")
    count_query = select(func.count(User.id)).where(User.status == "pending")

    if current_user.role == "HOLDER":
        # HOLDER can only see TEACHERs in their own tenant
        query = query.where(
            User.tenant_id == current_user.tenant_id,
            User.role == "TEACHER",
        )
        count_query = count_query.where(
            User.tenant_id == current_user.tenant_id,
            User.role == "TEACHER",
        )

    return query, count_query


@router.get("/api/admin/pending-registrations", response_model=PendingListResponse)
async def list_pending_registrations(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    role: str = Query(None, description="Filter by role (TEACHER, HOLDER, ADMIN)"),
    current_user: User = Depends(require_admin_or_holder),
    db: AsyncSession = Depends(get_db),
):
    """List pending user registrations with pagination and optional role filter.
    
    - ADMIN: sees all pending users across all tenants.
    - HOLDER: sees only TEACHERs pending within their own tenant.
    """
    query, count_query = _build_tenant_scoped_query(current_user)

    if role:
        role_upper = role.upper().strip()
        if role_upper not in ("TEACHER", "HOLDER", "ADMIN"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rol inválido: {role}. Use TEACHER, HOLDER o ADMIN.",
            )
        query = query.where(User.role == role_upper)
        count_query = count_query.where(User.role == role_upper)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch paginated results with tenant eager loading
    offset = (page - 1) * page_size
    result = await db.execute(
        query.options(selectinload(User.tenant))
        .order_by(User.created_at.asc())
        .offset(offset)
        .limit(page_size)
    )
    users = result.scalars().all()

    items = [
        PendingRegistrationResponse(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            tenant_id=u.tenant_id,
            tenant_name=u.tenant.name if u.tenant else None,
            brand=u.tenant.brand if u.tenant else None,
            created_at=u.created_at,
        )
        for u in users
    ]

    return PendingListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/api/admin/approve/{user_id}", response_model=ApprovalActionResponse)
async def approve_registration(
    user_id: UUID,
    body: ApproveRejectRequest,
    current_user: User = Depends(require_admin_or_holder),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending user registration.

    - ADMIN: can approve any user. Also approves their tenant if HOLDER/ADMIN.
    - HOLDER: can only approve TEACHERs within their own tenant.
      Cannot approve other HOLDERs or ADMINs (privilege escalation prevention).
    """
    user_id_str = str(user_id)

    result = await db.execute(
        select(User)
        .where(User.id == user_id_str)
        .options(selectinload(User.tenant))
        .with_for_update()
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado.",
        )

    if user.status not in ("pending", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El usuario debe estar pendiente o rechazado para ser aprobado. Estado actual: {user.status}",
        )

    previous_status = user.status

    # If re-approving a rejected user, clear rejection data
    if user.status == "rejected":
        user.rejection_reason = None
        user.rejected_at = None

    # ── HOLDER tenant scoping ──────────────────────────────────
    if current_user.role == "HOLDER":
        if user.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes aprobar usuarios de otro colegio.",
            )
        if user.role != "TEACHER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Como director solo puedes aprobar profesores. Contacta a un administrador para aprobar otros roles.",
            )

    now = datetime.now(timezone.utc)
    user.status = "active"
    user.approved_at = now
    user.approved_by = current_user.email

    # If HOLDER or ADMIN, also approve the tenant
    if user.role in ("HOLDER", "ADMIN") and user.tenant:
        tenant = user.tenant
        if tenant.status in ("pending", "rejected"):
            tenant.status = "active"
            tenant.approved_at = now
            tenant.approved_by = current_user.email
            # Clear rejection data if previously rejected
            tenant.rejection_reason = None
            tenant.rejected_at = None

    await db.flush()

    # ── Audit log ────────────────────────────────────────────────
    audit = AuditLog(
        id=str(uuid.uuid4()),
        tenant_id=user.tenant_id or "system",
        user_id=current_user.id,
        action="user_approved",
        resource="user",
        resource_id=user_id_str,
        details={
            "target_email": user.email,
            "target_role": user.role,
            "previous_status": previous_status,
            "new_status": user.status,
            "reason": body.reason,
        },
        ip_address="0.0.0.0",
    )
    db.add(audit)

    await db.commit()

    return ApprovalActionResponse(
        success=True,
        message="Usuario aprobado exitosamente.",
        user_id=user.id,
        status=UserStatusEnum.active,
    )


@router.post("/api/admin/reject/{user_id}", response_model=ApprovalActionResponse)
async def reject_registration(
    user_id: UUID,
    body: ApproveRejectRequest,
    current_user: User = Depends(require_admin_or_holder),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending user registration.

    - ADMIN: can reject any user. Also rejects their tenant if HOLDER/ADMIN.
    - HOLDER: can only reject TEACHERs within their own tenant.
      Cannot reject other HOLDERs or ADMINs (privilege escalation prevention).

    A rejection reason is required.
    """
    if not body.reason or not body.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El motivo de rechazo es obligatorio.",
        )

    user_id_str = str(user_id)
    previous_status = "pending"

    result = await db.execute(
        select(User)
        .where(User.id == user_id_str)
        .options(selectinload(User.tenant))
        .with_for_update()
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado.",
        )

    if user.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El usuario no está pendiente. Estado actual: {user.status}",
        )

    # ── HOLDER tenant scoping ──────────────────────────────────
    if current_user.role == "HOLDER":
        if user.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes rechazar usuarios de otro colegio.",
            )
        if user.role != "TEACHER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Como director solo puedes rechazar profesores. Contacta a un administrador para rechazar otros roles.",
            )

    now = datetime.now(timezone.utc)
    user.status = "rejected"
    user.rejection_reason = body.reason.strip()
    user.rejected_at = now

    # If HOLDER or ADMIN, also reject the tenant
    if user.role in ("HOLDER", "ADMIN") and user.tenant:
        tenant = user.tenant
        if tenant.status == "pending":
            tenant.status = "rejected"
            tenant.rejection_reason = body.reason.strip()
            tenant.rejected_at = now

    await db.flush()

    # ── Audit log ────────────────────────────────────────────────
    audit = AuditLog(
        id=str(uuid.uuid4()),
        tenant_id=user.tenant_id or "system",
        user_id=current_user.id,
        action="user_rejected",
        resource="user",
        resource_id=user_id_str,
        details={
            "target_email": user.email,
            "target_role": user.role,
            "previous_status": previous_status,
            "new_status": user.status,
            "reason": body.reason.strip(),
        },
        ip_address="0.0.0.0",
    )
    db.add(audit)

    await db.commit()

    return ApprovalActionResponse(
        success=True,
        message="Usuario rechazado exitosamente.",
        user_id=user.id,
        status=UserStatusEnum.rejected,
    )
