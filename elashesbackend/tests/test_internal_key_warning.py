"""Aviso de INTERNAL_API_KEY faltante: sin ella ningún teléfono se registra
al iniciar sesión (POST /dispositivos -> 503) y no le llegan avisos ni push,
sin ningún otro error visible."""
from app.config.settings import settings
from app.core import internal_auth


def test_avisa_si_los_avisos_estan_activos_y_falta_la_clave(monkeypatch):
    monkeypatch.setattr(settings, "client_notices_enabled", True)
    monkeypatch.setattr(settings, "internal_api_key", None)
    warning = internal_auth.missing_internal_key_warning()
    assert warning and "INTERNAL_API_KEY" in warning


def test_no_avisa_con_clave(monkeypatch):
    monkeypatch.setattr(settings, "client_notices_enabled", True)
    monkeypatch.setattr(settings, "internal_api_key", "x" * 43)
    assert internal_auth.missing_internal_key_warning() is None


def test_no_avisa_si_los_avisos_estan_apagados(monkeypatch):
    monkeypatch.setattr(settings, "client_notices_enabled", False)
    monkeypatch.setattr(settings, "internal_api_key", None)
    assert internal_auth.missing_internal_key_warning() is None
