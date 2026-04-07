from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_password_hash
from app.models.branch import Branch
from app.models.user import User, Role, Permission
from app.schemas.user import (
    PermissionCreate,
    RoleCreate,
    RoleUpdate,
    UserCreate,
    UserUpdate,
)

# Permissions
def list_permissions(db: Session):
    return db.query(Permission).order_by(Permission.name.asc()).all()


def get_permission_by_id(db: Session, permission_id: int) -> Permission:
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permiso no encontrado",
        )
    return permission


def create_permission(db: Session, payload: PermissionCreate) -> Permission:
    existing = (
        db.query(Permission)
        .filter(Permission.name == payload.name.strip())
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un permiso con ese nombre",
        )

    permission = Permission(name=payload.name.strip())
    db.add(permission)
    db.commit()
    db.refresh(permission)
    return permission


def delete_permission(db: Session, permission_id: int) -> None:
    permission = get_permission_by_id(db, permission_id)

    try:
        db.delete(permission)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar el permiso porque está en uso",
        )

# Roles
def _role_query(db: Session):
    return db.query(Role).options(joinedload(Role.permissions))


def _validate_permission_ids(db: Session, permission_ids: list[int]) -> list[Permission]:
    if not permission_ids:
        return []

    permissions = db.query(Permission).filter(Permission.id.in_(permission_ids)).all()

    if len(permissions) != len(set(permission_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uno o más permisos no existen",
        )

    return permissions


def list_roles(db: Session):
    return _role_query(db).order_by(Role.name.asc()).all()


def get_role_by_id(db: Session, role_id: int) -> Role:
    role = _role_query(db).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado",
        )
    return role


def create_role(db: Session, payload: RoleCreate) -> Role:
    existing = db.query(Role).filter(Role.name == payload.name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un rol con ese nombre",
        )

    permissions = _validate_permission_ids(db, payload.permission_ids)

    role = Role(
        name=payload.name.strip(),
        permissions=permissions,
    )
    db.add(role)
    db.commit()
    db.refresh(role)

    return get_role_by_id(db, role.id)


def update_role(db: Session, role_id: int, payload: RoleUpdate) -> Role:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        existing = (
            db.query(Role)
            .filter(Role.name == update_data["name"].strip(), Role.id != role_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un rol con ese nombre",
            )
        role.name = update_data["name"].strip()

    if "permission_ids" in update_data and update_data["permission_ids"] is not None:
        permissions = _validate_permission_ids(db, update_data["permission_ids"])
        role.permissions = permissions

    db.commit()
    db.refresh(role)

    return get_role_by_id(db, role.id)


def delete_role(db: Session, role_id: int) -> None:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado",
        )

    user_using_role = db.query(User).filter(User.role_id == role_id).first()
    if user_using_role:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar el rol porque está asignado a uno o más usuarios",
        )

    db.delete(role)
    db.commit()

# Users

def _user_query(db: Session):
    return db.query(User).options(
        joinedload(User.role).joinedload(Role.permissions),
        joinedload(User.branch),
    )


def _validate_role_and_branch(
    db: Session,
    role_id: Optional[int],
    branch_id: Optional[int],
):
    if role_id is not None:
        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El rol indicado no existe",
            )

    if branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sucursal indicada no existe",
            )


def list_users(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
):
    query = _user_query(db)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.username.ilike(search_term),
                User.email.ilike(search_term),
            )
        )

    return (
        query.order_by(User.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_user_by_id(db: Session, user_id: int) -> User:
    user = _user_query(db).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return user


def create_user(db: Session, payload: UserCreate) -> User:
    existing_username = db.query(User).filter(User.username == payload.username.strip()).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese username",
        )

    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email",
        )

    _validate_role_and_branch(db, payload.role_id, payload.branch_id)

    user = User(
        username=payload.username.strip(),
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        is_active=payload.is_active,
        role_id=payload.role_id,
        branch_id=payload.branch_id,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return get_user_by_id(db, user.id)


def update_user(
    db: Session,
    user_id: int,
    payload: UserUpdate,
    current_user_id: Optional[int] = None,
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "username" in update_data and update_data["username"] is not None:
        existing_username = (
            db.query(User)
            .filter(User.username == update_data["username"].strip(), User.id != user_id)
            .first()
        )
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un usuario con ese username",
            )
        user.username = update_data["username"].strip()

    if "email" in update_data and update_data["email"] is not None:
        existing_email = (
            db.query(User)
            .filter(User.email == update_data["email"], User.id != user_id)
            .first()
        )
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un usuario con ese email",
            )
        user.email = update_data["email"]

    role_id = update_data.get("role_id", user.role_id)
    branch_id = update_data.get("branch_id", user.branch_id)
    _validate_role_and_branch(db, role_id, branch_id)

    if "role_id" in update_data:
        user.role_id = update_data["role_id"]

    if "branch_id" in update_data:
        user.branch_id = update_data["branch_id"]

    if "is_active" in update_data:
        if current_user_id == user_id and update_data["is_active"] is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes desactivar tu propio usuario",
            )
        user.is_active = update_data["is_active"]

    if "password" in update_data and update_data["password"]:
        user.hashed_password = get_password_hash(update_data["password"])

    db.commit()
    db.refresh(user)

    return get_user_by_id(db, user.id)


def delete_user(
    db: Session,
    user_id: int,
    current_user_id: Optional[int] = None,
) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    if current_user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminar tu propio usuario",
        )

    db.delete(user)
    db.commit()