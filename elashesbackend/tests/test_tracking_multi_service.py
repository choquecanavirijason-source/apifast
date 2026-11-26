"""Seguimiento (mantenimiento/retiro) de una atención con VARIOS servicios (ticket grupal o promoción).

Antes solo se miraba el primer servicio: con "Lifting + Extensiones Clásicas" el retoque de las
extensiones se perdía por no ser el primero. Ahora se toma el servicio que SÍ tiene retoque/retiro y la
fecha más próxima de cada tipo entre todos los servicios (un solo seguimiento por atención).

Ejecutar:
  cd elashesbackend
  pytest tests/test_tracking_multi_service.py -v
"""
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # registra los modelos sin ejecutar migraciones
from app.application.services.tracking_service import (
    _resolve_next_dates,
    resolve_service,
    sync_appointment_followup,
)
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.service_agenda import Appointment, AppointmentService, Service, ServiceCategory
from app.domain.entities.tracking import Tracking
from app.infrastructure.database import Base

BASE = datetime(2030, 1, 1, 12, 0)


@pytest.fixture
def work():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    branch = Branch(name="Norte")
    with_followup = ServiceCategory(name="Extensiones", has_maintenance=True, has_removal=True)
    without = ServiceCategory(name="Lifting", has_maintenance=False, has_removal=False)
    only_maint = ServiceCategory(name="Solo mantenimiento", has_maintenance=True, has_removal=False)
    db.add_all([branch, with_followup, without, only_maint])
    db.flush()
    client = Client(name="Ana", last_name="Prueba", branch_id=branch.id)
    lifting = Service(name="Lifting", category_id=without.id, duration_minutes=60, price=100,
                      maintenance_days=7, removal_days=7)      # días cargados pero su categoría no los usa
    clasicas = Service(name="Clásicas", category_id=with_followup.id, duration_minutes=90, price=120,
                       maintenance_days=12, removal_days=15)
    volumen = Service(name="Volumen", category_id=with_followup.id, duration_minutes=120, price=180,
                      maintenance_days=20, removal_days=30)
    relleno = Service(name="Relleno", category_id=only_maint.id, duration_minutes=60, price=80, maintenance_days=5)
    cejas = Service(name="Cejas", category_id=without.id, duration_minutes=30, price=50)
    db.add_all([client, lifting, clasicas, volumen, relleno, cejas])
    db.commit()

    def appointment(*services):
        appt = Appointment(client_id=client.id, branch_id=branch.id, service_id=services[0].id,
                           start_time=BASE, end_time=BASE + timedelta(hours=1), status="in_service")
        db.add(appt)
        db.flush()
        if len(services) > 1:
            for order, svc in enumerate(services):
                db.add(AppointmentService(appointment_id=appt.id, service_id=svc.id, sort_order=order))
        db.commit()
        return appt

    yield SimpleNamespace(db=db, appointment=appointment, lifting=lifting, clasicas=clasicas, volumen=volumen,
                          relleno=relleno, cejas=cejas)
    db.close()
    engine.dispose()


def days(base, target):
    return None if target is None else (target - base).days


def test_single_service_behaves_as_before(work):
    appt = work.appointment(work.clasicas)
    m, r = _resolve_next_dates(work.db, appt.id, BASE)
    assert (days(BASE, m), days(BASE, r)) == (12, 15)
    assert resolve_service(work.db, appt.id).id == work.clasicas.id


def test_first_service_without_followup_does_not_hide_the_second(work):
    appt = work.appointment(work.lifting, work.clasicas)         # Lifting primero (sin retoque)
    assert resolve_service(work.db, appt.id).id == work.clasicas.id
    m, r = _resolve_next_dates(work.db, appt.id, BASE)
    assert (days(BASE, m), days(BASE, r)) == (12, 15)


def test_the_closest_date_of_each_kind_wins(work):
    appt = work.appointment(work.volumen, work.clasicas)         # 20/30 y 12/15 -> 12/15
    m, r = _resolve_next_dates(work.db, appt.id, BASE)
    assert (days(BASE, m), days(BASE, r)) == (12, 15)


def test_kinds_are_combined_across_services(work):
    appt = work.appointment(work.relleno, work.clasicas)         # relleno: solo mantenimiento (5); clásicas 12/15
    m, r = _resolve_next_dates(work.db, appt.id, BASE)
    assert (days(BASE, m), days(BASE, r)) == (5, 15)             # mantenimiento más próximo + retiro de las clásicas


def test_no_service_with_followup_gives_none(work):
    appt = work.appointment(work.lifting, work.cejas)
    assert _resolve_next_dates(work.db, appt.id, BASE) == (None, None)
    assert resolve_service(work.db, appt.id).id == work.lifting.id   # sin retoque: el principal de siempre


def test_finishing_creates_one_tracking_even_if_only_the_second_service_needs_it(work):
    appt = work.appointment(work.lifting, work.clasicas)
    appt.status = "completed"
    sync_appointment_followup(work.db, appt, previous_status="in_service", previous_service_id=work.lifting.id)
    work.db.commit()
    rows = work.db.query(Tracking).filter(Tracking.appointment_id == appt.id).all()
    assert len(rows) == 1
    assert rows[0].next_maintenance_date is not None and rows[0].next_removal_date is not None


def test_finishing_without_any_followup_creates_nothing(work):
    appt = work.appointment(work.lifting, work.cejas)
    appt.status = "completed"
    sync_appointment_followup(work.db, appt, previous_status="in_service", previous_service_id=work.lifting.id)
    work.db.commit()
    assert work.db.query(Tracking).count() == 0
