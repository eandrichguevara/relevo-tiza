"""Integration tests for all CRUD endpoints (tenants, users, courses, students,
evaluations, results, dashboard).

These tests use the same SQLite test infrastructure as test_auth.py and
exercise the full multi-tenant lifecycle:

  HOLDER → create tenant → TEACHER → create course → bulk-add students
  → create evaluation → simulate answers → review → check dashboard.
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from httpx import AsyncClient


# ─────────────────────────────────────────────
# Constants reused across tests
# ─────────────────────────────────────────────
HOLDER_EMAIL = "holder@integro.com"
HOLDER_PASS = "HolderPass999!"
HOLDER_NAME = "Holder Integro"

TEACHER_EMAIL = "teacher@integro.com"
TEACHER_PASS = "TeacherPass999!"
TEACHER_NAME = "Profe Integro"

COURSE_NAME = "1° Básico A"
COURSE_GRADE = "1° Básico"
COURSE_SUBJECT = "Matemáticas"

STUDENT_NAMES = ["Ana López", "Carlos Ruiz", "Sofía Muñoz"]

EVAL_TITLE = "Prueba de Matemáticas Semana 12"


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
@pytest.mark.asyncio
async def _setup_holder(_app) -> dict:
    """Create a HOLDER user + tenant directly in DB (bypasses register/pending).
    Uses the app's overridden get_db dependency to ensure same session as the API.
    Returns dict with token and tenant_id.
    """
    from database import get_db
    from models.db_models import Tenant, User, TenantMember, generate_join_code
    from utils.security import hash_password
    from httpx import AsyncClient, ASGITransport

    override = _app.dependency_overrides.get(get_db)
    session_generator = override() if override else get_db()
    async for session in session_generator:
        import time
        import random
        ts = f"{time.time()}-{random.randint(1000,9999)}"
        tenant = Tenant(
            subdomain=f"integro-holder-{ts}",
            name=f"Integro Holder School {ts}",
            brand="relevo",
            status="active",
            join_code=generate_join_code(),
        )
        session.add(tenant)
        await session.flush()

        holder = User(
            email=HOLDER_EMAIL,
            name=HOLDER_NAME,
            password=hash_password(HOLDER_PASS),
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
        tenant_id = tenant.id
        # Don't commit here — get_db() commits on generator exit

    # Login via API
    transport = ASGITransport(app=_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        login_resp = await c.post("/api/auth/login", json={
            "email": HOLDER_EMAIL,
            "password": HOLDER_PASS,
        })
        assert login_resp.status_code == 200, f"Holder login failed: {login_resp.text}"
        token = login_resp.json()["access_token"]

    return {"token": token, "tenant_id": tenant_id}


@pytest.mark.asyncio
async def _setup_teacher(_app, tenant_id: str) -> dict:
    """Create a TEACHER user directly in DB under a given tenant.
    Uses the app's overridden get_db dependency.
    Returns dict with token and email.
    """
    from database import get_db
    from models.db_models import User
    from utils.security import hash_password
    from httpx import AsyncClient, ASGITransport

    override = _app.dependency_overrides.get(get_db)
    session_generator = override() if override else get_db()
    async for session in session_generator:
        teacher = User(
            email=TEACHER_EMAIL,
            name=TEACHER_NAME,
            password=hash_password(TEACHER_PASS),
            status="active",
            role="TEACHER",
            tenant_id=tenant_id,
        )
        session.add(teacher)
        # Don't commit here — get_db() commits on generator exit

    # Login via API
    transport = ASGITransport(app=_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        login_resp = await c.post("/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASS,
        })
        assert login_resp.status_code == 200, f"Teacher login failed: {login_resp.text}"
        token = login_resp.json()["access_token"]

    return {"token": token, "email": TEACHER_EMAIL}


@pytest.mark.asyncio
async def _login(_app, email: str, password: str) -> str:
    """Login via API and return a Bearer token."""
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/auth/login", json={
            "email": email,
            "password": password,
        })
        assert resp.status_code == 200, f"Login failed ({email}): {resp.text}"
        return resp.json()["access_token"]


@pytest.mark.asyncio
async def _setup_holder_custom(
    _app,
    email: str,
    password: str = "CustomPass999!",
    name: str | None = None,
    with_member: bool = True,
) -> dict:
    """Create a HOLDER user + tenant directly in DB (bypasses register/pending).
    If with_member=True (default), also creates a TenantMember entry.
    Returns dict with token and tenant_id.
    """
    from database import get_db
    from models.db_models import Tenant, User, TenantMember, generate_join_code
    from utils.security import hash_password
    from httpx import AsyncClient, ASGITransport

    override = _app.dependency_overrides.get(get_db)
    session_generator = override() if override else get_db()
    async for session in session_generator:
        import time
        import random
        ts = f"{time.time()}-{random.randint(1000,9999)}"
        tenant = Tenant(
            subdomain=f"custom-{email.split('@')[0]}-{ts}",
            name=f"Custom School {email} {ts}",
            brand="relevo",
            status="active",
            join_code=generate_join_code(),
        )
        session.add(tenant)
        await session.flush()

        holder = User(
            email=email,
            name=name or f"Holder {email}",
            password=hash_password(password),
            status="active",
            role="HOLDER",
            tenant_id=tenant.id,
        )
        session.add(holder)
        await session.flush()

        if with_member:
            member = TenantMember(
                tenant_id=tenant.id,
                user_id=holder.id,
                role="owner",
            )
            session.add(member)

        tenant_id = tenant.id

    # Login via API
    transport = ASGITransport(app=_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        login_resp = await c.post("/api/auth/login", json={
            "email": email,
            "password": password,
        })
        assert login_resp.status_code == 200, f"Holder login failed: {login_resp.text}"
        token = login_resp.json()["access_token"]

    return {"token": token, "tenant_id": tenant_id}


@pytest.mark.asyncio
async def _create_teachers_direct(_app, tenant_id: str, count: int, prefix: str = "teacher") -> list[str]:
    """Create N TEACHER users directly in DB under a given tenant.
    Returns list of created emails.
    """
    from database import get_db
    from models.db_models import User
    from utils.security import hash_password

    override = _app.dependency_overrides.get(get_db)
    session_generator = override() if override else get_db()
    async for session in session_generator:
        for i in range(count):
            email = f"{prefix}-{i}@direct.test"
            teacher = User(
                email=email,
                name=f"Teacher {prefix} {i}",
                password=hash_password("DummyPass123!"),
                status="active",
                role="TEACHER",
                tenant_id=tenant_id,
            )
            session.add(teacher)
    return [f"{prefix}-{i}@direct.test" for i in range(count)]


@pytest.mark.asyncio
async def _create_evaluations_direct(_app, tenant_id: str, count: int) -> int:
    """Create N Evaluation records directly in DB under a given tenant.
    Returns the number of evaluations created.
    """
    from database import get_db
    from models.db_models import Evaluation

    override = _app.dependency_overrides.get(get_db)
    session_generator = override() if override else get_db()
    async for session in session_generator:
        for i in range(count):
            eval_entry = Evaluation(
                tenant_id=tenant_id,
                title=f"Direct Eval {i}",
                subject="Math",
                grade="1°",
                rubric=[],
                status="pending",
            )
            session.add(eval_entry)
    return count


# ═════════════════════════════════════════════
#  1. TENANTS  (HOLDER only)
# ═════════════════════════════════════════════
@pytest.mark.asyncio
class TestTenantsIntegration:
    """POST/GET /api/tenants — HOLDER creates and lists schools."""

    async def test_create_tenant_success(self, client: AsyncClient, fastapi_app):
        """Create a tenant with valid data returns 201."""
        holder = await _setup_holder(fastapi_app)
        token = holder["token"]

        resp = await client.post(
            "/api/tenants",
            json={"name": "Colegio Integración", "subdomain": "integro-colegio"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201, f"Tenant create failed: {resp.text}"
        data = resp.json()
        assert data["name"] == "Colegio Integración"
        assert data["subdomain"] == "integro-colegio"
        assert data["brand"] == "tiza"
        assert "id" in data

    async def test_create_tenant_duplicate_subdomain(self, client: AsyncClient, fastapi_app):
        """Duplicate subdomain returns 409."""
        holder = await _setup_holder(fastapi_app)
        token = holder["token"]
        await client.post(
            "/api/tenants",
            json={"name": "Primero", "subdomain": "dup-sub"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = await client.post(
            "/api/tenants",
            json={"name": "Segundo", "subdomain": "dup-sub"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409

    async def test_create_tenant_duplicate_name(self, client: AsyncClient, fastapi_app):
        """Duplicate name returns 409 (regression: linea 31 en tenants.py)."""
        holder = await _setup_holder(fastapi_app)
        token = holder["token"]
        await client.post(
            "/api/tenants",
            json={"name": "Colegio Duplicado", "subdomain": "primero"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = await client.post(
            "/api/tenants",
            json={"name": "Colegio Duplicado", "subdomain": "segundo"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409
        assert "registration failed" in resp.text.lower()

    async def test_create_tenant_duplicate_name_and_subdomain(self, client: AsyncClient, fastapi_app):
        """Same name AND same subdomain returns 409 (redundant but valid)."""
        holder = await _setup_holder(fastapi_app)
        token = holder["token"]
        await client.post(
            "/api/tenants",
            json={"name": "Full Dupe", "subdomain": "full-dupe"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = await client.post(
            "/api/tenants",
            json={"name": "Full Dupe", "subdomain": "full-dupe"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409

    async def test_list_tenants(self, client: AsyncClient, fastapi_app):
        """List tenants returns all created tenants."""
        holder = await _setup_holder(fastapi_app)
        token = holder["token"]

        # Create a couple of tenants
        await client.post(
            "/api/tenants",
            json={"name": "Colegio A", "subdomain": "colegio-a"},
            headers={"Authorization": f"Bearer {token}"},
        )
        await client.post(
            "/api/tenants",
            json={"name": "Colegio B", "subdomain": "colegio-b"},
            headers={"Authorization": f"Bearer {token}"},
        )

        resp = await client.get(
            "/api/tenants",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2
        names = [t["name"] for t in data]
        assert "Colegio A" in names
        assert "Colegio B" in names

    async def test_tenant_without_auth_returns_401(self, client: AsyncClient):
        """Non-authenticated requests to tenant endpoints return 401."""
        resp = await client.get("/api/tenants")
        assert resp.status_code == 401

    async def test_tenant_requires_holder_role(self, client: AsyncClient, fastapi_app):
        """A TEACHER (not HOLDER) cannot create tenants."""
        # Register HOLDER first to get a tenant
        holder = await _setup_holder(fastapi_app)
        holder_token = holder["token"]
        tenant_id = holder["tenant_id"]

        # Create a TEACHER via /api/users (HOLDER action) — gets status="active" by default
        teacher_resp = await client.post("/api/users", json={
            "email": "teacher-no-tenant@test.com",
            "password": "Pass1234!",
            "name": "Teacher Sin Permiso",
            "role": "teacher",
            "tenant_id": tenant_id,
        }, headers={"Authorization": f"Bearer {holder_token}"})
        assert teacher_resp.status_code == 201

        # Approve the teacher before login (users created via /api/users are pending)
        import database as db_module
        from sqlalchemy import text
        async with db_module.async_session() as session:
            await session.execute(
                text("UPDATE users SET status = 'active', approved_at = CURRENT_TIMESTAMP, approved_by = 'test_admin' WHERE email = :email"),
                {"email": "teacher-no-tenant@test.com"},
            )
            await session.commit()

        teacher_token = await _login(fastapi_app, "teacher-no-tenant@test.com", "Pass1234!")

        # TEACHER tries to create a tenant → 403
        resp = await client.post(
            "/api/tenants",
            json={"name": "Should Fail", "subdomain": "fail-tenant"},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"


# ═════════════════════════════════════════════
#  2. USERS  (HOLDER creates TEACHER)
# ═════════════════════════════════════════════
@pytest.mark.asyncio
class TestUsersIntegration:
    """POST/GET /api/users — HOLDER creates and lists teachers."""

    async def test_create_user_teacher_success(self, client: AsyncClient, fastapi_app):
        """Create a TEACHER under an existing tenant."""
        holder = await _setup_holder(fastapi_app)
        token = holder["token"]
        tenant_id = holder["tenant_id"]

        resp = await client.post(
            "/api/users",
            json={
                "email": TEACHER_EMAIL,
                "password": TEACHER_PASS,
                "name": TEACHER_NAME,
                "role": "teacher",
                "tenant_id": tenant_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201, f"Create user failed: {resp.text}"
        data = resp.json()
        assert data["email"] == TEACHER_EMAIL
        assert data["name"] == TEACHER_NAME
        assert data["role"] == "TEACHER"
        assert data["tenant_id"] == tenant_id
        assert "password" not in data

    async def test_create_user_invalid_role_returns_400(self, client: AsyncClient, fastapi_app):
        """Only 'teacher' role can be created via /api/users."""
        holder = await _setup_holder(fastapi_app)
        token = holder["token"]
        tenant_id = holder["tenant_id"]

        resp = await client.post(
            "/api/users",
            json={
                "email": "holder-wannabe@test.com",
                "password": "Pass1234!",
                "name": "Bad Role",
                "role": "director",  # not allowed
                "tenant_id": tenant_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    async def test_create_user_duplicate_email_returns_409(self, client: AsyncClient, fastapi_app):
        """Duplicate user email returns 409."""
        holder = await _setup_holder(fastapi_app)
        token = holder["token"]
        tenant_id = holder["tenant_id"]

        await client.post(
            "/api/users",
            json={
                "email": "dupe@test.com",
                "password": "Pass1234!",
                "name": "First",
                "role": "teacher",
                "tenant_id": tenant_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = await client.post(
            "/api/users",
            json={
                "email": "dupe@test.com",
                "password": "OtherPass456!",
                "name": "Second",
                "role": "teacher",
                "tenant_id": tenant_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409
        assert "already registered" in resp.text.lower()

    async def test_create_user_invalid_tenant_returns_404(self, client: AsyncClient, fastapi_app):
        """Non-existent tenant_id returns 404."""
        holder = await _setup_holder(fastapi_app)
        token = holder["token"]

        resp = await client.post(
            "/api/users",
            json={
                "email": "notenant@test.com",
                "password": "Pass1234!",
                "name": "No Tenant",
                "role": "teacher",
                "tenant_id": "00000000-0000-0000-0000-000000000000",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_list_users_filters_by_tenant(self, client: AsyncClient, fastapi_app):
        """Listing users respects tenant_id filter."""
        holder = await _setup_holder(fastapi_app)
        token = holder["token"]
        tenant_id = holder["tenant_id"]

        await client.post(
            "/api/users",
            json={
                "email": TEACHER_EMAIL,
                "password": TEACHER_PASS,
                "name": TEACHER_NAME,
                "role": "teacher",
                "tenant_id": tenant_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )

        resp = await client.get(
            f"/api/users?tenant_id={tenant_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        emails = [u["email"] for u in data]
        assert TEACHER_EMAIL in emails

    async def test_list_users_requires_auth(self, client: AsyncClient):
        """GET /api/users without auth returns 401."""
        resp = await client.get("/api/users")
        assert resp.status_code == 401


# ═════════════════════════════════════════════
#  3. COURSES  (TEACHER)
# ═════════════════════════════════════════════
@pytest.mark.asyncio
class TestCoursesIntegration:
    """POST/GET/DELETE /api/courses — teachers manage courses."""

    @pytest.fixture
    async def teacher_context(self, client: AsyncClient, fastapi_app) -> dict:
        """Create HOLDER + TEACHER users directly in DB."""
        holder = await _setup_holder(fastapi_app)
        teacher = await _setup_teacher(fastapi_app, holder["tenant_id"])
        return {
            "holder_token": holder["token"],
            "teacher_token": teacher["token"],
            "tenant_id": holder["tenant_id"],
        }

    async def test_create_course_success(self, client: AsyncClient, teacher_context: dict):
        """TEACHER creates a course under their tenant."""
        ctx = teacher_context
        resp = await client.post(
            "/api/courses",
            json={
                "name": COURSE_NAME,
                "grade": COURSE_GRADE,
                "subject": COURSE_SUBJECT,
            },
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 201, f"Create course failed: {resp.text}"
        data = resp.json()
        assert data["name"] == COURSE_NAME
        assert data["grade"] == COURSE_GRADE
        assert data["subject"] == COURSE_SUBJECT
        assert data["tenant_id"] == ctx["tenant_id"]
        assert "student_count" in data
        assert data["student_count"] == 0
        assert "id" in data

    async def test_list_courses(self, client: AsyncClient, teacher_context: dict):
        """List courses for the tenant (should include the created course)."""
        ctx = teacher_context
        # Create a course first
        await client.post(
            "/api/courses",
            json={"name": COURSE_NAME, "grade": COURSE_GRADE, "subject": COURSE_SUBJECT},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        resp = await client.get(
            "/api/courses",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        names = [c["name"] for c in data]
        assert COURSE_NAME in names

    async def test_get_course_by_id(self, client: AsyncClient, teacher_context: dict):
        """GET /api/courses/{id} returns the course."""
        ctx = teacher_context
        create_resp = await client.post(
            "/api/courses",
            json={"name": COURSE_NAME, "grade": COURSE_GRADE, "subject": COURSE_SUBJECT},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        course_id = create_resp.json()["id"]

        resp = await client.get(
            f"/api/courses/{course_id}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == COURSE_NAME

    async def test_get_course_not_found(self, client: AsyncClient, teacher_context: dict):
        """Non-existent course returns 404."""
        ctx = teacher_context
        resp = await client.get(
            "/api/courses/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 404

    async def test_delete_course(self, client: AsyncClient, teacher_context: dict):
        """DELETE /api/courses/{id} removes the course."""
        ctx = teacher_context
        create_resp = await client.post(
            "/api/courses",
            json={"name": "Curso a eliminar", "grade": "1°", "subject": "Test"},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        course_id = create_resp.json()["id"]

        resp = await client.delete(
            f"/api/courses/{course_id}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200

        # Verify it's gone
        resp2 = await client.get(
            f"/api/courses/{course_id}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp2.status_code == 404

    async def test_course_without_auth_returns_401(self, client: AsyncClient):
        """Courses endpoints require auth."""
        resp = await client.post(
            "/api/courses",
            json={"name": "X", "grade": "1°", "subject": "Test"},
        )
        assert resp.status_code == 401


# ═════════════════════════════════════════════
#  4. STUDENTS  (bulk create under course)
# ═════════════════════════════════════════════
@pytest.mark.asyncio
class TestStudentsIntegration:
    """Bulk create and list students under a course."""

    @pytest.fixture
    async def course_context(self, client: AsyncClient, fastapi_app) -> dict:
        """Create HOLDER → tenant → TEACHER → course."""
        holder = await _setup_holder(fastapi_app)
        teacher = await _setup_teacher(fastapi_app, holder["tenant_id"])

        # Create course
        course_resp = await client.post(
            "/api/courses",
            json={"name": COURSE_NAME, "grade": COURSE_GRADE, "subject": COURSE_SUBJECT},
            headers={"Authorization": f"Bearer {teacher['token']}"},
        )
        course_id = course_resp.json()["id"]
        return {
            "teacher_token": teacher["token"],
            "tenant_id": holder["tenant_id"],
            "course_id": course_id,
            "course_name": COURSE_NAME,
        }

    async def test_bulk_create_students(self, client: AsyncClient, course_context: dict):
        """Bulk create students returns 201 with correct count."""
        ctx = course_context
        resp = await client.post(
            f"/api/students/course/{ctx['course_id']}",
            json={"names": STUDENT_NAMES},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 201, f"Bulk create failed: {resp.text}"
        data = resp.json()
        assert data["count"] == len(STUDENT_NAMES)
        assert len(data["students"]) == len(STUDENT_NAMES)

        codes = [s["student_code"] for s in data["students"]]
        for s in data["students"]:
            assert s["course_id"] == ctx["course_id"]
            assert s["full_name"] in STUDENT_NAMES
            # Code should follow pattern STU-{prefix}-{nnn}
            assert s["student_code"].startswith("STU-")

    async def test_list_students(self, client: AsyncClient, course_context: dict):
        """List students in a course."""
        ctx = course_context
        # First create some students
        await client.post(
            f"/api/students/course/{ctx['course_id']}",
            json={"names": STUDENT_NAMES},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        resp = await client.get(
            f"/api/students/course/{ctx['course_id']}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == len(STUDENT_NAMES)
        names = [s["full_name"] for s in data]
        for n in STUDENT_NAMES:
            assert n in names

    async def test_bulk_create_invalid_course_returns_404(self, client: AsyncClient, course_context: dict):
        """Bulk create on non-existent course returns 404."""
        ctx = course_context
        resp = await client.post(
            "/api/students/course/00000000-0000-0000-0000-000000000000",
            json={"names": ["Test Student"]},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 404

    async def test_delete_student(self, client: AsyncClient, course_context: dict):
        """Delete a single student."""
        ctx = course_context
        create_resp = await client.post(
            f"/api/students/course/{ctx['course_id']}",
            json={"names": ["Deletable Student"]},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        student_id = create_resp.json()["students"][0]["id"]

        resp = await client.delete(
            f"/api/students/{student_id}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200

        # Verify deletion by listing
        list_resp = await client.get(
            f"/api/students/course/{ctx['course_id']}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        names = [s["full_name"] for s in list_resp.json()]
        assert "Deletable Student" not in names


# ═════════════════════════════════════════════
#  5. EVALUATIONS
# ═════════════════════════════════════════════
@pytest.mark.asyncio
class TestEvaluationsIntegration:
    """CRUD for evaluations with rubric."""

    RUBRIC = [
        {"question_number": 1, "type": "written", "max_score": 4.0, "criteria": "Resolución correcta", "correct_answer": "42"},
        {"question_number": 2, "type": "written", "max_score": 3.0, "criteria": "Procedimiento adecuado", "correct_answer": "x = 5"},
    ]

    @pytest.fixture
    async def eval_context(self, client: AsyncClient, fastapi_app) -> dict:
        """Create HOLDER → tenant → TEACHER."""
        holder = await _setup_holder(fastapi_app)
        teacher = await _setup_teacher(fastapi_app, holder["tenant_id"])
        return {"teacher_token": teacher["token"], "tenant_id": holder["tenant_id"]}

    async def test_create_evaluation(self, client: AsyncClient, eval_context: dict):
        """Create evaluation with rubric returns 201."""
        ctx = eval_context
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": EVAL_TITLE,
                "subject": COURSE_SUBJECT,
                "grade": COURSE_GRADE,
                "rubric": self.RUBRIC,
            },
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 201, f"Create evaluation failed: {resp.text}"
        data = resp.json()
        assert data["title"] == EVAL_TITLE
        assert data["subject"] == COURSE_SUBJECT
        assert data["grade"] == COURSE_GRADE
        assert data["status"] == "pending"
        assert len(data["rubric"]) == 2
        assert data["rubric"][0]["question_number"] == 1

    async def test_list_evaluations(self, client: AsyncClient, eval_context: dict):
        """List evaluations for tenant."""
        ctx = eval_context
        await client.post(
            "/api/evaluations",
            json={"title": "Eval-1", "subject": "Matemáticas", "grade": "1°", "rubric": self.RUBRIC},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        await client.post(
            "/api/evaluations",
            json={"title": "Eval-2", "subject": "Lenguaje", "grade": "2°", "rubric": self.RUBRIC},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        resp = await client.get(
            "/api/evaluations",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2
        titles = [e["title"] for e in data]
        assert "Eval-1" in titles
        assert "Eval-2" in titles

    async def test_get_evaluation_by_id(self, client: AsyncClient, eval_context: dict):
        """GET /api/evaluations/{id} returns the evaluation."""
        ctx = eval_context
        create_resp = await client.post(
            "/api/evaluations",
            json={"title": "Specific Eval", "subject": "Cs Naturales", "grade": "3°", "rubric": self.RUBRIC},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        eval_id = create_resp.json()["id"]
        resp = await client.get(
            f"/api/evaluations/{eval_id}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Specific Eval"

    async def test_get_evaluation_not_found(self, client: AsyncClient, eval_context: dict):
        """Non-existent evaluation returns 404."""
        ctx = eval_context
        resp = await client.get(
            "/api/evaluations/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 404

    async def test_delete_evaluation(self, client: AsyncClient, eval_context: dict):
        """DELETE /api/evaluations/{id}."""
        ctx = eval_context
        create_resp = await client.post(
            "/api/evaluations",
            json={"title": "To Delete", "subject": "X", "grade": "1°", "rubric": self.RUBRIC},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        eval_id = create_resp.json()["id"]
        resp = await client.delete(
            f"/api/evaluations/{eval_id}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200

        # Verify gone
        resp2 = await client.get(
            f"/api/evaluations/{eval_id}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp2.status_code == 404


# ═════════════════════════════════════════════
#  6. SIMULATE + RESULTS
# ═════════════════════════════════════════════
@pytest.mark.asyncio
class TestResultsIntegration:
    """Simulate answers and retrieve results."""

    RUBRIC = [
        {"question_number": 1, "type": "written", "max_score": 4.0, "criteria": "Respuesta correcta"},
        {"question_number": 2, "type": "written", "max_score": 3.0, "criteria": "Argumentación"},
    ]

    @pytest.fixture
    async def full_context(self, client: AsyncClient, fastapi_app) -> dict:
        """Full setup: HOLDER → tenant → TEACHER → course → students → evaluation."""
        holder = await _setup_holder(fastapi_app)
        teacher = await _setup_teacher(fastapi_app, holder["tenant_id"])

        # Course
        c_resp = await client.post("/api/courses", json={
            "name": COURSE_NAME, "grade": COURSE_GRADE, "subject": COURSE_SUBJECT,
        }, headers={"Authorization": f"Bearer {teacher['token']}"})
        course_id = c_resp.json()["id"]

        # Students
        await client.post(
            f"/api/students/course/{course_id}",
            json={"names": STUDENT_NAMES},
            headers={"Authorization": f"Bearer {teacher['token']}"},
        )

        # Evaluation
        e_resp = await client.post("/api/evaluations", json={
            "title": EVAL_TITLE, "subject": COURSE_SUBJECT,
            "grade": COURSE_GRADE, "rubric": self.RUBRIC,
        }, headers={"Authorization": f"Bearer {teacher['token']}"})
        eval_id = e_resp.json()["id"]

        return {
            "teacher_token": teacher["token"],
            "tenant_id": holder["tenant_id"],
            "course_id": course_id,
            "eval_id": eval_id,
        }

    async def test_simulate_answers(self, client: AsyncClient, full_context: dict):
        """POST /api/evaluations/{id}/simulate/{course_id} generates results."""
        ctx = full_context
        resp = await client.post(
            f"/api/evaluations/{ctx['eval_id']}/simulate/{ctx['course_id']}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200, f"Simulate failed: {resp.text}"
        data = resp.json()
        assert data["generated"] == len(STUDENT_NAMES)
        assert len(data["results"]) == len(STUDENT_NAMES)
        assert data["evaluation_id"] == ctx["eval_id"]
        assert data["course_id"] == ctx["course_id"]
        # Verify each result has a grade
        for r in data["results"]:
            assert "grade" in r
            assert "student_code" in r

    async def test_list_results_for_evaluation(self, client: AsyncClient, full_context: dict):
        """GET /api/results/evaluation/{id} returns results."""
        ctx = full_context
        # Simulate first
        await client.post(
            f"/api/evaluations/{ctx['eval_id']}/simulate/{ctx['course_id']}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        resp = await client.get(
            f"/api/results/evaluation/{ctx['eval_id']}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == len(STUDENT_NAMES)
        # Each result should have answers, confidence, final_grade
        for r in data:
            assert "answers" in r
            assert "final_grade" in r
            assert "confidence" in r
            assert r["evaluation_id"] == ctx["eval_id"]

    async def test_get_single_result(self, client: AsyncClient, full_context: dict):
        """GET /api/results/{id} returns a single result."""
        ctx = full_context
        await client.post(
            f"/api/evaluations/{ctx['eval_id']}/simulate/{ctx['course_id']}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        # Get results list
        list_resp = await client.get(
            f"/api/results/evaluation/{ctx['eval_id']}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        result_id = list_resp.json()[0]["id"]

        resp = await client.get(
            f"/api/results/{result_id}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == result_id

    async def test_pending_review(self, client: AsyncClient, full_context: dict):
        """GET /api/results/pending-review returns pending items."""
        ctx = full_context
        await client.post(
            f"/api/evaluations/{ctx['eval_id']}/simulate/{ctx['course_id']}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        resp = await client.get(
            "/api/results/pending-review",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200
        # Some might be pending, some might not — verify each has requires_review
        for r in resp.json():
            assert "requires_review" in r
            assert "status" in r

    async def test_simulate_no_students_returns_400(self, client: AsyncClient, fastapi_app):
        """Simulate on course with no students returns 400."""
        holder = await _setup_holder(fastapi_app)

        # Create teacher via /api/users (HOLDER action)
        await client.post("/api/users", json={
            "email": "teacher-nostudents@test.com", "password": TEACHER_PASS,
            "name": "Teacher No Students", "role": "teacher", "tenant_id": holder["tenant_id"],
        }, headers={"Authorization": f"Bearer {holder['token']}"})

        # Approve the teacher before login (users created via /api/users are pending)
        import database as db_module
        from sqlalchemy import text
        async with db_module.async_session() as session:
            await session.execute(
                text("UPDATE users SET status = 'active', approved_at = CURRENT_TIMESTAMP, approved_by = 'test_admin' WHERE email = :email"),
                {"email": "teacher-nostudents@test.com"},
            )
            await session.commit()

        teacher_token = await _login(fastapi_app, "teacher-nostudents@test.com", TEACHER_PASS)

        c_resp = await client.post("/api/courses", json={
            "name": "Empty Course", "grade": "1°", "subject": "X",
        }, headers={"Authorization": f"Bearer {teacher_token}"})
        course_id = c_resp.json()["id"]

        e_resp = await client.post("/api/evaluations", json={
            "title": "Empty Eval", "subject": "X", "grade": "1°", "rubric": self.RUBRIC,
        }, headers={"Authorization": f"Bearer {teacher_token}"})
        eval_id = e_resp.json()["id"]

        resp = await client.post(
            f"/api/evaluations/{eval_id}/simulate/{course_id}",
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert resp.status_code == 400


# ═════════════════════════════════════════════
#  7. DASHBOARD
# ═════════════════════════════════════════════
@pytest.mark.asyncio
class TestDashboardIntegration:
    """Dashboard stats endpoints."""

    RUBRIC = [
        {"question_number": 1, "type": "written", "max_score": 4.0},
        {"question_number": 2, "type": "written", "max_score": 3.0},
    ]

    @pytest.fixture
    async def dashboard_context(self, client: AsyncClient, fastapi_app) -> dict:
        """Full data setup including simulated results."""
        holder = await _setup_holder(fastapi_app)
        teacher = await _setup_teacher(fastapi_app, holder["tenant_id"])

        c_resp = await client.post("/api/courses", json={
            "name": COURSE_NAME, "grade": COURSE_GRADE, "subject": COURSE_SUBJECT,
        }, headers={"Authorization": f"Bearer {teacher['token']}"})
        course_id = c_resp.json()["id"]

        await client.post(
            f"/api/students/course/{course_id}",
            json={"names": STUDENT_NAMES},
            headers={"Authorization": f"Bearer {teacher['token']}"},
        )

        e_resp = await client.post("/api/evaluations", json={
            "title": EVAL_TITLE, "subject": COURSE_SUBJECT,
            "grade": COURSE_GRADE, "rubric": self.RUBRIC,
        }, headers={"Authorization": f"Bearer {teacher['token']}"})
        eval_id = e_resp.json()["id"]

        # Simulate to generate results
        await client.post(
            f"/api/evaluations/{eval_id}/simulate/{course_id}",
            headers={"Authorization": f"Bearer {teacher['token']}"},
        )

        return {
            "holder_token": holder["token"],
            "teacher_token": teacher["token"],
            "tenant_id": holder["tenant_id"],
            "course_id": course_id,
        }

    async def test_dashboard_teacher(self, client: AsyncClient, dashboard_context: dict):
        """GET /api/dashboard/teacher returns stats."""
        ctx = dashboard_context
        resp = await client.get(
            "/api/dashboard/teacher",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_evaluations" in data
        assert "total_students" in data
        assert "average_grade" in data
        assert "completed_this_week" in data
        assert "pending_review" in data
        # We created 1 evaluation, 3 students
        assert data["total_evaluations"] >= 1
        assert data["total_students"] >= 3

    async def test_dashboard_executive(self, client: AsyncClient, dashboard_context: dict):
        """GET /api/dashboard/executive returns macro stats (HOLDER only)."""
        ctx = dashboard_context
        resp = await client.get(
            "/api/dashboard/executive",
            headers={"Authorization": f"Bearer {ctx['holder_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_schools" in data
        assert "total_teachers" in data
        assert "total_evaluations" in data
        assert "average_performance" in data
        assert data["total_schools"] >= 1
        assert data["total_teachers"] >= 1

    async def test_dashboard_executive_requires_holder(self, client: AsyncClient, dashboard_context: dict):
        """TEACHER cannot access executive dashboard."""
        ctx = dashboard_context
        resp = await client.get(
            "/api/dashboard/executive",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 403

    async def test_dashboard_course_stats(self, client: AsyncClient, dashboard_context: dict):
        """GET /api/dashboard/course/{id} returns course-specific stats."""
        ctx = dashboard_context
        resp = await client.get(
            f"/api/dashboard/course/{ctx['course_id']}",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["course_id"] == ctx["course_id"]
        assert data["course_name"] == COURSE_NAME
        assert data["total_students"] == len(STUDENT_NAMES)
        assert "average_grade" in data
        assert len(data["students"]) == len(STUDENT_NAMES)

    async def test_dashboard_course_not_found(self, client: AsyncClient, dashboard_context: dict):
        """Dashboard course stats for non-existent course returns 404."""
        ctx = dashboard_context
        resp = await client.get(
            "/api/dashboard/course/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 404

    # ─────────────────────────────────────────────
    #  REGRESSION — tenant isolation & IDOR (Raven bugs → tests)
    # ─────────────────────────────────────────────

    async def test_dashboard_executive_holder_without_tenantmember(
        self, client: AsyncClient, fastapi_app
    ):
        """HOLDER without TenantMember must still see their own tenant data
        via the fallback path (current_user.tenant_id), not global data."""
        # Create holder WITHOUT TenantMember entry
        holder = await _setup_holder_custom(
            fastapi_app, "holdernm@test.com", "HolderNM999!", with_member=False
        )
        token = holder["token"]
        tenant_id = holder["tenant_id"]

        # Create teachers and evaluations in that tenant
        teachers = await _create_teachers_direct(fastapi_app, tenant_id, 2, prefix="nm")
        assert len(teachers) == 2
        await _create_evaluations_direct(fastapi_app, tenant_id, 2)

        resp = await client.get(
            "/api/dashboard/executive",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        # Must NOT be global — should only see own tenant
        assert data["total_schools"] == 1, (
            f"Expected 1 school (own tenant only), got {data['total_schools']}"
        )
        assert data["total_teachers"] == 2, (
            f"Expected 2 teachers, got {data['total_teachers']}"
        )
        assert data["total_evaluations"] == 2, (
            f"Expected 2 evaluations, got {data['total_evaluations']}"
        )

    async def test_dashboard_executive_header_injection(
        self, client: AsyncClient, fastapi_app
    ):
        """X-Tenant-Id header must NOT alter dashboard results.
        Regression: IDOR vulnerability where header was used for tenant resolution."""
        # Create two holders with their own tenants
        holder_a = await _setup_holder_custom(
            fastapi_app, "inject-a@test.com", "InjectA999!", with_member=True
        )
        token_a = holder_a["token"]
        tenant_a_id = holder_a["tenant_id"]

        holder_b = await _setup_holder_custom(
            fastapi_app, "inject-b@test.com", "InjectB999!", with_member=True
        )
        tenant_b_id = holder_b["tenant_id"]

        # Create 5 teachers in tenant_A, 2 in tenant_B
        await _create_teachers_direct(fastapi_app, tenant_a_id, 5, prefix="inja")
        await _create_teachers_direct(fastapi_app, tenant_b_id, 2, prefix="injb")

        # Call with holder_A's token but inject X-Tenant-Id for tenant_B
        resp = await client.get(
            "/api/dashboard/executive",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Tenant-Id": tenant_b_id,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        # Must be 5 (tenant A's teachers), NOT 2 (tenant B's)
        assert data["total_teachers"] == 5, (
            f"Expected 5 teachers (tenant A), got {data['total_teachers']}. "
            "X-Tenant-Id injection must not alter results."
        )
        assert data["total_schools"] == 1

    async def test_dashboard_executive_tenant_isolation(
        self, client: AsyncClient, fastapi_app
    ):
        """Tenants must have fully isolated dashboard executive data."""
        # Create tenant_A with holder_A
        holder_a = await _setup_holder_custom(
            fastapi_app, "isol-a@test.com", "IsoA999!", with_member=True
        )
        token_a = holder_a["token"]
        tenant_a_id = holder_a["tenant_id"]

        # Create tenant_B with holder_B
        holder_b = await _setup_holder_custom(
            fastapi_app, "isol-b@test.com", "IsoB999!", with_member=True
        )
        token_b = holder_b["token"]
        tenant_b_id = holder_b["tenant_id"]

        # Tenant A: 3 teachers, 2 evaluations
        await _create_teachers_direct(fastapi_app, tenant_a_id, 3, prefix="isoa")
        await _create_evaluations_direct(fastapi_app, tenant_a_id, 2)

        # Tenant B: 2 teachers, 1 evaluation
        await _create_teachers_direct(fastapi_app, tenant_b_id, 2, prefix="isob")
        await _create_evaluations_direct(fastapi_app, tenant_b_id, 1)

        # Verify holder_A's view
        resp_a = await client.get(
            "/api/dashboard/executive",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert resp_a.status_code == 200
        data_a = resp_a.json()
        assert data_a["total_schools"] == 1, (
            f"Holder A: expected 1 school, got {data_a['total_schools']}"
        )
        assert data_a["total_teachers"] == 3, (
            f"Holder A: expected 3 teachers, got {data_a['total_teachers']}"
        )
        assert data_a["total_evaluations"] == 2, (
            f"Holder A: expected 2 evaluations, got {data_a['total_evaluations']}"
        )

        # Verify holder_B's view
        resp_b = await client.get(
            "/api/dashboard/executive",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp_b.status_code == 200
        data_b = resp_b.json()
        assert data_b["total_schools"] == 1, (
            f"Holder B: expected 1 school, got {data_b['total_schools']}"
        )
        assert data_b["total_teachers"] == 2, (
            f"Holder B: expected 2 teachers, got {data_b['total_teachers']}"
        )
        assert data_b["total_evaluations"] == 1, (
            f"Holder B: expected 1 evaluation, got {data_b['total_evaluations']}"
        )


# ═════════════════════════════════════════════
#  8. RESULT REVIEW  (smoke test)
# ═════════════════════════════════════════════
@pytest.mark.asyncio
class TestResultReviewIntegration:
    """POST /api/results/{id}/review — teacher reviews a result."""

    RUBRIC = [
        {"question_number": 1, "type": "written", "max_score": 4.0},
    ]

    @pytest.fixture
    async def review_context(self, client: AsyncClient, fastapi_app) -> dict:
        """Setup + simulate to get a result to review."""
        holder = await _setup_holder(fastapi_app)
        teacher = await _setup_teacher(fastapi_app, holder["tenant_id"])

        c_resp = await client.post("/api/courses", json={
            "name": "Review Course", "grade": "1°", "subject": "Test",
        }, headers={"Authorization": f"Bearer {teacher['token']}"})
        course_id = c_resp.json()["id"]

        await client.post(
            f"/api/students/course/{course_id}",
            json={"names": ["Review Student"]},
            headers={"Authorization": f"Bearer {teacher['token']}"},
        )

        e_resp = await client.post("/api/evaluations", json={
            "title": "Review Eval", "subject": "Test", "grade": "1°", "rubric": self.RUBRIC,
        }, headers={"Authorization": f"Bearer {teacher['token']}"})
        eval_id = e_resp.json()["id"]

        await client.post(
            f"/api/evaluations/{eval_id}/simulate/{course_id}",
            headers={"Authorization": f"Bearer {teacher['token']}"},
        )

        # Get the result
        list_resp = await client.get(
            f"/api/results/evaluation/{eval_id}",
            headers={"Authorization": f"Bearer {teacher['token']}"},
        )
        result_id = list_resp.json()[0]["id"]

        return {"teacher_token": teacher["token"], "result_id": result_id}

    async def test_review_result(self, client: AsyncClient, review_context: dict):
        """POST /api/results/{id}/review updates and returns the reviewed result."""
        ctx = review_context
        resp = await client.post(
            f"/api/results/{ctx['result_id']}/review",
            json={"corrections": [
                {"question_number": 1, "teacher_score": 3.5, "teacher_correction": "Buen trabajo"}
            ]},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 200, f"Review failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "reviewed"
        assert data["requires_review"] is False

    async def test_review_nonexistent_result_returns_404(self, client: AsyncClient, review_context: dict):
        """Review non-existent result returns 404."""
        ctx = review_context
        resp = await client.post(
            "/api/results/00000000-0000-0000-0000-000000000000/review",
            json={"corrections": []},
            headers={"Authorization": f"Bearer {ctx['teacher_token']}"},
        )
        assert resp.status_code == 404
