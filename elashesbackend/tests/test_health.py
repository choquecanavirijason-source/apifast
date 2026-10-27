"""Health check: el frontend y el instalador lo consultan para saber si el
backend ya arrancó (ver main.py)."""
from fastapi.testclient import TestClient

from main import app


def test_health_check():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
