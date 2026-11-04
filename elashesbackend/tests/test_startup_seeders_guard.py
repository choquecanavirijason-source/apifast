"""Startup policy and preservation of business data; never uses a real database."""
import asyncio
import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

import main
from app.config.settings import Settings
from app.infrastructure.database import Base
from app.infrastructure.database.seeders import run_seeders


@pytest.mark.parametrize("environment,override,expected", [
    ("development", None, True), ("test", None, True),
    ("production", None, False), (" PROD ", None, False),
    ("Production", None, False), ("development", False, False),
    ("production", False, False), ("production", True, True),
    ("development", True, True),
])
def test_startup_policy(environment, override, expected):
    config = Settings(_env_file=None, environment=environment, run_startup_seeders=override)
    assert config.should_run_startup_seeders is expected


def test_environment_switches(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("RUN_STARTUP_SEEDERS", raising=False)
    assert not Settings(_env_file=None).should_run_startup_seeders
    monkeypatch.setenv("RUN_STARTUP_SEEDERS", "true")
    assert Settings(_env_file=None).should_run_startup_seeders
    monkeypatch.setenv("RUN_STARTUP_SEEDERS", "false")
    assert not Settings(_env_file=None).should_run_startup_seeders
    monkeypatch.setenv("RUN_STARTUP_SEEDERS", "invalid")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


@pytest.fixture
def startup(monkeypatch):
    migrations = []
    for name, module in vars(main).copy().items():
        if name.startswith("m") and name[1:].isdigit() and hasattr(module, "upgrade"):
            spy = Mock()
            monkeypatch.setattr(module, "upgrade", spy)
            migrations.append(spy)
    scheduler = Mock()
    monkeypatch.setattr(main, "AsyncIOScheduler", Mock(return_value=scheduler))
    monkeypatch.setattr(main, "client_notices_active", lambda: False)
    init = Mock()
    recover = Mock(return_value=0)
    seed = Mock()
    monkeypatch.setattr(main, "init_db", init)
    monkeypatch.setattr(main, "mark_interrupted_broadcasts", recover)
    monkeypatch.setattr(main, "run_seeders", seed)
    db = Mock()
    monkeypatch.setattr(main, "SessionLocal", lambda: db)
    return SimpleNamespace(init=init, recover=recover, seed=seed, scheduler=scheduler,
                           migrations=migrations, db=db)


@pytest.mark.parametrize("environment,override,enabled", [
    ("production", None, False), ("development", False, False),
    ("development", None, True), ("production", True, True),
])
def test_guard_keeps_other_startup_steps(monkeypatch, startup, environment, override, enabled):
    monkeypatch.setattr(main, "settings", Settings(_env_file=None, environment=environment,
                                                  run_startup_seeders=override))

    async def exercise():
        async with main.lifespan(main.app):
            startup.init.assert_called_once()
            assert startup.migrations
            for migration in startup.migrations:
                migration.assert_called_once()
            startup.recover.assert_called_once_with(startup.db)
            startup.scheduler.start.assert_called_once()
            assert startup.scheduler.add_job.called

    asyncio.run(exercise())
    assert startup.seed.call_count == int(enabled)
    startup.db.close.assert_called_once()
    startup.scheduler.shutdown.assert_called_once_with(wait=False)


def snapshot(engine):
    with engine.connect() as conn:
        quote = engine.dialect.identifier_preparer.quote
        return {
            table: sorted(json.dumps(dict(row), sort_keys=True, default=str)
                          for row in conn.execute(text("SELECT * FROM " + quote(table))).mappings())
            for table in inspect(conn).get_table_names()
        }


def test_protected_startup_preserves_business_records(monkeypatch, startup, tmp_path):
    engine = create_engine("sqlite:///" + str(tmp_path / "synthetic.db"))
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    try:
        with sessions() as db:
            run_seeders(db)
            for sql in (
                "UPDATE users SET commission_rate=0.123, is_active=0, skill_level=1",
                "UPDATE branches SET address='Synthetic sentinel'",
                "DELETE FROM role_permissions",
                "UPDATE services SET price=987.65, commission_rate=0.123",
                "UPDATE products SET price=876.54,cost=765.43,min_stock=99",
                "UPDATE batches SET initial_quantity=999,current_quantity=7",
            ):
                db.execute(text(sql))
            db.commit()
        before = snapshot(engine)
        for table in ("users", "branches", "services", "products", "batches", "inventory_movements"):
            assert before[table], "Fixture must contain business data"
        monkeypatch.setattr(main, "SessionLocal", sessions)
        monkeypatch.setattr(main, "settings", Settings(_env_file=None, environment="production",
                                                      run_startup_seeders=False))
        asyncio.run(_start_and_stop())
        startup.seed.assert_not_called()
        assert snapshot(engine) == before
    finally:
        engine.dispose()


async def _start_and_stop():
    async with main.lifespan(main.app):
        pass
