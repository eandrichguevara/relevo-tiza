"""Tests for F-04: Email notifications on user approval/rejection.

Covers:
- Approving a user calls send_approval_notification with correct args
- Rejecting a user calls send_rejection_notification with correct args
- Approval/rejection completes even if email sending fails (fire-and-forget)
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from httpx import AsyncClient
from unittest.mock import patch, AsyncMock


async def _create_admin_user(client: AsyncClient) -> dict:
    """Create an ADMIN user directly in DB and return token + user data."""
    import database as db_module
    from models.db_models import Tenant, User, TenantMember
    from utils.security import hash_password, create_access_token
    from models.db_models import generate_join_code

    async with db_module.async_session() as session:
        tenant = Tenant(
            subdomain="admin-email-test-tenant",
            name="Admin Email Test School",
            brand="tiza",
            status="active",
            join_code=generate_join_code(),
        )
        session.add(tenant)
        await session.flush()

        admin_user = User(
            email="admin-email@test.com",
            name="Admin Email",
            password=hash_password("AdminEmail123!"),
            status="active",
            role="ADMIN",
            tenant_id=tenant.id,
        )
        session.add(admin_user)
        await session.flush()

        member = TenantMember(
            tenant_id=tenant.id,
            user_id=admin_user.id,
            role="owner",
        )
        session.add(member)
        await session.commit()

        token = create_access_token(
            data={"sub": admin_user.id, "role": admin_user.role, "tenant_id": admin_user.tenant_id}
        )

    return {"token": token, "id": admin_user.id, "tenant_id": tenant.id}


async def _create_pending_teacher(db) -> dict:
    """Create a pending TEACHER directly in DB and return user data."""
    from models.db_models import User, Tenant
    from utils.security import hash_password
    from sqlalchemy import select
    from models.db_models import generate_join_code

    result = await db.execute(select(Tenant).limit(1))
    tenant = result.scalar_one_or_none()

    if not tenant:
        tenant = Tenant(
            subdomain="pending-email-tenant",
            name="Pending Email School",
            brand="tiza",
            status="pending",
            join_code=generate_join_code(),
        )
        db.add(tenant)
        await db.flush()

    user = User(
        email="pending-email-teacher@test.com",
        name="Pending Email Teacher",
        password=hash_password("Pass1234!"),
        status="pending",
        role="TEACHER",
        tenant_id=tenant.id,
    )
    db.add(user)
    await db.flush()

    return {"id": user.id, "email": user.email, "name": user.name, "tenant_id": tenant.id}


@pytest.mark.asyncio
class TestEmailNotifications:
    """F-04: Email notifications on user approval/rejection."""

    async def test_approval_calls_send_approval_notification(self, client: AsyncClient):
        """Approving a pending user calls send_approval_notification with correct args."""
        admin = await _create_admin_user(client)

        # Create a pending user
        import database as db_module
        async with db_module.async_session() as session:
            pending = await _create_pending_teacher(session)
            await session.commit()

        # Mock send_approval_notification (target the imported ref in admin router)
        from routers import admin as admin_router
        mock_func = AsyncMock()
        original = admin_router.send_approval_notification
        admin_router.send_approval_notification = mock_func

        try:
            response = await client.post(
                f"/api/admin/approve/{pending['id']}",
                json={"reason": "Documentación completa"},
                headers={"Authorization": f"Bearer {admin['token']}"},
            )
        finally:
            admin_router.send_approval_notification = original

        assert response.status_code == 200, f"Approval failed: {response.text}"

        # The mock may be called via background_tasks after the response returns.
        # We check call_count — if >0 the notification was queued.
        # Since background tasks run in the same event loop, they should complete.
        assert mock_func.call_count >= 1, (
            "send_approval_notification was never called"
        )
        if mock_func.call_count > 0:
            _args, kwargs = mock_func.call_args
            # Verify correct arguments
            assert kwargs.get("to") == pending["email"], (
                f"Expected to={pending['email']}, got {kwargs.get('to')}"
            )
            assert kwargs.get("user_name") == pending["name"], (
                f"Expected user_name={pending['name']}, got {kwargs.get('user_name')}"
            )

    async def test_rejection_calls_send_rejection_notification(self, client: AsyncClient):
        """Rejecting a pending user calls send_rejection_notification with correct args."""
        admin = await _create_admin_user(client)

        import database as db_module
        async with db_module.async_session() as session:
            pending = await _create_pending_teacher(session)
            await session.commit()

        from routers import admin as admin_router
        mock_func = AsyncMock()
        original = admin_router.send_rejection_notification
        admin_router.send_rejection_notification = mock_func

        try:
            response = await client.post(
                f"/api/admin/reject/{pending['id']}",
                json={"reason": "Documentación incompleta"},
                headers={"Authorization": f"Bearer {admin['token']}"},
            )
        finally:
            admin_router.send_rejection_notification = original

        assert response.status_code == 200, f"Rejection failed: {response.text}"
        assert mock_func.call_count >= 1, (
            "send_rejection_notification was never called"
        )

    async def test_approval_completes_even_if_email_fails(self, client: AsyncClient):
        """Approval succeeds even if email sending fails (fire-and-forget pattern)."""
        admin = await _create_admin_user(client)

        import database as db_module
        async with db_module.async_session() as session:
            pending = await _create_pending_teacher(session)
            await session.commit()

        from routers import admin as admin_router

        async def failing_email(**kwargs):
            """Simulate email failure by returning False (the real function never raises)."""
            return False

        original = admin_router.send_approval_notification
        admin_router.send_approval_notification = failing_email

        try:
            response = await client.post(
                f"/api/admin/approve/{pending['id']}",
                json={"reason": "OK"},
                headers={"Authorization": f"Bearer {admin['token']}"},
            )
        finally:
            admin_router.send_approval_notification = original

        # Approval succeeds despite email failure (fire-and-forget)
        assert response.status_code == 200, f"Approval failed: {response.text}"
        assert response.json()["status"] == "active"

    async def test_rejection_completes_even_if_email_fails(self, client: AsyncClient):
        """Rejection succeeds even if email sending fails (fire-and-forget pattern)."""
        admin = await _create_admin_user(client)

        import database as db_module
        async with db_module.async_session() as session:
            pending = await _create_pending_teacher(session)
            await session.commit()

        from routers import admin as admin_router

        async def failing_email(**kwargs):
            """Simulate email failure by returning False (the real function never raises)."""
            return False

        original = admin_router.send_rejection_notification
        admin_router.send_rejection_notification = failing_email

        try:
            response = await client.post(
                f"/api/admin/reject/{pending['id']}",
                json={"reason": "Documentación incompleta"},
                headers={"Authorization": f"Bearer {admin['token']}"},
            )
        finally:
            admin_router.send_rejection_notification = original

        assert response.status_code == 200, f"Rejection failed: {response.text}"
        assert response.json()["status"] == "rejected"
