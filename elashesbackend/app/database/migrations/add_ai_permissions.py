"""
Migracion: permisos ai:view y ai:manage para el asistente IA del admin.
Ejecutar con: python -m app.database.migrations.add_ai_permissions
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from app.database import SessionLocal
from app.models.user import Permission, Role


AI_PERMISSIONS = ("ai:view", "ai:manage")
ADMIN_ROLE_NAMES = ("SuperAdmin", "Admin", "admin")


def upgrade():
    db = SessionLocal()
    try:
        created = []
        for name in AI_PERMISSIONS:
            perm = db.query(Permission).filter(Permission.name == name).first()
            if not perm:
                perm = Permission(name=name)
                db.add(perm)
                db.flush()
            created.append(perm)

        for role_name in ADMIN_ROLE_NAMES:
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                continue
            existing = {p.name for p in role.permissions}
            for perm in created:
                if perm.name not in existing:
                    role.permissions.append(perm)

        db.commit()
        print("Permisos ai:view y ai:manage agregados y asignados a roles admin.")
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
