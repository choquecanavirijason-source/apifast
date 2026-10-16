"""
Vínculo cuenta marketplace ↔ ficha del salón (opción b: por email, sin verificar):
  - POST /clients/link-marketplace (X-Internal-Key): found / not_found / ambiguous;
  - POST /booking-public/appointments: ya no reutiliza homónimas por nombre,
    acepta salon_client_id (solo con X-Internal-Key) y devuelve client_id.

Ejecutar:
  cd elashesbackend
  pytest tests/test_link_marketplace.py -v
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # noqa: F401  (registra todos los modelos)
from app.config.settings import settings
from app.core import dependencies
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.service_agenda import Service, ServiceCategory
from app.infrastructure.database.base_class import Base
from app.presentation.controllers.client_controller import router as clients_router
from app.presentation.controllers.marketplace_booking_controller import router as booking_router

KEY = "clave-interna-de-prueba"
LINK_URL = "/clients/link-marketplace"
BOOK_URL = "/booking-public/appointments"


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def seed(db):
    branch = Branch(name="Salón Centro", address="Calle 1", city="LPZ", department="LP")
    category = ServiceCategory(name="Pestañas", is_mobile=False)
    db.add_all([branch, category])
    db.commit()
    service = Service(name="Extensiones", duration_minutes=60, price=150.0, category_id=category.id)
    ana = Client(name="Ana", last_name="Lopez", email="Ana@Test.com", phone="7712 3456", branch_id=branch.id)
    # Homónima de quien reserve como "Bea Perez": sin email ni teléfono propios.
    bea = Client(name="Bea", last_name="Perez", ci="2222")
    db.add_all([service, ana, bea])
    db.commit()
    return {"branch": branch, "service": service, "ana": ana, "bea": bea}


@pytest.fixture
def api(db, monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", KEY)
    app = FastAPI()
    app.include_router(clients_router)
    app.include_router(booking_router)
    app.dependency_overrides[dependencies.get_db] = lambda: db
    with TestClient(app) as c:
        yield c


def link(api: TestClient, key: str | None = KEY, **body):
    headers = {"X-Internal-Key": key} if key is not None else {}
    return api.post(LINK_URL, json=body, headers=headers)


def book(api: TestClient, seed: dict, key: str | None = None, hours_ahead: int = 24, **extra):
    start = (datetime.now() + timedelta(hours=hours_ahead)).replace(minute=0, second=0, microsecond=0)
    body = {
        "email": "nueva@test.com",
        "name": "Bea Perez",
        "service_id": seed["service"].id,
        "branch_id": seed["branch"].id,
        "start_iso": start.isoformat(),
        **extra,
    }
    headers = {"X-Internal-Key": key} if key is not None else {}
    return api.post(BOOK_URL, json=body, headers=headers)


class TestLinkMarketplace:
    def test_por_email_sin_distinguir_mayusculas(self, api, seed):
        resp = link(api, email="  ana@TEST.com ")
        assert resp.status_code == 200
        assert resp.json() == {"status": "found", "id": seed["ana"].id}

    def test_email_ambiguo_no_devuelve_id(self, api, seed, db):
        db.add(Client(name="Ana", last_name="Otra", email="ana@test.com"))
        db.commit()
        assert link(api, email="ana@test.com").json() == {"status": "ambiguous"}

    def test_email_ambiguo_no_cae_al_telefono(self, api, seed, db):
        db.add(Client(name="Ana", last_name="Otra", email="ana@test.com"))
        db.commit()
        resp = link(api, email="ana@test.com", phone="77123456")
        assert resp.json() == {"status": "ambiguous"}

    def test_por_telefono_normalizado_si_el_email_no_coincide(self, api, seed):
        for phone in ("77123456", "+591 7712-3456", "59177123456"):
            resp = link(api, email="otra@test.com", phone=phone)
            assert resp.json() == {"status": "found", "id": seed["ana"].id}, phone

    def test_telefono_ambiguo(self, api, seed, db):
        db.add(Client(name="Carla", last_name="Ruiz", phone="+59177123456"))
        db.commit()
        assert link(api, phone="77123456").json() == {"status": "ambiguous"}

    def test_not_found(self, api, seed):
        assert link(api, email="nadie@test.com", phone="70000000").json() == {"status": "not_found"}
        assert link(api).json() == {"status": "not_found"}

    def test_sin_clave_401(self, api, seed):
        assert link(api, key=None, email="ana@test.com").status_code == 401
        assert link(api, key="otra", email="ana@test.com").status_code == 401

    def test_sin_clave_configurada_503(self, api, seed, monkeypatch):
        monkeypatch.setattr(settings, "internal_api_key", None)
        assert link(api, email="ana@test.com").status_code == 503


class TestBookingSinVinculo:
    def test_no_reutiliza_homonima_por_nombre(self, api, seed, db):
        resp = book(api, seed)
        assert resp.status_code == 201, resp.text
        client_id = resp.json()["client_id"]
        assert client_id != seed["bea"].id
        db.refresh(seed["bea"])
        # la homónima del salón queda intacta
        assert seed["bea"].email is None
        assert db.get(Client, client_id).email == "nueva@test.com"

    def test_email_existente_reutiliza_la_ficha(self, api, seed):
        resp = book(api, seed, email="ANA@test.com", name="Ana Lopez")
        assert resp.status_code == 201, resp.text
        assert resp.json()["client_id"] == seed["ana"].id


class TestBookingConSalonClientId:
    def test_tiene_prioridad_sobre_el_email(self, api, seed, db):
        resp = book(api, seed, key=KEY, salon_client_id=seed["bea"].id, phone="70011223")
        assert resp.status_code == 201, resp.text
        assert resp.json()["client_id"] == seed["bea"].id
        db.refresh(seed["bea"])
        # no se le escribe el email de la cuenta; sí se completa sucursal y teléfono
        assert seed["bea"].email is None
        assert seed["bea"].branch_id == seed["branch"].id
        assert seed["bea"].phone == "70011223"
        assert db.query(Client).filter(Client.email == "nueva@test.com").count() == 0

    def test_sin_clave_401(self, api, seed):
        assert book(api, seed, salon_client_id=seed["bea"].id).status_code == 401
        assert book(api, seed, key="otra", salon_client_id=seed["bea"].id).status_code == 401

    def test_ficha_inexistente_404(self, api, seed):
        assert book(api, seed, key=KEY, salon_client_id=99999).status_code == 404
