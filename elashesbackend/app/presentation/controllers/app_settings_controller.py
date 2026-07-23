from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_role
from app.domain.entities.user import User
from app.presentation.schemas.app_settings import AppSettingsResponse
from app.application.services.app_settings_service import (
    get_app_settings,
    remove_logo,
    update_logo,
)

router = APIRouter(prefix="/settings", tags=["Configuración de la App"])


@router.get("/logo", response_model=AppSettingsResponse)
def get_logo(db: Session = Depends(get_db)):
    return get_app_settings(db=db)


@router.post("/logo", response_model=AppSettingsResponse)
def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    return update_logo(db=db, file=file)


@router.delete("/logo", response_model=AppSettingsResponse)
def delete_logo(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SuperAdmin")),
):
    return remove_logo(db=db)
