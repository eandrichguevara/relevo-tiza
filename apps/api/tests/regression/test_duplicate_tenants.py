"""Regression tests: Duplicate tenant names (BUG: duplicate schools in tenants table).

Bug context:
    - Raven discovered that creating two tenants with the same ``name`` was possible
      because only ``subdomain`` had a UNIQUE constraint in PostgreSQL.
    - Fix:
        1. Added ``UniqueConstraint("name")`` to ``Tenant`` model in ``db_models.py``.
        2. Added explicit ``SELECT`` check for ``name`` before INSERT in ``POST /api/tenants``.
        3. Added ``IntegrityError`` catch as a fallback safety net.
    - These tests ensure the fix works and never regresses.
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from httpx import AsyncClient


HOLDER_EMAIL = "regression-holder@test.com"
HOLDER_PASS = "Regr3ss!onPass"


@pytest.mark.asyncio
async def _register_holder(client: AsyncClient) -> dict:
    """Register a HOLDER (auto-creates a tenant) for test setup."""
    resp = await client.post("/api/auth/register", json={
        "email": HOLDER_EMAIL,
        "password": HOLDER_PASS,
        "name": "Regression Holder",
        "role": "director",
    })
    assert resp.status_code == 201, f"Holder register failed: {resp.text}"
    return resp.json()


@pytest.mark.asyncio
async def _login(client: AsyncClient) -> str:
    """Login and return Bearer token."""
    resp = await client.post("/api/auth/login", json={
        "email": HOLDER_EMAIL,
        "password": HOLDER_PASS,
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.mark.asyncio
class TestDuplicateTenantsRegression:
    """Regression: duplicate tenant names are rejected."""

    async def test_duplicate_name_rejected(self, client: AsyncClient):
        """BUG: Creating two tenants with same name returns 409."""
        await _register_holder(client)
        token = await _login(client)

        # First tenant — should succeed
        resp1 = await client.post(
            "/api/tenants",
            json={"name": "Regresión Colegio", "subdomain": "regresion-colegio"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp1.status_code == 201, f"First tenant creation failed: {resp1.text}"

        # Second tenant with SAME name but DIFFERENT subdomain — should fail
        resp2 = await client.post(
            "/api/tenants",
            json={"name": "Regresión Colegio", "subdomain": "otro-subdominio"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp2.status_code == 409, (
            f"Expected 409 for duplicate name, got {resp2.status_code}: {resp2.text}"
        )

    async def test_duplicate_name_error_message_generic(self, client: AsyncClient):
        """Error message is generic (no info leak)."""
        await _register_holder(client)
        token = await _login(client)

        await client.post(
            "/api/tenants",
            json={"name": "Unique Name Test", "subdomain": "unique-name-test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = await client.post(
            "/api/tenants",
            json={"name": "Unique Name Test", "subdomain": "different-subdomain"},
            headers={"Authorization": f"Bearer {token}"},
        )
        data = resp.json()
        assert resp.status_code == 409
        assert data["detail"] == "Registration failed"

    async def test_unique_names_allowed(self, client: AsyncClient):
        """Different names with different subdomains are all accepted."""
        await _register_holder(client)
        token = await _login(client)

        for i in range(3):
            resp = await client.post(
                "/api/tenants",
                json={
                    "name": f"Escuela {i}",
                    "subdomain": f"escuela-{i}",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 201, (
                f"Tenant {i} should be created: {resp.status_code} {resp.text}"
            )

    async def test_duplicate_subdomain_still_rejected(self, client: AsyncClient):
        """Existing subdomain uniqueness is still enforced (no regression)."""
        await _register_holder(client)
        token = await _login(client)

        await client.post(
            "/api/tenants",
            json={"name": "Alpha School", "subdomain": "alpha"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = await client.post(
            "/api/tenants",
            json={"name": "Beta School", "subdomain": "alpha"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409
