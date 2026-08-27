"""
Migracion: agrega columnas cash_received y cash_change a payments.
Ejecutar con: python -m app.infrastructure.database.migrations.add_cash_received_to_payments
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text

from app.config.settings import settings
from app.infrastructure.database import engine


def _column_exists(conn, is_sqlite: bool, column: str) -> bool:
    if is_sqlite:
        result = conn.execute(text("PRAGMA table_info(payments)"))
        return any(row[1] == column for row in result)
    result = conn.execute(
        text(
            """
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'payments' AND column_name = :column
            """
        ),
        {"column": column},
    )
    return result.scalar() > 0


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        for column in ("cash_received", "cash_change"):
            if not _column_exists(conn, is_sqlite, column):
                conn.execute(text(f"ALTER TABLE payments ADD COLUMN {column} FLOAT NULL"))
                conn.commit()
                print(f"Columna {column} agregada a payments.")
            else:
                print(f"La columna {column} ya existe en payments.")


if __name__ == "__main__":
    upgrade()
