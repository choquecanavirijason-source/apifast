"""
Migracion: agrega appointments.created_at e indices en appointments.client_id
y appointments.start_time (necesarios para los avisos programados).
Ejecutar con: python -m app.infrastructure.database.migrations.add_created_at_and_indexes_to_appointments

created_at queda en UTC naive (igual que pos_sales/inventory). Las citas que
ya existen quedan con la fecha de la migracion.

SQLite no permite ADD COLUMN con DEFAULT no constante (CURRENT_TIMESTAMP), asi
que ahi se agrega la columna y se rellena con un UPDATE. MySQL/Postgres lo
aceptan directo.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine


def upgrade():
    inspector = inspect(engine)
    if "appointments" not in inspector.get_table_names():
        print("La tabla appointments no existe todavia.")
        return

    dialect = engine.dialect.name
    columns = {c["name"] for c in inspector.get_columns("appointments")}
    indexed_columns = {
        tuple(ix["column_names"]) for ix in inspector.get_indexes("appointments")
    }

    with engine.connect() as conn:
        if "created_at" not in columns:
            if dialect == "sqlite":
                conn.execute(text("ALTER TABLE appointments ADD COLUMN created_at DATETIME"))
                conn.execute(
                    text("UPDATE appointments SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
                )
            else:
                col_type = "TIMESTAMP" if dialect == "postgresql" else "DATETIME"
                conn.execute(
                    text(
                        f"ALTER TABLE appointments ADD COLUMN created_at {col_type} "
                        "NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    )
                )
            print("Columna created_at agregada a appointments.")
        else:
            print("La columna created_at ya existe en appointments.")

        for column in ("client_id", "start_time"):
            if (column,) in indexed_columns:
                print(f"Ya existe un indice sobre appointments.{column}.")
                continue
            conn.execute(
                text(f"CREATE INDEX ix_appointments_{column} ON appointments ({column})")
            )
            print(f"Indice ix_appointments_{column} creado.")

        conn.commit()


if __name__ == "__main__":
    upgrade()
