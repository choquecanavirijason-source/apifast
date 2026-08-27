from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.media import MAX_LOGO_BYTES, delete_media_file, save_catalog_image
from app.domain.entities.app_settings import AppSettings

LOGO_FOLDER = "branding"


def _get_or_create_settings(db: Session) -> AppSettings:
    row = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if row:
        return row
    row = AppSettings(id=1)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_app_settings(db: Session) -> dict:
    row = _get_or_create_settings(db)
    return {
        "logo_url": row.logo_url,
        "logo_original_name": row.logo_original_name,
    }


def update_logo(db: Session, file: UploadFile) -> dict:
    row = _get_or_create_settings(db)
    old_url = row.logo_url

    new_url = save_catalog_image(file=file, folder=LOGO_FOLDER, max_bytes=MAX_LOGO_BYTES)

    delete_media_file(old_url)

    row.logo_url = new_url
    row.logo_original_name = file.filename
    db.commit()
    db.refresh(row)
    return get_app_settings(db=db)


def remove_logo(db: Session) -> dict:
    row = _get_or_create_settings(db)
    delete_media_file(row.logo_url)
    row.logo_url = None
    row.logo_original_name = None
    db.commit()
    db.refresh(row)
    return get_app_settings(db=db)
