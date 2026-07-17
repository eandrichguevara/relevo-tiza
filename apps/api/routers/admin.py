"""Admin router — user registration approval workflow."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from database import get_db
from models.db_models import User, Tenant
from models.schemas import (
    PendingListResponse,
    PendingRegistrationResponse,
    ApproveRejectRequest,
    ApprovalActionResponse,
    UserStatusEnum,
)
from utils.security import require_super_admin

router = APIRouter()


@router.get("/api/admin/pending-registrations", response_model=PendingListResponse)
async def list_pending_registrations(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    role: str = Query(None, description="Filter by role (TEACHER, HOLDER, ADMIN)"),
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all pending user registrations with pagination and optional role filter."""
    query = select(User).where(User.status == "pending")
    count_query = select(func.count(User.id)).where(User.status == "pending")

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
    user_id: str,
    body: ApproveRejectRequest,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending user registration.

    If the user is a HOLDER or ADMIN, also approves their tenant.
    """
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.tenant))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado.",
        )

    if user.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El usuario no está pendiente. Estado actual: {user.status}",
        )

    now = datetime.now(timezone.utc)
    user.status = "active"
    user.approved_at = now
    user.approved_by = current_user.email

    # If HOLDER or ADMIN, also approve the tenant
    if user.role in ("HOLDER", "ADMIN") and user.tenant:
        tenant = user.tenant
        if tenant.status == "pending":
            tenant.status = "active"
            tenant.approved_at = now
            tenant.approved_by = current_user.email

    await db.flush()
    await db.commit()

    return ApprovalActionResponse(
        success=True,
        message="Usuario aprobado exitosamente.",
        user_id=user.id,
        status=UserStatusEnum.active,
    )


@router.post("/api/admin/reject/{user_id}", response_model=ApprovalActionResponse)
async def reject_registration(
    user_id: str,
    body: ApproveRejectRequest,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending user registration.

    A rejection reason is required. If the user is a HOLDER or ADMIN,
    also rejects their tenant.
    """
    if not body.reason or not body.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El motivo de rechazo es obligatorio.",
        )

    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.tenant))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado.",
        )

    if user.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El usuario no está pendiente. Estado actual: {user.status}",
        )

    now = datetime.now(timezone.utc)
    user.status = "rejected"
    user.rejection_reason = body.reason.strip()
    user.rejected_at = now
    user.approved_by = current_user.email

    # If HOLDER or ADMIN, also reject the tenant
    if user.role in ("HOLDER", "ADMIN") and user.tenant:
        tenant = user.tenant
        if tenant.status == "pending":
            tenant.status = "rejected"
            tenant.rejection_reason = body.reason.strip()
            tenant.rejected_at = now
            tenant.approved_by = current_user.email

    await db.flush()
    await db.commit()

    return ApprovalActionResponse(
        success=True,
        message="Usuario rechazado exitosamente.",
        user_id=user.id,
        status=UserStatusEnum.rejected,
    )
