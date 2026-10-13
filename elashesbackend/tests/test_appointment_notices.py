"""
Tests de los avisos programados de citas (reglas de ventanas, tokens de
dispositivo y endpoints).

SQLite en memoria; el router se monta en una app mínima para no depender de
main.py ni de la bandera client_notices_enabled.

Ejecutar:
  cd elashesbackend
  pytest tests/test_appointment_notices.py -v
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # noqa: F401  (registra todos los modelos)
from app.application.services.appointment_notice_service import (
    LA_PAZ,
    compute_notices,
    get_scheduled_notices,
    make_aviso_id,
)
from app.config.settings import settings
from app.core import dependencies
from app.core.rate_limit import _attempts
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.client_device import ClientDevice
from app.domain.entities.service_agenda import (
    Appointment,
    AppointmentService,
    Service,
    ServiceCategory,
)
from app.infrastructure.database.base_class import Base
from app.presentation.controllers.device_notices_controller import router

INTERNAL_KEY = "clave-interna-de-prueba"


# ── Helpers de tiempo ────────────────────────────────────────────────────────

def local(y, m, d, hh=0, mm=0) -> datetime:
    """Hora de La Paz, naive (como se guarda appointments.start_time)."""
    return datetime(y, m, d, hh, mm)


def utc_naive(dt_local: datetime) -> datetime:
    """Hora local naive de La Paz -> UTC naive (como se guarda created_at)."""
    return dt_local.replace(tzinfo=LA_PAZ).astimezone(timezone.utc).replace(tzinfo=None)


def now_at(dt_local: datetime) -> datetime:
    """'Ahora' como instante UTC aware a partir de una hora local de La Paz."""
    return dt_local.replace(tzinfo=LA_PAZ).astimezone(timezone.utc)


LONG_AGO = utc_naive(local(2026, 10, 1, 9, 0))


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    # FK activas (como en session.py) para que actúe ON DELETE CASCADE
    event.listen(eng, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture
def db(engine) -> Session:
    session = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def seed(db: Session) -> dict:
    branch = Branch(name="Salón Centro", address="Calle 1", city="LPZ", department="LP")
    db.add(branch)
    db.flush()
    ana = Client(name="Ana", last_name="Lopez", branch_id=branch.id)
    bea = Client(name="Bea", last_name="Perez", branch_id=branch.id)
    category = ServiceCategory(name="Pestañas", is_mobile=False)
    db.add_all([ana, bea, category])
    db.flush()
    ext = Service(name="Extensiones de pestañas", duration_minutes=90, price=150.0, category_id=category.id)
    retoque = Service(name="Retoque", duration_minutes=30, price=50.0, category_id=category.id)
    db.add_all([ext, retoque])
    db.commit()
    return {"branch": branch, "ana": ana, "bea": bea, "ext": ext, "retoque": retoque}


def add_appointment(
    db: Session,
    seed: dict,
    start: datetime,
    *,
    client: str = "ana",
    created_at: datetime = LONG_AGO,
    status: str = "pending",
    services: tuple[str, ...] = ("ext",),
) -> Appointment:
    appt = Appointment(
        client_id=seed[client].id,
        branch_id=seed["branch"].id,
        # service_id distinto a propósito: el nombre debe salir de appointment_services
        service_id=seed["retoque"].id,
        start_time=start,
        end_time=start + timedelta(hours=1),
        status=status,
        created_at=created_at,
    )
    db.add(appt)
    db.flush()
    for order, key in enumerate(services):
        db.add(AppointmentService(appointment_id=appt.id, service_id=seed[key].id, sort_order=order))
    db.commit()
    return appt


def tipos(result: dict) -> list[str]:
    return [a["tipo"] for a in result["avisos"]]


# ── Reglas de ventanas (función pura) ────────────────────────────────────────

class TestReglasDeVentanas:
    def test_cita_10_00_hoy_desde_las_8_hasta_9_30(self):
        manana, hoy = compute_notices(local(2026, 10, 14, 10, 0), LONG_AGO)
        assert manana.tipo == "manana"
        assert manana.mostrar_en.isoformat() == "2026-10-13T18:00:00-04:00"
        assert manana.expira_en.isoformat() == "2026-10-14T00:00:00-04:00"
        assert hoy.tipo == "hoy"
        assert hoy.mostrar_en.isoformat() == "2026-10-14T08:00:00-04:00"  # 07:00 -> no antes de las 8
        assert hoy.expira_en.isoformat() == "2026-10-14T09:30:00-04:00"

    def test_cita_tarde_hoy_sale_3_horas_antes(self):
        _, hoy = compute_notices(local(2026, 10, 14, 15, 0), LONG_AGO)
        assert hoy.mostrar_en.isoformat() == "2026-10-14T12:00:00-04:00"
        assert hoy.expira_en.isoformat() == "2026-10-14T14:30:00-04:00"

    def test_cita_8_15_solo_aviso_manana(self):
        # mostrar_en = 08:00, a 15 min de la cita (< 30 min): sin aviso "hoy"
        avisos = compute_notices(local(2026, 10, 14, 8, 15), LONG_AGO)
        assert [a.tipo for a in avisos] == ["manana"]

    def test_cita_8_30_justo_en_el_limite_si_tiene_aviso_hoy(self):
        avisos = compute_notices(local(2026, 10, 14, 8, 30), LONG_AGO)
        assert [a.tipo for a in avisos] == ["manana", "hoy"]

    def test_cita_agendada_a_ultimo_momento_sin_aviso_hoy(self):
        start = local(2026, 10, 14, 15, 0)
        created_2h_antes = utc_naive(local(2026, 10, 14, 13, 0))
        assert [a.tipo for a in compute_notices(start, created_2h_antes)] == ["manana"]

    def test_cita_agendada_justo_3_horas_antes_si_tiene_aviso_hoy(self):
        start = local(2026, 10, 14, 15, 0)
        created_3h_antes = utc_naive(local(2026, 10, 14, 12, 0))
        assert [a.tipo for a in compute_notices(start, created_3h_antes)] == ["manana", "hoy"]

    def test_aviso_id_deterministico_de_31_bits(self):
        start = local(2026, 10, 14, 10, 0)
        a = make_aviso_id(7, "manana", start)
        assert a == make_aviso_id(7, "manana", start)
        assert 0 <= a <= 0x7FFFFFFF
        assert a != make_aviso_id(7, "hoy", start)
        assert a != make_aviso_id(8, "manana", start)


# ── Avisos programados contra la BD ──────────────────────────────────────────

class TestAvisosProgramados:
    def test_estructura_titulo_cuerpo_y_offsets(self, db, seed):
        appt = add_appointment(db, seed, local(2026, 10, 14, 10, 0), services=("ext", "retoque"))
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 13, 12, 0)))

        assert result["generado_en"] == "2026-10-13T12:00:00-04:00"
        assert tipos(result) == ["manana", "hoy"]  # orden por mostrar_en
        manana = result["avisos"][0]
        assert set(manana) == {
            "aviso_id", "cita_id", "tipo", "mostrar_en", "expira_en", "titulo", "cuerpo"
        }
        assert manana["cita_id"] == appt.id
        assert manana["mostrar_en"].endswith("-04:00") and manana["expira_en"].endswith("-04:00")
        assert manana["aviso_id"] == make_aviso_id(appt.id, "manana", appt.start_time)
        # Servicios desde appointment_services (no appointments.service_id) y el salón desde branches
        assert "Extensiones de pestañas, Retoque" in manana["cuerpo"]
        assert "Salón Centro" in manana["cuerpo"]
        assert "10:00" in manana["cuerpo"]

    def test_cita_8_15(self, db, seed):
        add_appointment(db, seed, local(2026, 10, 14, 8, 15))
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 13, 12, 0)))
        assert tipos(result) == ["manana"]

    def test_cita_agendada_a_ultimo_momento(self, db, seed):
        add_appointment(
            db, seed, local(2026, 10, 14, 15, 0), created_at=utc_naive(local(2026, 10, 14, 13, 30))
        )
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 14, 13, 45)))
        assert "hoy" not in tipos(result)

    def test_cita_cancelada_se_ignora(self, db, seed):
        add_appointment(db, seed, local(2026, 10, 14, 10, 0), status="cancelled")
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 13, 12, 0)))
        assert result["avisos"] == []

    def test_cita_reprogramada_cambia_aviso_id(self, db, seed):
        appt = add_appointment(db, seed, local(2026, 10, 14, 10, 0))
        now = now_at(local(2026, 10, 13, 12, 0))
        antes = {a["tipo"]: a["aviso_id"] for a in get_scheduled_notices(db, seed["ana"].id, now)["avisos"]}

        appt.start_time = local(2026, 10, 14, 16, 0)
        db.commit()
        despues = get_scheduled_notices(db, seed["ana"].id, now)["avisos"]

        assert {a["cita_id"] for a in despues} == {appt.id}
        assert {a["tipo"] for a in despues} == {"manana", "hoy"}
        for aviso in despues:
            assert aviso["aviso_id"] != antes[aviso["tipo"]]

    def test_solo_avisos_de_la_clienta(self, db, seed):
        add_appointment(db, seed, local(2026, 10, 14, 10, 0), client="bea")
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 13, 12, 0)))
        assert result["avisos"] == []

    def test_aviso_vigente_con_hora_pasada_se_muestra_al_sincronizar(self, db, seed):
        add_appointment(db, seed, local(2026, 10, 14, 10, 0))
        # 08:30 del día de la cita: "hoy" ya pasó su mostrar_en (08:00) pero vale hasta 09:30
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 14, 8, 30)))
        assert tipos(result) == ["hoy"]

    def test_aviso_expirado_no_se_devuelve(self, db, seed):
        add_appointment(db, seed, local(2026, 10, 14, 10, 0))
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 14, 9, 45)))
        assert result["avisos"] == []

    def test_fuera_de_las_proximas_48_horas(self, db, seed):
        add_appointment(db, seed, local(2026, 10, 20, 10, 0))
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 13, 12, 0)))
        assert result["avisos"] == []

    def test_cambio_de_dia_despues_de_las_20_utc(self, db, seed):
        # 02:00 UTC del 14 = 22:00 del 13 en La Paz: la cita del 14 sigue siendo "mañana".
        add_appointment(db, seed, local(2026, 10, 14, 10, 0))
        now = datetime(2026, 10, 14, 2, 0, tzinfo=timezone.utc)
        result = get_scheduled_notices(db, seed["ana"].id, now)

        assert result["generado_en"] == "2026-10-13T22:00:00-04:00"
        manana = next(a for a in result["avisos"] if a["tipo"] == "manana")
        assert manana["mostrar_en"] == "2026-10-13T18:00:00-04:00"
        assert manana["expira_en"] == "2026-10-14T00:00:00-04:00"

    def test_a_las_20_utc_aun_es_la_misma_tarde_en_la_paz(self, db, seed):
        # 20:30 UTC del 13 = 16:30 del 13 en La Paz; el "mañana" de la cita del 14 sale a las 18:00.
        add_appointment(db, seed, local(2026, 10, 14, 10, 0))
        now = datetime(2026, 10, 13, 20, 30, tzinfo=timezone.utc)
        manana = next(
            a for a in get_scheduled_notices(db, seed["ana"].id, now)["avisos"] if a["tipo"] == "manana"
        )
        assert manana["mostrar_en"] == "2026-10-13T18:00:00-04:00"


# ── Dispositivos y endpoints ─────────────────────────────────────────────────

@pytest.fixture
def api(db, seed, monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", INTERNAL_KEY)
    _attempts.clear()
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[dependencies.get_db] = lambda: db
    with TestClient(app) as c:
        yield c


def register(api: TestClient, client_id: int, installation_id="install-0001", key=INTERNAL_KEY):
    headers = {"X-Internal-Key": key} if key is not None else {}
    return api.post(
        "/dispositivos",
        json={"client_id": client_id, "installation_id": installation_id, "platform": "android"},
        headers=headers,
    )


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestDispositivos:
    def test_registro_requiere_clave_interna(self, api, seed):
        assert register(api, seed["ana"].id, key=None).status_code == 401
        assert register(api, seed["ana"].id, key="otra").status_code == 401

    def test_rate_limit_solo_cuenta_claves_incorrectas(self, api, seed):
        # Muchas llamadas válidas desde la misma IP nunca se limitan
        for i in range(15):
            assert register(api, seed["ana"].id, installation_id=f"install-{i:04d}").status_code == 201
        # Los intentos con clave mala sí se frenan (10 por minuto) ...
        codes = [register(api, seed["ana"].id, key="mala").status_code for _ in range(11)]
        assert codes[:10] == [401] * 10 and codes[10] == 429
        # ... y no bloquean a las llamadas válidas
        assert register(api, seed["ana"].id, installation_id="install-9999").status_code == 201

    def test_registro_deshabilitado_sin_clave_configurada(self, api, seed, monkeypatch):
        monkeypatch.setattr(settings, "internal_api_key", None)
        assert register(api, seed["ana"].id).status_code == 503

    def test_registro_cliente_inexistente(self, api):
        assert register(api, 9999).status_code == 404

    def test_registro_guarda_solo_el_hash(self, api, db, seed):
        resp = register(api, seed["ana"].id)
        assert resp.status_code == 201
        token = resp.json()["token"]
        device = db.query(ClientDevice).one()
        assert token not in (device.token_hash, device.installation_id)
        assert len(device.token_hash) == 64 and device.client_id == seed["ana"].id

    def test_avisos_requieren_token(self, api, seed):
        assert api.get("/avisos/programados").status_code == 401
        assert api.get("/avisos/programados", headers=bearer("falso")).status_code == 401

    def test_avisos_con_token_valido_actualiza_last_seen(self, api, db, seed):
        token = register(api, seed["ana"].id).json()["token"]
        resp = api.get("/avisos/programados", headers=bearer(token))
        assert resp.status_code == 200
        body = resp.json()
        assert body["avisos"] == [] and body["generado_en"].endswith("-04:00")
        db.expire_all()
        assert db.query(ClientDevice).one().last_seen_at is not None

    def test_token_revocado_con_delete(self, api, seed):
        token = register(api, seed["ana"].id).json()["token"]
        assert api.delete("/dispositivos/actual", headers=bearer(token)).status_code == 204
        assert api.get("/avisos/programados", headers=bearer(token)).status_code == 401
        assert api.delete("/dispositivos/actual", headers=bearer(token)).status_code == 401

    def test_token_revocado_en_la_bd(self, api, db, seed):
        token = register(api, seed["ana"].id).json()["token"]
        device = db.query(ClientDevice).one()
        device.revoked_at = datetime.utcnow()
        db.commit()
        assert api.get("/avisos/programados", headers=bearer(token)).status_code == 401

    def test_reasignar_instalacion_revoca_el_token_anterior(self, api, db, seed):
        token_ana = register(api, seed["ana"].id).json()["token"]
        token_bea = register(api, seed["bea"].id).json()["token"]  # misma instalación

        assert api.get("/avisos/programados", headers=bearer(token_ana)).status_code == 401
        assert api.get("/avisos/programados", headers=bearer(token_bea)).status_code == 200
        device = db.query(ClientDevice).one()
        assert device.client_id == seed["bea"].id and device.revoked_at is None

    def test_reregistrar_tras_revocar_reactiva_la_instalacion(self, api, seed):
        token = register(api, seed["ana"].id).json()["token"]
        api.delete("/dispositivos/actual", headers=bearer(token))
        nuevo = register(api, seed["ana"].id).json()["token"]
        assert api.get("/avisos/programados", headers=bearer(nuevo)).status_code == 200

    def test_borrar_clienta_borra_sus_dispositivos(self, api, db, seed):
        register(api, seed["ana"].id)
        assert db.query(ClientDevice).count() == 1
        db.delete(seed["ana"])
        db.commit()
        assert db.query(ClientDevice).count() == 0

    def test_avisos_extremo_a_extremo(self, api, db, seed, monkeypatch):
        token = register(api, seed["ana"].id).json()["token"]
        start = datetime.now(LA_PAZ).replace(tzinfo=None) + timedelta(hours=30)
        add_appointment(db, seed, start)
        body = api.get("/avisos/programados", headers=bearer(token)).json()
        assert "manana" in [a["tipo"] for a in body["avisos"]]
