"""One-time migration: HOLDER → GESTION role rename.

Run this script to update existing users in the database:
    cd apps/api && python -m scripts.migrate_holder_to_gestion
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import func, select, update
from database import async_session
from models.db_models import User


async def migrate() -> None:
    """Update all users with role='HOLDER' to role='GESTION'."""
    async with async_session() as session:
        # Count before
        count_result = await session.execute(
            select(func.count()).select_from(User).where(User.role == "HOLDER")
        )
        before = count_result.scalar() or 0

        if before == 0:
            print("✅ No users with role='HOLDER' found. Migration already applied or no data.")
            return

        # Update
        await session.execute(
            update(User).where(User.role == "HOLDER").values(role="GESTION")
        )
        await session.commit()

        # Verify
        after_result = await session.execute(
            select(func.count()).select_from(User).where(User.role == "HOLDER")
        )
        after = after_result.scalar() or 0

        print(f"✅ Migrated {before - after} users from 'HOLDER' to 'GESTION'.")
        print(f"   Remaining 'HOLDER' rows: {after}")


if __name__ == "__main__":
    asyncio.run(migrate())
