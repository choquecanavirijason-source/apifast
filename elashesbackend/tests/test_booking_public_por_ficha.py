"""
GET /booking-public/my-appointments, /ws-ticket y /pending-reminders con
salon_client_id (ficha ya vinculada): exige X-Internal-Key, busca por id e
ignora el email. Sin salon_client_id, todo sigue buscando por email.

Ejecutar:
  cd elashesbackend
  pytest tests/test_booking_public_por_ficha.py -v
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
from app.domain.entities.service_agenda import Appointment
from app.domain.entities.tracking import Tracking
from app.infrastructure.database.base_class import Base
from app.infrastructure.security.jwt import decode_token
from app.presentation.controllers.marketplace_booking_controller import router

KEY = "clave-interna-de-prueba"


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
    ana = Client(name="Ana", last_name="Lopez", email="ana@test.com")
    # Sin email: solo se la puede encontrar por id (vinculada por teléfono).
    bea = Client(name="Bea", last_name="Perez")
    db.add_all([branch, ana, bea])
    db.commit()
    start = datetime(2026, 12, 1, 10, 0)
    for client in (ana, bea):
        db.add(Appointment(
            client_id=client.id, branch_id=branch.id, start_time=start,
            end_time=start + timedelta(hours=1), status="pending",
        ))
        db.add(Tracking(
            client_id=client.id, branch_id=branch.id,
            next_maintenance_date=datetime(2026, 12, 20), maintenance_reminder_sent=True,
        ))
    db.commit()
    return {"ana": ana, "bea": bea}


@pytest.fixture
def api(db, monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", KEY)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[dependencies.get_db] = lambda: db
    with TestClient(app) as c:
        yield c


def get(api: TestClient, path: str, key: str | None = None, **params):
    headers = {"X-Internal-Key": key} if key is not None else {}
    return api.get(f"/booking-public/{path}", params=params, headers=headers)


def appt_ids(resp) -> set[int]:
    """ids de las citas devueltas."""
    return {a["id"] for a in resp.json()}


class TestMyAppointments:
    def test_id_con_clave(self, api, seed, db):
        resp = get(api, "my-appointments", key=KEY, email="x@test.com", salon_client_id=seed["bea"].id)
        assert resp.status_code == 200
        bea_appt = db.query(Appointment).filter(Appointment.client_id == seed["bea"].id).one()
        assert appt_ids(resp) == {bea_appt.id}

    def test_id_sin_clave_401(self, api, seed):
        assert get(api, "my-appointments", email="x@test.com", salon_client_id=seed["bea"].id).status_code == 401
        resp = get(api, "my-appointments", key="otra", email="x@test.com", salon_client_id=seed["bea"].id)
        assert resp.status_code == 401

    def test_id_inexistente_404(self, api, seed):
        resp = get(api, "my-appointments", key=KEY, email="ana@test.com", salon_client_id=99999)
        assert resp.status_code == 404
        assert resp.json() == {"detail": "Cliente no encontrado"}

    def test_solo_email_sin_cambios(self, api, seed, db):
        resp = get(api, "my-appointments", email="ANA@test.com")
        ana_appt = db.query(Appointment).filter(Appointment.client_id == seed["ana"].id).one()
        assert resp.status_code == 200 and appt_ids(resp) == {ana_appt.id}
        assert get(api, "my-appointments", email="nadie@test.com").json() == []

    def test_id_y_email_de_otra_clienta_manda_el_id(self, api, seed, db):
        resp = get(api, "my-appointments", key=KEY, email="ana@test.com", salon_client_id=seed["bea"].id)
        bea_appt = db.query(Appointment).filter(Appointment.client_id == seed["bea"].id).one()
        assert appt_ids(resp) == {bea_appt.id}

    def test_email_sigue_siendo_obligatorio(self, api, seed):
        assert get(api, "my-appointments", key=KEY, salon_client_id=seed["bea"].id).status_code == 422

    def test_sin_clave_configurada_503(self, api, seed, monkeypatch):
        monkeypatch.setattr(settings, "internal_api_key", None)
        resp = get(api, "my-appointments", key=KEY, email="x@test.com", salon_client_id=seed["bea"].id)
        assert resp.status_code == 503


class TestWsTicket:
    def test_id_con_clave_emite_token_de_esa_ficha(self, api, seed):
        resp = get(api, "ws-ticket", key=KEY, email="ana@test.com", salon_client_id=seed["bea"].id)
        assert resp.status_code == 200
        assert resp.json()["client_id"] == seed["bea"].id
        assert decode_token(resp.json()["token"])["sub"] == f"client:{seed['bea'].id}"

    def test_id_sin_clave_401(self, api, seed):
        assert get(api, "ws-ticket", email="ana@test.com", salon_client_id=seed["bea"].id).status_code == 401

    def test_id_inexistente_404(self, api, seed):
        assert get(api, "ws-ticket", key=KEY, email="ana@test.com", salon_client_id=99999).status_code == 404

    def test_solo_email_sin_cambios(self, api, seed):
        assert get(api, "ws-ticket", email="ana@test.com").json()["client_id"] == seed["ana"].id
        assert get(api, "ws-ticket", email="nadie@test.com").status_code == 404


class TestPendingReminders:
    def test_id_con_clave_manda_sobre_el_email(self, api, seed, db):
        resp = get(api, "pending-reminders", key=KEY, email="ana@test.com", salon_client_id=seed["bea"].id)
        assert resp.status_code == 200
        bea_tracking = db.query(Tracking).filter(Tracking.client_id == seed["bea"].id).one()
        assert [r["tracking_id"] for r in resp.json()] == [bea_tracking.id]

    def test_id_sin_clave_401(self, api, seed):
        resp = get(api, "pending-reminders", email="ana@test.com", salon_client_id=seed["bea"].id)
        assert resp.status_code == 401

    def test_id_inexistente_404(self, api, seed):
        resp = get(api, "pending-reminders", key=KEY, email="ana@test.com", salon_client_id=99999)
        assert resp.status_code == 404

    def test_solo_email_sin_cambios(self, api, seed, db):
        ana_tracking = db.query(Tracking).filter(Tracking.client_id == seed["ana"].id).one()
        resp = get(api, "pending-reminders", email="ana@test.com")
        assert [r["tracking_id"] for r in resp.json()] == [ana_tracking.id]
        assert get(api, "pending-reminders", email="nadie@test.com").json() == []
