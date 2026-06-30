"""Migration: crea tabla marketplace_products."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import text
from app.config.settings import settings
from app.infrastructure.database import engine


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        # Check if table already exists
        if is_sqlite:
            result = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='marketplace_products'")
            )
            table_exists = result.fetchone() is not None
        else:
            result = conn.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema = DATABASE() AND table_name = 'marketplace_products'"
                )
            )
            table_exists = result.scalar() > 0

        if not table_exists:
            conn.execute(text("""
                CREATE TABLE marketplace_products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(150) NOT NULL,
                    brand VARCHAR(100),
                    description TEXT,
                    price FLOAT NOT NULL DEFAULT 0.0,
                    original_price FLOAT,
                    image_url VARCHAR(500),
                    category VARCHAR(100),
                    rating FLOAT DEFAULT 0.0,
                    review_count INTEGER DEFAULT 0,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """) if is_sqlite else text("""
                CREATE TABLE marketplace_products (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(150) NOT NULL,
                    brand VARCHAR(100),
                    description TEXT,
                    price FLOAT NOT NULL DEFAULT 0.0,
                    original_price FLOAT,
                    image_url VARCHAR(500),
                    category VARCHAR(100),
                    rating FLOAT DEFAULT 0.0,
                    review_count INT DEFAULT 0,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
            print("Tabla marketplace_products creada.")
        else:
            print("La tabla marketplace_products ya existe.")


if __name__ == "__main__":
    upgrade()
