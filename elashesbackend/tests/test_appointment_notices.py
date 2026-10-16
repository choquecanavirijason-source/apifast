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
    compute_tracking_notices,
    get_scheduled_notices,
    make_aviso_id,
)
from app.application.services.reminder_service import collect_due_reminders
from app.application.services.service_agenda_service import (
    create_appointment,
    mark_rescheduled,
    update_appointment,
)
from app.application.services.tracking_service import create_tracking
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
from app.domain.entities.tracking import Tracking
from app.infrastructure.database.base_class import Base
from app.presentation.controllers.device_notices_controller import router
from app.presentation.schemas.tracking import TrackingCreate

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
    scheduled_at: datetime | None = None,
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
        # Por defecto como deja la migración a las citas existentes: = created_at.
        scheduled_at=scheduled_at or created_at,
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
            "aviso_id", "cita_id", "seguimiento_id", "tipo", "mostrar_en", "expira_en", "titulo", "cuerpo"
        }
        assert manana["cita_id"] == appt.id
        assert manana["seguimiento_id"] is None
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

    @pytest.mark.parametrize(
        "estado", ["completed", "finalizado", "atendido", "no_show", "done", "cancelado"]
    )
    def test_cita_en_estado_final_se_ignora(self, db, seed, estado):
        add_appointment(db, seed, local(2026, 10, 14, 10, 0), status=estado)
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 13, 12, 0)))
        assert result["avisos"] == []

    @pytest.mark.parametrize("estado", ["pending", "confirmed", "in_service"])
    def test_cita_activa_si_avisa(self, db, seed, estado):
        add_appointment(db, seed, local(2026, 10, 14, 10, 0), status=estado)
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 13, 12, 0)))
        assert tipos(result) == ["manana", "hoy"]

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


# ── Avisos de mantenimiento / retiro ─────────────────────────────────────────

# Fecha objetivo: 5 nov 15:00 en La Paz, guardada en UTC naive como en la BD.
OBJETIVO = utc_naive(local(2026, 11, 5, 15, 0))


def add_tracking(
    db: Session,
    seed: dict,
    *,
    maintenance: datetime | None = OBJETIVO,
    removal: datetime | None = None,
    applied: datetime = LONG_AGO,
    client: str = "ana",
) -> Tracking:
    """Seguimiento con fechas ya calculadas, ligado a una cita pasada."""
    appt = add_appointment(db, seed, local(2026, 10, 1, 10, 0), client=client, status="completed")
    tracking = Tracking(
        client_id=seed[client].id,
        appointment_id=appt.id,
        branch_id=seed["branch"].id,
        last_application_date=applied,
        next_maintenance_date=maintenance,
        next_removal_date=removal,
    )
    db.add(tracking)
    db.commit()
    return tracking


def seguimiento(result: dict) -> list[dict]:
    return [a for a in result["avisos"] if a["seguimiento_id"] is not None]


def enable_category(seed: dict, db: Session, *, maintenance_days=21, removal_days=None) -> None:
    """La cita de add_appointment usa service_id = retoque: ese servicio decide los días."""
    retoque = seed["retoque"]
    retoque.category.has_maintenance = True
    retoque.category.has_removal = True
    retoque.maintenance_days = maintenance_days
    retoque.removal_days = removal_days
    db.commit()


class TestReglasDeSeguimiento:
    def test_aviso_previo_y_del_mismo_dia_a_las_10(self):
        previo, dia = compute_tracking_notices("mantenimiento", OBJETIVO)
        assert previo.mostrar_en.isoformat() == "2026-11-02T10:00:00-04:00"
        assert previo.expira_en.isoformat() == "2026-11-05T00:00:00-04:00"
        assert not previo.el_mismo_dia
        assert dia.mostrar_en.isoformat() == "2026-11-05T10:00:00-04:00"
        assert dia.expira_en.isoformat() == "2026-11-06T00:00:00-04:00"
        assert dia.el_mismo_dia

    def test_fecha_utc_de_madrugada_es_el_dia_anterior_en_la_paz(self):
        # 01:00 UTC del 6 = 21:00 del 5 en La Paz: el día objetivo es el 5.
        _, dia = compute_tracking_notices("retiro", datetime(2026, 11, 6, 1, 0))
        assert dia.mostrar_en.isoformat() == "2026-11-05T10:00:00-04:00"


class TestAvisosDeSeguimiento:
    def test_aviso_previo_estructura_y_texto(self, db, seed):
        tracking = add_tracking(db, seed)
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 2, 9, 0)))

        [aviso] = seguimiento(result)  # el del mismo día (5 nov 10:00) queda a > 48 h
        assert aviso["tipo"] == "mantenimiento"
        assert aviso["cita_id"] is None and aviso["seguimiento_id"] == tracking.id
        assert aviso["titulo"] == "Te toca tu retoque"
        assert aviso["cuerpo"] == "Retoque · Salón Centro"
        assert aviso["mostrar_en"] == "2026-11-02T10:00:00-04:00"
        assert aviso["expira_en"] == "2026-11-05T00:00:00-04:00"

    def test_ambos_avisos_y_titulo_del_mismo_dia(self, db, seed):
        add_tracking(db, seed)
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 4, 12, 0)))
        assert [a["titulo"] for a in seguimiento(result)] == ["Te toca tu retoque", "Hoy te toca tu retoque"]

    def test_el_dia_objetivo_solo_queda_el_del_dia(self, db, seed):
        add_tracking(db, seed)
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 5, 12, 0)))
        assert [a["titulo"] for a in seguimiento(result)] == ["Hoy te toca tu retoque"]

    def test_expirados_no_se_devuelven(self, db, seed):
        add_tracking(db, seed)
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 6, 0, 30)))
        assert seguimiento(result) == []

    def test_fuera_de_las_proximas_48_horas(self, db, seed):
        add_tracking(db, seed)
        # El previo sale el 2 nov 10:00: a las 09:00 del 31 oct faltan 49 h.
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 31, 9, 0)))
        assert seguimiento(result) == []

    def test_retiro_con_sus_titulos(self, db, seed):
        add_tracking(db, seed, maintenance=None, removal=OBJETIVO)
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 4, 12, 0)))
        avisos = seguimiento(result)
        assert {a["tipo"] for a in avisos} == {"retiro"}
        assert [a["titulo"] for a in avisos] == ["Te toca tu retiro", "Hoy te toca tu retiro"]

    def test_cita_futura_no_cancelada_anula_los_avisos(self, db, seed):
        add_tracking(db, seed)
        add_appointment(db, seed, local(2026, 11, 20, 10, 0))
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 4, 12, 0)))
        assert seguimiento(result) == []

    def test_cita_futura_cancelada_no_anula(self, db, seed):
        add_tracking(db, seed)
        add_appointment(db, seed, local(2026, 11, 20, 10, 0), status="cancelled")
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 4, 12, 0)))
        assert len(seguimiento(result)) == 2

    @pytest.mark.parametrize("estado", ["completed", "no_show", "finalizado", "atendido", "done"])
    def test_cita_futura_en_estado_final_no_anula(self, db, seed, estado):
        add_tracking(db, seed)
        add_appointment(db, seed, local(2026, 11, 20, 10, 0), status=estado)
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 4, 12, 0)))
        assert len(seguimiento(result)) == 2

    def test_seguimiento_nuevo_anula_los_anteriores(self, db, seed):
        add_tracking(db, seed, applied=LONG_AGO)
        # Seguimiento más reciente sin mantenimiento (ej. un lifting).
        add_tracking(db, seed, maintenance=None, applied=LONG_AGO + timedelta(days=5))
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 4, 12, 0)))
        assert seguimiento(result) == []

    def test_solo_avisos_de_la_clienta(self, db, seed):
        add_tracking(db, seed, client="bea")
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 4, 12, 0)))
        assert result["avisos"] == []

    def test_aviso_id_estable_distinto_por_etapa_y_por_fecha(self, db, seed):
        tracking = add_tracking(db, seed)
        now = now_at(local(2026, 11, 4, 12, 0))
        primero = [a["aviso_id"] for a in seguimiento(get_scheduled_notices(db, seed["ana"].id, now))]
        segundo = [a["aviso_id"] for a in seguimiento(get_scheduled_notices(db, seed["ana"].id, now))]
        assert primero == segundo and len(set(primero)) == 2
        assert all(0 <= i <= 0x7FFFFFFF for i in primero)

        tracking.next_maintenance_date = OBJETIVO + timedelta(hours=2)  # mismo día en La Paz
        db.commit()
        assert [a["aviso_id"] for a in seguimiento(get_scheduled_notices(db, seed["ana"].id, now))] == primero

        tracking.next_maintenance_date = OBJETIVO + timedelta(days=1)
        db.commit()
        movido = seguimiento(get_scheduled_notices(db, seed["ana"].id, now))
        assert not {a["aviso_id"] for a in movido} & set(primero)

    def test_categoria_con_mantenimiento_apagado_no_avisa(self, db, seed):
        enable_category(seed, db)
        seed["retoque"].category.has_maintenance = False
        db.commit()
        appt = add_appointment(db, seed, local(2026, 10, 15, 10, 0), status="completed")
        tracking = create_tracking(
            db, TrackingCreate(client_id=seed["ana"].id, appointment_id=appt.id,
                               last_application_date=utc_naive(local(2026, 10, 15, 11, 0)))
        )
        assert tracking.next_maintenance_date is None
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 4, 12, 0)))
        assert seguimiento(result) == []

    def test_servicio_sin_dias_no_avisa(self, db, seed):
        enable_category(seed, db, maintenance_days=None)
        appt = add_appointment(db, seed, local(2026, 10, 15, 10, 0), status="completed")
        create_tracking(
            db, TrackingCreate(client_id=seed["ana"].id, appointment_id=appt.id,
                               last_application_date=utc_naive(local(2026, 10, 15, 11, 0)))
        )
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 4, 12, 0)))
        assert seguimiento(result) == []

    def test_aplicacion_de_noche_cae_en_el_dia_correcto(self, db, seed):
        # Aplicado el 15 oct a las 21:00 en La Paz (01:00 UTC del 16) + 21 días:
        # el retoque es el 5 nov, no el 6.
        enable_category(seed, db, maintenance_days=21)
        appt = add_appointment(db, seed, local(2026, 10, 15, 19, 0), status="completed")
        create_tracking(
            db, TrackingCreate(client_id=seed["ana"].id, appointment_id=appt.id,
                               last_application_date=utc_naive(local(2026, 10, 15, 21, 0)))
        )
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 5, 12, 0)))
        [aviso] = seguimiento(result)
        assert aviso["titulo"] == "Hoy te toca tu retoque"
        assert aviso["mostrar_en"] == "2026-11-05T10:00:00-04:00"


class TestNotificacionesDesactivadas:
    def test_desactivadas_no_recibe_mantenimiento_ni_retiro(self, db, seed):
        add_tracking(db, seed, maintenance=OBJETIVO, removal=OBJETIVO)
        seed["ana"].notificaciones_activas = False
        db.commit()
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 4, 12, 0)))
        assert seguimiento(result) == []

    def test_activas_los_recibe_normalmente(self, db, seed):
        add_tracking(db, seed, maintenance=OBJETIVO, removal=OBJETIVO)
        assert seed["ana"].notificaciones_activas is True  # valor por defecto
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 11, 4, 12, 0)))
        assert sorted(a["tipo"] for a in seguimiento(result)) == [
            "mantenimiento", "mantenimiento", "retiro", "retiro"
        ]

    def test_desactivadas_las_citas_siguen_avisando(self, db, seed):
        add_appointment(db, seed, local(2026, 10, 14, 10, 0))
        seed["ana"].notificaciones_activas = False
        db.commit()
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 13, 12, 0)))
        assert tipos(result) == ["manana", "hoy"]

    def test_websocket_tampoco_envia_ni_marca(self, db, seed, monkeypatch):
        monkeypatch.setattr(settings, "client_notices_enabled", False)
        tracking = add_tracking(db, seed, maintenance=datetime.utcnow() + timedelta(days=3))
        seed["ana"].notificaciones_activas = False
        db.commit()
        assert collect_due_reminders(db) == []
        db.refresh(tracking)
        assert tracking.maintenance_reminder_sent is False


class TestReminderServiceConAvisosActivos:
    def _tracking_en_3_dias(self, db, seed) -> Tracking:
        return add_tracking(db, seed, maintenance=datetime.utcnow() + timedelta(days=3))

    def test_con_avisos_activos_no_envia_ni_marca(self, db, seed, monkeypatch):
        monkeypatch.setattr(settings, "client_notices_enabled", True)
        tracking = self._tracking_en_3_dias(db, seed)
        assert collect_due_reminders(db) == []
        db.refresh(tracking)
        assert tracking.maintenance_reminder_sent is False

    def test_sin_avisos_activos_sigue_como_antes(self, db, seed, monkeypatch):
        monkeypatch.setattr(settings, "client_notices_enabled", False)
        tracking = self._tracking_en_3_dias(db, seed)
        due = collect_due_reminders(db)
        assert [(r["tracking_id"], r["type"]) for r in due] == [(tracking.id, "maintenance")]
        db.refresh(tracking)
        assert tracking.maintenance_reminder_sent is True


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
        assert all("seguimiento_id" in a and a["seguimiento_id"] is None for a in body["avisos"])

    def test_avisos_de_seguimiento_extremo_a_extremo(self, api, db, seed):
        token = register(api, seed["ana"].id).json()["token"]
        # Fecha objetivo mañana a mediodía: el aviso previo ya está vigente.
        objetivo = datetime.utcnow() + timedelta(days=1)
        tracking = add_tracking(db, seed, maintenance=objetivo)
        body = api.get("/avisos/programados", headers=bearer(token)).json()

        avisos = [a for a in body["avisos"] if a["tipo"] == "mantenimiento"]
        assert avisos, body
        for aviso in avisos:
            assert aviso["cita_id"] is None
            assert aviso["seguimiento_id"] == tracking.id


# ── Reprogramación: scheduled_at manda en la regla de último momento ────────

class TestReprogramacion:
    def test_reservada_con_antelacion_y_movida_a_ultimo_momento_sin_aviso_hoy(self, db, seed):
        # Creada hace días; a las 13:00 la mueven a las 15:00 del mismo día.
        add_appointment(
            db, seed, local(2026, 10, 14, 15, 0), scheduled_at=utc_naive(local(2026, 10, 14, 13, 0))
        )
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 14, 13, 5)))
        assert "hoy" not in tipos(result)

    def test_reservada_a_ultimo_momento_y_movida_con_margen_si_avisa_hoy(self, db, seed):
        # Creada a las 16:00 (para una cita cercana); a las 16:05 la mueven a las 21:00.
        add_appointment(
            db, seed, local(2026, 10, 14, 21, 0),
            created_at=utc_naive(local(2026, 10, 14, 16, 0)),
            scheduled_at=utc_naive(local(2026, 10, 14, 16, 5)),
        )
        result = get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 14, 16, 10)))
        assert tipos(result) == ["hoy"]

    def test_sin_scheduled_at_usa_created_at(self, db, seed):
        appt = add_appointment(
            db, seed, local(2026, 10, 14, 15, 0), created_at=utc_naive(local(2026, 10, 14, 13, 30))
        )
        appt.scheduled_at = None  # cita insertada a mano en SQLite (columna nullable ahí)
        assert "hoy" not in tipos(
            get_scheduled_notices(db, seed["ana"].id, now_at(local(2026, 10, 14, 13, 45)))
        )


class TestMarcaDeReprogramacion:
    def test_crear_fija_scheduled_at(self, db, seed):
        antes = datetime.utcnow()
        appt = create_appointment(
            db, client_id=seed["ana"].id, start_time=local(2026, 12, 1, 10, 0),
            end_time=local(2026, 12, 1, 11, 0), branch_id=seed["branch"].id,
        )
        assert appt.scheduled_at >= antes - timedelta(seconds=1)

    def test_misma_hora_no_toca_scheduled_at(self, db, seed):
        appt = add_appointment(db, seed, local(2026, 12, 1, 10, 0))
        update_appointment(
            db, appt.id, start_time=local(2026, 12, 1, 10, 0), end_time=local(2026, 12, 1, 11, 0),
            skip_availability_check=True,
        )
        update_appointment(db, appt.id, is_ia=True, skip_availability_check=True)
        db.refresh(appt)
        assert appt.scheduled_at == LONG_AGO

    def test_cambiar_la_hora_actualiza_scheduled_at(self, db, seed):
        appt = add_appointment(db, seed, local(2026, 12, 1, 10, 0))
        antes = datetime.utcnow()
        update_appointment(
            db, appt.id, start_time=local(2026, 12, 1, 15, 0), end_time=local(2026, 12, 1, 16, 0),
            skip_availability_check=True,
        )
        db.refresh(appt)
        assert appt.scheduled_at >= antes - timedelta(seconds=1)

    def test_mark_rescheduled_ignora_tzinfo(self, db, seed):
        appt = add_appointment(db, seed, local(2026, 12, 1, 10, 0))
        mark_rescheduled(appt, local(2026, 12, 1, 10, 0).replace(tzinfo=LA_PAZ))
        assert appt.scheduled_at == LONG_AGO
