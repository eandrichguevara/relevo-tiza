"""Authentication router - login, register."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database import get_db
from models.db_models import User, Tenant, TenantMember, generate_join_code as _raw_join_code
from models.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from utils.security import verify_password, hash_password, create_access_token, get_current_user

MAX_JOIN_CODE_ATTEMPTS = 10


async def _generate_unique_join_code(db: AsyncSession) -> str:
    """Generate a unique join_code with collision retry."""
    for _ in range(MAX_JOIN_CODE_ATTEMPTS):
        code = _raw_join_code()
        existing = await db.execute(select(Tenant).where(Tenant.join_code == code))
        if not existing.scalar_one_or_none():
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate a unique join_code. Please try again.",
    )

router = APIRouter()

# ─── Role & brand mapping ─────────────────────────────────
# SECURITY: Only TEACHER and HOLDER can be created via public registration.
# "admin" role is intentionally excluded to prevent privilege escalation.
ROLE_MAP = {
    "teacher": "TEACHER",
    "director": "HOLDER",
    "holder": "HOLDER",
}

BRAND_MAP = {
    "TEACHER": "tiza",
    "HOLDER": "relevo",
    "ADMIN": "tiza",
}

DEFAULT_TENANT_NAME = "Colegio Demo"


def _resolve_role(raw_role: Optional[str]) -> str:
    """Map frontend role to backend RoleEnum value."""
    role = (raw_role or "teacher").lower().strip()
    return ROLE_MAP.get(role, "TEACHER")


def _resolve_brand(role: str) -> str:
    """Map backend role to tenant brand."""
    return BRAND_MAP.get(role, "tiza")


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user.

    - TEACHER: requires an existing ``tenant_id`` in body.
    - HOLDER/ADMIN: creates a default tenant when ``tenant_id`` is omitted.
    """
    # Check existing user
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Resolve role and brand
    resolved_role = _resolve_role(body.role)
    brand = _resolve_brand(resolved_role)

    # Determine tenant
    tenant_id: Optional[str] = body.tenant_id
    join_code: Optional[str] = body.join_code

    # If join_code provided, resolve it to tenant_id
    if join_code and not tenant_id:
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.join_code == join_code.strip().upper())
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid join code",
            )
        tenant_id = tenant.id

    if tenant_id:
        # Verify tenant exists (only if not already resolved from join_code)
        if not join_code:
            tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = tenant_result.scalar_one_or_none()
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Tenant not found",
                )
    elif resolved_role == "TEACHER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teachers must be assigned to an existing tenant. Provide a tenant_id, a join_code, or ask your school director to create an account.",
        )
    else:
        # HOLDER / ADMIN → create a default tenant
        tenant_subdomain = f"colegio-demo-{brand}"
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.subdomain == tenant_subdomain)
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            tenant_name = body.school or DEFAULT_TENANT_NAME
            join_code = await _generate_unique_join_code(db)
            tenant = Tenant(
                subdomain=tenant_subdomain,
                name=tenant_name,
                brand=brand,
                status="pending",
                join_code=join_code,
            )
            db.add(tenant)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                # Race condition: another request concurrently created the same tenant.
                # Re-fetch the existing one instead of failing with a 500.
                tenant_result = await db.execute(
                    select(Tenant).where(Tenant.subdomain == tenant_subdomain)
                )
                tenant = tenant_result.scalar_one_or_none()
                if not tenant:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to create tenant due to a concurrent registration. Please try again.",
                    )
        tenant_id = tenant.id

    user = User(
        email=body.email,
        name=body.name or body.email.split("@")[0],
        password=hash_password(body.password),
        status="pending",
        role=resolved_role,
        tenant_id=tenant_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Add user as a member of their tenant (tenant isolation)
    member = TenantMember(
        tenant_id=tenant_id,
        user_id=user.id,
        role="owner" if resolved_role in ("HOLDER", "ADMIN") else "member",
    )
    db.add(member)

    await db.commit()
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user and return JWT token."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Block non-active users from logging in
    if user.status != "active":
        if user.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu cuenta está pendiente de aprobación. Un administrador debe activarla antes de que puedas iniciar sesión.",
            )
        elif user.status == "rejected":
            reason = f" Motivo: {user.rejection_reason}" if user.rejection_reason else ""
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Tu cuenta ha sido rechazada.{reason}",
            )
        elif user.status == "suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu cuenta ha sido suspendida. Contacta al administrador.",
            )

    token = create_access_token(
        data={"sub": user.id, "role": user.role, "tenant_id": user.tenant_id}
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return current_user


@router.get("/session")
async def get_session(current_user: User = Depends(get_current_user)):
    """Get current user session info — compatible with client-side session checks.
    
    Returns user identity, role, and tenant info so the frontend can
    determine access and redirects without separate API calls.
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "tenant_id": current_user.tenant_id,
        "authenticated": True,
    }
