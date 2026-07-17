"""Seed demo data into the FastAPI SQLAlchemy database."""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select
from database import async_session, engine, Base
from models.db_models import Tenant, User, TenantMember, generate_join_code
from utils.security import hash_password

MAX_SEED_CODE_ATTEMPTS = 10

# Super admin defaults when env vars are not set
_DEFAULT_SUPER_ADMIN_EMAIL = "admin@relevo-tiza.app"
_DEFAULT_SUPER_ADMIN_PASSWORD = "Admin123!Segura"


async def _get_seed_join_code(db) -> str:
    """Generate a unique join_code for seed data."""
    for _ in range(MAX_SEED_CODE_ATTEMPTS):
        code = generate_join_code()
        from sqlalchemy import select
        existing = await db.execute(select(Tenant).where(Tenant.join_code == code))
        if not existing.scalar_one_or_none():
            return code
    return "TIZA0001"  # fallback


async def seed():
    print("🌱 Seeding FastAPI database...")

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Check if demo tenant already exists
        result = await db.execute(
            select(Tenant).where(Tenant.subdomain == "colegio-demo")
        )
        tenant = result.scalar_one_or_none()

        if not tenant:
            join_code = await _get_seed_join_code(db)
            tenant = Tenant(
                subdomain="colegio-demo",
                name="Colegio Demo",
                brand="tiza",
                join_code=join_code,
            )
            db.add(tenant)
            await db.flush()
            print(f"   ✅ Tenant 'colegio-demo' created (join_code={join_code})")
        else:
            # Backfill join_code for existing tenants that may have NULL
            # (legacy migration added the column without NOT NULL constraint)
            existing_join_code = await db.execute(
                select(Tenant.join_code).where(Tenant.id == tenant.id)
            )
            existing_code = existing_join_code.scalar_one_or_none()
            if not existing_code:
                join_code = await _get_seed_join_code(db)
                tenant.join_code = join_code
                print(f"   🔄 Tenant 'colegio-demo' backfilled (join_code={join_code})")
            else:
                print(f"   ⏭️  Tenant 'colegio-demo' already exists (join_code={existing_code})")

        # Check if demo users already exist
        demo_users = [
            ("profesor@demo.cl", "María González", "TEACHER", "demo123"),
            ("director@demo.cl", "Carlos Rodríguez", "HOLDER", "demo123"),
        ]

        for email, name, role, password in demo_users:
            result = await db.execute(select(User).where(User.email == email))
            existing = result.scalar_one_or_none()
            if existing:
                print(f"   ⏭️  User '{email}' already exists")
            else:
                user = User(
                    email=email,
                    name=name,
                    password=hash_password(password),
                    role=role,
                    tenant_id=tenant.id,
                )
                db.add(user)
                print(f"   ✅ User '{email}' ({role}) created")

        # Assign HOLDER user as owner of the demo tenant
        holder_result = await db.execute(
            select(User).where(User.email == "director@demo.cl")
        )
        holder = holder_result.scalar_one_or_none()

        if holder:
            existing_member = await db.execute(
                select(TenantMember).where(
                    TenantMember.tenant_id == tenant.id,
                    TenantMember.user_id == holder.id,
                )
            )
            if not existing_member.scalar_one_or_none():
                tm = TenantMember(
                    tenant_id=tenant.id,
                    user_id=holder.id,
                    role="owner",
                )
                db.add(tm)
                print("   ✅ TenantMember 'director@demo.cl' → 'colegio-demo' (owner)")

        # ─── Super Admin ────────────────────────────────────────────
        super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", _DEFAULT_SUPER_ADMIN_EMAIL)
        super_admin_password = os.getenv("SUPER_ADMIN_PASSWORD", _DEFAULT_SUPER_ADMIN_PASSWORD)

        result = await db.execute(select(User).where(User.email == super_admin_email))
        existing_admin = result.scalar_one_or_none()
        if existing_admin:
            print(f"   ⏭️  Super admin '{super_admin_email}' already exists")
        else:
            # Super admin belongs to the demo tenant (or create a dedicated one)
            admin_tenant = tenant
            super_admin = User(
                email=super_admin_email,
                name="Super Admin",
                password=hash_password(super_admin_password),
                status="active",
                role="ADMIN",
                tenant_id=admin_tenant.id,
            )
            db.add(super_admin)
            await db.flush()

            # Also add as TenantMember owner
            existing_member = await db.execute(
                select(TenantMember).where(
                    TenantMember.tenant_id == admin_tenant.id,
                    TenantMember.user_id == super_admin.id,
                )
            )
            if not existing_member.scalar_one_or_none():
                tm = TenantMember(
                    tenant_id=admin_tenant.id,
                    user_id=super_admin.id,
                    role="owner",
                )
                db.add(tm)

            print(f"   ✅ Super admin '{super_admin_email}' created")

        await db.commit()

    print("✅ Seed complete!")
    print("   Teacher:     profesor@demo.cl / demo123")
    print("   Holder:      director@demo.cl / demo123")
    print(f"   Super Admin: {super_admin_email} / {super_admin_password}")
    print("   TenantMember: director@demo.cl → colegio-demo (owner)")

    # Warn if using default credentials
    if super_admin_email == _DEFAULT_SUPER_ADMIN_EMAIL or super_admin_password == _DEFAULT_SUPER_ADMIN_PASSWORD:
        print("   ⚠️  WARNING: Using default super admin credentials!")
        print("       Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars for production.")


if __name__ == "__main__":
    asyncio.run(seed())
