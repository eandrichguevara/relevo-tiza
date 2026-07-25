"""Tests for admin approval workflow endpoints.

Covers:
- GET  /api/admin/pending-registrations (list pending users)
- POST /api/admin/approve/{user_id} (approve a pending user)
- POST /api/admin/reject/{user_id} (reject a pending user)
- require_super_admin dependency (403 for non-admin)
- Edge cases: already approved, already rejected, no reason, invalid role filter
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from httpx import AsyncClient
from sqlalchemy import text
from models.db_models import Tenant


async def _create_admin_user(client: AsyncClient) -> dict:
    """Create an ADMIN user directly in DB and return token + user data."""
    import database as db_module
    from models.db_models import Tenant, User, TenantMember
    from utils.security import hash_password, create_access_token
    from models.db_models import generate_join_code

    async with db_module.async_session() as session:
        tenant = Tenant(
            subdomain="admin-global-tenant",
            name="Admin Global School",
            brand="tiza",
            status="active",
            join_code=generate_join_code(),
        )
        session.add(tenant)
        await session.flush()

        admin_user = User(
            email="superadmin@example.com",
            name="Super Admin",
            password=hash_password("AdminPass123!"),
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

    return {
        "token": token,
        "email": "superadmin@example.com",
        "id": admin_user.id,
        "tenant_id": tenant.id,
    }


async def _create_pending_user(db, email: str, role: str = "TEACHER") -> dict:
    """Create a pending user directly in DB and return user data."""
    from models.db_models import User
    from utils.security import hash_password
    from sqlalchemy import select

    # Get existing tenant (use first available)
    result = await db.execute(select(Tenant).limit(1))
    tenant = result.scalar_one_or_none()
    if not tenant:
        from models.db_models import generate_join_code
        tenant = Tenant(
            subdomain=f"pending-tenant-{role.lower()}",
            name=f"Pending School {role}",
            brand="relevo" if role == "GESTION" else "tiza",
            status="pending",
            join_code=generate_join_code(),
        )
        db.add(tenant)
        await db.flush()

    user = User(
        email=email,
        name=email.split("@")[0],
        password=hash_password("Pass1234!"),
        status="pending",
        role=role,
        tenant_id=tenant.id,
    )
    db.add(user)
    await db.flush()

    return {
        "id": user.id,
        "email": email,
        "role": role,
        "tenant_id": tenant.id,
        "tenant_name": tenant.name,
    }


# ─────────────────────────────────────────────
# 1. LIST PENDING REGISTRATIONS
# ─────────────────────────────────────────────
@pytest.mark.asyncio
class TestListPendingRegistrations:
    """Tests for GET /api/admin/pending-registrations."""

    async def test_list_pending_returns_paginated_results(self, client: AsyncClient):
        """GET pending-registrations with admin token returns paginated results."""
        admin = await _create_admin_user(client)

        # Create some pending users directly in DB
        import database as db_module
        async with db_module.async_session() as session:
            await _create_pending_user(session, "pending1@test.com", "TEACHER")
            await _create_pending_user(session, "pending2@test.com", "GESTION")
            await _create_pending_user(session, "pending3@test.com", "TEACHER")
            await session.commit()

        response = await client.get(
            "/api/admin/pending-registrations",
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert data["total"] >= 3
        assert len(data["items"]) >= 3
        # Verify shape of items
        for item in data["items"]:
            assert "id" in item
            assert "email" in item
            assert "role" in item
            assert "tenant_id" in item

    async def test_list_pending_holder_can_access_scoped_to_tenant(self, client: AsyncClient):
        """GESTION users can access pending registrations scoped to their tenant."""
        import database as db_module
        from models.db_models import Tenant, User, TenantMember
        from utils.security import hash_password, create_access_token
        from models.db_models import generate_join_code

        async with db_module.async_session() as session:
            tenant = Tenant(
                subdomain="gestion-has-access",
                name="Gestion Has Access",
                brand="relevo",
                status="active",
                join_code=generate_join_code(),
            )
            session.add(tenant)
            await session.flush()

            gestion = User(
                email="gestion-has-access@test.com",
                name="Gestion Has Access",
                password=hash_password("Pass1234!"),
                status="active",
                role="GESTION",
                tenant_id=tenant.id,
            )
            session.add(gestion)
            await session.commit()

            gestion_token = create_access_token(
                data={"sub": gestion.id, "role": gestion.role, "tenant_id": gestion.tenant_id}
            )

        response = await client.get(
            "/api/admin/pending-registrations",
            headers={"Authorization": f"Bearer {gestion_token}"},
        )
        # GESTION has access via require_admin_or_gestion, scoped to their tenant
        assert response.status_code == 200
        data = response.json()
        # No pending users exist in this tenant, so results should be empty
        assert data["total"] == 0
        assert data["items"] == []

    async def test_list_pending_without_auth_returns_401(self, client: AsyncClient):
        """No auth token should return 401."""
        response = await client.get("/api/admin/pending-registrations")
        assert response.status_code == 401

    async def test_list_pending_empty_when_no_pending_users(self, client: AsyncClient):
        """When no pending users exist, return empty list."""
        admin = await _create_admin_user(client)

        response = await client.get(
            "/api/admin/pending-registrations",
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_list_pending_with_role_filter(self, client: AsyncClient):
        """Filter pending registrations by role."""
        admin = await _create_admin_user(client)

        import database as db_module
        async with db_module.async_session() as session:
            await _create_pending_user(session, "filter-teacher@test.com", "TEACHER")
            await _create_pending_user(session, "filter-gestion@test.com", "GESTION")
            await session.commit()

        # Filter by TEACHER
        response = await client.get(
            "/api/admin/pending-registrations?role=TEACHER",
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        for item in data["items"]:
            assert item["role"] == "TEACHER"

        # Filter by GESTION
        response = await client.get(
            "/api/admin/pending-registrations?role=GESTION",
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        for item in data["items"]:
            assert item["role"] == "GESTION"

    async def test_list_pending_invalid_role_filter_returns_400(self, client: AsyncClient):
        """Invalid role filter returns 400."""
        admin = await _create_admin_user(client)

        response = await client.get(
            "/api/admin/pending-registrations?role=INVALID_ROLE",
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 400
        data = response.json()
        assert "inválido" in data["detail"].lower()

    async def test_list_pending_pagination(self, client: AsyncClient):
        """Pagination params are respected."""
        admin = await _create_admin_user(client)

        import database as db_module
        async with db_module.async_session() as session:
            for i in range(5):
                await _create_pending_user(session, f"page-user-{i}@test.com", "TEACHER")
            await session.commit()

        # Page size 2, page 1
        response = await client.get(
            "/api/admin/pending-registrations?page=1&page_size=2",
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["items"]) <= 2

        # Page 2
        response2 = await client.get(
            "/api/admin/pending-registrations?page=2&page_size=2",
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200
        data2 = response2.json()
        assert data2["page"] == 2
        if data2["items"]:
            # Ensure no overlap with page 1
            page1_ids = {item["id"] for item in data["items"]}
            page2_ids = {item["id"] for item in data2["items"]}
            assert page1_ids.isdisjoint(page2_ids)


# ─────────────────────────────────────────────
# 2. APPROVE USER
# ─────────────────────────────────────────────
@pytest.mark.asyncio
class TestApproveRegistration:
    """Tests for POST /api/admin/approve/{user_id}."""

    async def _create_pending_teacher(self, client: AsyncClient, admin_token: str) -> str:
        """Helper: create a pending TEACHER and return user_id."""
        import database as db_module
        async with db_module.async_session() as session:
            user = await _create_pending_user(session, "approve-teacher@test.com", "TEACHER")
            await session.commit()
            return user["id"]

    async def test_approve_pending_user_success(self, client: AsyncClient):
        """Approve a pending user should return success and set status=active."""
        admin = await _create_admin_user(client)
        user_id = await self._create_pending_teacher(client, admin["token"])

        response = await client.post(
            f"/api/admin/approve/{user_id}",
            json={"reason": "Documentación completa"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "active"
        assert data["user_id"] == user_id
        assert "aprobado" in data["message"].lower()

        # Verify in DB
        import database as db_module
        from sqlalchemy import select
        from models.db_models import User
        async with db_module.async_session() as session:
            result = await session.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            assert user is not None
            assert user.status == "active"
            assert user.approved_by == "superadmin@example.com"

    async def test_approve_nonexistent_user_returns_404(self, client: AsyncClient):
        """Approve non-existent user returns 404."""
        admin = await _create_admin_user(client)

        response = await client.post(
            "/api/admin/approve/00000000-0000-0000-0000-000000000000",
            json={"reason": "OK"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 404
        assert "no encontrado" in response.json()["detail"].lower()

    async def test_approve_already_active_user_returns_409(self, client: AsyncClient):
        """Approve an already active user returns 409."""
        admin = await _create_admin_user(client)

        # First approve
        user_id = await self._create_pending_teacher(client, admin["token"])
        await client.post(
            f"/api/admin/approve/{user_id}",
            json={"reason": "OK"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )

        # Try approving again
        response = await client.post(
            f"/api/admin/approve/{user_id}",
            json={"reason": "Again"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 409
        data = response.json()
        assert "pendiente o rechazado" in data["detail"].lower()

    async def test_approve_pending_gestion_also_approves_tenant(self, client: AsyncClient):
        """Approve a GESTION should also approve their pending tenant."""
        admin = await _create_admin_user(client)

        import database as db_module
        from models.db_models import Tenant, User, generate_join_code
        from utils.security import hash_password

        async with db_module.async_session() as session:
            # Create a dedicated pending tenant (don't reuse admin's active tenant)
            pending_tenant = Tenant(
                subdomain="gestion-pending-approve-tenant",
                name="Gestion Pending Approve School",
                brand="relevo",
                status="pending",
                join_code=generate_join_code(),
            )
            session.add(pending_tenant)
            await session.flush()

            gestion = User(
                email="gestion-approve-pending@test.com",
                name="Gestion Pending Approve",
                password=hash_password("Pass1234!"),
                status="pending",
                role="GESTION",
                tenant_id=pending_tenant.id,
            )
            session.add(gestion)
            await session.flush()
            gestion_id = gestion.id
            tenant_id = pending_tenant.id
            await session.commit()

        response = await client.post(
            f"/api/admin/approve/{gestion_id}",
            json={"reason": "Bienvenido"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200

        # Verify tenant is also active
        from sqlalchemy import select
        async with db_module.async_session() as session:
            result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = result.scalar_one_or_none()
            assert tenant is not None
            assert tenant.status == "active", f"Expected active, got {tenant.status}"
            assert tenant.approved_by == "superadmin@example.com"

    async def test_approve_holder_can_approve_in_own_tenant(self, client: AsyncClient):
        """GESTION user can approve pending users in their own tenant."""
        import database as db_module
        from models.db_models import Tenant, User
        from utils.security import hash_password, create_access_token
        from models.db_models import generate_join_code

        async with db_module.async_session() as session:
            tenant = Tenant(
                subdomain="approve-gestion-tenant",
                name="Approve Gestion School",
                brand="tiza",
                status="active",
                join_code=generate_join_code(),
            )
            session.add(tenant)
            await session.flush()

            gestion = User(
                email="gestion-approve-own@test.com",
                name="Gestion Approve Own",
                password=hash_password("Pass1234!"),
                status="active",
                role="GESTION",
                tenant_id=tenant.id,
            )
            session.add(gestion)

            # Create a pending user in the same tenant for the GESTION to approve
            pending_user = User(
                email="pending-in-gestion-tenant@test.com",
                name="Pending In Gestion Tenant",
                password=hash_password("Pass1234!"),
                status="pending",
                role="TEACHER",
                tenant_id=tenant.id,
            )
            session.add(pending_user)
            await session.flush()
            pending_user_id = pending_user.id
            await session.commit()

            token = create_access_token(
                data={"sub": gestion.id, "role": gestion.role, "tenant_id": gestion.tenant_id}
            )

        response = await client.post(
            f"/api/admin/approve/{pending_user_id}",
            json={"reason": "OK"},
            headers={"Authorization": f"Bearer {token}"},
        )
        # GESTION has access via require_admin_or_gestion, scoped to their tenant
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "active"


# ─────────────────────────────────────────────
# 3. REJECT USER
# ─────────────────────────────────────────────
@pytest.mark.asyncio
class TestRejectRegistration:
    """Tests for POST /api/admin/reject/{user_id}."""

    async def test_reject_pending_user_success(self, client: AsyncClient):
        """Reject a pending user with a reason should return success and set status=rejected."""
        admin = await _create_admin_user(client)

        import database as db_module
        async with db_module.async_session() as session:
            user_data = await _create_pending_user(session, "reject-test@test.com", "TEACHER")
            await session.commit()

        response = await client.post(
            f"/api/admin/reject/{user_data['id']}",
            json={"reason": "Documentación incompleta: falta certificado de título"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "rejected"
        assert data["user_id"] == user_data["id"]
        assert "rechazado" in data["message"].lower()

        # Verify in DB
        from sqlalchemy import select
        from models.db_models import User
        async with db_module.async_session() as session:
            result = await session.execute(select(User).where(User.id == user_data["id"]))
            user = result.scalar_one_or_none()
            assert user is not None
            assert user.status == "rejected"
            assert user.rejection_reason == "Documentación incompleta: falta certificado de título"
            assert user.rejected_at is not None

    async def test_reject_without_reason_returns_400(self, client: AsyncClient):
        """Reject without a reason returns 400."""
        admin = await _create_admin_user(client)

        import database as db_module
        async with db_module.async_session() as session:
            user_data = await _create_pending_user(session, "reject-noreason@test.com", "TEACHER")
            await session.commit()

        # Empty reason
        response = await client.post(
            f"/api/admin/reject/{user_data['id']}",
            json={"reason": ""},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 400
        assert "motivo" in response.json()["detail"].lower()

        # Null reason
        response2 = await client.post(
            f"/api/admin/reject/{user_data['id']}",
            json={"reason": None},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response2.status_code == 400

        # Whitespace-only reason
        response3 = await client.post(
            f"/api/admin/reject/{user_data['id']}",
            json={"reason": "   "},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response3.status_code == 400

    async def test_reject_nonexistent_user_returns_404(self, client: AsyncClient):
        """Reject non-existent user returns 404."""
        admin = await _create_admin_user(client)

        response = await client.post(
            "/api/admin/reject/00000000-0000-0000-0000-000000000000",
            json={"reason": "Documentación inválida"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 404

    async def test_reject_already_rejected_user_returns_409(self, client: AsyncClient):
        """Reject an already rejected user returns 409."""
        admin = await _create_admin_user(client)

        import database as db_module
        async with db_module.async_session() as session:
            user_data = await _create_pending_user(session, "double-reject@test.com", "TEACHER")
            await session.commit()

        # First reject
        await client.post(
            f"/api/admin/reject/{user_data['id']}",
            json={"reason": "Primer rechazo"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )

        # Try rejecting again
        response = await client.post(
            f"/api/admin/reject/{user_data['id']}",
            json={"reason": "Segundo rechazo"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 409
        assert "no está pendiente" in response.json()["detail"].lower()

    async def test_reject_pending_gestion_also_rejects_tenant(self, client: AsyncClient):
        """Reject a GESTION should also reject their pending tenant."""
        admin = await _create_admin_user(client)

        # Create a GESTION with a dedicated pending tenant (don't use _create_pending_user
        # because it may reuse an active tenant from the admin setup)
        import database as db_module
        from models.db_models import Tenant, User, generate_join_code
        from utils.security import hash_password

        async with db_module.async_session() as session:
            pending_tenant = Tenant(
                subdomain="gestion-pending-reject-tenant",
                name="Gestion Pending Reject School",
                brand="relevo",
                status="pending",
                join_code=generate_join_code(),
            )
            session.add(pending_tenant)
            await session.flush()

            gestion = User(
                email="gestion-pending-reject@test.com",
                name="Gestion Pending Reject",
                password=hash_password("Pass1234!"),
                status="pending",
                role="GESTION",
                tenant_id=pending_tenant.id,
            )
            session.add(gestion)
            await session.flush()
            gestion_id = gestion.id
            tenant_id = pending_tenant.id
            await session.commit()

        response = await client.post(
            f"/api/admin/reject/{gestion_id}",
            json={"reason": "No cumple requisitos"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200

        # Verify tenant is also rejected
        from sqlalchemy import select
        async with db_module.async_session() as session:
            result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = result.scalar_one_or_none()
            assert tenant is not None
            assert tenant.status == "rejected", f"Expected rejected, got {tenant.status}"
            assert tenant.rejection_reason == "No cumple requisitos"

    async def test_reject_holder_can_reject_in_own_tenant(self, client: AsyncClient):
        """GESTION user can reject pending users in their own tenant."""
        import database as db_module
        from models.db_models import Tenant, User
        from utils.security import hash_password, create_access_token
        from models.db_models import generate_join_code

        async with db_module.async_session() as session:
            tenant = Tenant(
                subdomain="reject-gestion-tenant",
                name="Reject Gestion School",
                brand="tiza",
                status="active",
                join_code=generate_join_code(),
            )
            session.add(tenant)
            await session.flush()

            gestion = User(
                email="gestion-reject-own@test.com",
                name="Gestion Reject Own",
                password=hash_password("Pass1234!"),
                status="active",
                role="GESTION",
                tenant_id=tenant.id,
            )
            session.add(gestion)

            # Create a pending user in the same tenant for the GESTION to reject
            pending_user = User(
                email="pending-reject-in-gestion-tenant@test.com",
                name="Pending Reject In Gestion Tenant",
                password=hash_password("Pass1234!"),
                status="pending",
                role="TEACHER",
                tenant_id=tenant.id,
            )
            session.add(pending_user)
            await session.flush()
            pending_user_id = pending_user.id
            await session.commit()

            token = create_access_token(
                data={"sub": gestion.id, "role": gestion.role, "tenant_id": gestion.tenant_id}
            )

        response = await client.post(
            f"/api/admin/reject/{pending_user_id}",
            json={"reason": "Documentación incompleta"},
            headers={"Authorization": f"Bearer {token}"},
        )
        # GESTION has access via require_admin_or_gestion, scoped to their tenant
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "rejected"


# ─────────────────────────────────────────────
# 4. REQUIRE SUPER ADMIN UNIT TEST
# ─────────────────────────────────────────────
@pytest.mark.asyncio
class TestRequireSuperAdmin:
    """Tests for require_super_admin dependency."""

    async def test_require_super_admin_with_admin_passes(self, client: AsyncClient):
        """ADMIN user passes require_super_admin."""
        admin = await _create_admin_user(client)

        # Access admin endpoint as admin — should pass
        response = await client.get(
            "/api/admin/pending-registrations",
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200

    async def test_require_super_admin_with_holder_passes(self, client: AsyncClient):
        """GESTION user passes require_admin_or_gestion (200) scoped to their tenant."""
        import database as db_module
        from models.db_models import Tenant, User
        from utils.security import hash_password, create_access_token
        from models.db_models import generate_join_code

        async with db_module.async_session() as session:
            tenant = Tenant(
                subdomain="superadmin-gestion-tenant",
                name="SuperAdmin Gestion Tenant",
                brand="tiza",
                status="active",
                join_code=generate_join_code(),
            )
            session.add(tenant)
            await session.flush()

            gestion = User(
                email="gestion-superadmin-pass@test.com",
                name="Gestion SuperAdmin Pass",
                password=hash_password("Pass1234!"),
                status="active",
                role="GESTION",
                tenant_id=tenant.id,
            )
            session.add(gestion)
            await session.commit()

            token = create_access_token(
                data={"sub": gestion.id, "role": gestion.role, "tenant_id": gestion.tenant_id}
            )

        response = await client.get(
            "/api/admin/pending-registrations",
            headers={"Authorization": f"Bearer {token}"},
        )
        # GESTION has access via require_admin_or_gestion
        assert response.status_code == 200

    async def test_require_super_admin_with_teacher_fails(self, client: AsyncClient):
        """TEACHER user fails require_super_admin (403)."""
        import database as db_module
        from models.db_models import Tenant, User
        from utils.security import hash_password, create_access_token
        from models.db_models import generate_join_code

        async with db_module.async_session() as session:
            tenant = Tenant(
                subdomain="teacher-superadmin-tenant",
                name="Teacher SuperAdmin",
                brand="tiza",
                status="active",
                join_code=generate_join_code(),
            )
            session.add(tenant)
            await session.flush()

            teacher = User(
                email="teacher-superadmin-test@test.com",
                name="Teacher SuperAdmin Test",
                password=hash_password("Pass1234!"),
                status="active",
                role="TEACHER",
                tenant_id=tenant.id,
            )
            session.add(teacher)
            await session.commit()

            token = create_access_token(
                data={"sub": teacher.id, "role": teacher.role, "tenant_id": teacher.tenant_id}
            )

        response = await client.get(
            "/api/admin/pending-registrations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

# ─────────────────────────────────────────────
# 5. RE-APPROVAL OF REJECTED USER
# ─────────────────────────────────────────────
@pytest.mark.asyncio
class TestReapproveRejectedUser:
    """Tests for re-approving a previously rejected user."""

    async def test_approve_rejected_user_success(self, client: AsyncClient):
        """Re-approve a rejected user should return success and set status=active."""
        admin = await _create_admin_user(client)

        # Create a pending user
        import database as db_module
        from models.db_models import User
        from sqlalchemy import select

        async with db_module.async_session() as session:
            user_data = await _create_pending_user(session, "reapprove@test.com", "TEACHER")
            await session.commit()

        # First reject the user
        reject_resp = await client.post(
            f"/api/admin/reject/{user_data['id']}",
            json={"reason": "Documentación incompleta"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert reject_resp.status_code == 200

        # Now re-approve
        response = await client.post(
            f"/api/admin/approve/{user_data['id']}",
            json={"reason": "Documentación completa ahora"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "active"
        assert "aprobado" in data["message"].lower()

        # Verify in DB: status=active, rejection data cleared
        async with db_module.async_session() as session:
            result = await session.execute(select(User).where(User.id == user_data["id"]))
            user = result.scalar_one_or_none()
            assert user is not None
            assert user.status == "active"
            assert user.rejection_reason is None, f"Expected None, got {user.rejection_reason}"
            assert user.rejected_at is None, f"Expected None, got {user.rejected_at}"
            assert user.approved_by == "superadmin@example.com"

    async def test_approve_rejected_user_clears_audit_trail(self, client: AsyncClient):
        """Re-approval of rejected user should clear rejection_reason and rejected_at in DB."""
        admin = await _create_admin_user(client)

        import database as db_module
        from models.db_models import User
        from sqlalchemy import select

        async with db_module.async_session() as session:
            user_data = await _create_pending_user(session, "reapprove-clear@test.com", "TEACHER")
            await session.commit()

        # Reject with a specific reason
        await client.post(
            f"/api/admin/reject/{user_data['id']}",
            json={"reason": "Falta documentación"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )

        # Verify rejection data exists before re-approval
        async with db_module.async_session() as session:
            result = await session.execute(select(User).where(User.id == user_data["id"]))
            user = result.scalar_one_or_none()
            assert user.rejection_reason == "Falta documentación"
            assert user.rejected_at is not None

        # Re-approve
        await client.post(
            f"/api/admin/approve/{user_data['id']}",
            json={"reason": "Documentación recibida"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )

        # Verify rejection data is cleared
        async with db_module.async_session() as session:
            result = await session.execute(select(User).where(User.id == user_data["id"]))
            user = result.scalar_one_or_none()
            assert user.status == "active"
            assert user.rejection_reason is None
            assert user.rejected_at is None

    async def test_approve_rejected_user_accepts_without_reason(self, client: AsyncClient):
        """Re-approving a rejected user works even without a reason in the body."""
        admin = await _create_admin_user(client)

        import database as db_module
        async with db_module.async_session() as session:
            user_data = await _create_pending_user(session, "reapprove-noreason@test.com", "TEACHER")
            await session.commit()

        # Reject first
        await client.post(
            f"/api/admin/reject/{user_data['id']}",
            json={"reason": "Falta info"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )

        # Re-approve with null reason (edge case: the body has reason as optional/null)
        response = await client.post(
            f"/api/admin/approve/{user_data['id']}",
            json={"reason": None},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        # Should still work — reason is not required for approval
        assert response.status_code == 200
        assert response.json()["status"] == "active"


# ─────────────────────────────────────────────
# 6. E2E APPROVAL AND REJECTION FLOWS
# ─────────────────────────────────────────────
@pytest.mark.asyncio
class TestE2EApprovalFlow:
    """End-to-end tests for the complete approval and rejection flows."""

    async def test_e2e_approval_flow(self, client: AsyncClient):
        """Full E2E approval flow: register → list pending → approve → login → /me."""
        # 1. Admin user
        admin = await _create_admin_user(client)

        # 2. Register a GESTION (auto-creates tenant, status=pending)
        reg_resp = await client.post("/api/auth/register", json={
            "email": "e2e-approve@test.com",
            "password": "SecurePass123!",
            "role": "director",
            "name": "E2E Approval Test",
        })
        assert reg_resp.status_code == 201
        gestion_email = "e2e-approve@test.com"

        # 3. Admin lists pending registrations → verify GESTION appears
        list_resp = await client.get(
            "/api/admin/pending-registrations",
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        # The pending user should be in the list
        matching_users = [
            u for u in list_data["items"]
            if u["email"] == gestion_email
        ]
        assert len(matching_users) >= 1, f"GESTION {gestion_email} not in pending list"
        gestion_id = matching_users[0]["id"]

        # 4. Admin approves the GESTION
        approve_resp = await client.post(
            f"/api/admin/approve/{gestion_id}",
            json={"reason": "Documentación completa"},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert approve_resp.status_code == 200
        assert approve_resp.json()["status"] == "active"

        # 5. GESTION logs in → 200 with token
        login_resp = await client.post("/api/auth/login", json={
            "email": gestion_email,
            "password": "SecurePass123!",
        })
        assert login_resp.status_code == 200
        gestion_token = login_resp.json()["access_token"]

        # 6. GESTION calls /me → 200, status="active"
        me_resp = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {gestion_token}"},
        )
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["email"] == gestion_email
        assert me_data["status"] == "active"
        assert "password" not in me_data

    async def test_e2e_rejection_flow(self, client: AsyncClient):
        """Full E2E rejection flow: register → reject → login fails with 403 + reason."""
        # 1. Admin user
        admin = await _create_admin_user(client)

        # 2. Register a GESTION (auto-creates tenant, status=pending)
        reg_resp = await client.post("/api/auth/register", json={
            "email": "e2e-reject@test.com",
            "password": "SecurePass123!",
            "role": "director",
            "name": "E2E Rejection Test",
        })
        assert reg_resp.status_code == 201
        gestion_email = "e2e-reject@test.com"

        # 3. Admin lists pending registrations → find GESTION
        list_resp = await client.get(
            "/api/admin/pending-registrations",
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert list_resp.status_code == 200
        matching_users = [
            u for u in list_resp.json()["items"]
            if u["email"] == gestion_email
        ]
        assert len(matching_users) >= 1
        gestion_id = matching_users[0]["id"]

        # 4. Admin rejects the GESTION with a reason
        reject_reason = "Prueba de rechazo"
        reject_resp = await client.post(
            f"/api/admin/reject/{gestion_id}",
            json={"reason": reject_reason},
            headers={"Authorization": f"Bearer {admin['token']}"},
        )
        assert reject_resp.status_code == 200
        assert reject_resp.json()["status"] == "rejected"

        # 5. GESTION tries to log in → 403 with rejection reason in detail
        login_resp = await client.post("/api/auth/login", json={
            "email": gestion_email,
            "password": "SecurePass123!",
        })
        assert login_resp.status_code == 403
        detail = login_resp.json()["detail"]
        assert "rechazada" in detail.lower()
        assert reject_reason in detail

        # 6. Verify /me returns 401 (rejected user can't access protected endpoints)
        import database as db_module
        from utils.security import create_access_token
        from sqlalchemy import select
        from models.db_models import User
        async with db_module.async_session() as session:
            result = await session.execute(select(User).where(User.email == gestion_email))
            user = result.scalar_one_or_none()
            assert user is not None
            assert user.status == "rejected"
            # Create a token for the rejected user to verify /me blocks them
            rejected_token = create_access_token(
                data={"sub": user.id, "role": user.role, "tenant_id": user.tenant_id}
            )

        me_resp = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {rejected_token}"},
        )
        assert me_resp.status_code == 401
        assert "rechazada" in me_resp.json()["detail"].lower()


