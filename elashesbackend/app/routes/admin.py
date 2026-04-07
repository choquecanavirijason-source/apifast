from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.base_response import MessageResponse
from app.schemas.user import (
    PermissionCreate,
    PermissionResponse,
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    UserCreate,
    UserUpdate,
    UserResponse,
)
from app.services.admin_service import (
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
    current_user: User = Depends(require_role("SuperAdmin")),
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
    current_user: User = Depends(require_role("SuperAdmin")),
):
    return list_users(db=db, skip=skip, limit=limit, search=search)


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
    current_user: User = Depends(require_role("SuperAdmin")),
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
    current_user: User = Depends(require_role("SuperAdmin")),
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
    current_user: User = Depends(require_role("SuperAdmin")),
):
    delete_user(
        db=db,
        user_id=user_id,
        current_user_id=current_user.id,
    )
    return MessageResponse(message="Usuario eliminado correctamente")