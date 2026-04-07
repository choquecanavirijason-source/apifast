"""
Migracion: agrega columna created_at a users.
Ejecutar con: python -m app.database.migrations.add_user_created_at
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text

from app.config.settings import settings
from app.database import engine


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        column_exists = False
        if is_sqlite:
            result = conn.execute(text("PRAGMA table_info(users)"))
            for row in result:
                if row[1] == "created_at":
                    column_exists = True
                    break
        else:
            result = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'created_at'
                    """
                )
            )
            column_exists = result.scalar() > 0

        if not column_exists:
            if is_sqlite:
                conn.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    )
                )
            else:
                conn.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    )
                )
            conn.commit()
            print("Columna created_at agregada a users.")
        else:
            print("La columna created_at ya existe en users.")


if __name__ == "__main__":
    upgrade()
