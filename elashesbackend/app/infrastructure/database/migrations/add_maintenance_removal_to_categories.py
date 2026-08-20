"""
Migracion: mueve mantenimiento/retiro de efectos/volumenes/disenos de
pestanas (que resultaron no tener mucho sentido ahi, se descartaron) a
service_categories (has_maintenance, maintenance_days, has_removal,
removal_days) — solo algunas categorias de servicio (ej. Extensiones)
necesitan retoque/retiro, otras no (ej. Lifting, Tratamientos).
Ejecutar con: python -m app.infrastructure.database.migrations.add_maintenance_removal_to_categories
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text

from app.config.settings import settings
from app.infrastructure.database import engine


def _column_exists(conn, table_name: str, column_name: str, is_sqlite: bool) -> bool:
    if is_sqlite:
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        return any(row[1] == column_name for row in result)

    result = conn.execute(
        text(
            """
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = :table_name AND column_name = :column_name
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    )
    return result.scalar() > 0


def _add_bool_column(conn, table_name: str, column_name: str, bool_type: str) -> None:
    if _column_exists(conn, table_name, column_name, True):
        return
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {bool_type} NOT NULL DEFAULT 0"))
    conn.commit()
    print(f"Columna {column_name} agregada a {table_name}.")


def _add_nullable_int_column(conn, table_name: str, column_name: str, is_sqlite: bool) -> None:
    if _column_exists(conn, table_name, column_name, is_sqlite):
        return
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} INTEGER NULL"))
    conn.commit()
    print(f"Columna {column_name} agregada a {table_name}.")


def _drop_column_if_exists(conn, table_name: str, column_name: str, is_sqlite: bool) -> None:
    if not _column_exists(conn, table_name, column_name, is_sqlite):
        return
    try:
        # SQLite soporta DROP COLUMN desde 3.35 (2021); si falla, se ignora
        # y la columna vieja queda sin uso — no rompe nada.
        conn.execute(text(f"ALTER TABLE {table_name} DROP COLUMN {column_name}"))
        conn.commit()
        print(f"Columna {column_name} eliminada de {table_name}.")
    except Exception as e:
        conn.rollback()
        print(f"No se pudo eliminar {column_name} de {table_name} (se deja sin usar): {e}")


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    bool_type = "BOOLEAN" if is_sqlite else "TINYINT(1)"

    with engine.connect() as conn:
        _add_bool_column(conn, "service_categories", "has_maintenance", bool_type)
        _add_bool_column(conn, "service_categories", "has_removal", bool_type)
        # maintenance_days/removal_days en service_categories se descartó —
        # los días se cargan por Service, no por categoría (ver migración
        # move_maintenance_removal_days_to_services). Si esta migración ya
        # corrió antes y los llegó a crear, esa migración los elimina.

        for table_name in ("effects", "volumes", "lash_designs"):
            _drop_column_if_exists(conn, table_name, "maintenance_days", is_sqlite)
            _drop_column_if_exists(conn, table_name, "removal_days", is_sqlite)


if __name__ == "__main__":
    upgrade()
