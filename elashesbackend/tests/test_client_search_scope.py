"""El buscador de clientas para agendar/cobrar NO se limita por sucursal.

Pasó que una clienta registrada desde el marketplace en otra sucursal no aparecía al
agendarla o cobrarla porque la búsqueda se acotaba a la sucursal de la cajera.
Estas pruebas fijan el comportamiento: quien atiende encuentra a cualquier clienta,
sin importar su sucursal ni si le falta el apellido.

(La pantalla de gestión "Clientas" SÍ se acota por sucursal en roles de una sola
sucursal: es política de esa pantalla y no se toca aquí.)

Ejecutar:
  cd elashesbackend
  pytest tests/test_client_search_scope.py -v
"""
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
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.user import User, Role, Permission
from app.presentation.controllers import client_controller as clients
from app.presentation.controllers import service_agenda_controller as agenda


@pytest.fixture
def work():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    role = Role(name="Cajera")  # rol acotado a su sucursal
    role.permissions = [Permission(name=name) for name in (
        "clients:view", "clients:manage", "appointments:view", "appointments:manage", "payments:view")]
    own, other = Branch(name="Probe Principal"), Branch(name="Probe Norte")
    db.add_all([role, own, other])
    db.flush()
    user = User(username="probe_cashier", email="probe@example.com", hashed_password="unused",
                role=role, branch_id=own.id, is_active=True)
    db.add_all([
        user,
        Client(name="Laura", last_name="Propia", phone="70000001", branch_id=own.id),
        Client(name="Claudia", last_name="Vidaurre", phone="70000002", branch_id=own.id),
        # registrada desde el marketplace en OTRA sucursal, solo con nombre (sin apellido)
        Client(name="claudia", last_name="", phone="70000003", branch_id=other.id),
        Client(name="Sin", last_name="Sucursal", phone="70000004", branch_id=None),
    ])
    db.commit()
    app = FastAPI()
    app.include_router(agenda.router)
    app.include_router(clients.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: user
    with TestClient(app) as api:
        yield SimpleNamespace(api=api, own=own.id, other=other.id)
    db.close()
    engine.dispose()


def names(response):
    assert response.status_code == 200, response.text
    return sorted(f"{c['nombre']} {c['apellido']}".strip() for c in response.json())


def test_search_without_branch_finds_clients_of_every_branch(work):
    found = names(work.api.get("/agenda/clients-for-select", params={"search": "cla"}))
    assert found == ["Claudia Vidaurre", "claudia"]


def test_client_from_another_branch_without_last_name_is_found(work):
    assert names(work.api.get("/agenda/clients-for-select", params={"search": "claudia"})) == [
        "Claudia Vidaurre", "claudia",
    ]


def test_search_by_phone_crosses_branches(work):
    assert names(work.api.get("/agenda/clients-for-select", params={"search": "70000003"})) == ["claudia"]


def test_client_without_branch_is_found(work):
    assert names(work.api.get("/agenda/clients-for-select", params={"search": "sucursal"})) == ["Sin Sucursal"]


def test_list_without_search_includes_every_branch(work):
    assert len(names(work.api.get("/agenda/clients-for-select", params={"limit": 50}))) == 4


def test_clients_screen_lists_every_branch_even_for_a_single_branch_role(work):
    response = work.api.get("/clients/", params={"limit": 50})
    assert response.status_code == 200, response.text
    assert len(response.json()) == 4


def test_clients_screen_branch_is_only_an_optional_filter(work):
    response = work.api.get("/clients/", params={"limit": 50, "branch_id": work.other})
    assert response.status_code == 200
    assert [c["name"] for c in response.json()] == ["claudia"]
