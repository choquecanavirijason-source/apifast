from datetime import date as date_type
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_role, require_any_role, SUPER_ADMIN_ROLE
from app.domain.entities.branch import Branch
from app.domain.entities.user import User
from app.presentation.schemas.base_response import MessageResponse
from app.presentation.schemas.user import (
    PermissionCreate,
    PermissionResponse,
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    UserCreate,
    UserUpdate,
    UserResponse,
    SkillLevelUpdate,
)
from app.application.services.admin_service import (
    list_permissions,
    get_permission_by_id,
    create_permission,
    delete_permission,
    list_roles,
    get_role_by_id,
    create_role,
    update_role,
    delete_role,
    list_users,
    get_user_by_id,
    create_user,
    update_user,
    update_skill_level,
    delete_user,
)


router = APIRouter(
    prefix="/admin",
    tags=["Administración"],
)


# ==========================================
# Permissions
# ==========================================
@router.get(
    "/permissions",
    response_model=List[PermissionResponse],
)
def get_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    return list_permissions(db=db)


@router.get(
    "/permissions/{permission_id}",
    response_model=PermissionResponse,
)
def get_permission(
    permission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    return get_permission_by_id(db=db, permission_id=permission_id)


@router.post(
    "/permissions",
    response_model=PermissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_permission(
    payload: PermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    return create_permission(db=db, payload=payload)


@router.delete(
    "/permissions/{permission_id}",
    response_model=MessageResponse,
)
def delete_existing_permission(
    permission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    delete_permission(db=db, permission_id=permission_id)
    return MessageResponse(message="Permiso eliminado correctamente")


# ==========================================
# Roles
# ==========================================
@router.get(
    "/roles",
    response_model=List[RoleResponse],
)
def get_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role("SuperAdmin", "Admin", "Secretaria")),
):
    return list_roles(db=db)


@router.get(
    "/roles/{role_id}",
    response_model=RoleResponse,
)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    return get_role_by_id(db=db, role_id=role_id)


@router.post(
    "/roles",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    return create_role(db=db, payload=payload)


@router.put(
    "/roles/{role_id}",
    response_model=RoleResponse,
)
def update_existing_role(
    role_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    return update_role(db=db, role_id=role_id, payload=payload)


@router.delete(
    "/roles/{role_id}",
    response_model=MessageResponse,
)
def delete_existing_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    delete_role(db=db, role_id=role_id)
    return MessageResponse(message="Rol eliminado correctamente")


# ==========================================
# Users
# ==========================================
@router.get(
    "/users",
    response_model=List[UserResponse],
)
def get_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role("SuperAdmin", "Admin", "Secretaria")),
):
    # SuperAdmin ve todos; Admin y Secretaria solo ven su sucursal
    branch_id = None if current_user.role.name in (SUPER_ADMIN_ROLE, "Secretaria") else current_user.branch_id
    return list_users(db=db, skip=skip, limit=limit, search=search, branch_id=branch_id)


@router.patch(
    "/users/{user_id}/skill-level",
    response_model=UserResponse,
)
def patch_user_skill_level(
    user_id: int,
    payload: SkillLevelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role("SuperAdmin", "Admin", "Secretaria")),
):
    return update_skill_level(db=db, user_id=user_id, skill_level=payload.skill_level, branch_id=payload.branch_id, phone=payload.phone)


@router.get(
    "/users/{user_id}",
    response_model=UserResponse,
)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    return get_user_by_id(db=db, user_id=user_id)


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role("SuperAdmin", "Admin", "Secretaria")),
):
    return create_user(db=db, payload=payload)


@router.put(
    "/users/{user_id}",
    response_model=UserResponse,
)
def update_existing_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role("SuperAdmin", "Admin")),
):
    return update_user(
        db=db,
        user_id=user_id,
        payload=payload,
        current_user_id=current_user.id,
    )


@router.delete(
    "/users/{user_id}",
    response_model=MessageResponse,
)
def delete_existing_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role("SuperAdmin", "Secretaria")),
):
    # Secretaria solo puede eliminar usuarios con rol Operaria
    if current_user.role and current_user.role.name == "Secretaria":
        target = db.query(User).filter(User.id == user_id).first()
        if not target or not target.role or target.role.name != "Operaria":
            from fastapi import HTTPException, status as http_status
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Solo puedes eliminar operarias",
            )
    delete_user(
        db=db,
        user_id=user_id,
        current_user_id=current_user.id,
    )
    return MessageResponse(message="Usuario eliminado correctamente")


# ── Reasignación de sucursal ──────────────────────────────────────────────────

class BranchAssignmentPayload(BaseModel):
    """
    Reasignación de sucursal para una operaria.
    - permanent=True  → mueve branch_id permanentemente, borra temp.
    - permanent=False → asigna temp_branch_id hasta temp_until (YYYY-MM-DD).
    - branch_id=None  → limpia la asignación temporal (vuelve a la de origen).
    """
    branch_id: Optional[int] = None
    permanent: bool = False
    temp_until: Optional[str] = None   # YYYY-MM-DD, requerido si permanent=False y branch_id != None


@router.patch("/users/{user_id}/branch-assignment", response_model=UserResponse)
def assign_branch(
    user_id: int,
    payload: BranchAssignmentPayload,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role("SuperAdmin", "Admin", "Secretaria")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if payload.branch_id is None:
        # Limpiar asignación temporal
        user.temp_branch_id = None
        user.temp_branch_until = None
        db.commit()
        db.refresh(user)
        return user

    branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    if payload.permanent:
        user.branch_id = payload.branch_id
        user.temp_branch_id = None
        user.temp_branch_until = None
    else:
        if not payload.temp_until:
            raise HTTPException(status_code=400, detail="temp_until es requerido para asignaciones temporales (YYYY-MM-DD)")
        try:
            until = date_type.fromisoformat(payload.temp_until)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")
        if until < date_type.today():
            raise HTTPException(status_code=400, detail="La fecha de fin no puede ser en el pasado")
        user.temp_branch_id = payload.branch_id
        user.temp_branch_until = until

    db.commit()
    db.refresh(user)
    return user