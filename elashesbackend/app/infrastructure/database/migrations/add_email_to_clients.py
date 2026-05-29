"""Migration: agrega columna email (VARCHAR 255) en clients."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import text
from app.config.settings import settings
from app.infrastructure.database import engine


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        column_exists = False
        if is_sqlite:
            result = conn.execute(text("PRAGMA table_info(clients)"))
            for row in result:
                if row[1] == "email":
                    column_exists = True
                    break
        else:
            result = conn.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.columns "
                    "WHERE table_schema = DATABASE() AND table_name = 'clients' AND column_name = 'email'"
                )
            )
            column_exists = result.scalar() > 0

        if not column_exists:
            conn.execute(text("ALTER TABLE clients ADD COLUMN email VARCHAR(255) NULL"))
            conn.commit()
            print("Columna email agregada a clients.")
        else:
            print("Columna email ya existe en clients.")


if __name__ == "__main__":
    upgrade()
