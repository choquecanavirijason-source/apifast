"""Opt-in, actual PG16 migration/concurrency test. Only a NEW local scratch DB.

Set RETOUCH_PG_TEST_URL to localhost:15432/elashes_retouch_test_<suffix>.
Never uses DATABASE_URL or a production database; refuses nonempty databases.
"""
import importlib.util
import os
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Barrier

import psycopg2
import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

URL = os.environ.get('RETOUCH_PG_TEST_URL')
pytestmark = pytest.mark.skipif(not URL, reason='Explicit local PostgreSQL 16 scratch database required')


def test_pg16_migration_concurrency_and_downgrade(monkeypatch):
    url = make_url(URL)
    assert url.host in ('127.0.0.1', 'localhost') and url.port == 15432
    assert url.database.startswith('elashes_retouch_test_')
    # Imports do not run the application lifespan or any providers.
    import main
    from app.application.services import retouch_reminder_service as service, broadcast_delivery_service as delivery, push_service
    from app.config.settings import settings
    from app.domain.entities.audit_log import AuditLog
    from app.domain.entities.branch import Branch
    from app.domain.entities.broadcast import Broadcast, BroadcastRecipient
    from app.domain.entities.client import Client
    from app.domain.entities.client_device import ClientDevice
    from app.domain.entities.retouch_reminder import RetouchReminder
    from app.domain.entities.service_agenda import Appointment, Service, ServiceCategory
    from app.domain.entities.tracking import Tracking
    from app.domain.entities.user import Role, User
    from app.infrastructure.database import Base
    from app.infrastructure.push.fcm_client import FcmResult
    from app.presentation.schemas.retouch_reminder import RetouchReminderSend

    path = Path(__file__).resolve().parents[1] / 'deploy/retouch-release/schema.py'
    spec = importlib.util.spec_from_file_location('retouch_schema', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine(URL)
    assert inspect(engine).get_table_names() == [], 'Refusing an existing/nonempty database'
    Base.metadata.create_all(engine)
    RetouchReminder.__table__.drop(engine)
    connection = psycopg2.connect(URL)
    sessions = sessionmaker(bind=engine)
    emails, pushes = [], []

    class Fcm:
        def send_data(self, token, data, notification=None):
            pushes.append(token)
            return FcmResult.SENT

    class Smtp:
        def send_message(self, message):
            emails.append(message['To'])

    @contextmanager
    def smtp():
        yield Smtp()

    monkeypatch.setenv('RETOUCH_REMINDERS_DELIVERY_MODE', 'live')
    monkeypatch.setattr(service, 'get_fcm_client', lambda: Fcm())
    monkeypatch.setattr(push_service, 'get_fcm_client', lambda: Fcm())
    monkeypatch.setattr(delivery, 'smtp_connection', smtp)
    monkeypatch.setattr(settings, 'smtp_host', 'fake.invalid')
    monkeypatch.setattr(settings, 'smtp_from_email', 'demo@example.com')
    try:
        migration.migrate(connection, 'upgrade')
        migration.migrate(connection, 'upgrade')
        migration.migrate(connection, 'check')
        with sessions() as db:
            role, branch = Role(name='SuperAdmin'), Branch(name='PG16 FICTICIA', address='Prueba')
            db.add_all([role, branch]); db.flush()
            user = User(username='pg16_demo', email='pg16@example.com', hashed_password='unused',
                        role_id=role.id, branch_id=branch.id, is_active=True)
            client = Client(name='PG16 FICTICIA', last_name='PRUEBA', branch_id=branch.id, email='fake@example.com')
            category = ServiceCategory(name='PG16 DEMO', has_maintenance=True)
            db.add_all([user, client, category]); db.flush()
            item = Service(name='Extensiones PG16', duration_minutes=60, price=100,
                           category_id=category.id, maintenance_days=21)
            db.add(item); db.flush()
            applied = datetime.utcnow() - timedelta(days=16)
            appointment = Appointment(client_id=client.id, branch_id=branch.id, service_id=item.id,
                start_time=applied, end_time=applied+timedelta(hours=1), status='completed')
            db.add(appointment); db.flush()
            tracking = Tracking(client_id=client.id, branch_id=branch.id, appointment_id=appointment.id,
                last_application_date=applied, next_maintenance_date=applied+timedelta(days=21))
            db.add(tracking)
            db.add(ClientDevice(client_id=client.id, installation_id='PG16-FAKE-ONLY', platform='android',
                                token_hash='PG16-FAKE-HASH', fcm_token='PG16-FAKE-TOKEN'))
            db.commit()
            user_id, tracking_id = user.id, tracking.id
        gate = Barrier(2)

        def request():
            with sessions() as db:
                user = db.get(User, user_id)
                preview, _ = service.preview_reminder(db, tracking_id, 'mantenimiento', user)
                gate.wait(timeout=10)
                return service.create_reminder(db, tracking_id, 'mantenimiento',
                    RetouchReminderSend(preview_version=preview['preview_version'], send_push=True, send_email=True), user)

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(request) for _ in range(2)]
            results = [future.result(timeout=30) for future in futures]
        assert sum(int(created) for _, created in results) == 1
        assert results[0][0].broadcast_id == results[1][0].broadcast_id
        bid = results[0][0].broadcast_id
        service.deliver_reminder(bid, tracking_id, 'mantenimiento', sessions)
        with sessions() as db:
            user = db.get(User, user_id)
            preview, _ = service.preview_reminder(db, tracking_id, 'mantenimiento', user)
            result, created = service.create_reminder(db, tracking_id, 'mantenimiento',
                RetouchReminderSend(preview_version=preview['preview_version'], send_push=True, send_email=True), user)
            assert not created and result.broadcast_id == bid
            assert db.query(RetouchReminder).count() == db.query(Broadcast).count() == 1
        assert len(emails) == len(pushes) == 1
        with pytest.raises(RuntimeError, match='Receipts exist'):
            migration.migrate(connection, 'downgrade')
        migration.migrate(connection, 'check')
        with connection:
            with connection.cursor() as cursor:
                with pytest.raises(psycopg2.errors.ForeignKeyViolation):
                    cursor.execute("INSERT INTO retouch_reminders VALUES (%s,%s,%s)", ('f'*64, -1, 'f'*64))
        connection.rollback()
        # Only synthetic scratch records, never production. Empty-table down/up.
        with sessions() as db:
            db.query(RetouchReminder).delete(); db.query(BroadcastRecipient).delete()
            db.query(AuditLog).delete(); db.query(Broadcast).delete(); db.commit()
        before = set(inspect(engine).get_table_names())
        migration.migrate(connection, 'downgrade')
        assert set(inspect(engine).get_table_names()) == before - {'retouch_reminders'}
        migration.migrate(connection, 'upgrade')
        migration.migrate(connection, 'check')
    finally:
        connection.close()
        engine.dispose()
