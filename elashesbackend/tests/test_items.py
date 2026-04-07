"""
Tests para la API de Items
"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_read_main():
    """Test endpoint principal"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["success"] is True


def test_health_check():
    """Test health check"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_create_item():
    """Test crear item"""
    item_data = {
        "name": "Test Item",
        "description": "Test Description",
        "price": 29.99,
        "is_available": True
    }
    response = client.post("/items/", json=item_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == item_data["name"]
    assert data["price"] == item_data["price"]
    assert "id" in data


def test_get_items():
    """Test obtener items"""
    response = client.get("/items/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


def test_get_item_not_found():
    """Test obtener item que no existe"""
    response = client.get("/items/9999")
    assert response.status_code == 404
