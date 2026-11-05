"""Estado de retoques / retirados: reserva pendiente -> seguimiento habilitado.

Rutas reales, datos ficticios, proveedores SMTP/FCM falsos (fixture compartido).
"""
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_retouch_reminders import scenario  # noqa: F401  (fixture)
from app.application.services.appointment_notice_service import LA_PAZ
from app.domain.entities.client import Client
from app.domain.entities.service_agenda import Appointment, Service, ServiceCategory
from app.domain.entities.tracking import Tracking


def _setup(scenario):
    """Servicio con mantenimiento+retiro, servicio solo mantenimiento y una clienta nueva."""
    api, factory, _, auth, _, _ = scenario
    with factory() as db:
        both_cat = ServiceCategory(name="EXT AMBOS DEMO", has_maintenance=True, has_removal=True)
        db.add(both_cat); db.flush()
        both = Service(name="Volumen DEMO", category_id=both_cat.id, maintenance_days=21,
                       removal_days=60, price=100, duration_minutes=60)
        db.add(both); db.flush()
        client = Client(name="Dora", last_name="FICTICIA", email="dora@example.com", branch_id=1)
        db.add(client); db.commit()
        ids = {"both": both.id, "maint": 1, "plain": 2, "client": client.id}
    return api, factory, auth(), ids


def _book(api, h, client_id, service_id, days=3, branch_id=1):
    start = (datetime.now(LA_PAZ) + timedelta(days=days)).replace(hour=11, minute=0, second=0, microsecond=0)
    r = api.post("/agenda/appointments", headers=h, json={
        "client_id": client_id, "branch_id": branch_id, "service_id": service_id,
        "start_time": start.replace(tzinfo=None).isoformat(),
        "end_time": (start + timedelta(hours=1)).replace(tzinfo=None).isoformat()})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _rows(api, h, tipo, client_id=None, **params):
    r = api.get("/clients/retoques", headers=h, params={"tipo": tipo, **params})
    assert r.status_code == 200, r.text
    return [row for row in r.json() if client_id is None or row["client_id"] == client_id]


def _put(api, h, aid, **body):
    r = api.put(f"/agenda/appointments/{aid}", headers=h, json=body)
    assert r.status_code == 200, r.text


def test_new_booking_is_pending_in_matching_tabs_only(scenario):
    api, _, h, ids = _setup(scenario)
    aid = _book(api, h, ids["client"], ids["maint"])
    [row] = _rows(api, h, "mantenimiento", ids["client"])
    assert row["estado_seguimiento"] == "pendiente_atencion"
    assert row["appointment_id"] == aid and row["seguimiento_id"] is None
    assert row["fecha_objetivo"] is None and row["dias_restantes"] is None
    assert row["recordatorio_permitido"] is False and row["cita_fecha"]
    assert _rows(api, h, "retiro", ids["client"]) == []


def test_service_with_both_followups_appears_in_both_tabs(scenario):
    api, _, h, ids = _setup(scenario)
    _book(api, h, ids["client"], ids["both"])
    for tipo in ("mantenimiento", "retiro"):
        [row] = _rows(api, h, tipo, ids["client"])
        assert row["estado_seguimiento"] == "pendiente_atencion"


def test_in_service_stays_pending_and_blocks_reminders(scenario):
    api, _, h, ids = _setup(scenario)
    aid = _book(api, h, 1, ids["maint"], days=0)  # Ana already has an enabled tracking
    _put(api, h, aid, status="in_service", skip_availability_check=True)
    [row] = _rows(api, h, "mantenimiento", 1)  # single row: no duplicate with old tracking
    assert row["estado_seguimiento"] == "pendiente_atencion" and row["cita_estado"] == "in_service"
    old_tracking = scenario[2][0]
    assert api.get(f"/clients/retoques/{old_tracking}/recordatorio/mantenimiento", headers=h).status_code == 409


def test_finish_without_tracking_post_enables_followup_from_real_finish(scenario):
    """Arrastrar a Finalizadas / marcar finalizada (solo PUT completed)."""
    api, factory, h, ids = _setup(scenario)
    aid = _book(api, h, ids["client"], ids["both"], days=-1)
    before = datetime.utcnow()
    _put(api, h, aid, status="completed")
    with factory() as db:
        [tracking] = db.query(Tracking).filter_by(appointment_id=aid).all()
        assert tracking.last_application_date >= before  # finish time, not booking time
        assert (tracking.next_maintenance_date - tracking.last_application_date).days == 21
        assert (tracking.next_removal_date - tracking.last_application_date).days == 60
    [maint] = _rows(api, h, "mantenimiento", ids["client"])
    assert maint["estado_seguimiento"] == "habilitado" and maint["dias_restantes"] in (20, 21)
    assert maint["recordatorio_permitido"] is True
    # 60 days > selected range (30): recently finished attentions stay visible.
    [removal] = _rows(api, h, "retiro", ids["client"], dias=30)
    assert removal["estado_seguimiento"] == "habilitado" and removal["dias_restantes"] in (59, 60)


def test_control_de_servicios_flow_does_not_duplicate_tracking(scenario):
    api, factory, h, ids = _setup(scenario)
    aid = _book(api, h, ids["client"], ids["maint"], days=0)
    _put(api, h, aid, status="in_service", skip_availability_check=True)
    r = api.post("/tracking/", headers=h, json={
        "client_id": ids["client"], "branch_id": 1, "appointment_id": aid,
        "last_application_date": datetime.now(timezone.utc).isoformat()})
    assert r.status_code == 201, r.text
    # Tracking registered but attention not finished yet: still pending.
    assert _rows(api, h, "mantenimiento", ids["client"])[0]["estado_seguimiento"] == "pendiente_atencion"
    _put(api, h, aid, status="completed")
    with factory() as db:
        assert db.query(Tracking).filter_by(appointment_id=aid).count() == 1
    [row] = _rows(api, h, "mantenimiento", ids["client"])
    assert row["estado_seguimiento"] == "habilitado"


def test_payment_flag_is_not_finishing(scenario):
    """Pagado (comisión) / cobro no activan seguimiento; solo la transición a completed."""
    api, factory, h, ids = _setup(scenario)
    aid = _book(api, h, ids["client"], ids["maint"])
    with factory() as db:
        db.get(Appointment, aid).pagado = True; db.commit()
    assert _rows(api, h, "mantenimiento", ids["client"])[0]["estado_seguimiento"] == "pendiente_atencion"
    with factory() as db:
        assert db.query(Tracking).filter_by(appointment_id=aid).count() == 0


def test_non_followup_service_completion_creates_nothing(scenario):
    api, factory, h, ids = _setup(scenario)
    aid = _book(api, h, ids["client"], ids["plain"], days=-1)
    assert _rows(api, h, "mantenimiento", ids["client"]) == []
    _put(api, h, aid, status="completed")
    with factory() as db:
        assert db.query(Tracking).filter_by(appointment_id=aid).count() == 0


def test_rescheduling_updates_single_pending_row(scenario):
    api, _, h, ids = _setup(scenario)
    aid = _book(api, h, ids["client"], ids["maint"], days=3)
    start = (datetime.now(LA_PAZ) + timedelta(days=9)).replace(hour=12, minute=0, second=0, microsecond=0)
    _put(api, h, aid, start_time=start.replace(tzinfo=None).isoformat(),
         end_time=(start + timedelta(hours=1)).replace(tzinfo=None).isoformat())
    [row] = _rows(api, h, "mantenimiento", ids["client"])
    assert row["cita_fecha"] == start.replace(tzinfo=None).isoformat()


def test_cancellation_removes_pending_and_marks_finished_as_cancelled(scenario):
    api, _, h, ids = _setup(scenario)
    aid = _book(api, h, ids["client"], ids["maint"])
    _put(api, h, aid, status="cancelled")
    assert _rows(api, h, "mantenimiento", ids["client"]) == []
    aid2 = _book(api, h, ids["client"], ids["maint"], days=-1)
    _put(api, h, aid2, status="completed")
    _put(api, h, aid2, status="cancelled")
    [row] = _rows(api, h, "mantenimiento", ids["client"])
    assert row["estado_seguimiento"] == "cancelado" and row["recordatorio_permitido"] is False


def test_service_change_updates_lists_and_recomputes_dates(scenario):
    api, factory, h, ids = _setup(scenario)
    aid = _book(api, h, ids["client"], ids["both"])
    assert len(_rows(api, h, "retiro", ids["client"])) == 1
    _put(api, h, aid, service_id=ids["maint"], skip_availability_check=True)
    assert _rows(api, h, "retiro", ids["client"]) == []
    assert len(_rows(api, h, "mantenimiento", ids["client"])) == 1
    _put(api, h, aid, service_id=ids["plain"], skip_availability_check=True)
    assert _rows(api, h, "mantenimiento", ids["client"]) == []
    # Finished attention with the wrong service, corrected afterwards.
    aid2 = _book(api, h, ids["client"], ids["maint"], days=-1)
    _put(api, h, aid2, status="completed")
    _put(api, h, aid2, service_id=ids["both"])
    with factory() as db:
        [tracking] = db.query(Tracking).filter_by(appointment_id=aid2).all()
        assert (tracking.next_removal_date - tracking.last_application_date).days == 60
    assert _rows(api, h, "retiro", ids["client"])[0]["estado_seguimiento"] == "habilitado"


def test_date_filters_do_not_hide_pending(scenario):
    api, _, h, ids = _setup(scenario)
    _book(api, h, ids["client"], ids["maint"], days=200)
    assert len(_rows(api, h, "mantenimiento", ids["client"], dias=7)) == 1
    with scenario[1]() as db:  # stale never-attended booking (>7 days ago) is not listed
        start = (datetime.now(LA_PAZ) - timedelta(days=10)).replace(tzinfo=None)
        db.add(Appointment(client_id=3, branch_id=1, service_id=1, start_time=start,
                           end_time=start + timedelta(hours=1), status="pending"))
        db.commit()
    assert all(r["estado_seguimiento"] != "pendiente_atencion" for r in _rows(api, h, "mantenimiento", 3))


@pytest.mark.parametrize("user,visible", [("own_demo", 1), ("reader_demo", 1), ("other_demo", 0), ("no_branch", 0)])
def test_branch_scope_and_permissions(scenario, user, visible):
    api, _, h, ids = _setup(scenario)
    _book(api, h, ids["client"], ids["maint"])
    headers = scenario[3](user)
    assert len(_rows(api, headers, "mantenimiento", ids["client"])) == visible
    assert _rows(api, h, "mantenimiento", ids["client"], branch_id=2) == []


def test_booking_in_other_branch_follows_the_appointment_branch(scenario):
    api, _, h, ids = _setup(scenario)  # client's home branch = 1
    _book(api, h, ids["client"], ids["maint"], branch_id=2)
    assert _rows(api, h, "mantenimiento", ids["client"], branch_id=1) == []
    [row] = _rows(api, h, "mantenimiento", ids["client"], branch_id=2)
    assert row["branch_id"] == 2 and row["estado_seguimiento"] == "pendiente_atencion"


def test_sent_reminder_state_and_no_duplicate_dispatch(scenario):
    api, factory, ids_all, auth, outbox, pushes = scenario
    h = auth()
    tid = ids_all[0]
    url = f"/clients/retoques/{tid}/recordatorio/mantenimiento"
    row = next(r for r in _rows(api, h, "mantenimiento") if r["seguimiento_id"] == tid)
    assert row["estado_seguimiento"] == "habilitado"
    overdue = next(r for r in _rows(api, h, "mantenimiento") if r["seguimiento_id"] == ids_all[2])
    assert overdue["estado_seguimiento"] == "vencido"
    p = api.get(url, headers=h).json()
    payload = {"preview_version": p["preview_version"], "send_push": True, "send_email": True}
    first = api.post(url, headers=h, json=payload).json()["broadcast_id"]
    for _ in range(3):
        assert api.post(url, headers=h, json=payload).json()["broadcast_id"] == first
    assert len(outbox) == len(pushes) == 1
    row = next(r for r in _rows(api, h, "mantenimiento") if r["seguimiento_id"] == tid)
    assert row["estado_seguimiento"] == "recordatorio_enviado"
    # A new booking for the same follow-up: row becomes pending, no extra dispatch.
    _book(api, h, row["client_id"], 1)
    [pending] = _rows(api, h, "mantenimiento", row["client_id"])
    assert pending["estado_seguimiento"] == "pendiente_atencion"
    assert api.post(url, headers=h, json=payload).status_code == 409
    assert len(outbox) == len(pushes) == 1
    from app.domain.entities.retouch_reminder import RetouchReminder
    with factory() as db:
        assert db.query(RetouchReminder).count() == 1


def test_untyped_listing_keeps_previous_contract(scenario):
    api, _, h, ids = _setup(scenario)
    _book(api, h, ids["client"], ids["maint"])
    rows = api.get("/clients/retoques", headers=h).json()
    assert all(r["seguimiento_id"] is not None for r in rows)
    assert not any(r["client_id"] == ids["client"] for r in rows)
