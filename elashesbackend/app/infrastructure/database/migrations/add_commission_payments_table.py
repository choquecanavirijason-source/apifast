"""Migration: crea la tabla commission_payments para historial de pagos de comisión."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import text
from app.infrastructure.database import engine


def upgrade():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS commission_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                professional_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount REAL NOT NULL,
                period_start TEXT,
                period_end TEXT,
                notes TEXT,
                registered_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
                registered_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL
            )
        """))
        conn.commit()
        print("Tabla commission_payments creada o ya existía.")


if __name__ == "__main__":
    upgrade()
