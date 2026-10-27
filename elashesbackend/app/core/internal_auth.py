"""Autenticación server-to-server: backend_marketplace envía el secreto
compartido (settings.internal_api_key) en el header X-Internal-Key."""
import hmac
import logging
from typing import Optional

from fastapi import HTTPException, Request, status

from app.config.settings import settings
from app.core.rate_limit import rate_limit

logger = logging.getLogger("elashes.internal_auth")


def missing_internal_key_warning() -> Optional[str]:
    """Mensaje para el log si los avisos a la app están activos pero falta
    INTERNAL_API_KEY: sin ella ningún teléfono se registra al iniciar sesión
    (POST /dispositivos -> 503) y no le llega ningún push. Pasó al editar el
    .env del servidor a mano: el error quedaba escondido en un 503."""
    from app.application.services.appointment_notice_service import client_notices_active

    if client_notices_active() and not settings.internal_api_key:
        return (
            "INTERNAL_API_KEY no está configurada: los teléfonos NO se registran al "
            "iniciar sesión y no reciben avisos ni push. Debe tener el mismo valor "
            "que INTERNAL_API_KEY de marketplaceapi (elashesbackend/.env)."
        )
    return None


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
        logger.error("Registro de dispositivo rechazado (503): %s", missing_internal_key_warning() or
                     "INTERNAL_API_KEY no está configurada.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clave interna no configurada",
        )
    if not has_valid_internal_key(x_internal_key):
        rate_limit(request, key_prefix, max_attempts=10, window_seconds=60)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Clave interna inválida"
        )
