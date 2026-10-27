"""
Migracion: crea la tabla reminder_email_senders (remitentes de los
recordatorios por correo agregados desde el panel).
Ejecutar con: python -m app.infrastructure.database.migrations.add_reminder_email_senders_table

Se crea desde la definicion de la entidad (checkfirst) para que el DDL sea
valido en SQLite, MySQL y Postgres sin ramas por dialecto.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect

from app.domain.entities.reminder_email_sender import ReminderEmailSender
from app.domain.entities.user import User  # noqa: F401  (FK users.id)
from app.infrastructure.database import engine


def upgrade():
    if "reminder_email_senders" in inspect(engine).get_table_names():
        print("La tabla reminder_email_senders ya existe.")
        return
    ReminderEmailSender.__table__.create(bind=engine, checkfirst=True)
    print("Tabla reminder_email_senders creada.")


if __name__ == "__main__":
    upgrade()
