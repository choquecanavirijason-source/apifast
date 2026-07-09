"""Capa de seguridad de infraestructura.

Re-exporta los símbolos públicos para que el resto del código use:
    from app.infrastructure.security import (
        verify_password, get_password_hash,
        create_access_token, decode_token,
    )
"""
from app.infrastructure.security.password import (
    verify_password,
    get_password_hash,
)
from app.infrastructure.security.jwt import (
    JWTError,
    create_access_token,
    decode_token,
)

__all__ = [
    "verify_password",
    "get_password_hash",
    "JWTError",
    "create_access_token",
    "decode_token",
]
