"""Migration: agrega/actualiza columna skill_level (INTEGER 1-5) en users."""
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
            result = conn.execute(text("PRAGMA table_info(users)"))
            for row in result:
                if row[1] == "skill_level":
                    column_exists = True
                    break
        else:
            result = conn.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.columns "
                    "WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'skill_level'"
                )
            )
            column_exists = result.scalar() > 0

        if not column_exists:
            if is_sqlite:
                conn.execute(text("ALTER TABLE users ADD COLUMN skill_level INTEGER NULL"))
            else:
                conn.execute(text("ALTER TABLE users ADD COLUMN skill_level INTEGER NULL"))
            conn.commit()
            print("Columna skill_level (INTEGER) agregada a users.")
        else:
            # La columna ya existe: limpiar valores string heredados y convertir a NULL
            conn.execute(
                text(
                    "UPDATE users SET skill_level = NULL "
                    "WHERE skill_level IS NOT NULL "
                    "AND skill_level NOT GLOB '[1-5]'"
                    if is_sqlite else
                    "UPDATE users SET skill_level = NULL "
                    "WHERE skill_level IS NOT NULL "
                    "AND skill_level NOT REGEXP '^[1-5]$'"
                )
            )
            if not is_sqlite:
                conn.execute(
                    text("ALTER TABLE users MODIFY COLUMN skill_level INTEGER NULL")
                )
            conn.commit()
            print("Columna skill_level actualizada a INTEGER en users.")


if __name__ == "__main__":
    upgrade()
