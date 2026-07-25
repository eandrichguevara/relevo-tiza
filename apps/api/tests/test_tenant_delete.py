"""Tests for N-05: Soft delete of tenants.

Covers:
- GESTION owner can soft-delete their own tenant → 200
- Deleted tenant has status="inactive" in list
- GESTION (non-owner) cannot delete another's tenant → 403
- TEACHER cannot delete any tenant → 403
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from httpx import AsyncClient


async def _setup_gestion_custom(
    _app,
    email: str,
    password: str,
    name: str | None = None,
    with_member: bool = True,
) -> dict:
    """Create a GESTION user + tenant directly in DB.
    Returns dict with token and tenant_id.
    """
    from database import get_db
    from models.db_models import Tenant, User, TenantMember, generate_join_code
    from utils.security import hash_password
    from httpx import AsyncClient as HAC, ASGITransport
    import time
    import random

    override = _app.dependency_overrides.get(get_db)
    session_generator = override() if override else get_db()
    async for session in session_generator:
        ts = f"{time.time()}-{random.randint(1000, 9999)}"
        tenant = Tenant(
            subdomain=f"deletetest-{email.split('@')[0]}-{ts}",
            name=f"Delete Test School {email} {ts}",
            brand="relevo",
            status="active",
            join_code=generate_join_code(),
        )
        session.add(tenant)
        await session.flush()

        gestion = User(
            email=email,
            name=name or f"Gestion {email}",
            password=hash_password(password),
            status="active",
            role="GESTION",
            tenant_id=tenant.id,
        )
        session.add(gestion)
        await session.flush()

        if with_member:
            member = TenantMember(
                tenant_id=tenant.id,
                user_id=gestion.id,
                role="owner",
            )
            session.add(member)

        tenant_id = tenant.id

    # Login via API to get token
    transport = ASGITransport(app=_app)
    async with HAC(transport=transport, base_url="http://test") as c:
        login_resp = await c.post("/api/auth/login", json={
            "email": email,
            "password": password,
        })
        assert login_resp.status_code == 200, f"Login failed for {email}: {login_resp.text}"
        token = login_resp.json()["access_token"]

    return {"token": token, "tenant_id": tenant_id}


async def _login(_app, email: str, password: str) -> str:
    """Login via API and return a Bearer token."""
    from httpx import AsyncClient as HAC, ASGITransport
    transport = ASGITransport(app=_app)
    async with HAC(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/login", json={
            "email": email,
            "password": password,
        })
        assert resp.status_code == 200, f"Login failed ({email}): {resp.text}"
        return resp.json()["access_token"]


@pytest.mark.asyncio
class TestTenantDelete:
    """N-05: Soft delete of tenants."""

    async def test_delete_tenant_success(self, client: AsyncClient, fastapi_app):
        """GESTION owner can soft-delete their own tenant. Status becomes 'inactive'."""
        gestion = await _setup_gestion_custom(
            fastapi_app, "owner@delete.test", "OwnerDel999!", with_member=True
        )
        tid = gestion["tenant_id"]

        # DELETE the tenant
        resp = await client.delete(
            f"/api/tenants/{tid}",
            headers={"Authorization": f"Bearer {gestion['token']}"},
        )
        assert resp.status_code == 200, f"Delete failed: {resp.text}"
        data = resp.json()
        assert data["success"] is True
        assert "desactivado" in data["message"].lower()
        assert data["tenant_id"] == tid

        # Verify tenant now has status "inactive" via list endpoint
        list_resp = await client.get(
            "/api/tenants",
            headers={"Authorization": f"Bearer {gestion['token']}"},
        )
        assert list_resp.status_code == 200
        tenants = list_resp.json()["items"]
        for t in tenants:
            if t["id"] == tid:
                assert t["status"] == "inactive", (
                    f"Expected status 'inactive', got '{t['status']}'"
                )
                break
        else:
            pytest.fail(f"Tenant {tid} not found in tenant list after soft delete")

    async def test_delete_tenant_non_owner_returns_403(self, client: AsyncClient, fastapi_app):
        """GESTION who is not an owner of the tenant cannot delete it."""
        # Create tenant A with owner A
        gestion_a = await _setup_gestion_custom(
            fastapi_app, "owner-a@delete.test", "OwnerADel999!", with_member=True
        )

        # Create gestion B (different tenant, not an owner of A)
        gestion_b = await _setup_gestion_custom(
            fastapi_app, "gestion-b@delete.test", "GestionBDel999!", with_member=True
        )

        # Gestion B tries to delete tenant A → 403
        resp = await client.delete(
            f"/api/tenants/{gestion_a['tenant_id']}",
            headers={"Authorization": f"Bearer {gestion_b['token']}"},
        )
        assert resp.status_code == 403, (
            f"Expected 403 for non-owner GESTION, got {resp.status_code}: {resp.text}"
        )

    async def test_delete_tenant_teacher_returns_403(self, client: AsyncClient, fastapi_app):
        """TEACHER cannot delete a tenant (require_role('GESTION') blocks them)."""
        # Create GESTION with tenant
        gestion = await _setup_gestion_custom(
            fastapi_app, "gestion@teacherdel.test", "GestionTDel999!", with_member=True
        )

        # Create TEACHER in that tenant
        import database as db_module
        from models.db_models import User
        from utils.security import hash_password

        async with db_module.async_session() as session:
            teacher = User(
                email="teacher@delete.test",
                name="Teacher Delete",
                password=hash_password("TeacherDel999!"),
                status="active",
                role="TEACHER",
                tenant_id=gestion["tenant_id"],
            )
            session.add(teacher)
            await session.commit()

        teacher_token = await _login(fastapi_app, "teacher@delete.test", "TeacherDel999!")

        # TEACHER tries to delete tenant → 403 (require_role)
        resp = await client.delete(
            f"/api/tenants/{gestion['tenant_id']}",
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert resp.status_code == 403, (
            f"Expected 403 for TEACHER deleting tenant, got {resp.status_code}: {resp.text}"
        )
