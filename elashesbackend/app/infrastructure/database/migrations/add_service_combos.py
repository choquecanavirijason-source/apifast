"""
Migracion: combos reales de servicios.
  - services.is_combo (NOT NULL, false)
  - tabla service_combo_items: servicios componentes de cada combo
Ejecutar con: python -m app.infrastructure.database.migrations.add_service_combos
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine


def upgrade():
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    false_literal = "0" if engine.dialect.name == "sqlite" else "false"

    with engine.connect() as conn:
        if "services" in tables and "is_combo" not in {c["name"] for c in inspector.get_columns("services")}:
            conn.execute(text(f"ALTER TABLE services ADD COLUMN is_combo BOOLEAN NOT NULL DEFAULT {false_literal}"))
            print("Columna is_combo agregada a services.")

        if "service_combo_items" not in tables:
            pk = "INTEGER PRIMARY KEY AUTOINCREMENT" if engine.dialect.name == "sqlite" else (
                "SERIAL PRIMARY KEY" if engine.dialect.name == "postgresql" else "INTEGER PRIMARY KEY AUTO_INCREMENT"
            )
            conn.execute(text(
                f"""CREATE TABLE service_combo_items (
                    id {pk},
                    combo_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
                    position INTEGER NOT NULL DEFAULT 0
                )"""
            ))
            conn.execute(text("CREATE INDEX ix_service_combo_items_combo_id ON service_combo_items (combo_id)"))
            conn.execute(text("CREATE INDEX ix_service_combo_items_service_id ON service_combo_items (service_id)"))
            print("Tabla service_combo_items creada.")
        conn.commit()


if __name__ == "__main__":
    upgrade()
