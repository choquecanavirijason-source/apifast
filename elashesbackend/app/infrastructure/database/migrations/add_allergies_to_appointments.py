"""
Migracion: appointments.allergies y appointments.allergies_checked_at.

Alergias de ESTE ticket. Solo se usan con la clienta de mostrador (compartida por
todas las personas que pagan sin registrarse): su alergia no puede guardarse en la
ficha, asi que se anota en el ticket de esa atencion. Con una clienta registrada
las alergias viven en su ficha (clients.allergies).

Ejecutar con: python -m app.infrastructure.database.migrations.add_allergies_to_appointments
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

    columns = {c["name"] for c in inspector.get_columns("appointments")}
    datetime_type = "TIMESTAMP WITH TIME ZONE" if engine.dialect.name == "postgresql" else "DATETIME"
    wanted = (
        ("allergies", "VARCHAR(500)"),
        ("allergies_checked_at", datetime_type),
    )

    with engine.connect() as conn:
        for name, sql_type in wanted:
            if name in columns:
                print(f"La columna {name} ya existe en appointments.")
                continue
            conn.execute(text(f"ALTER TABLE appointments ADD COLUMN {name} {sql_type}"))
            print(f"Columna {name} agregada a appointments.")
        conn.commit()


if __name__ == "__main__":
    upgrade()
