"""
Migracion: agrega maintenance_reminder_sent / removal_reminder_sent a
client_tracking — banderas para que el chequeo diario de recordatorios (ver
app/application/services/reminder_service.py) no reenvie el mismo aviso cada
dia una vez que ya se genero.
Ejecutar con: python -m app.infrastructure.database.migrations.add_reminder_flags_to_tracking
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


def _add_bool_column(conn, table_name: str, column_name: str, bool_type: str, is_sqlite: bool) -> None:
    if _column_exists(conn, table_name, column_name, is_sqlite):
        return
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {bool_type} NOT NULL DEFAULT 0"))
    conn.commit()
    print(f"Columna {column_name} agregada a {table_name}.")


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    bool_type = "BOOLEAN" if is_sqlite else "TINYINT(1)"

    with engine.connect() as conn:
        _add_bool_column(conn, "client_tracking", "maintenance_reminder_sent", bool_type, is_sqlite)
        _add_bool_column(conn, "client_tracking", "removal_reminder_sent", bool_type, is_sqlite)


if __name__ == "__main__":
    upgrade()
