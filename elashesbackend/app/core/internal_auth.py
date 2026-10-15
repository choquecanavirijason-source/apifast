"""Autenticación server-to-server: backend_marketplace envía el secreto
compartido (settings.internal_api_key) en el header X-Internal-Key."""
import hmac
from typing import Optional

from app.config.settings import settings


def has_valid_internal_key(x_internal_key: Optional[str]) -> bool:
    """True solo si hay clave configurada y la recibida coincide (tiempo constante)."""
    expected = settings.internal_api_key
    if not expected or not x_internal_key:
        return False
    return hmac.compare_digest(x_internal_key.encode("utf-8"), expected.encode("utf-8"))
