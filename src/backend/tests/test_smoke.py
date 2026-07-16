"""Smoke test: app starts, /health returns 200."""
def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"
