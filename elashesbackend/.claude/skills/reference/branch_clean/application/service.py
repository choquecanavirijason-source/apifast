"""
Casos de uso del agregado Branch.

- Recibe un BranchRepository inyectado (puerto).
- No conoce SQLAlchemy ni FastAPI.
- Lanza excepciones de dominio (`branch_clean.domain.exceptions`),
  NUNCA HTTPException. El controller las traduce.
- Cada función pública = un caso de uso.
"""
from typing import Optional
from sqlalchemy.exc import IntegrityError

from app.domain.entities.branch import Branch as BranchORM

from ..domain.exceptions import (
    BranchNotFound,
    BranchNameConflict,
    BranchInUse,
    UsersNotFound,
)
from ..infrastructure.repository import BranchRepository


class BranchService:
    def __init__(self, repo: BranchRepository) -> None:
        self.repo = repo

    # ---------- queries ----------

    def list_branches(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        city: Optional[str] = None,
        department: Optional[str] = None,
    ) -> list[BranchORM]:
        branches = list(self.repo.list(skip=skip, limit=limit, city=city, department=department))
        for branch in branches:
            self._normalize_for_response(branch)
        return branches

    def get_branch(self, branch_id: int) -> BranchORM:
        branch = self.repo.get_by_id(branch_id)
        if branch is None:
            raise BranchNotFound(branch_id)
        self._normalize_for_response(branch)
        return branch

    # ---------- mutations ----------

    def create_branch(
        self,
        *,
        name: str,
        address: Optional[str] = None,
        city: Optional[str] = None,
        department: Optional[str] = None,
        opening_hours: Optional[list[dict]] = None,
        user_ids: Optional[list[int]] = None,
    ) -> BranchORM:
        name = name.strip()
        if self.repo.get_by_name(name) is not None:
            raise BranchNameConflict(name)

        branch = BranchORM(
            name=name,
            address=address,
            city=city,
            department=department,
            opening_hours=opening_hours or [],
        )
        self.repo.add(branch)
        self.repo.commit()

        if user_ids is not None:
            self._assign_users(branch.id, user_ids)
            self.repo.commit()

        self.repo.refresh(branch)
        self._normalize_for_response(branch)
        return branch

    def update_branch(
        self,
        branch_id: int,
        *,
        name: Optional[str] = None,
        address: Optional[str] = None,
        city: Optional[str] = None,
        department: Optional[str] = None,
        opening_hours: Optional[list[dict]] = None,
        user_ids: Optional[list[int]] = None,
    ) -> BranchORM:
        branch = self.repo.get_by_id(branch_id)
        if branch is None:
            raise BranchNotFound(branch_id)

        if name is not None:
            name = name.strip()
            if self.repo.get_by_name(name, exclude_id=branch_id) is not None:
                raise BranchNameConflict(name)
            branch.name = name

        if address is not None:
            branch.address = address
        if city is not None:
            branch.city = city
        if department is not None:
            branch.department = department
        if opening_hours is not None:
            branch.opening_hours = opening_hours
        if user_ids is not None:
            self._assign_users(branch_id, user_ids)

        self.repo.commit()
        self.repo.refresh(branch)
        self._normalize_for_response(branch)
        return branch

    def delete_branch(self, branch_id: int) -> None:
        branch = self.repo.get_by_id(branch_id)
        if branch is None:
            raise BranchNotFound(branch_id)
        try:
            self.repo.delete(branch)
            self.repo.commit()
        except IntegrityError:
            self.repo.rollback()
            raise BranchInUse(branch_id)

    # ---------- helpers internos ----------

    def _assign_users(self, branch_id: int, user_ids: list[int]) -> None:
        users, missing = self.repo.find_users(user_ids)
        if missing:
            raise UsersNotFound(missing)
        self.repo.reassign_users(branch_id, users)

    @staticmethod
    def _normalize_for_response(branch: BranchORM) -> None:
        """Asegura defaults para campos opcionales (consumido por el response schema)."""
        if branch.opening_hours is None:
            branch.opening_hours = []
        branch.user_ids = [u.id for u in (branch.users or [])]
