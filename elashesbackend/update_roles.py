"""
Script para actualizar los permisos de los roles en la BD existente.
Ejecutar: python update_roles.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.infrastructure.database.session import SessionLocal
from app.domain.entities.user import Role, Permission


def update_roles():
    db = SessionLocal()
    try:
        # Cargar todos los permisos disponibles
        all_perms = db.query(Permission).all()
        pmap = {p.name: p for p in all_perms}
        print(f"Permisos disponibles: {sorted(pmap.keys())}")

        # ── Definición de permisos por rol ────────────────────────────────────
        role_permissions = {
            "SuperAdmin": list(pmap.values()),

            "Admin": [
                pmap[p] for p in [
                    "clients:view", "clients:manage",
                    "catalog:view", "catalog:manage",
                    "tracking:view", "tracking:manage",
                    "forms:view", "forms:manage",
                    "payments:view", "payments:manage",
                    "services:view", "services:manage",
                    "appointments:view", "appointments:manage",
                    "branches:view",
                    "inventory:view", "inventory:manage",
                    "settings:view",
                    "users:manage",
                    "ai:view", "ai:manage",
                ] if p in pmap
            ],

            "Operaria": [
                pmap[p] for p in [
                    "clients:view", "clients:manage",
                    "catalog:view",
                    "tracking:view", "tracking:manage",
                    "forms:view",
                    "services:view", "services:manage",
                    "appointments:view", "appointments:manage",
                    "payments:view",
                    "branches:view",
                ] if p in pmap
            ],

            # Secretaria necesita catalog:view para cargar tipos de ojos en el POS
            "Secretaria": [
                pmap[p] for p in [
                    "clients:view", "clients:manage",
                    "catalog:view",
                    "tracking:view",
                    "forms:view",
                    "payments:view", "payments:manage",
                    "services:view", "services:manage",
                    "appointments:view", "appointments:manage",
                    "branches:view",
                ] if p in pmap
            ],

            "EncargadaAlmacen": [
                pmap[p] for p in [
                    "inventory:view", "inventory:manage",
                    "catalog:view",
                    "branches:view",
                ] if p in pmap
            ],
        }

        updated = []
        created = []

        for role_name, perms in role_permissions.items():
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(name=role_name)
                db.add(role)
                db.flush()
                created.append(role_name)
            else:
                updated.append(role_name)

            role.permissions = perms
            label = "Creado" if role_name in created else "Actualizado"
            print(f"  [{label}] {role_name} -> {len(perms)} permisos")

        db.commit()
        print(f"\nListo. Actualizados: {updated}  |  Creados: {created}")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    update_roles()
