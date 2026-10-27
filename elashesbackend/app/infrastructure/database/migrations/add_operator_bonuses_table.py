"""
Migracion: crea la tabla operator_bonuses (pagos extra / bonos a operarias,
registrados en Corte de Caja).
Ejecutar con: python -m app.infrastructure.database.migrations.add_operator_bonuses_table

Se crea desde la definicion de la entidad (checkfirst) para que el DDL sea
valido en SQLite, MySQL y Postgres sin ramas por dialecto.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect

from app.domain.entities.branch import Branch  # noqa: F401  (FK branches.id)
from app.domain.entities.operator_bonus import OperatorBonus
from app.domain.entities.user import User  # noqa: F401  (FK users.id)
from app.infrastructure.database import engine


def upgrade():
    if "operator_bonuses" in inspect(engine).get_table_names():
        print("La tabla operator_bonuses ya existe.")
        return
    OperatorBonus.__table__.create(bind=engine, checkfirst=True)
    print("Tabla operator_bonuses creada.")


if __name__ == "__main__":
    upgrade()
