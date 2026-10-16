"""Autenticación server-to-server: backend_marketplace envía el secreto
compartido (settings.internal_api_key) en el header X-Internal-Key."""
import hmac
from typing import Optional

from fastapi import HTTPException, Request, status

from app.config.settings import settings
from app.core.rate_limit import rate_limit


def has_valid_internal_key(x_internal_key: Optional[str]) -> bool:
    """True solo si hay clave configurada y la recibida coincide (tiempo constante)."""
    expected = settings.internal_api_key
    if not expected or not x_internal_key:
        return False
    return hmac.compare_digest(x_internal_key.encode("utf-8"), expected.encode("utf-8"))


def require_internal_key(request: Request, x_internal_key: Optional[str], key_prefix: str) -> None:
    """503 si no hay clave configurada; 401 si la recibida falta o no coincide.

    Todas las llamadas legítimas llegan desde la IP del marketplace, así que el
    límite por IP (cubeta `key_prefix`) cuenta solo los intentos con clave
    ausente o incorrecta (fuerza bruta); las llamadas válidas nunca consumen cupo.
    """
    if not settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clave interna no configurada",
        )
    if not has_valid_internal_key(x_internal_key):
        rate_limit(request, key_prefix, max_attempts=10, window_seconds=60)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Clave interna inválida"
        )
