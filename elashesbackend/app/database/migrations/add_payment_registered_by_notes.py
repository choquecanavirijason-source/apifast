"""
Migración: agrega registered_by_id y notes a payments.
Ejecutar con: python -m app.database.migrations.add_payment_registered_by_notes
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text
from app.database import engine
from app.config.settings import settings


def _column_exists(conn, is_sqlite: bool, table: str, col: str) -> bool:
    if is_sqlite:
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        return any(row[1] == col for row in result)
    # MySQL
    result = conn.execute(text("""
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = :tbl AND column_name = :col
    """), {"tbl": table, "col": col})
    return result.scalar() > 0


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        if not _column_exists(conn, is_sqlite, "payments", "registered_by_id"):
            sql = "ALTER TABLE payments ADD COLUMN registered_by_id INTEGER"
            if not is_sqlite:
                sql += " REFERENCES users(id)"
            conn.execute(text(sql))
            conn.commit()
            print("Columna registered_by_id agregada a payments.")
        else:
            print("La columna registered_by_id ya existe.")

        if not _column_exists(conn, is_sqlite, "payments", "notes"):
            conn.execute(text("ALTER TABLE payments ADD COLUMN notes TEXT"))
            conn.commit()
            print("Columna notes agregada a payments.")
        else:
            print("La columna notes ya existe.")


if __name__ == "__main__":
    upgrade()
