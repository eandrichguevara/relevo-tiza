"""Tests for the temporary/provisional password change enforcement flow."""
import sys
import os
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from httpx import AsyncClient
from models.db_models import User
from sqlalchemy import select, update
from utils.security import hash_password


async def _activate_user_and_set_must_change(email: str, must_change: bool):
    """Update user in DB to be active and set must_change_password status."""
    import database as db_module
    async with db_module.async_session() as session:
        await session.execute(
            update(User)
            .where(User.email == email)
            .values(status="active", must_change_password=must_change)
        )
        await session.commit()


@pytest.mark.asyncio
async def test_must_change_password_enforcement(client: AsyncClient):
    """Test the complete force password change flow and path protection."""
    # 1. Register a holder (auto-created tenant)
    holder_resp = await client.post("/api/auth/register", json={
        "email": "holder_must_change@test.com",
        "password": "TempPassword123!",
        "role": "director",
    })
    assert holder_resp.status_code == 201
    tenant_id = holder_resp.json()["tenant_id"]

    # 2. Register a teacher under the tenant
    teacher_resp = await client.post("/api/auth/register", json={
        "email": "teacher_must_change@test.com",
        "password": "TempPassword123!",
        "role": "teacher",
        "name": "Teacher Must Change",
        "tenant_id": tenant_id,
    })
    assert teacher_resp.status_code == 201

    # 3. Activate teacher and set must_change_password to True (simulating a reset or admin creation)
    await _activate_user_and_set_must_change("teacher_must_change@test.com", must_change=True)

    # 4. Login as the teacher
    login_resp = await client.post("/api/auth/login", json={
        "email": "teacher_must_change@test.com",
        "password": "TempPassword123!",
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 5. Verify they can query /session
    session_resp = await client.get("/api/auth/session", headers=headers)
    assert session_resp.status_code == 200
    assert session_resp.json()["must_change_password"] is True

    # 6. Verify they CANNOT query courses (should be blocked)
    courses_resp = await client.get("/api/courses", headers=headers)
    assert courses_resp.status_code == 403
    assert "contraseña provisoria" in courses_resp.json()["detail"]

    # 7. Try changing password with wrong current password -> 400
    change_resp = await client.post("/api/auth/change-password", headers=headers, json={
        "current_password": "WrongPassword!",
        "new_password": "NewSecurePassword123!",
    })
    assert change_resp.status_code == 400
    assert "incorrecta" in change_resp.json()["detail"]

    # 8. Try changing password to the same temporary password -> 400 (prevent bypass)
    change_resp = await client.post("/api/auth/change-password", headers=headers, json={
        "current_password": "TempPassword123!",
        "new_password": "TempPassword123!",
    })
    assert change_resp.status_code == 400
    assert "igual" in change_resp.json()["detail"]

    # 9. Change password successfully
    change_resp = await client.post("/api/auth/change-password", headers=headers, json={
        "current_password": "TempPassword123!",
        "new_password": "NewSecurePassword123!",
    })
    assert change_resp.status_code == 200
    assert "access_token" in change_resp.json()

    # 10. Login with new password
    login_resp_2 = await client.post("/api/auth/login", json={
        "email": "teacher_must_change@test.com",
        "password": "NewSecurePassword123!",
    })
    assert login_resp_2.status_code == 200
    token_2 = login_resp_2.json()["access_token"]
    headers_2 = {"Authorization": f"Bearer {token_2}"}

    # 11. Verify they can now access courses endpoint
    courses_resp_2 = await client.get("/api/courses", headers=headers_2)
    assert courses_resp_2.status_code == 200
