"""Retouch reminders use real routes and fake providers; no external messages."""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import secrets

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.application.services import broadcast_delivery_service as delivery, push_service
from app.application.services import retouch_reminder_service as reminders
from app.application.services.appointment_notice_service import LA_PAZ
from app.config.settings import settings
from app.core.dependencies import get_db, get_session_factory
from app.domain.entities.branch import Branch
from app.domain.entities.broadcast import Broadcast, BroadcastRecipient
from app.domain.entities.client import Client
from app.domain.entities.client_device import ClientDevice
from app.domain.entities.retouch_reminder import RetouchReminder
from app.domain.entities.service_agenda import Appointment, Service, ServiceCategory
from app.domain.entities.tracking import Tracking
from app.domain.entities.user import User, Role, Permission
from app.infrastructure.database import Base
from app.infrastructure.push.fcm_client import FcmResult
from app.infrastructure.security import get_password_hash


@pytest.fixture
def scenario(monkeypatch):
    test_password = secrets.token_urlsafe(24)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    outbox, pushes = [], []

    class Fcm:
        def send_data(self, token, data, notification=None):
            pushes.append((token, data))
            return FcmResult.SENT

    class Smtp:
        def send_message(self, message):
            outbox.append(message["To"])

    @contextmanager
    def smtp():
        yield Smtp()

    monkeypatch.setattr(push_service, "get_fcm_client", lambda: Fcm())
    monkeypatch.setattr(reminders, "get_fcm_client", lambda: Fcm())
    monkeypatch.setattr(delivery, "smtp_connection", smtp)
    monkeypatch.setattr(settings, "smtp_host", "fake.invalid")
    monkeypatch.setattr(settings, "smtp_from_email", "demo@example.com")
    monkeypatch.setattr(settings, "smtp_username", "demo@example.com")
    monkeypatch.setattr(settings, "smtp_password", "fake")
    with factory() as db:
        branch = Branch(name="DEMO", address="Prueba")
        other = Branch(name="OTHER", address="Prueba")
        db.add_all([branch, other]); db.flush()
        permission = Permission(name="clients:view")
        send = Permission(name="reminders:send")
        roles = [Role(name="SuperAdmin"), Role(name="Operaria"), Role(name="Reader")]
        roles[1].permissions = [permission, send]
        roles[2].permissions = [permission]
        db.add_all(roles); db.flush()
        for name, role, bid in [("admin_demo", roles[0], branch.id), ("other_demo", roles[1], other.id),
                                 ("reader_demo", roles[2], branch.id), ("no_branch", roles[1], None),
                                 ("own_demo", roles[1], branch.id)]:
            db.add(User(username=name, email=name+"@example.com", hashed_password=get_password_hash(test_password),
                        role_id=role.id, branch_id=bid, is_active=True))
        category = ServiceCategory(name="DEMO", has_maintenance=True)
        db.add(category); db.flush()
        service = Service(name="Extensiones Clasicas DEMO", category_id=category.id,
                          maintenance_days=21, price=100, duration_minutes=60)
        db.add(service); db.flush()
        today = datetime.now(LA_PAZ).replace(hour=11, minute=0, second=0, microsecond=0)
        ids = []
        for index, days in enumerate([5, 5, -3]):
            client = Client(name=["Ana", "Bea", "Carla"][index], last_name="FICTICIA",
                            email=f"demo{index}@example.com", branch_id=branch.id)
            db.add(client); db.flush()
            applied = today - timedelta(days=21-days)
            appointment = Appointment(client_id=client.id, branch_id=branch.id, service_id=service.id,
                                      start_time=applied.replace(tzinfo=None),
                                      end_time=(applied+timedelta(hours=1)).replace(tzinfo=None), status="completed")
            db.add(appointment); db.flush()
            tracking = Tracking(client_id=client.id, branch_id=branch.id, appointment_id=appointment.id,
                                last_application_date=applied.astimezone(timezone.utc).replace(tzinfo=None),
                                next_maintenance_date=(today+timedelta(days=days)).astimezone(timezone.utc).replace(tzinfo=None))
            db.add(tracking)
            db.add(ClientDevice(client_id=client.id, installation_id=f"demo{index}",token_hash=f"fake{index}",
                                platform="android",fcm_token=f"fake{index}"))
            if index == 1:
                future = (today+timedelta(days=2)).replace(tzinfo=None)
                db.add(Appointment(client_id=client.id, branch_id=branch.id, service_id=service.id,
                                   start_time=future,end_time=future+timedelta(hours=1),status="confirmed"))
            db.flush(); ids.append(tracking.id)
        db.commit()
    def session():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = session
    app.dependency_overrides[get_session_factory] = lambda: factory
    with TestClient(app) as api:
        def auth(name="admin_demo"):
            r = api.post("/auth/login", json={"username": name, "password": test_password})
            assert r.status_code == 200, r.text
            return {"Authorization": "Bearer "+r.json()["access_token"]}
        yield api, factory, ids, auth, outbox, pushes
    app.dependency_overrides.clear()
    engine.dispose()


def path(tracking_id):
    return f"/clients/retoques/{tracking_id}/recordatorio/mantenimiento"


@pytest.mark.parametrize("index,days,state", [(0,5,"sin_cita"),(1,5,"no_verificada"),(2,-3,"sin_cita")])
def test_preview_and_delivery_are_scoped_and_repeat_safe(scenario,index,days,state):
    api,factory,ids,auth,outbox,pushes=scenario
    h=auth()
    r=api.get(path(ids[index]),headers=h)
    assert r.status_code==200,r.text
    p=r.json()
    assert p["dias_restantes"]==days and p["appointment_state"]==state
    if index==1:
        assert "no se ha verificado" in p["appointment_note"]
        assert "consulta con tu sucursal" in p["message"]
    payload={"preview_version":p["preview_version"],"send_email":True,"send_push":True}
    first=api.post(path(ids[index]),headers=h,json=payload)
    assert first.status_code==200,first.text
    for _ in range(3):
        repeated=api.post(path(ids[index]),headers=h,json=payload)
        assert repeated.json()["broadcast_id"]==first.json()["broadcast_id"]
    result=api.get(path(ids[index]),headers=h).json()["result"]
    assert result["email_status"]=="sent" and result["push_status"]=="sent"
    assert len(outbox)==1 and len(pushes)==1
    with factory() as db:
        assert db.query(Broadcast).count()==1 and db.query(RetouchReminder).count()==1
        assert db.query(BroadcastRecipient).one().client_id==p["client_id"]


@pytest.mark.parametrize("user,code", [("reader_demo",403),("other_demo",403),("no_branch",403),("own_demo",200)])
def test_permissions_and_branches(scenario,user,code):
    api,_,ids,auth,_,_=scenario
    h=auth(user)
    assert api.get(path(ids[0]),headers=h).status_code==code
    assert api.post(path(ids[0]),headers=h,json={"preview_version":"x"*64,"send_push":True}).status_code==(409 if code==200 else code)


@pytest.mark.parametrize("change", ["consent","client","branch","latest","status","date"])
def test_revalidates_after_preview(scenario,change):
    api,factory,ids,auth,outbox,pushes=scenario
    h=auth();p=api.get(path(ids[0]),headers=h).json()
    with factory() as db:
        t=db.get(Tracking,ids[0]);a=db.get(Appointment,t.appointment_id)
        if change=="consent":db.get(Client,t.client_id).notificaciones_activas=False
        elif change=="client":a.client_id+=1
        elif change=="branch":t.branch_id+=1
        elif change=="latest":db.add(Tracking(client_id=t.client_id,last_application_date=datetime.utcnow()))
        elif change=="status":a.status="cancelled"
        else:t.next_maintenance_date+=timedelta(days=1)
        db.commit()
    r=api.post(path(ids[0]),headers=h,json={"preview_version":p["preview_version"],"send_push":True})
    assert r.status_code==409,r.text
    assert not outbox and not pushes


def test_unavailable_channel_and_no_channels(scenario,monkeypatch):
    api,_,ids,auth,outbox,pushes=scenario
    h=auth();p=api.get(path(ids[0]),headers=h).json()
    assert api.post(path(ids[0]),headers=h,json={"preview_version":p["preview_version"]}).status_code==400
    monkeypatch.setattr(reminders,"get_fcm_client",lambda:None)
    p=api.get(path(ids[0]),headers=h).json()
    assert not p["push_available"]
    assert api.post(path(ids[0]),headers=h,json={"preview_version":p["preview_version"],"send_push":True}).status_code==409
    assert not outbox and not pushes


def test_delivery_failure_is_visible_and_not_retried(scenario,monkeypatch):
    api,_,ids,auth,outbox,pushes=scenario
    monkeypatch.setattr(delivery,"_send_email_batch",lambda *args:set())
    h=auth();p=api.get(path(ids[0]),headers=h).json()
    payload={"preview_version":p["preview_version"],"send_email":True}
    api.post(path(ids[0]),headers=h,json=payload)
    result=api.get(path(ids[0]),headers=h).json()["result"]
    assert result["email_status"]=="failed"
    api.post(path(ids[0]),headers=h,json=payload)
    assert not outbox and not pushes


def test_consent_rechecked_before_background_delivery(scenario):
    api,factory,ids,auth,outbox,pushes=scenario
    h=auth();p=api.get(path(ids[0]),headers=h).json()
    from app.presentation.schemas.retouch_reminder import RetouchReminderSend
    with factory() as db:
        user=db.query(User).filter_by(username="admin_demo").one()
        result,created=reminders.create_reminder(db,ids[0],"mantenimiento",
            RetouchReminderSend(preview_version=p["preview_version"],send_email=True,send_push=True),user)
        assert created
        db.get(Client,p["client_id"]).notificaciones_activas=False;db.commit()
    reminders.deliver_reminder(result.broadcast_id,ids[0],"mantenimiento",factory)
    assert not outbox and not pushes
    with factory() as db:
        assert db.get(Broadcast,result.broadcast_id).status=="interrupted"
        assert not db.get(Broadcast,result.broadcast_id).send_push
        from app.application.services.broadcast_service import client_broadcast_feed
        assert client_broadcast_feed(db,p["client_id"])==[]
        receipt=db.query(RetouchReminder).one()
        result=reminders._result(db,receipt)
        assert result.send_push and result.send_email
        assert result.push_status=="failed" and result.email_status=="failed"


def test_receipt_has_postgres_primary_key():
    from sqlalchemy.schema import CreateTable
    sql=str(CreateTable(RetouchReminder.__table__).compile(dialect=postgresql.dialect()))
    assert "PRIMARY KEY (event_key)" in sql and "UNIQUE (broadcast_id)" in sql


def test_production_delivery_defaults_to_disabled_and_rejects_post(scenario,monkeypatch):
    api,factory,ids,auth,outbox,pushes=scenario
    monkeypatch.setattr(settings,"environment","production")
    monkeypatch.delenv("RETOUCH_REMINDERS_DELIVERY_MODE",raising=False)
    h=auth();p=api.get(path(ids[0]),headers=h).json()
    assert p["delivery_enabled"] is False
    response=api.post(path(ids[0]),headers=h,json={"preview_version":p["preview_version"],"send_email":True})
    assert response.status_code==503
    assert not outbox and not pushes
    with factory() as db:assert db.query(RetouchReminder).count()==0
    monkeypatch.setenv("RETOUCH_REMINDERS_DELIVERY_MODE","live")
    assert api.get(path(ids[0]),headers=h).json()["delivery_enabled"] is True


def test_concurrent_requests_create_only_one_dispatch(scenario,tmp_path):
    import sqlite3
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from app.presentation.schemas.retouch_reminder import RetouchReminderSend

    _,factory,ids,_,outbox,pushes=scenario
    # Independent connections/transactions, unlike the in-memory API fixture.
    target=tmp_path/"concurrent.db"
    connection=factory.kw["bind"].raw_connection()
    with sqlite3.connect(target) as destination:
        connection.driver_connection.backup(destination)
    connection.close()
    engine=create_engine("sqlite:///"+str(target),connect_args={"check_same_thread":False,"timeout":20})
    sessions=sessionmaker(bind=engine)
    gate=Barrier(2)
    def send():
        with sessions() as db:
            user=db.query(User).filter_by(username="admin_demo").one()
            p,_=reminders.preview_reminder(db,ids[0],"mantenimiento",user)
            gate.wait(timeout=10)
            result,created=reminders.create_reminder(db,ids[0],"mantenimiento",
                RetouchReminderSend(preview_version=p["preview_version"],send_email=True),user)
            return result.broadcast_id,created
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures=[pool.submit(send) for _ in range(2)]
            results=[f.result(timeout=30) for f in futures]
        assert results[0][0]==results[1][0]
        assert sum(int(created) for _,created in results)==1
        with sessions() as db:
            assert db.query(Broadcast).count()==1 and db.query(RetouchReminder).count()==1
        assert not outbox and not pushes
    finally:
        engine.dispose()
