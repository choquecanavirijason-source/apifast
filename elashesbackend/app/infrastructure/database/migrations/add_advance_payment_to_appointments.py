"""Migration: agrega advance_payment_amount (FLOAT, default 0.0) a appointments."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import text
from app.config.settings import settings
from app.infrastructure.database import engine


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        if is_sqlite:
            result = conn.execute(text("PRAGMA table_info(appointments)"))
            exists = any(row[1] == "advance_payment_amount" for row in result)
        else:
            result = conn.execute(text(
                "SELECT COUNT(*) FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = 'appointments' "
                "AND column_name = 'advance_payment_amount'"
            ))
            exists = result.scalar() > 0

        if not exists:
            conn.execute(text(
                "ALTER TABLE appointments ADD COLUMN advance_payment_amount FLOAT NOT NULL DEFAULT 0.0"
            ))
            conn.commit()
            print("Columna advance_payment_amount agregada a appointments.")
        else:
            print("Columna advance_payment_amount ya existe.")


if __name__ == "__main__":
    upgrade()
