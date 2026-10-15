"""Limitador de intentos en memoria del proceso — sin dependencias nuevas
(Redis, slowapi, etc.), pensado para frenar fuerza bruta scripted contra
login/registro. No es un rate-limiter distribuido (si se corre con varios
workers, cada uno lleva su propio conteo), pero es infinitamente mejor que
no tener ningún límite, que era el estado anterior."""
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

_attempts: dict[str, list[float]] = defaultdict(list)


def _bucket_key(request: Request, key_prefix: str, subject: str | None) -> str:
    if subject is not None:
        return f"{key_prefix}:{subject}"
    ip = request.client.host if request.client else "unknown"
    return f"{key_prefix}:{ip}"


def rate_limit_check(
    request: Request,
    key_prefix: str,
    max_attempts: int = 5,
    window_seconds: int = 60,
    subject: str | None = None,
) -> None:
    """Levanta 429 si la cubeta ya tiene `max_attempts` intentos en los últimos
    `window_seconds` segundos, SIN registrar uno nuevo. La cubeta es la IP, o
    `subject` si se indica (p. ej. la cuenta, cuando todas las llamadas
    legítimas vienen de la misma IP)."""
    key = _bucket_key(request, key_prefix, subject)
    now = time.time()
    attempts = _attempts[key]
    attempts[:] = [t for t in attempts if now - t < window_seconds]
    if len(attempts) >= max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Espera un minuto e intenta de nuevo.",
        )


def rate_limit_record(
    request: Request, key_prefix: str, subject: str | None = None
) -> None:
    """Registra un intento en la cubeta (ver rate_limit_check)."""
    _attempts[_bucket_key(request, key_prefix, subject)].append(time.time())


def rate_limit(
    request: Request,
    key_prefix: str,
    max_attempts: int = 5,
    window_seconds: int = 60,
) -> None:
    """Levanta 429 si la IP ya hizo `max_attempts` intentos en los últimos
    `window_seconds` segundos para esta acción (`key_prefix`); si no, registra
    el intento."""
    rate_limit_check(request, key_prefix, max_attempts, window_seconds)
    rate_limit_record(request, key_prefix)
