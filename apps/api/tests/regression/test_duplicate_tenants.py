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


@pytest.mark.asyncio
class TestDuplicateTenantsRegression:
    """Regression: duplicate tenant names are rejected."""

    async def test_duplicate_name_rejected(self, client: AsyncClient, pre_approved_gestion: dict):
        """BUG: Creating two tenants with same name returns 409."""
        token = pre_approved_gestion["token"]

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

    async def test_duplicate_name_error_message_generic(self, client: AsyncClient, pre_approved_gestion: dict):
        """Error message is generic (no info leak)."""
        token = pre_approved_gestion["token"]

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
        assert "colegio" in data["detail"].lower()
        assert "nombre" in data["detail"].lower()

    async def test_unique_names_allowed(self, client: AsyncClient, pre_approved_gestion: dict):
        """Different names with different subdomains are all accepted."""
        token = pre_approved_gestion["token"]

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

    async def test_duplicate_subdomain_still_rejected(self, client: AsyncClient, pre_approved_gestion: dict):
        """Existing subdomain uniqueness is still enforced (no regression)."""
        token = pre_approved_gestion["token"]

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
