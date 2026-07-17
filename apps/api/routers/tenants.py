"""Tenants router — multi-tenant management for HOLDERs."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from sqlalchemy.exc import IntegrityError

from database import get_db, create_tenant_schema
from models.db_models import Tenant, TenantMember, User, generate_join_code
from models.schemas import CreateTenantRequest, TenantResponse, TenantLookupResponse, DeleteTenantResponse
from utils.security import require_role, require_super_admin

router = APIRouter()

MAX_JOIN_CODE_ATTEMPTS = 10


async def _generate_unique_join_code(db: AsyncSession) -> str:
    """Generar un join_code único con reintento en caso de colisión."""
    for _ in range(MAX_JOIN_CODE_ATTEMPTS):
        code = generate_join_code()
        existing = await db.execute(
            select(Tenant).where(Tenant.join_code == code)
        )
        if not existing.scalar_one_or_none():
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="No se pudo generar un código de acceso único. Intenta nuevamente.",
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
            detail="Ya existe un colegio con este nombre",
        )

    # Check subdomain uniqueness
    existing = await db.execute(
        select(Tenant).where(Tenant.subdomain == body.subdomain)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un colegio con este subdominio",
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
        # Create tenant schema for data isolation
        await create_tenant_schema(tenant.id)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un colegio con este nombre o subdominio",
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
            detail="Ya existe un colegio con este nombre o subdominio",
        )
    return tenant


@router.get("", response_model=list[TenantResponse])
async def list_tenants(
    request: Request,
    current_user: User = Depends(require_role("HOLDER")),
    db: AsyncSession = Depends(get_db),
):
    """List tenants.

    - ADMIN: sees ALL tenants across the system.
    - HOLDER: only sees tenants where they are a member (tenant isolation).
    """
    # ADMIN can see all tenants
    if current_user.role == "ADMIN":
        result = await db.execute(
            select(Tenant).order_by(Tenant.created_at.desc())
        )
        tenants = result.scalars().all()
        return tenants

    # HOLDER: get IDs of all tenants where they are a member
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
        # Use current_user.tenant_id (DB value, not manipulable)
        # instead of get_tenant_id() which reads headers — Consistent
        # with executive_dashboard() fallback, defense against IDOR.
        if not current_user.tenant_id:
            return []
        result = await db.execute(
            select(Tenant)
            .where(Tenant.id == current_user.tenant_id)
            .order_by(Tenant.created_at.desc())
        )

    tenants = result.scalars().all()
    return tenants


@router.delete("/{tenant_id}", response_model=DeleteTenantResponse)
async def delete_tenant(
    tenant_id: str,
    current_user: User = Depends(require_role("HOLDER")),
    db: AsyncSession = Depends(get_db),
):
    """Eliminar un colegio (tenant). Solo el dueño o un ADMIN puede eliminarlo.

    Realiza un soft delete: cambia el estado a "inactive" en lugar de
    eliminar físicamente el registro.
    """
    # Verify tenant exists
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Colegio no encontrado",
        )

    # Verify ownership: ADMIN can delete any tenant, HOLDER must be owner
    if current_user.role != "ADMIN":
        membership = await db.execute(
            select(TenantMember).where(
                TenantMember.tenant_id == tenant_id,
                TenantMember.user_id == current_user.id,
                TenantMember.role == "owner",
            )
        )
        if not membership.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el dueño del colegio puede eliminarlo. Contacta a un administrador.",
            )

    # Soft delete: change status to inactive
    tenant.status = "inactive"
    await db.flush()
    await db.commit()

    return DeleteTenantResponse(
        success=True,
        message="Colegio desactivado exitosamente.",
        tenant_id=tenant_id,
    )


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
            detail="El código de acceso es obligatorio",
        )

    result = await db.execute(
        select(Tenant).where(Tenant.join_code == code.strip().upper())
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Código de acceso inválido",
        )

    return TenantLookupResponse(tenant_id=tenant.id, name=tenant.name)
