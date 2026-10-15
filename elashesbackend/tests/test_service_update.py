"""
Tests de PUT /agenda/services/{id}: maintenance_days / removal_days enviados
en null se vacían ("no requiere"); ausentes del body se conservan.

Ejecutar:
  cd elashesbackend
  pytest tests/test_service_update.py -v
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.dependencies import get_db
from app.domain.entities.branch import Branch
from app.domain.entities.service_agenda import Service, ServiceCategory
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database.base_class import Base
from app.infrastructure.security import get_password_hash

engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db() -> Session:
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db: Session) -> TestClient:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def seed(db: Session) -> dict:
    perms = [Permission(name=n) for n in ("services:view", "services:manage")]
    db.add_all(perms)
    db.flush()
    role = Role(name="Admin")
    db.add(role)
    db.flush()
    role.permissions = perms

    branch = Branch(name="Sucursal Test", address="Calle 1", city="SCZ", department="SC")
    db.add(branch)
    db.flush()
    db.add(User(
        username="admin_test",
        email="admin@test.com",
        phone="+59199000009",
        hashed_password=get_password_hash("test1234"),
        is_active=True,
        role_id=role.id,
        branch_id=branch.id,
    ))

    category = ServiceCategory(name="Extensiones", is_mobile=False, has_maintenance=True, has_removal=True)
    db.add(category)
    db.flush()
    service = Service(
        name="Extensiones Clásicas",
        duration_minutes=60,
        price=150.0,
        category_id=category.id,
        maintenance_days=21,
        removal_days=35,
    )
    db.add(service)
    db.commit()
    return {"service": service}


@pytest.fixture
def auth(client: TestClient, seed) -> dict:
    resp = client.post("/auth/login", json={"username": "admin_test", "password": "test1234"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def put(client: TestClient, auth: dict, service_id: int, body: dict) -> dict:
    resp = client.put(f"/agenda/services/{service_id}", json=body, headers=auth)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestEditarDiasDeServicio:
    def test_null_vacia_los_dias(self, client, auth, seed):
        body = put(client, auth, seed["service"].id, {"maintenance_days": None, "removal_days": None})
        assert body["maintenance_days"] is None
        assert body["removal_days"] is None

    def test_omitir_los_campos_los_conserva(self, client, auth, seed):
        body = put(client, auth, seed["service"].id, {"price": 160.0})
        assert body["price"] == 160.0
        assert body["maintenance_days"] == 21
        assert body["removal_days"] == 35

    def test_vaciar_uno_no_toca_el_otro(self, client, auth, seed):
        body = put(client, auth, seed["service"].id, {"maintenance_days": None})
        assert body["maintenance_days"] is None
        assert body["removal_days"] == 35

    def test_cambiar_los_dias(self, client, auth, seed):
        body = put(client, auth, seed["service"].id, {"maintenance_days": 18, "removal_days": 30})
        assert body["maintenance_days"] == 18
        assert body["removal_days"] == 30
