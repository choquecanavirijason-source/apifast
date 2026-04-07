from typing import Generator, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session, joinedload

from app.database.session import SessionLocal
from app.models.user import User, Role
from app.core.security import decode_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
        subject = payload.get("sub")
        if subject is None:
            raise credentials_exception

        user_id = int(subject)
    except (JWTError, ValueError):
        raise credentials_exception

    user = (
        db.query(User)
        .options(
            joinedload(User.role).joinedload(Role.permissions),
            joinedload(User.branch),
        )
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        raise credentials_exception

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )
    return current_user


def require_role(role_name: str) -> Callable:
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if not current_user.role or current_user.role.name != role_name:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere el rol: {role_name}",
            )
        return current_user

    return role_checker


def require_any_role(*role_names: str) -> Callable:
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if not current_user.role or current_user.role.name not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere uno de estos roles: {', '.join(role_names)}",
            )
        return current_user

    return role_checker


def require_permission(permission_name: str) -> Callable:
    def permission_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if not current_user.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El usuario no tiene rol asignado",
            )

        permissions = [permission.name for permission in current_user.role.permissions]

        if permission_name not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere el permiso: {permission_name}",
            )

        return current_user

    return permission_checker


def require_any_permission(*permission_names: str) -> Callable:
    """Permite acceso si el usuario tiene al menos uno de los permisos indicados."""
    def permission_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if not current_user.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El usuario no tiene rol asignado",
            )

        permissions = [permission.name for permission in current_user.role.permissions]

        if not any(p in permissions for p in permission_names):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere el permiso: {', '.join(permission_names)}",
            )

        return current_user

    return permission_checker