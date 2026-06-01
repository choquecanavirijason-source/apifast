"""Migration: agrega temp_branch_id y temp_branch_until a users para asignaciones temporales."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import text
from app.config.settings import settings
from app.infrastructure.database import engine


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        existing = set()
        if is_sqlite:
            for row in conn.execute(text("PRAGMA table_info(users)")):
                existing.add(row[1])
        else:
            result = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = DATABASE() AND table_name = 'users'"
                )
            )
            existing = {row[0] for row in result}

        added = []
        if "temp_branch_id" not in existing:
            conn.execute(text("ALTER TABLE users ADD COLUMN temp_branch_id INTEGER NULL REFERENCES branches(id)"))
            added.append("temp_branch_id")

        if "temp_branch_until" not in existing:
            conn.execute(text("ALTER TABLE users ADD COLUMN temp_branch_until DATE NULL"))
            added.append("temp_branch_until")

        if added:
            conn.commit()
            print(f"Columnas agregadas a users: {', '.join(added)}")
        else:
            print("Columnas temp_branch_id y temp_branch_until ya existen.")


if __name__ == "__main__":
    upgrade()
