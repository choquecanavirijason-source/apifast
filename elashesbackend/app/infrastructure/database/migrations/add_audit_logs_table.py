"""
Migracion: crea la tabla audit_logs (registro de acciones editar/eliminar/
cancelar para auditoria del sistema).
Ejecutar con: python -m app.infrastructure.database.migrations.add_audit_logs_table

Usa sqlalchemy.inspect en vez de SQL crudo por dialecto — a diferencia de
otras migraciones de este proyecto, así funciona igual en SQLite/Postgres
sin duplicar ramas (la rama "no sqlite" de las migraciones viejas usa
DATABASE(), que es sintaxis MySQL y no existe en Postgres).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine


def upgrade():
    inspector = inspect(engine)
    if "audit_logs" in inspector.get_table_names():
        print("La tabla audit_logs ya existe.")
        return

    is_sqlite = engine.dialect.name == "sqlite"
    pk_type = "INTEGER PRIMARY KEY" if is_sqlite else "SERIAL PRIMARY KEY"

    with engine.connect() as conn:
        conn.execute(
            text(
                f"""
                CREATE TABLE audit_logs (
                    id {pk_type},
                    user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                    branch_id INTEGER NULL REFERENCES branches(id) ON DELETE SET NULL,
                    action VARCHAR(20) NOT NULL,
                    entity_type VARCHAR(50) NOT NULL,
                    entity_id INTEGER NULL,
                    description TEXT NOT NULL,
                    created_at DATETIME NOT NULL
                )
                """
                if is_sqlite
                else """
                CREATE TABLE audit_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                    branch_id INTEGER NULL REFERENCES branches(id) ON DELETE SET NULL,
                    action VARCHAR(20) NOT NULL,
                    entity_type VARCHAR(50) NOT NULL,
                    entity_id INTEGER NULL,
                    description TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                )
                """
            )
        )
        conn.execute(text("CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id)"))
        conn.execute(text("CREATE INDEX ix_audit_logs_branch_id ON audit_logs (branch_id)"))
        conn.execute(text("CREATE INDEX ix_audit_logs_action ON audit_logs (action)"))
        conn.execute(text("CREATE INDEX ix_audit_logs_entity_type ON audit_logs (entity_type)"))
        conn.execute(text("CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at)"))
        conn.commit()
        print("Tabla audit_logs creada.")


if __name__ == "__main__":
    upgrade()
