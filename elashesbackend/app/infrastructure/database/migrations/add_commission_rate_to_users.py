"""Migration: agrega columna commission_rate (FLOAT, default 0.40) a users."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import text
from app.config.settings import settings
from app.infrastructure.database import engine


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        # Verificar si ya existe
        if is_sqlite:
            result = conn.execute(text("PRAGMA table_info(users)"))
            exists = any(row[1] == "commission_rate" for row in result)
        else:
            result = conn.execute(text(
                "SELECT COUNT(*) FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = 'users' "
                "AND column_name = 'commission_rate'"
            ))
            exists = result.scalar() > 0

        if not exists:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN commission_rate FLOAT NOT NULL DEFAULT 0.40"
            ))
            conn.commit()
            print("Columna commission_rate (FLOAT, default 0.40) agregada a users.")
        else:
            print("Columna commission_rate ya existe en users.")


if __name__ == "__main__":
    upgrade()
