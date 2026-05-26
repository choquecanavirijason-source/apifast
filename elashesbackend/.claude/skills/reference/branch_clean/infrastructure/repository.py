"""
Adaptador de persistencia. ESTE archivo es el único que conoce SQLAlchemy
para el agregado Branch. El service nunca importa de sqlalchemy directamente.

Trabaja con la entidad ORM existente del repo (`app.domain.entities.branch.Branch`)
para no duplicar el esquema. Si se quisiera Clean Arch más puro, se mapearía a
la entidad `domain.entities.Branch` (la pura, no la ORM) en `to_entity()`.
"""
from typing import Optional, Sequence

from sqlalchemy.orm import Session

from app.domain.entities.branch import Branch as BranchORM
from app.domain.entities.user import User as UserORM


class BranchRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---------- queries ----------

    def list(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        city: Optional[str] = None,
        department: Optional[str] = None,
    ) -> Sequence[BranchORM]:
        query = self.db.query(BranchORM)
        if city and city.strip():
            query = query.filter(BranchORM.city.ilike(f"%{city.strip()}%"))
        if department and department.strip():
            query = query.filter(BranchORM.department.ilike(f"%{department.strip()}%"))
        return query.order_by(BranchORM.name.asc()).offset(skip).limit(limit).all()

    def get_by_id(self, branch_id: int) -> Optional[BranchORM]:
        return self.db.query(BranchORM).filter(BranchORM.id == branch_id).first()

    def get_by_name(self, name: str, *, exclude_id: Optional[int] = None) -> Optional[BranchORM]:
        query = self.db.query(BranchORM).filter(BranchORM.name == name.strip())
        if exclude_id is not None:
            query = query.filter(BranchORM.id != exclude_id)
        return query.first()

    def find_users(self, user_ids: list[int]) -> tuple[list[UserORM], list[int]]:
        """Devuelve (users_encontrados, ids_faltantes)."""
        normalized = sorted(set(user_ids))
        if not normalized:
            return [], []
        found = self.db.query(UserORM).filter(UserORM.id.in_(normalized)).all()
        found_ids = {u.id for u in found}
        missing = [i for i in normalized if i not in found_ids]
        return found, missing

    # ---------- mutaciones ----------

    def add(self, branch: BranchORM) -> BranchORM:
        self.db.add(branch)
        return branch

    def delete(self, branch: BranchORM) -> None:
        self.db.delete(branch)

    def reassign_users(self, branch_id: int, users: list[UserORM]) -> None:
        """Mueve todos los users de esta sucursal al nuevo set."""
        self.db.query(UserORM).filter(UserORM.branch_id == branch_id).update(
            {UserORM.branch_id: None}
        )
        for user in users:
            user.branch_id = branch_id

    # ---------- unit of work ----------

    def commit(self) -> None:
        self.db.commit()

    def rollback(self) -> None:
        self.db.rollback()

    def refresh(self, branch: BranchORM) -> None:
        self.db.refresh(branch)
