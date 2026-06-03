"""Migration: agrega columna commission_rate a la tabla services."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import text
from app.config.settings import settings
from app.infrastructure.database import engine


def upgrade():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE services ADD COLUMN commission_rate FLOAT DEFAULT NULL"))
            conn.commit()
            print("Columna commission_rate agregada a services.")
        except Exception:
            # Ya existe
            pass


if __name__ == "__main__":
    upgrade()
