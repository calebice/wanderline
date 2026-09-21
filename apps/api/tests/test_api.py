from httpx import AsyncClient


async def test_health_checks(client: AsyncClient) -> None:
    assert (await client.get("/health/live")).json() == {"status": "ok"}
    ready = await client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json() == {"status": "ready", "database": "ok"}
