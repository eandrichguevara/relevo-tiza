"""Repair script: backfill NULL join_codes for existing tenants.

BUG-1: The join_code column was added to the tenants table via raw ALTER TABLE
without a NOT NULL constraint, leaving existing rows with NULL join_code.
This blocks TEACHER registration since they need a join_code to look up their school.

Usage:
    python -m scripts.backfill_join_codes

This script:
   1. Finds every Tenant with a NULL or empty join_code.
   2. Generates a unique 8-char uppercase join_code for each.
   3. Commits the changes.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from models.db_models import Tenant, generate_join_code

MAX_RETRIES = 10
FALLBACK_CODE = "TIZA0001"


async def backfill() -> None:
    """Generate join_codes for all tenants that have NULL."""
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://tiza_user:tiza_password@localhost:5432/tiza_dev",
    )
    engine = create_async_engine(database_url, echo=False)

    async with async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as db:
        # Find all tenants with NULL or empty join_code
        result = await db.execute(
            select(Tenant).where(
                (Tenant.join_code.is_(None)) | (Tenant.join_code == "")
            )
        )
        tenants: list[Tenant] = list(result.scalars().all())

        if not tenants:
            print("✅ All tenants already have a join_code. Nothing to do.")
            await engine.dispose()
            return

        print(f"🛠️  Found {len(tenants)} tenant(s) with missing join_code...")

        updated = 0
        for tenant in tenants:
            code = FALLBACK_CODE
            for _ in range(MAX_RETRIES):
                candidate = generate_join_code()
                conflict = await db.execute(
                    select(Tenant).where(Tenant.join_code == candidate)
                )
                if not conflict.scalar_one_or_none():
                    code = candidate
                    break

            tenant.join_code = code
            updated += 1
            print(f"   🔄 Tenant '{tenant.name}' ({tenant.id[:8]}…) → join_code={code}")

        await db.commit()
        print(f"\n✅ Backfill complete: {updated} tenant(s) updated.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(backfill())
