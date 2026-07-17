"""Test authentication endpoints."""
import sys
import os
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from httpx import AsyncClient


async def _approve_user(email: str):
    """Simulate admin approval by setting user.status='active' directly in DB."""
    import database as db_module
    from models.db_models import User, Tenant
    from sqlalchemy import select
    from datetime import datetime, timezone

    async with db_module.async_session() as session:
        from sqlalchemy import text
        await session.execute(
            text("UPDATE users SET status = 'active', approved_at = :now WHERE email = :email"),
            {"email": email, "now": datetime.now(timezone.utc)},
        )
        await session.commit()


@pytest.mark.asyncio
class TestAuthRegister:
    """Tests for POST /api/auth/register."""

    async def test_register_creates_holder_with_auto_tenant(self, client: AsyncClient):
        """Register a HOLDER should auto-create a tenant and return 201."""
        response = await client.post("/api/auth/register", json={
            "email": "director@example.com",
            "password": "SecurePass123!",
            "role": "director",
        })
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["email"] == "director@example.com"
        assert data["role"] == "HOLDER"
        assert "tenant_id" in data
        # Password should NOT be returned
        assert "password" not in data

    async def test_register_teacher_requires_tenant_id(self, client: AsyncClient):
        """Register a TEACHER without tenant_id should return 400."""
        response = await client.post("/api/auth/register", json={
            "email": "teacher@example.com",
            "password": "SecurePass123!",
            "role": "teacher",
        })
        assert response.status_code == 400
        data = response.json()
        assert "tenant_id" in data["detail"].lower() or "teacher" in data["detail"].lower() or "tenant" in data["detail"].lower()

    async def test_register_teacher_with_valid_tenant_id(self, client: AsyncClient):
        """Register a TEACHER with an existing tenant_id should succeed."""
        # First create a HOLDER to get a tenant
        holder_resp = await client.post("/api/auth/register", json={
            "email": "principal@school.com",
            "password": "SecurePass123!",
            "role": "director",
        })
        assert holder_resp.status_code == 201
        tenant_id = holder_resp.json()["tenant_id"]

        # Now register a TEACHER with that tenant_id
        response = await client.post("/api/auth/register", json={
            "email": "profe@school.com",
            "password": "TeachPass456!",
            "role": "teacher",
            "name": "Profe Lenguaje",
            "tenant_id": tenant_id,
        })
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "profe@school.com"
        assert data["name"] == "Profe Lenguaje"
        assert data["role"] == "TEACHER"
        assert data["tenant_id"] == tenant_id
        assert "password" not in data

    async def test_register_teacher_invalid_tenant_id_returns_404(self, client: AsyncClient):
        """Register a TEACHER with a non-existent tenant_id should return 404."""
        response = await client.post("/api/auth/register", json={
            "email": "noprofe@nowhere.com",
            "password": "SecurePass123!",
            "role": "teacher",
            "tenant_id": "00000000-0000-0000-0000-000000000000",
        })
        assert response.status_code == 404

    async def test_register_with_name_stores_name_correctly(self, client: AsyncClient):
        """Register a HOLDER with a 'name' field should store and return it."""
        response = await client.post("/api/auth/register", json={
            "email": "nameduser@example.com",
            "password": "SecurePass123!",
            "name": "María González",
            "role": "director",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "María González"
        assert data["email"] == "nameduser@example.com"

    async def test_register_without_name_defaults_from_email(self, client: AsyncClient):
        """Register without 'name' should default to email local-part."""
        response = await client.post("/api/auth/register", json={
            "email": "juan.perez@colegio.cl",
            "password": "SecurePass123!",
            "role": "director",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "juan.perez"  # Default from email split

    async def test_register_duplicate_email_returns_409(self, client: AsyncClient):
        """Register with an existing email should return 409 Conflict."""
        # First registration
        await client.post("/api/auth/register", json={
            "email": "duplicate@example.com",
            "password": "SecurePass123!",
            "role": "director",
        })
        # Second registration with same email
        response = await client.post("/api/auth/register", json={
            "email": "duplicate@example.com",
            "password": "AnotherPass456!",
            "role": "director",
        })
        assert response.status_code == 409
        data = response.json()
        assert "already registered" in data["detail"].lower()

    async def test_register_admin_role_downgraded_to_teacher(self, client: AsyncClient):
        """Register with role 'admin' should be rejected or downgraded.
        
        SECURITY: The public register endpoint does NOT allow creating ADMIN users.
        The 'admin' role is treated as 'teacher' (which requires a tenant_id).
        """
        response = await client.post("/api/auth/register", json={
            "email": "admin@platform.com",
            "password": "AdminPass789!",
            "role": "admin",
        })
        # 'admin' is not in ROLE_MAP, so it defaults to 'teacher' → requires tenant_id → 400
        assert response.status_code == 400
        data = response.json()
        assert "tenant_id" in data["detail"].lower() or "teacher" in data["detail"].lower()


@pytest.mark.asyncio
class TestAuthLogin:
    """Tests for POST /api/auth/login."""

    async def test_login_returns_token(self, client: AsyncClient, test_user_data: dict):
        """Login with valid credentials should return a JWT token."""
        # First register (HOLDER so tenant auto-created)
        await client.post("/api/auth/register", json=test_user_data)
        # Approve user (simulate admin approval) before login
        await _approve_user(test_user_data["email"])
        # Then login
        response = await client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"],
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        # Token should be a JWT (3 parts separated by dots)
        assert data["access_token"].count(".") == 2

    async def test_login_wrong_password_returns_401(self, client: AsyncClient, test_user_data: dict):
        """Login with wrong password should return 401."""
        await client.post("/api/auth/register", json=test_user_data)
        await _approve_user(test_user_data["email"])
        response = await client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": "WrongPassword999!",
        })
        assert response.status_code == 401
        data = response.json()
        assert "invalid" in data["detail"].lower()

    async def test_login_nonexistent_user_returns_401(self, client: AsyncClient):
        """Login with an email that doesn't exist should return 401."""
        response = await client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "SomePass123!",
        })
        assert response.status_code == 401


@pytest.mark.asyncio
class TestAuthMe:
    """Tests for GET /api/auth/me."""

    async def test_get_me_with_valid_token(self, client: AsyncClient, registered_user: dict):
        """GET /me with a valid token should return user data."""
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {registered_user['token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == registered_user["email"]
        assert "id" in data
        assert "role" in data
        assert "tenant_id" in data
        # Password should never be returned
        assert "password" not in data

    async def test_get_me_without_token_returns_401(self, client: AsyncClient):
        """GET /me without a token should return 401."""
        response = await client.get("/api/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    async def test_get_me_with_invalid_token_returns_401(self, client: AsyncClient):
        """GET /me with an invalid token should return 401."""
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid-token-here"},
        )
        assert response.status_code == 401
