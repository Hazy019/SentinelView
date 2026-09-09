import asyncio
import httpx
from main import app
from app.db.database import init_db, close_db

async def run_e2e():
    await init_db("./sentinel.db")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test Demo Login
        r_demo = await client.post("/auth/token", json={"username": "demo", "password": "demo123"})
        print("1. Demo Login Status:", r_demo.status_code, "is_demo:", r_demo.json().get("is_demo"))
        assert r_demo.status_code == 200
        assert r_demo.json()["is_demo"] is True

        # 2. Test User Registration
        r_reg = await client.post("/auth/register", json={"username": "lead_architect_01", "password": "superpassword123"})
        print("2. Registration Status:", r_reg.status_code, "tenant_id:", r_reg.json().get("tenant_id"))
        assert r_reg.status_code == 201
        data_reg = r_reg.json()
        assert data_reg["is_demo"] is False
        user_api_key = data_reg["api_key"]
        user_tenant = data_reg["tenant_id"]
        assert user_api_key.startswith("sv_live_")

        # 3. Test Real Website Ingestion with Personal API Key
        log_event = {
            "timestamp": "2026-09-09T12:00:00Z",
            "source_ip": "185.220.101.47",
            "dest_ip": "10.0.0.1",
            "action": "LOGIN",
            "status_code": 401,
            "username": "admin",
            "bytes_sent": 120,
        }
        r_ingest = await client.post("/api/v1/ingest", headers={"X-API-Key": user_api_key}, json=log_event)
        print("3. Ingest with API Key Status:", r_ingest.status_code, r_ingest.json())
        assert r_ingest.status_code == 200
        assert r_ingest.json()["tenant_id"] == user_tenant

        # 4. Test WebSocket Ticket creation
        token = data_reg["access_token"]
        r_ticket = await client.post(
            "/auth/ws-ticket",
            headers={"Authorization": f"Bearer {token}"},
            params={"tenant_id": user_tenant}
        )
        print("4. WS Ticket Status:", r_ticket.status_code, "Ticket prefix:", r_ticket.json().get("ticket")[:8] + "...")
        assert r_ticket.status_code == 200

        # 5. Test Profile Me endpoint
        r_me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        print("5. Profile /auth/me Status:", r_me.status_code, "Role:", r_me.json().get("role"))
        assert r_me.status_code == 200
        assert r_me.json()["api_key"] == user_api_key

        # 6. Test Duplicate User Conflict
        r_dup = await client.post("/auth/register", json={"username": "lead_architect_01", "password": "newpassword123"})
        print("6. Duplicate Registration Conflict Status:", r_dup.status_code)
        assert r_dup.status_code == 409

    await close_db()
    print("--> ALL E2E ARCHITECTURAL TESTS PASSED SUCCESSFULLY! <--")

if __name__ == "__main__":
    asyncio.run(run_e2e())
