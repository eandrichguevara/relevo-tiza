"""Repair script: create missing TenantMember entries for legacy data.

SEC-7: After adding TenantMember-based tenant isolation, existing users
(who registered before the migration) lack TenantMember entries, causing
them to see 0 tenants in GET /api/tenants.

Usage:
    python -m scripts.repair_tenant_memberships

This script:
  1. Finds every User with a tenant_id that lacks a TenantMember entry.
  2. Creates TenantMember (role=owner for GESTION/ADMIN, role=member for TEACHER).
  3. For GESTION users with zero memberships, grants access to ALL tenants (legacy fallback).
"""
import asyncio
import os
import sys

# Ensure the API root is on the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from models.db_models import User, Tenant, TenantMember
from config import settings


async def repair() -> None:
    """Create missing TenantMember entries for all users."""
    database_url = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./relevo-tiza.db",
    )
    engine = create_async_engine(database_url, echo=True)

    async with async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as db:  # type: ignore[arg-type]
        # Get all tenants indexed by id
        tenants_result = await db.execute(select(Tenant))
        all_tenants: list[Tenant] = list(tenants_result.scalars().all())
        tenant_map = {t.id: t for t in all_tenants}

        # Get all users
        users_result = await db.execute(select(User))
        all_users: list[User] = list(users_result.scalars().all())

        # Load existing memberships
        members_result = await db.execute(select(TenantMember))
        existing_members: list[TenantMember] = list(members_result.scalars().all())

        # Build lookup: {user_id: set(tenant_ids)}
        existing_by_user: dict[str, set[str]] = {}
        for m in existing_members:
            existing_by_user.setdefault(m.user_id, set()).add(m.tenant_id)

        created = 0
        for user in all_users:
            user_memberships = existing_by_user.get(user.id, set())

            # Determine target tenants for this user
            target_tenant_ids: set[str] = set()

            # Every user should be a member of their own assigned tenant
            if user.tenant_id and user.tenant_id in tenant_map:
                target_tenant_ids.add(user.tenant_id)

            # GESTION users without ANY memberships → grant access to ALL tenants
            # (legacy data fallback: these GESTION users managed all schools before SEC-7)
            if user.role == "GESTION" and not user_memberships:
                for tid in tenant_map:
                    target_tenant_ids.add(tid)

            # Create missing memberships
            for tid in target_tenant_ids:
                if tid not in user_memberships:
                    role = "owner" if user.role in ("GESTION", "ADMIN") else "member"
                    member = TenantMember(
                        tenant_id=tid,
                        user_id=user.id,
                        role=role,
                    )
                    db.add(member)
                    created += 1

        await db.commit()
        print(f"\n✅ Repair complete: created {created} missing TenantMember entries")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(repair())
