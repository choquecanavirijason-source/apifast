"""Migration: crea la tabla expenses (gastos de caja por sucursal)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import text
from app.infrastructure.database import engine


def upgrade():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                amount REAL NOT NULL,
                description TEXT NOT NULL,
                expense_date DATE NOT NULL,
                photo_url TEXT,
                created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
                created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL
            )
        """))
        conn.commit()
        print("Tabla expenses creada o ya existía.")


if __name__ == "__main__":
    upgrade()
