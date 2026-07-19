"""
Temporary auth test script.
Tests: register → login → /me with token.
Run: source .venv/bin/activate && python test_auth.py
"""
import asyncio
import sys
import os

# Ensure we're in the right directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Use httpx for async HTTP calls
try:
    import httpx
except ImportError:
    print("❌ httpx not installed. Run: pip install httpx")
    sys.exit(1)


BASE_URL = "http://localhost:8000"
TEST_EMAIL = "test_forge@example.com"
TEST_PASSWORD = "test1234"


async def test_auth_flow():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        # Step 1: Health check
        print("\n🔍 Step 1: Health check...")
        try:
            resp = await client.get("/api/health")
            if resp.status_code == 200:
                print(f"   ✅ Health OK: {resp.json()}")
            else:
                print(f"   ❌ Health failed: {resp.status_code} {resp.text}")
                return False
        except httpx.ConnectError as e:
            print(f"   ❌ Cannot connect to {BASE_URL}. Is the server running?")
            print(f"      Error: {e}")
            return False

        # Step 2: Register
        print(f"\n🔍 Step 2: Register {TEST_EMAIL}...")
        resp = await client.post(
            "/api/auth/register",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        if resp.status_code == 201:
            data = resp.json()
            print(f"   ✅ Register OK: id={data.get('id')}, email={data.get('email')}, role={data.get('role')}")
        elif resp.status_code == 400:
            print(f"   ℹ️  Already registered: {resp.json()}")
        else:
            print(f"   ❌ Register failed: {resp.status_code} {resp.text}")
            return False

        # Step 3: Login
        print(f"\n🔍 Step 3: Login {TEST_EMAIL}...")
        resp = await client.post(
            "/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("access_token")
            print(f"   ✅ Login OK: token_type={data.get('token_type')}, token_preview={token[:20]}...")
        else:
            print(f"   ❌ Login failed: {resp.status_code} {resp.text}")
            return False

        # Step 4: Get /me with token
        print(f"\n🔍 Step 4: GET /me with token...")
        resp = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"   ✅ /me OK: id={data.get('id')}, email={data.get('email')}, role={data.get('role')}")
        else:
            print(f"   ❌ /me failed: {resp.status_code} {resp.text}")
            return False

        return True


async def main():
    print("=" * 60)
    print("🧪 AUTH FLOW TEST")
    print("=" * 60)
    print(f"   Server: {BASE_URL}")
    print(f"   Email:  {TEST_EMAIL}")
    print(f"   Pass:   {TEST_PASSWORD}")
    print("=" * 60)

    success = await test_auth_flow()

    print()
    print("=" * 60)
    if success:
        print("✅ ALL AUTH TESTS PASSED")
    else:
        print("❌ AUTH TESTS FAILED")
    print("=" * 60)

    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
