"""Alergias de la clienta (texto libre) — se registran al crear/editar y viajan con
el ticket (la cita) para el ticket impreso y la app de operarias.

  - se guardan al crear y se normalizan (espacios fuera; vacío = sin dato);
  - se pueden editar y borrar;
  - aparecen en la clienta de la cita (AppointmentResponse.client.allergies);
  - el límite de 500 caracteres se respeta.

Ejecutar:
  cd elashesbackend
  pytest tests/test_client_allergies.py -v
"""
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # register models only
from app.infrastructure.database import Base
from app.core.dependencies import get_db, get_current_active_user
from app.domain.entities.user import User, Role, Permission
from app.domain.entities.branch import Branch
from app.domain.entities.service_agenda import Appointment
from app.presentation.controllers import client_controller as clients
from app.presentation.controllers import service_agenda_controller as agenda


@pytest.fixture
def work():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    role = Role(name="Secretaria")
    role.permissions = [Permission(name=name) for name in (
        "clients:view", "clients:manage", "appointments:view", "appointments:manage")]
    branch = Branch(name="Probe Norte")
    db.add_all([role, branch])
    db.flush()
    user = User(username="probe_user", email="probe@example.com", hashed_password="unused",
                role=role, branch_id=branch.id, is_active=True)
    db.add(user)
    db.commit()
    app = FastAPI()
    app.include_router(clients.router)
    app.include_router(agenda.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: user
    with TestClient(app) as api:
        yield SimpleNamespace(api=api, db=db, branch=branch.id)
    db.close()
    engine.dispose()


def new_client(work, **extra):
    body = {"name": "Maria", "last_name": "Prueba", "branch_id": work.branch, **extra}
    response = work.api.post("/clients/", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_allergies_are_saved_and_trimmed_on_create(work):
    client = new_client(work, allergies="  Latex y pegamento con cianoacrilato  ")
    assert client["allergies"] == "Latex y pegamento con cianoacrilato"
    assert work.api.get(f"/clients/{client['id']}").json()["allergies"] == "Latex y pegamento con cianoacrilato"


def test_client_without_allergies_is_null(work):
    assert new_client(work)["allergies"] is None
    assert new_client(work, name="Ana", allergies="   ")["allergies"] is None


def test_allergies_can_be_edited_and_cleared(work):
    client = new_client(work, allergies="Latex")
    edited = work.api.put(f"/clients/{client['id']}", json={"allergies": "Latex y acrilatos"})
    assert edited.status_code == 200 and edited.json()["allergies"] == "Latex y acrilatos"

    # editar otro campo no borra las alergias
    other = work.api.put(f"/clients/{client['id']}", json={"age": 30})
    assert other.json()["allergies"] == "Latex y acrilatos"

    cleared = work.api.put(f"/clients/{client['id']}", json={"allergies": ""})
    assert cleared.status_code == 200 and cleared.json()["allergies"] is None


def test_allergies_limit_is_500_chars(work):
    body = {"name": "Maria", "last_name": "Prueba", "branch_id": work.branch, "allergies": "x" * 501}
    assert work.api.post("/clients/", json=body).status_code == 422
    assert new_client(work, name="Luz", allergies="x" * 500)["allergies"] == "x" * 500


def test_allergies_travel_with_the_ticket(work):
    client = new_client(work, allergies="Latex")
    start = datetime(2030, 1, 15, 10)
    created = work.api.post("/agenda/appointments", json={
        "client_id": client["id"], "branch_id": work.branch, "status": "pending",
        "start_time": start.isoformat(), "end_time": (start + timedelta(hours=1)).isoformat(),
    })
    assert created.status_code in (200, 201), created.text
    assert created.json()["client"]["allergies"] == "Latex"

    listed = work.api.get("/agenda/appointments", params={"branch_id": work.branch}).json()
    assert [a["client"]["allergies"] for a in listed] == ["Latex"]


def test_new_client_without_allergies_is_not_confirmed(work):
    client = new_client(work)
    assert client["allergies"] is None and client["allergies_confirmed"] is False
    assert new_client(work, name="Ana", allergies="   ")["allergies_confirmed"] is False


def test_writing_allergies_marks_them_confirmed(work):
    client = new_client(work, allergies="Latex")
    assert client["allergies_confirmed"] is True
    other = new_client(work, name="Luz")
    edited = work.api.put(f"/clients/{other['id']}", json={"allergies": "Acrilatos"})
    assert edited.json()["allergies_confirmed"] is True


def test_confirm_no_allergies_marks_checked(work):
    client = new_client(work)
    response = work.api.put(f"/clients/{client['id']}/allergies", json={"allergies": None})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["allergies"] is None and body["allergies_confirmed"] is True
    # editar otro dato no la vuelve a dejar sin confirmar
    assert work.api.put(f"/clients/{client['id']}", json={"age": 30}).json()["allergies_confirmed"] is True


def test_confirm_with_allergy_text(work):
    client = new_client(work)
    response = work.api.put(f"/clients/{client['id']}/allergies", json={"allergies": "  Latex  "})
    assert response.status_code == 200
    assert response.json()["allergies"] == "Latex" and response.json()["allergies_confirmed"] is True
    # vacío = "sin alergias": borra lo anterior y queda confirmado
    cleared = work.api.put(f"/clients/{client['id']}/allergies", json={"allergies": ""})
    assert cleared.json()["allergies"] is None and cleared.json()["allergies_confirmed"] is True


def test_confirm_unknown_client_is_404(work):
    assert work.api.put("/clients/9999/allergies", json={"allergies": None}).status_code == 404


def test_generic_counter_client_cannot_get_allergies(work):
    from app.application.services.client_service import get_or_create_generic_client
    generic = get_or_create_generic_client(db=work.db, branch_id=work.branch)
    assert work.api.get(f"/clients/{generic.id}").json()["is_generic"] is True
    response = work.api.put(f"/clients/{generic.id}/allergies", json={"allergies": "Latex"})
    assert response.status_code == 400
    work.db.expire_all()
    assert work.db.get(type(generic), generic.id).allergies is None


def test_confirmation_state_travels_with_the_ticket(work):
    client = new_client(work)
    start = datetime(2030, 1, 15, 10)
    body = {"client_id": client["id"], "branch_id": work.branch, "status": "pending",
            "start_time": start.isoformat(), "end_time": (start + timedelta(hours=1)).isoformat()}
    first = work.api.post("/agenda/appointments", json=body).json()["client"]
    assert first["allergies_confirmed"] is False and first["is_generic"] is False
    work.api.put(f"/clients/{client['id']}/allergies", json={"allergies": None})
    listed = work.api.get("/agenda/appointments", params={"branch_id": work.branch}).json()
    assert listed[0]["client"]["allergies_confirmed"] is True


# ── Alergias del ticket: mostrador solo en el ticket, registrada en su ficha ──────

def make_ticket(work, client_id, hour=10):
    start = datetime(2030, 1, 15, hour)
    response = work.api.post("/agenda/appointments", json={
        "client_id": client_id, "branch_id": work.branch, "status": "pending",
        "start_time": start.isoformat(), "end_time": (start + timedelta(hours=1)).isoformat(),
    })
    assert response.status_code in (200, 201), response.text
    return response.json()


def generic_client(work):
    from app.application.services.client_service import get_or_create_generic_client
    return get_or_create_generic_client(db=work.db, branch_id=work.branch)


def test_registered_client_ticket_allergies_save_to_the_profile(work):
    client = new_client(work)
    ticket = make_ticket(work, client["id"])
    assert ticket["ticket_allergies"] is None and ticket["ticket_allergies_confirmed"] is False

    response = work.api.put(f"/agenda/appointments/{ticket['id']}/allergies", json={"allergies": "Latex"})
    assert response.status_code == 200, response.text
    assert response.json()["ticket_allergies"] == "Latex" and response.json()["ticket_allergies_confirmed"] is True
    # quedó en la ficha: otro ticket de la misma clienta ya sale confirmado
    assert work.api.get(f"/clients/{client['id']}").json()["allergies"] == "Latex"
    other = make_ticket(work, client["id"], hour=12)
    assert other["ticket_allergies"] == "Latex" and other["ticket_allergies_confirmed"] is True


def test_counter_client_allergies_stay_on_the_ticket_only(work):
    generic = generic_client(work)
    first = make_ticket(work, generic.id)
    assert first["ticket_allergies_confirmed"] is False

    response = work.api.put(f"/agenda/appointments/{first['id']}/allergies", json={"allergies": "Pegamento"})
    assert response.status_code == 200, response.text
    assert response.json()["ticket_allergies"] == "Pegamento"
    assert response.json()["ticket_allergies_confirmed"] is True

    # la ficha compartida NO se tocó
    work.db.expire_all()
    from app.domain.entities.client import Client
    fresh = work.db.get(Client, generic.id)
    assert fresh.allergies is None and fresh.allergies_checked_at is None
    # el siguiente cliente de mostrador vuelve a empezar sin confirmar
    second = make_ticket(work, generic.id, hour=12)
    assert second["ticket_allergies"] is None and second["ticket_allergies_confirmed"] is False


def test_counter_client_can_confirm_no_allergies_for_that_ticket(work):
    generic = generic_client(work)
    ticket = make_ticket(work, generic.id)
    response = work.api.put(f"/agenda/appointments/{ticket['id']}/allergies", json={"allergies": None})
    assert response.status_code == 200
    assert response.json()["ticket_allergies"] is None and response.json()["ticket_allergies_confirmed"] is True


def test_ticket_allergies_unknown_ticket_is_404(work):
    assert work.api.put("/agenda/appointments/9999/allergies", json={"allergies": None}).status_code == 404


# ── Fecha de nacimiento ──────────────────────────────────────────────────────────

def test_birth_date_is_saved_and_age_is_derived(work):
    from datetime import date
    from app.presentation.schemas.client import today_la_paz
    birth = date(today_la_paz().year - 30, 1, 1)
    client = new_client(work, birth_date=birth.isoformat(), age=99)  # la edad escrita se ignora
    assert client["birth_date"] == birth.isoformat()
    assert client["age"] == 30
    assert work.api.get(f"/clients/{client['id']}").json()["age"] == 30


def test_age_counts_completed_years_only():
    from datetime import date
    from app.presentation.schemas.client import age_from_birth_date
    assert age_from_birth_date(date(2000, 6, 15), today=date(2026, 6, 14)) == 25   # falta un día
    assert age_from_birth_date(date(2000, 6, 15), today=date(2026, 6, 15)) == 26   # cumple hoy
    assert age_from_birth_date(date(2026, 1, 1), today=date(2026, 11, 13)) == 0     # bebé
    assert age_from_birth_date(date(2000, 2, 29), today=date(2026, 2, 28)) == 25    # bisiesto


def test_birth_date_cannot_be_in_the_future_or_over_100_years(work):
    from datetime import timedelta
    from app.presentation.schemas.client import today_la_paz
    base = {"name": "Maria", "last_name": "Prueba", "branch_id": work.branch}
    future = (today_la_paz() + timedelta(days=1)).isoformat()
    assert work.api.post("/clients/", json={**base, "birth_date": future}).status_code == 422
    assert work.api.post("/clients/", json={**base, "birth_date": "1900-01-01"}).status_code == 422
    assert work.api.post("/clients/", json={**base, "birth_date": "no-es-fecha"}).status_code == 422


def test_birth_date_can_be_edited_and_cleared(work):
    client = new_client(work)
    assert client["birth_date"] is None
    edited = work.api.put(f"/clients/{client['id']}", json={"birth_date": "1995-03-10"})
    assert edited.status_code == 200 and edited.json()["birth_date"] == "1995-03-10"
    # editar otro campo no la borra
    assert work.api.put(f"/clients/{client['id']}", json={"phone": "70000000"}).json()["birth_date"] == "1995-03-10"
    cleared = work.api.put(f"/clients/{client['id']}", json={"birth_date": None})
    assert cleared.status_code == 200 and cleared.json()["birth_date"] is None


def test_without_birth_date_the_typed_age_is_kept(work):
    assert new_client(work, age=41)["age"] == 41
