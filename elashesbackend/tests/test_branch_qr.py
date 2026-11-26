"""QR de pago de la sucursal: se sube como imagen, se valida y cada cambio queda en Auditoría
(quién, cuándo y qué). La edición normal de la sucursal ya no puede tocar el QR.

Ejecutar:
  cd elashesbackend
  pytest tests/test_branch_qr.py -v
"""
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # registra los modelos sin ejecutar migraciones
from app.core.dependencies import get_current_active_user, get_db
from app.domain.entities.audit_log import AuditLog
from app.domain.entities.branch import Branch
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database import Base
from app.presentation.controllers.branch_controller import router

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


@pytest.fixture
def work():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    manage, view = Permission(name="branches:manage"), Permission(name="branches:view")
    role = Role(name="Admin")
    role.permissions = [manage, view]
    branch = Branch(name="Principal", address="Calle 1", city="LP", department="Bolivia")
    db.add_all([manage, view, role, branch])
    db.flush()
    admin = User(username="admin_t", email="a@test.com", hashed_password="x", role_id=role.id, is_active=True)
    db.add(admin)
    db.commit()

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: admin
    with TestClient(app) as api:
        yield SimpleNamespace(api=api, db=db, branch=branch.id)
    db.close()
    engine.dispose()


def upload(w, content, name="qr.png", mime="image/png"):
    return w.api.post(f"/branches/{w.branch}/qr", files={"file": (name, content, mime)})


def audits(w):
    return w.db.query(AuditLog).filter(AuditLog.entity_type == "branch_qr").order_by(AuditLog.id).all()


def test_upload_saves_qr_and_records_who_and_when(work):
    res = upload(work, PNG)
    assert res.status_code == 200
    body = res.json()
    assert body["qr_image_url"].startswith("data:image/png;base64,")
    assert body["qr_updated_by_name"] == "admin_t"
    assert body["qr_updated_at"]
    log = audits(work)
    assert len(log) == 1 and log[0].action == "create" and log[0].user_id is not None
    assert "cargado por primera vez" in log[0].description


def test_replace_is_audited_as_update(work):
    upload(work, PNG)
    assert upload(work, JPG, "qr.jpg", "image/jpeg").status_code == 200
    log = audits(work)
    assert [l.action for l in log] == ["create", "update"]
    assert "reemplazado" in log[1].description


def test_rejects_non_image_even_with_image_content_type(work):
    res = upload(work, b"<svg onload=alert(1)></svg>", "qr.png", "image/png")
    assert res.status_code == 400
    assert audits(work) == []


def test_rejects_too_big_and_empty(work):
    assert upload(work, PNG + b"\x00" * (2 * 1024 * 1024)).status_code == 400
    assert upload(work, b"").status_code == 400
    assert audits(work) == []


def test_delete_clears_qr_and_is_audited(work):
    upload(work, PNG)
    res = work.api.delete(f"/branches/{work.branch}/qr")
    assert res.status_code == 200 and res.json()["qr_image_url"] is None
    assert [l.action for l in audits(work)] == ["create", "delete"]


def test_delete_without_qr_does_not_create_noise(work):
    assert work.api.delete(f"/branches/{work.branch}/qr").status_code == 200
    assert audits(work) == []


def test_normal_branch_edit_cannot_change_qr(work):
    upload(work, PNG)
    res = work.api.put(f"/branches/{work.branch}", json={"name": "Principal", "qr_image_url": "https://evil/x.png"})
    assert res.status_code == 200
    assert res.json()["qr_image_url"].startswith("data:image/png;base64,")
