"""Security utilities - JWT, password hashing, tenant access control."""
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from config import settings
from database import get_db
from models.db_models import User, TenantMember

security_scheme = HTTPBearer()

# ─── Password Hashing ─────────────────────────────────────────────
# bcrypt has a 72-byte limit. To handle longer passwords safely,
# we pre-hash with SHA-256 before bcrypt. This is a standard approach
# (Django does the same) and avoids the 72-byte truncation issue.
# The SHA-256 output is always 32 bytes, well within bcrypt's limit.


def _prehash_password(password: str) -> bytes:
    """Pre-hash password with SHA-256 to avoid bcrypt's 72-byte limit.
    
    This is a standard approach (used by Django, etc.) that ensures
    passwords of any length work correctly with bcrypt.
    """
    return hashlib.sha256(password.encode("utf-8")).digest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Try SHA-256 pre-hashed method first (new format)
    if bcrypt.checkpw(
        _prehash_password(plain_password),
        hashed_password.encode("utf-8"),
    ):
        return True
    # Fallback: try direct comparison for passwords hashed with old method
    # (before SHA-256 pre-hashing was introduced)
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        return False


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        _prehash_password(password),
        bcrypt.gensalt(),
    ).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.JWT_EXPIRATION_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    # Check user status — block non-active users from accessing protected endpoints
    if user.status != "active":
        if user.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tu cuenta está pendiente de aprobación. Un administrador debe activarla antes de que puedas acceder.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif user.status == "rejected":
            reason = f" Motivo: {user.rejection_reason}" if user.rejection_reason else ""
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Tu cuenta ha sido rechazada.{reason}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif user.status == "suspended":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tu cuenta ha sido suspendida. Contacta al administrador.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return user


def require_role(role: str):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != role and current_user.role != "ADMIN":
            raise HTTPException(status_code=403, detail=f"Requires {role} role")
        return current_user

    return role_checker


async def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Strict super_admin dependency — only ADMIN role allowed, no bypass."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren privilegios de administrador para esta operación.",
        )
    return current_user


# ─── Tenant Access Control ─────────────────────────────────────────


def get_tenant_id(request: Request, current_user: User = None) -> str:
    """Extract tenant_id from request.state (set by TenantMiddleware).

    Falls back to X-Tenant-Id header, then current_user.tenant_id for
    backward compatibility with tests and direct API calls.
    """
    # 1. TenantMiddleware injected value
    tid = getattr(request.state, "tenant_id", None)
    if tid:
        return tid

    # 2. Direct X-Tenant-Id header (dev/test convenience)
    tid = request.headers.get("X-Tenant-Id")
    if tid:
        return tid

    # 3. Authenticated user's default tenant (backward compat)
    if current_user and current_user.tenant_id:
        return current_user.tenant_id

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No tenant context. Provide a valid subdomain or X-Tenant-Id header.",
    )


def get_brand(request: Request) -> str:
    """Extract brand from request.state (set by TenantMiddleware)."""
    return getattr(request.state, "brand", "tiza")


async def verify_tenant_access(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Verify the authenticated user has access to the resolved tenant.

    Used as a FastAPI dependency. Must be called AFTER get_current_user.
    Injects: request.state.tenant_id and request.state.brand via TenantMiddleware.

    Raises:
        404: No tenant context available
        403: User does not have access to this tenant
    """
    tenant_id = get_tenant_id(request)

    # Admin can access everything
    if current_user.role == "ADMIN":
        return current_user

    # Direct tenant match (user's default tenant)
    if current_user.tenant_id == tenant_id:
        return current_user

    # Multi-tenant: check TenantMember membership
    membership = await db.execute(
        select(TenantMember).where(
            TenantMember.tenant_id == tenant_id,
            TenantMember.user_id == current_user.id,
        )
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this tenant",
        )

    return current_user
