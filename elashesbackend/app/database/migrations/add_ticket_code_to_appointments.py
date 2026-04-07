"""
Migración: agrega columna ticket_code a appointments.
Ejecutar con: python -m app.database.migrations.add_ticket_code_to_appointments
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text
from app.database import engine
from app.config.settings import settings


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        column_exists = False
        unique_index_exists = False
        if is_sqlite:
            result = conn.execute(text("PRAGMA table_info(appointments)"))
            for row in result:
                if row[1] == "ticket_code":
                    column_exists = True
                    break

            index_result = conn.execute(text("PRAGMA index_list(appointments)"))
            for row in index_result:
                if row[1] == "ix_appointments_ticket_code":
                    unique_index_exists = True
                    break
        else:
            result = conn.execute(
                text("""
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_schema = DATABASE() AND table_name = 'appointments' AND column_name = 'ticket_code'
                """)
            )
            column_exists = result.scalar() > 0

            index_result = conn.execute(
                text("""
                    SELECT COUNT(*) FROM information_schema.statistics
                    WHERE table_schema = DATABASE() AND table_name = 'appointments' AND index_name = 'ix_appointments_ticket_code'
                """)
            )
            unique_index_exists = index_result.scalar() > 0

        if not column_exists:
            conn.execute(text("ALTER TABLE appointments ADD COLUMN ticket_code VARCHAR(50)"))
            conn.commit()
            print("Columna ticket_code agregada a appointments.")

        if not unique_index_exists:
            conn.execute(text("CREATE UNIQUE INDEX ix_appointments_ticket_code ON appointments(ticket_code)"))
            conn.commit()
            print("Indice unico ix_appointments_ticket_code creado.")
        else:
            print("La columna ticket_code ya existe.")


if __name__ == "__main__":
    upgrade()
