"""
Rate limit de POST /clients/verify-salon-login:
  - sin X-Internal-Key válida: 5 por minuto por IP (cuenta todas las llamadas);
  - con X-Internal-Key válida: 5 intentos fallidos por minuto por cuenta.

Ejecutar:
  cd elashesbackend
  pytest tests/test_verify_salon_login.py -v
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # noqa: F401  (registra todos los modelos)
from app.config.settings import settings
from app.core import dependencies
from app.domain.entities.client import Client
from app.infrastructure.database.base_class import Base
from app.presentation.controllers.client_controller import router

KEY = "clave-interna-de-prueba"
URL = "/clients/verify-salon-login"


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", KEY)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    db.add_all([
        Client(name="Ana", last_name="Lopez", email="ana@test.com", ci="1111", marketplace_enabled=True),
        Client(name="Bea", last_name="Perez", email="bea@test.com", ci="2222", marketplace_enabled=True),
    ])
    db.commit()
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[dependencies.get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    db.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def login(api: TestClient, email: str, ci: str, key: str | None = None):
    headers = {"X-Internal-Key": key} if key is not None else {}
    return api.post(URL, json={"email": email, "ci": ci}, headers=headers)


class TestSinClave:
    def test_5_por_minuto_por_ip_contando_todas_las_llamadas(self, api):
        # incluso con credenciales válidas, la 6ª llamada de la misma IP se frena
        codes = [login(api, "ana@test.com", "1111").status_code for _ in range(6)]
        assert codes == [200] * 5 + [429]

    def test_el_limite_es_por_ip_no_por_cuenta(self, api):
        for _ in range(5):
            login(api, "ana@test.com", "mal")
        assert login(api, "bea@test.com", "2222").status_code == 429


class TestClaveIncorrecta:
    def test_se_trata_igual_que_sin_clave(self, api):
        codes = [login(api, "ana@test.com", "1111", key="otra").status_code for _ in range(6)]
        assert codes == [200] * 5 + [429]

    def test_no_se_vuelve_por_cuenta(self, api):
        for _ in range(5):
            login(api, "ana@test.com", "mal", key="otra")
        assert login(api, "bea@test.com", "2222", key="otra").status_code == 429


class TestClaveValida:
    def test_logins_validos_no_consumen_cupo(self, api):
        for _ in range(12):
            resp = login(api, "ana@test.com", "1111", key=KEY)
            assert resp.status_code == 200 and resp.json()["valid"] is True
        assert resp.json()["id"] is not None

    def test_5_fallos_por_cuenta_y_el_sexto_intento_se_bloquea(self, api):
        for _ in range(5):
            resp = login(api, "ana@test.com", "mal", key=KEY)
            assert resp.status_code == 200 and resp.json() == {"valid": False}
        assert login(api, "ana@test.com", "mal", key=KEY).status_code == 429
        # la cuenta bloqueada tampoco acepta ya el CI correcto durante el minuto
        assert login(api, "ana@test.com", "1111", key=KEY).status_code == 429

    def test_otra_cuenta_no_se_ve_afectada(self, api):
        for _ in range(5):
            login(api, "ana@test.com", "mal", key=KEY)
        resp = login(api, "bea@test.com", "2222", key=KEY)
        assert resp.status_code == 200 and resp.json()["valid"] is True

    def test_identificador_en_minusculas_comparte_cubeta(self, api):
        for _ in range(5):
            login(api, "ANA@test.com", "mal", key=KEY)
        assert login(api, "ana@test.com", "mal", key=KEY).status_code == 429

    def test_no_consume_el_cupo_por_ip_de_llamadas_sin_clave(self, api):
        for _ in range(5):
            login(api, "ana@test.com", "mal", key=KEY)
        # la IP no se ve afectada por los fallos con clave: sin clave sigue teniendo sus 5
        assert login(api, "bea@test.com", "2222").status_code == 200
