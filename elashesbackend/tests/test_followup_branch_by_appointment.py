"""Regression: follow-up scope = branch of the attention, not the client's file.

Production case (anonymised): pending "Extensiones Volumen 3D" booking in
Sucursal Norte (branch 2) for a client whose file is in Sucursal Principal
(branch 1). Próximas citas showed it; Estado de retoques/retirados did not.
Synthetic data and fake providers only.
"""
from datetime import datetime, timedelta

import pytest

from tests.test_retouch_reminders import scenario  # noqa: F401  (fixture)
from app.application.services.appointment_notice_service import LA_PAZ
from app.domain.entities.broadcast import Broadcast
from app.domain.entities.client import Client
from app.domain.entities.retouch_reminder import RetouchReminder
from app.domain.entities.service_agenda import Service, ServiceCategory
from app.domain.entities.tracking import Tracking
from app.domain.entities.user import User


def _setup(scenario, home_branch):
    api, factory, _, auth, _, _ = scenario
    with factory() as db:
        category = ServiceCategory(name="Extensiones REG", has_maintenance=True, has_removal=True)
        db.add(category); db.flush()
        v3d = Service(name="Extensiones Volumen 3D REG", category_id=category.id, maintenance_days=21,
                      removal_days=45, price=100, duration_minutes=60)
        db.add(v3d); db.flush()
        client = Client(name="Niko", last_name="FICTICIA", email="reg@example.com", branch_id=home_branch)
        db.add(client)
        # A restricted user of branch 2 (Norte) with the same permissions as own_demo.
        own = db.query(User).filter_by(username="own_demo").one()
        db.add(User(username="norte_demo", email="norte_demo@example.com", hashed_password=own.hashed_password,
                    role_id=own.role_id, branch_id=2, is_active=True))
        db.commit()
        return api, factory, auth, v3d.id, client.id


def _book(api, h, client_id, service_id, days=1, branch_id=2):
    start = (datetime.now(LA_PAZ) + timedelta(days=days)).replace(hour=9, minute=0, second=0, microsecond=0)
    r = api.post("/agenda/appointments", headers=h, json={
        "client_id": client_id, "branch_id": branch_id, "service_ids": [service_id],
        "start_time": start.replace(tzinfo=None).isoformat(),
        "end_time": (start + timedelta(hours=1)).replace(tzinfo=None).isoformat()})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _rows(api, h, tipo, client_id, **params):
    r = api.get("/clients/retoques", headers=h, params={"tipo": tipo, **params})
    assert r.status_code == 200, r.text
    return [row for row in r.json() if row["client_id"] == client_id]


@pytest.mark.parametrize("home_branch", [1, None], ids=["ficha_en_otra_sucursal", "ficha_sin_sucursal"])
def test_pending_booking_appears_in_the_appointment_branch(scenario, home_branch):
    api, factory, auth, v3d, cid, = _setup(scenario, home_branch)
    h = auth()
    _book(api, h, cid, v3d)
    # Same data that Próximas citas shows for Norte.
    citas = api.get("/clients/citas-proximas", headers=h, params={"branch_id": 2}).json()
    assert any(c["client_id"] == cid for c in citas)
    for tipo in ("mantenimiento", "retiro"):
        [row] = _rows(api, h, tipo, cid, branch_id=2)
        assert row["estado_seguimiento"] == "pendiente_atencion" and row["branch_id"] == 2
        assert row["recordatorio_permitido"] is False
        assert _rows(api, h, tipo, cid, branch_id=1) == []  # never in the file's branch
    with factory() as db:
        assert db.get(Client, cid).branch_id == home_branch  # file untouched


@pytest.mark.parametrize("home_branch", [1, None])
def test_finish_keeps_attention_branch_and_enables_followup_once(scenario, home_branch):
    api, factory, auth, v3d, cid = _setup(scenario, home_branch)
    h = auth()
    aid = _book(api, h, cid, v3d, days=0)
    for _ in range(2):  # repeated finish must not duplicate the tracking
        assert api.put(f"/agenda/appointments/{aid}", headers=h, json={"status": "completed"}).status_code == 200
    with factory() as db:
        [tracking] = db.query(Tracking).filter_by(appointment_id=aid).all()
        assert tracking.branch_id == 2
        assert db.get(Client, cid).branch_id == home_branch
    for tipo in ("mantenimiento", "retiro"):
        [row] = _rows(api, h, tipo, cid, branch_id=2)
        assert row["estado_seguimiento"] == "habilitado" and row["seguimiento_id"] == tracking.id
        assert _rows(api, h, tipo, cid, branch_id=1) == []


def test_reminder_scope_uses_tracking_branch_and_permissions(scenario):
    api, factory, auth, v3d, cid = _setup(scenario, 1)
    admin = auth()
    aid = _book(api, admin, cid, v3d, days=0)
    assert api.put(f"/agenda/appointments/{aid}", headers=admin, json={"status": "completed"}).status_code == 200
    with factory() as db:
        tid = db.query(Tracking).filter_by(appointment_id=aid).one().id
    url = f"/clients/retoques/{tid}/recordatorio/mantenimiento"
    # Branch 1 user (client's file branch) cannot read a branch 2 attention.
    assert api.get(url, headers=auth("own_demo")).status_code == 403
    assert api.get(url, headers=auth("no_branch")).status_code == 403
    norte = auth("norte_demo")
    # Manipulated branch_id: restricted user stays locked to its own branch.
    assert _rows(api, auth("own_demo"), "mantenimiento", cid, branch_id=2) == []
    assert len(_rows(api, norte, "mantenimiento", cid, branch_id=1)) == 1
    preview = api.get(url, headers=norte)
    assert preview.status_code == 200, preview.text
    payload = {"preview_version": preview.json()["preview_version"], "send_push": False, "send_email": True}
    first = api.post(url, headers=norte, json=payload)
    assert first.status_code == 200, first.text
    assert api.post(url, headers=norte, json=payload).json()["broadcast_id"] == first.json()["broadcast_id"]
    with factory() as db:
        assert db.query(RetouchReminder).count() == 1
        assert db.get(Broadcast, first.json()["broadcast_id"]).branch_id == 2


def test_followup_row_is_hidden_when_tracking_and_attention_branches_disagree(scenario):
    api, factory, auth, v3d, cid = _setup(scenario, 1)
    h = auth()
    aid = _book(api, h, cid, v3d, days=0)
    assert api.put(f"/agenda/appointments/{aid}", headers=h, json={"status": "completed"}).status_code == 200
    with factory() as db:
        db.query(Tracking).filter_by(appointment_id=aid).one().branch_id = 1; db.commit()
    for scope in ({}, {"branch_id": 1}, {"branch_id": 2}):
        assert _rows(api, h, "mantenimiento", cid, **scope) == []


def test_service_without_followup_is_never_listed(scenario):
    """Mirrors production config: category flags off, no days. Not inferred by name."""
    api, factory, auth, _, cid = _setup(scenario, 1)
    h = auth()
    with factory() as db:
        category = ServiceCategory(name="Extensiones SIN CONFIG", has_maintenance=False, has_removal=False)
        db.add(category); db.flush()
        service = Service(name="Extensiones Volumen 3D", category_id=category.id, price=100, duration_minutes=60)
        db.add(service); db.commit()
        sid = service.id
    aid = _book(api, h, cid, sid)
    for scope in ({}, {"branch_id": 2}):
        assert _rows(api, h, "mantenimiento", cid, **scope) == []
        assert _rows(api, h, "retiro", cid, **scope) == []
    assert api.put(f"/agenda/appointments/{aid}", headers=h, json={"status": "completed"}).status_code == 200
    with factory() as db:
        assert db.query(Tracking).filter_by(appointment_id=aid).count() == 0
