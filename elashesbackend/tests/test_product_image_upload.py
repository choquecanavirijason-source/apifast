"""Subir la foto de un producto: lo puede hacer quien gestiona inventario (la cajera), solo imágenes.

Ejecutar:
  cd elashesbackend
  pytest tests/test_product_image_upload.py -v
"""
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.core.media as media
import app.infrastructure.database.init_db  # registra los modelos sin ejecutar migraciones
from app.core.dependencies import get_current_active_user, get_db
from app.domain.entities.branch import Branch
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database import Base
from app.presentation.controllers.inventory_controller import router

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


@pytest.fixture
def work(tmp_path, monkeypatch):
    monkeypatch.setattr(media, "MEDIA_ROOT", str(tmp_path))
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    perm = Permission(name="inventory:manage")
    cashier_role, viewer_role = Role(name="Cajera"), Role(name="Operaria")
    cashier_role.permissions = [perm]
    branch = Branch(name="Norte", address="Calle 1", city="LP", department="LP")
    db.add_all([perm, cashier_role, viewer_role, branch])
    db.flush()
    cashier = User(username="caja", email="c@test.com", hashed_password="x", role_id=cashier_role.id, branch_id=branch.id, is_active=True)
    viewer = User(username="op", email="o@test.com", hashed_password="x", role_id=viewer_role.id, branch_id=branch.id, is_active=True)
    db.add_all([cashier, viewer])
    db.commit()

    holder = SimpleNamespace(user=cashier)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: holder.user
    with TestClient(app) as api:
        yield SimpleNamespace(api=api, holder=holder, viewer=viewer, root=tmp_path)
    db.close()
    engine.dispose()


def test_cashier_uploads_a_product_photo(work):
    response = work.api.post("/inventory/products/upload-image", files={"file": ("foto.png", PNG, "image/png")})
    assert response.status_code == 201, response.text
    path = response.json()["image_url"]
    assert path.startswith("/media/products/") and path.endswith(".png")
    assert (work.root / "products" / path.rsplit("/", 1)[1]).read_bytes() == PNG


def test_only_images_are_accepted(work):
    response = work.api.post("/inventory/products/upload-image", files={"file": ("virus.exe", b"MZ", "application/octet-stream")})
    assert response.status_code == 400


def test_user_without_inventory_permission_is_rejected(work):
    work.holder.user = work.viewer
    response = work.api.post("/inventory/products/upload-image", files={"file": ("foto.png", PNG, "image/png")})
    assert response.status_code == 403
