"""
Tests de integración para el endpoint /agenda/appointments.

Usa SQLite en memoria + TestClient para no tocar la base de datos real.
Cada test arranca con un estado limpio (fixtures crean los datos mínimos).

Ejecutar:
  cd elashesbackend
  pytest tests/test_appointments.py -v
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from main import app
from app.infrastructure.database.session import get_db
from app.infrastructure.security import get_password_hash
from app.domain.entities.user import User, Role, Permission, role_permissions
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.service_agenda import Service, ServiceCategory, Appointment
from app.infrastructure.database.base_class import Base


# ── Setup de base de datos en memoria ────────────────────────────────────────

SQLITE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    """Crea todas las tablas antes de cada test y las elimina al terminar."""
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
    """TestClient con override de la sesión de base de datos."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ── Fixtures de datos mínimos ────────────────────────────────────────────────

def _make_permissions(db: Session) -> dict[str, Permission]:
    names = [
        "appointments:view", "appointments:manage",
        "clients:view", "clients:manage",
        "services:view", "services:manage",
        "branches:view",
    ]
    perms = {}
    for name in names:
        p = Permission(name=name)
        db.add(p)
        db.flush()
        perms[name] = p
    return perms


def _make_operaria_role(db: Session, perms: dict) -> Role:
    role = Role(name="Operaria")
    db.add(role)
    db.flush()
    role.permissions = list(perms.values())
    return role


@pytest.fixture
def seed(db: Session) -> dict:
    """
    Crea en la DB de prueba:
      - 1 branch
      - 1 rol Operaria con permisos mínimos
      - 2 operarias (op1 / op2)
      - 1 clienta
      - 1 servicio
    Devuelve un dict con los objetos y tokens JWT para autenticar.
    """
    perms = _make_permissions(db)
    role = _make_operaria_role(db, perms)

    branch = Branch(name="Sucursal Test", address="Calle 1", city="SCZ", department="SC")
    db.add(branch)
    db.flush()

    op1 = User(
        username="op_test1",
        email="op1@test.com",
        phone="+59199000001",
        hashed_password=get_password_hash("test1234"),
        is_active=True,
        role_id=role.id,
        branch_id=branch.id,
        skill_level=4,
    )
    op2 = User(
        username="op_test2",
        email="op2@test.com",
        phone="+59199000002",
        hashed_password=get_password_hash("test1234"),
        is_active=True,
        role_id=role.id,
        branch_id=branch.id,
        skill_level=3,
    )
    db.add_all([op1, op2])
    db.flush()

    clienta = Client(name="Laura", last_name="Test", age=25, branch_id=branch.id)
    db.add(clienta)
    db.flush()

    category = ServiceCategory(name="Extensiones", is_mobile=False)
    db.add(category)
    db.flush()

    servicio = Service(
        name="Extensiones Clásicas",
        duration_minutes=60,
        price=150.0,
        category_id=category.id,
    )
    db.add(servicio)
    db.flush()

    db.commit()
    return {
        "branch": branch,
        "role": role,
        "op1": op1,
        "op2": op2,
        "client": clienta,
        "service": servicio,
    }


def _get_token(client: TestClient, username: str, password: str = "test1234") -> str:
    resp = client.post("/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login falló: {resp.text}"
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Helpers de tiempo ─────────────────────────────────────────────────────────

def _now_plus(minutes: int) -> str:
    dt = datetime.now() + timedelta(minutes=minutes)
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def _yesterday_iso() -> str:
    dt = datetime.now() - timedelta(days=1)
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestListarAppointments:
    def test_lista_vacia_sin_datos(self, client: TestClient, seed: dict):
        token = _get_token(client, "op_test1")
        resp = client.get("/agenda/appointments", headers=_auth(token))
        assert resp.status_code == 200
        assert resp.json() == []

    def test_lista_con_filtro_professional_id(self, client: TestClient, seed: dict, db: Session):
        op1 = seed["op1"]
        clienta = seed["client"]
        servicio = seed["service"]
        branch = seed["branch"]

        appt = Appointment(
            client_id=clienta.id,
            professional_id=op1.id,
            service_id=servicio.id,
            branch_id=branch.id,
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1),
            status="pending",
        )
        db.add(appt)
        db.commit()

        token = _get_token(client, "op_test1")
        resp = client.get(
            f"/agenda/appointments?professional_id={op1.id}",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["professional_id"] == op1.id


class TestCrearAppointment:
    def test_crea_appointment_pendiente(self, client: TestClient, seed: dict):
        token = _get_token(client, "op_test1")
        payload = {
            "client_id": seed["client"].id,
            "professional_id": seed["op1"].id,
            "service_id": seed["service"].id,
            "branch_id": seed["branch"].id,
            "start_time": _now_plus(10),
            "end_time": _now_plus(70),
            "status": "pending",
        }
        resp = client.post("/agenda/appointments", json=payload, headers=_auth(token))
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "pending"
        assert data["client_id"] == seed["client"].id

    def test_rechaza_sin_cliente(self, client: TestClient, seed: dict):
        token = _get_token(client, "op_test1")
        payload = {
            "professional_id": seed["op1"].id,
            "service_id": seed["service"].id,
            "branch_id": seed["branch"].id,
            "start_time": _now_plus(10),
            "end_time": _now_plus(70),
            "status": "pending",
        }
        resp = client.post("/agenda/appointments", json=payload, headers=_auth(token))
        assert resp.status_code == 422


class TestIniciarAtencion:
    def test_inicia_atencion_sin_conflicto(self, client: TestClient, seed: dict, db: Session):
        """Una operaria sin servicios activos puede iniciar atención."""
        op1 = seed["op1"]
        appt = Appointment(
            client_id=seed["client"].id,
            professional_id=op1.id,
            service_id=seed["service"].id,
            branch_id=seed["branch"].id,
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1),
            status="pending",
        )
        db.add(appt)
        db.commit()

        token = _get_token(client, "op_test1")
        resp = client.put(
            f"/agenda/appointments/{appt.id}",
            json={"status": "in_service"},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_service"

    def test_bloquea_segunda_atencion_misma_operaria_hoy(
        self, client: TestClient, seed: dict, db: Session
    ):
        """
        Si una operaria ya tiene un ticket 'in_service' de HOY,
        no puede iniciar otro.
        """
        op1 = seed["op1"]
        clienta = seed["client"]
        servicio = seed["service"]
        branch = seed["branch"]

        appt_en_servicio = Appointment(
            client_id=clienta.id,
            professional_id=op1.id,
            service_id=servicio.id,
            branch_id=branch.id,
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1),
            status="in_service",
        )
        appt_nuevo = Appointment(
            client_id=clienta.id,
            professional_id=op1.id,
            service_id=servicio.id,
            branch_id=branch.id,
            start_time=datetime.now() + timedelta(hours=2),
            end_time=datetime.now() + timedelta(hours=3),
            status="pending",
        )
        db.add_all([appt_en_servicio, appt_nuevo])
        db.commit()

        token = _get_token(client, "op_test1")
        resp = client.put(
            f"/agenda/appointments/{appt_nuevo.id}",
            json={"status": "in_service"},
            headers=_auth(token),
        )
        assert resp.status_code == 409
        assert "en curso" in resp.json()["detail"]

    def test_permite_atencion_si_conflicto_es_de_ayer(
        self, client: TestClient, seed: dict, db: Session
    ):
        """
        BUG FIX: un ticket 'in_service' de un día anterior NO debe bloquear
        nuevas atenciones de hoy.
        """
        op1 = seed["op1"]
        clienta = seed["client"]
        servicio = seed["service"]
        branch = seed["branch"]

        # Ticket de ayer que quedó colgado en in_service
        yesterday = datetime.now() - timedelta(days=1)
        appt_viejo = Appointment(
            client_id=clienta.id,
            professional_id=op1.id,
            service_id=servicio.id,
            branch_id=branch.id,
            start_time=yesterday,
            end_time=yesterday + timedelta(hours=1),
            status="in_service",
        )
        # Ticket nuevo de hoy
        appt_hoy = Appointment(
            client_id=clienta.id,
            professional_id=op1.id,
            service_id=servicio.id,
            branch_id=branch.id,
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1),
            status="pending",
        )
        db.add_all([appt_viejo, appt_hoy])
        db.commit()

        token = _get_token(client, "op_test1")
        resp = client.put(
            f"/agenda/appointments/{appt_hoy.id}",
            json={"status": "in_service"},
            headers=_auth(token),
        )
        # Con el fix aplicado debe ser 200, no 409
        assert resp.status_code == 200, (
            f"El ticket del día anterior no debe bloquear: {resp.json()}"
        )
        assert resp.json()["status"] == "in_service"

    def test_operarias_distintas_pueden_estar_en_servicio_a_la_vez(
        self, client: TestClient, seed: dict, db: Session
    ):
        """Dos operarias distintas pueden tener tickets in_service simultáneamente."""
        op1, op2 = seed["op1"], seed["op2"]
        clienta = seed["client"]
        servicio = seed["service"]
        branch = seed["branch"]

        appt_op1 = Appointment(
            client_id=clienta.id,
            professional_id=op1.id,
            service_id=servicio.id,
            branch_id=branch.id,
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1),
            status="in_service",
        )
        appt_op2 = Appointment(
            client_id=clienta.id,
            professional_id=op2.id,
            service_id=servicio.id,
            branch_id=branch.id,
            start_time=datetime.now() + timedelta(hours=1),
            end_time=datetime.now() + timedelta(hours=2),
            status="pending",
        )
        db.add_all([appt_op1, appt_op2])
        db.commit()

        token = _get_token(client, "op_test2")
        resp = client.put(
            f"/agenda/appointments/{appt_op2.id}",
            json={"status": "in_service"},
            headers=_auth(token),
        )
        assert resp.status_code == 200


class TestCompletarAppointment:
    def test_completa_appointment_en_servicio(
        self, client: TestClient, seed: dict, db: Session
    ):
        op1 = seed["op1"]
        appt = Appointment(
            client_id=seed["client"].id,
            professional_id=op1.id,
            service_id=seed["service"].id,
            branch_id=seed["branch"].id,
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1),
            status="in_service",
        )
        db.add(appt)
        db.commit()

        token = _get_token(client, "op_test1")
        resp = client.put(
            f"/agenda/appointments/{appt.id}",
            json={"status": "completed"},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    def test_despues_de_completar_puede_iniciar_nuevo(
        self, client: TestClient, seed: dict, db: Session
    ):
        """Después de completar un servicio la operaria puede iniciar otro."""
        op1 = seed["op1"]
        clienta = seed["client"]
        servicio = seed["service"]
        branch = seed["branch"]

        appt_completado = Appointment(
            client_id=clienta.id,
            professional_id=op1.id,
            service_id=servicio.id,
            branch_id=branch.id,
            start_time=datetime.now() - timedelta(hours=2),
            end_time=datetime.now() - timedelta(hours=1),
            status="completed",
        )
        appt_nuevo = Appointment(
            client_id=clienta.id,
            professional_id=op1.id,
            service_id=servicio.id,
            branch_id=branch.id,
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1),
            status="pending",
        )
        db.add_all([appt_completado, appt_nuevo])
        db.commit()

        token = _get_token(client, "op_test1")
        resp = client.put(
            f"/agenda/appointments/{appt_nuevo.id}",
            json={"status": "in_service"},
            headers=_auth(token),
        )
        assert resp.status_code == 200


class TestEliminarAppointment:
    def test_elimina_appointment_existente(
        self, client: TestClient, seed: dict, db: Session
    ):
        appt = Appointment(
            client_id=seed["client"].id,
            professional_id=seed["op1"].id,
            service_id=seed["service"].id,
            branch_id=seed["branch"].id,
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(hours=1),
            status="pending",
        )
        db.add(appt)
        db.commit()

        token = _get_token(client, "op_test1")
        resp = client.delete(f"/agenda/appointments/{appt.id}", headers=_auth(token))
        assert resp.status_code in (200, 204)

    def test_eliminar_no_existente_retorna_404(self, client: TestClient, seed: dict):
        token = _get_token(client, "op_test1")
        resp = client.delete("/agenda/appointments/99999", headers=_auth(token))
        assert resp.status_code == 404
