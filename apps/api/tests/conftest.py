"""Pytest fixtures for API tests."""
import os
import sys
import pytest
from typing import AsyncGenerator, Generator

# Ensure the API root is on the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Load .env before any app imports (database.py requires DATABASE_URL at import time)
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Disable rate limiting during tests to avoid false positives
os.environ["RATE_LIMIT_ENABLED"] = "false"

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from database import Base, get_db
from main import app
from config import settings


# Use in-memory SQLite for tests — ensures full test isolation
TEST_DATABASE_URL = "sqlite+aiosqlite://"


async def _approve_user(db_session, email: str):
    """Helper to simulate admin approval: set user status to active."""
    await db_session.execute(
        text("UPDATE users SET status = 'active', approved_at = CURRENT_TIMESTAMP, approved_by = 'test_admin' WHERE email = :email"),
        {"email": email},
    )
    await db_session.commit()


@pytest.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test and drop after."""
    from database import engine as prod_engine
    # Override the engine for tests
    test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Store original engine
    import database as db_module
    original_engine = db_module.engine
    original_session = db_module.async_session

    # Patch
    db_module.engine = test_engine
    db_module.async_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await test_engine.dispose()

    # Restore
    db_module.engine = original_engine
    db_module.async_session = original_session


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override get_db to use test database."""
    import database as db_module
    async with db_module.async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest.fixture
def fastapi_app():
    """Return the FastAPI application instance for test helpers."""
    from main import app as _app
    return _app


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client."""
    from main import app as _app
    _app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    _app.dependency_overrides.clear()


@pytest.fixture
async def test_user_data():
    """Return test user data (HOLDER, so it auto-creates a tenant)."""
    return {
        "email": "test@example.com",
        "password": "SecurePass123!",
        "role": "director",
    }


@pytest.fixture
async def holder_data():
    """Return HOLDER test data for tenant management tests."""
    return {
        "email": "holder@test.com",
        "password": "HolderPass789!",
        "role": "director",
        "name": "Director Test",
    }


@pytest.fixture
async def registered_user(client: AsyncClient, test_user_data: dict) -> dict:
    """Register a HOLDER user (auto-creates tenant) and return user + token."""
    response = await client.post("/api/auth/register", json=test_user_data)
    assert response.status_code == 201
    user = response.json()

    # Approve the user (simulate admin approval) before login
    import database as db_module
    async with db_module.async_session() as session:
        await _approve_user(session, test_user_data["email"])

    # Login to get token
    login_resp = await client.post("/api/auth/login", json={
        "email": test_user_data["email"],
        "password": test_user_data["password"],
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    return {
        "user": user,
        "token": token,
        "email": test_user_data["email"],
        "password": test_user_data["password"],
        "tenant_id": user["tenant_id"],
    }


@pytest.fixture
async def pre_approved_holder(client: AsyncClient) -> dict:
    """Create a pre-approved HOLDER user + tenant directly in DB.
    
    Bypasses the register endpoint to avoid the pending status requirement.
    Returns dict with token, tenant_id, and user data.
    """
    from models.db_models import Tenant, User, TenantMember, generate_join_code
    from utils.security import hash_password
    from datetime import datetime, timezone
    import database as db_module

    async with db_module.async_session() as session:
        now = datetime.now(timezone.utc)

        tenant = Tenant(
            subdomain="pre-approved-holder-tenant",
            name="Pre-Approved Holder School",
            brand="relevo",
            status="active",
            join_code=generate_join_code(),
        )
        session.add(tenant)
        await session.flush()

        holder = User(
            email="pre-approved-holder@test.com",
            name="Pre-Approved Holder",
            password=hash_password("PreApprovedPass1!"),
            status="active",
            role="HOLDER",
            tenant_id=tenant.id,
        )
        session.add(holder)
        await session.flush()

        member = TenantMember(
            tenant_id=tenant.id,
            user_id=holder.id,
            role="owner",
        )
        session.add(member)
        await session.commit()

        # Login via API to get token
        login_resp = await client.post("/api/auth/login", json={
            "email": "pre-approved-holder@test.com",
            "password": "PreApprovedPass1!",
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        return {
            "token": token,
            "tenant_id": tenant.id,
            "email": "pre-approved-holder@test.com",
        }


@pytest.fixture
async def create_test_user():
    """Factory fixture that creates a user with given params directly in DB.
    
    Usage:
        user = await create_test_user(email="x@y.com", role="TEACHER", tenant_id="...")
    """
    async def _create(email: str, password: str, role: str, tenant_id: str,
                      name: str = None, status: str = "active") -> dict:
        import database as db_module
        from models.db_models import User
        from utils.security import hash_password

        async with db_module.async_session() as session:
            user = User(
                email=email,
                name=name or email.split("@")[0],
                password=hash_password(password),
                status=status,
                role=role,
                tenant_id=tenant_id,
            )
            session.add(user)
            await session.commit()
            return {"email": email, "password": password, "id": user.id}
    return _create


@pytest.fixture
async def teacher_tenant(client: AsyncClient, holder_data: dict) -> dict:
    """Register a HOLDER, then create a tenant and a TEACHER under it.
    Returns dict with tenant_id and teacher credentials."""
    # 1. Register HOLDER
    resp = await client.post("/api/auth/register", json=holder_data)
    assert resp.status_code == 201
    holder = resp.json()

    # Approve HOLDER before login
    import database as db_module
    async with db_module.async_session() as session:
        await _approve_user(session, holder_data["email"])

    holder_token = (await client.post("/api/auth/login", json={
        "email": holder_data["email"],
        "password": holder_data["password"],
    })).json()["access_token"]

    # 2. HOLDER creates a tenant
    tenant_resp = await client.post(
        "/api/tenants",
        json={"name": "Colegio Test", "subdomain": "colegio-test"},
        headers={"Authorization": f"Bearer {holder_token}"},
    )
    assert tenant_resp.status_code == 201
    tenant = tenant_resp.json()

    return {
        "tenant_id": tenant["id"],
        "holder_token": holder_token,
        "holder": holder,
    }
