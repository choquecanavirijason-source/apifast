"""
Migracion: los DIAS de mantenimiento/retiro se mueven de service_categories a
services (pueden variar entre servicios de la misma categoria, ej.
"Extensiones Clasicas" vs "Volumen 5D"). service_categories conserva
has_maintenance/has_removal — esos checks solo habilitan los campos de dias
en el formulario del servicio, no guardan una duracion ellos mismos.
Ejecutar con: python -m app.infrastructure.database.migrations.move_maintenance_removal_days_to_services
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
        conn.execute(text(f"ALTER TABLE {table_name} DROP COLUMN {column_name}"))
        conn.commit()
        print(f"Columna {column_name} eliminada de {table_name}.")
    except Exception as e:
        conn.rollback()
        print(f"No se pudo eliminar {column_name} de {table_name} (se deja sin usar): {e}")


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")

    with engine.connect() as conn:
        _add_nullable_int_column(conn, "services", "maintenance_days", is_sqlite)
        _add_nullable_int_column(conn, "services", "removal_days", is_sqlite)

        _drop_column_if_exists(conn, "service_categories", "maintenance_days", is_sqlite)
        _drop_column_if_exists(conn, "service_categories", "removal_days", is_sqlite)


if __name__ == "__main__":
    upgrade()
