from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.user import User, Role
from app.models.branch import Branch
from app.core.security import verify_password, create_access_token, get_password_hash
from app.config.settings import settings
from app.schemas.auth import RegisterRequest


def authenticate_user(db: Session, username: str, password: str) -> User:
    user = (
        db.query(User)
        .options(
            joinedload(User.role).joinedload(Role.permissions),
            joinedload(User.branch),
        )
        .filter(User.username == username)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )

    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    return user


def login_user(db: Session, username: str, password: str) -> dict:
    user = authenticate_user(db, username, password)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(subject=str(user.id))

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "expires_at": expires_at.isoformat(),
        "expires_in_minutes": settings.access_token_expire_minutes,
    }

def register_user(db: Session, payload: RegisterRequest) -> User:
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

    existing_phone = db.query(User).filter(User.phone == payload.phone.strip()).first()
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese phone",
        )

    if payload.role_id is not None:
        role = db.query(Role).filter(Role.id == payload.role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El rol indicado no existe",
            )

    if payload.branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sucursal indicada no existe",
            )

    user = User(
        username=payload.username.strip(),
        email=payload.email,
        phone=payload.phone.strip(),
        hashed_password=get_password_hash(payload.password),
        is_active=payload.is_active,
        role_id=payload.role_id,
        branch_id=payload.branch_id,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    user = (
        db.query(User)
        .options(
            joinedload(User.role).joinedload(Role.permissions),
            joinedload(User.branch),
        )
        .filter(User.id == user.id)
        .first()
    )

    return user