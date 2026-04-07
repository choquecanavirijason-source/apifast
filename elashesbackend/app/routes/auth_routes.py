from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, LogoutResponse, SessionInfoResponse
from app.schemas.user import UserResponse
from app.core.dependencies import get_db, get_current_active_user, require_role
from app.core.security import decode_token, create_access_token
from app.config.settings import settings
from fastapi.security import OAuth2PasswordBearer
from app.services.auth_service import login_user, register_user
from app.models.user import User


router = APIRouter(
    prefix="/auth",
    tags=["Autenticación"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@router.post("/login", response_model=LoginResponse)
def login_json(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    return login_user(
        db=db,
        username=payload.username,
        password=payload.password,
    )


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_active_user),
):
    return current_user


@router.get("/session", response_model=SessionInfoResponse)
def get_session_info(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_active_user),
):
    payload = decode_token(token)
    exp = payload.get("exp")

    if exp is None:
        expires_at = datetime.now(timezone.utc)
    else:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)

    remaining_seconds = max(0, int((expires_at - datetime.now(timezone.utc)).total_seconds()))

    return SessionInfoResponse(
        user=current_user,
        expires_at=expires_at.isoformat(),
        expires_in_minutes=settings.access_token_expire_minutes,
        remaining_seconds=remaining_seconds,
    )

@router.post("/register", response_model=UserResponse, status_code=201)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    return register_user(db=db, payload=payload)


@router.post("/logout", response_model=LogoutResponse)
def logout(
    current_user: User = Depends(get_current_active_user),
):
    return LogoutResponse(message="Logout correcto. El cliente debe eliminar el token.")


@router.post("/refresh", response_model=LoginResponse)
def refresh_token(
    current_user: User = Depends(get_current_active_user),
):
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(subject=str(current_user.id))

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=current_user,
        expires_at=expires_at.isoformat(),
        expires_in_minutes=settings.access_token_expire_minutes,
    )