"""
Migracion: agrega columnas maintenance_days y removal_days a effects,
volumes y lash_designs (dias hasta retoque/retiro por item de catalogo),
y next_maintenance_date / next_removal_date a client_tracking (fechas
calculadas al registrar el seguimiento).
Ejecutar con: python -m app.infrastructure.database.migrations.add_maintenance_removal_days
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


def _add_column(conn, table_name: str, column_name: str, col_type: str, is_sqlite: bool) -> None:
    if _column_exists(conn, table_name, column_name, is_sqlite):
        return
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {col_type} NULL"))
    conn.commit()
    print(f"Columna {column_name} agregada a {table_name}.")


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    int_type = "INTEGER"
    datetime_type = "DATETIME" if is_sqlite else "DATETIME"

    with engine.connect() as conn:
        for table_name in ("effects", "volumes", "lash_designs"):
            _add_column(conn, table_name, "maintenance_days", int_type, is_sqlite)
            _add_column(conn, table_name, "removal_days", int_type, is_sqlite)

        _add_column(conn, "client_tracking", "next_maintenance_date", datetime_type, is_sqlite)
        _add_column(conn, "client_tracking", "next_removal_date", datetime_type, is_sqlite)


if __name__ == "__main__":
    upgrade()
