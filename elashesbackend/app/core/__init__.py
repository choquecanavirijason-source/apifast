"""Cross-cutting concerns: dependencias compartidas que no pertenecen a una capa específica.

Para seguridad (JWT, password hashing) ver `app.infrastructure.security`.
"""
from app.core.dependencies import (
    get_db,
    get_current_user,
    get_current_active_user,
    require_role,
    require_any_role,
    require_permission,
    require_any_permission,
)

__all__ = [
    "get_db",
    "get_current_user",
    "get_current_active_user",
    "require_role",
    "require_any_role",
    "require_permission",
    "require_any_permission",
]
