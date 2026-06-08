"""
Migracion: agrega columna qr_image_url a branches para QR de pago estático.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text

from app.config.settings import settings
from app.infrastructure.database import engine


def _column_exists(conn, table_name: str, column_name: str, is_sqlite: bool) -> bool:
    if is_sqlite:
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        return any(row[1] == column_name for row in result)
    result = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"
        ),
        {"t": table_name, "c": column_name},
    )
    return result.scalar() > 0


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        if _column_exists(conn, "branches", "qr_image_url", is_sqlite):
            print("La columna qr_image_url ya existe en branches.")
            return
        conn.execute(text("ALTER TABLE branches ADD COLUMN qr_image_url TEXT NULL"))
        conn.commit()
        print("Columna qr_image_url agregada a branches.")


if __name__ == "__main__":
    upgrade()