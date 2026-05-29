"""Migration: agrega columna min_stock a products."""
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
            result = conn.execute(text("PRAGMA table_info(products)"))
            for row in result:
                if row[1] == "min_stock":
                    column_exists = True
                    break
        else:
            result = conn.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.columns "
                    "WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'min_stock'"
                )
            )
            column_exists = result.scalar() > 0

        if not column_exists:
            conn.execute(text("ALTER TABLE products ADD COLUMN min_stock FLOAT NULL"))
            conn.commit()
            print("Columna min_stock agregada a products.")
        else:
            print("La columna min_stock ya existe en products.")


if __name__ == "__main__":
    upgrade()
