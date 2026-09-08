"""
Migracion: agrega is_active (activar/desactivar el servicio para venta y
reserva) y discount_percent (promoción temporal sobre el precio base, sin
tener que editar el precio a mano) a la tabla services.
Ejecutar con: python -m app.infrastructure.database.migrations.add_is_active_and_discount_to_services
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

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


def _add_column(conn, table_name: str, column_name: str, col_def: str, is_sqlite: bool) -> None:
    if _column_exists(conn, table_name, column_name, is_sqlite):
        return
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {col_def}"))
    conn.commit()
    print(f"Columna {column_name} agregada a {table_name}.")


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")

    with engine.connect() as conn:
        _add_column(conn, "services", "is_active", "BOOLEAN NOT NULL DEFAULT 1" if is_sqlite else "BOOLEAN NOT NULL DEFAULT TRUE", is_sqlite)
        _add_column(conn, "services", "discount_percent", "REAL NULL", is_sqlite)


if __name__ == "__main__":
    upgrade()
