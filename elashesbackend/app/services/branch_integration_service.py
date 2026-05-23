from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.branch import Branch
from app.models.branch_integration_profile import BranchIntegrationProfile


@dataclass
class WhatsAppBranchConfig:
    enabled: bool
    provider: str
    api_url: Optional[str]
    api_token: Optional[str]
    phone_number_id: Optional[str]


def _profile_to_response(profile: BranchIntegrationProfile, db: Session) -> dict:
    branch_ids = [
        branch.id
        for branch in db.query(Branch).filter(Branch.integration_profile_id == profile.id).all()
    ]
    return {
        "id": profile.id,
        "name": profile.name,
        "is_shared": profile.is_shared,
        "whatsapp_enabled": profile.whatsapp_enabled,
        "whatsapp_provider": profile.whatsapp_provider or "webhook",
        "whatsapp_api_url": profile.whatsapp_api_url,
        "whatsapp_phone_number_id": profile.whatsapp_phone_number_id,
        "ai_api_url": profile.ai_api_url,
        "whatsapp_has_token": bool(profile.whatsapp_api_token),
        "ai_has_token": bool(profile.ai_api_token),
        "branch_ids": branch_ids,
    }


def _apply_profile_tokens(profile: BranchIntegrationProfile, payload: dict) -> None:
    if payload.get("whatsapp_api_token"):
        profile.whatsapp_api_token = payload["whatsapp_api_token"]
    if payload.get("ai_api_token"):
        profile.ai_api_token = payload["ai_api_token"]


def list_integration_profiles(db: Session) -> list[dict]:
    profiles = db.query(BranchIntegrationProfile).order_by(BranchIntegrationProfile.name.asc()).all()
    return [_profile_to_response(profile, db) for profile in profiles]


def get_integration_profile(db: Session, profile_id: int) -> dict:
    profile = db.query(BranchIntegrationProfile).filter(BranchIntegrationProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de integración no encontrado")
    return _profile_to_response(profile, db)


def create_integration_profile(db: Session, payload: dict) -> dict:
    name = payload["name"].strip()
    existing = db.query(BranchIntegrationProfile).filter(BranchIntegrationProfile.name == name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un perfil con ese nombre")

    profile = BranchIntegrationProfile(
        name=name,
        is_shared=payload.get("is_shared", True),
        whatsapp_enabled=payload.get("whatsapp_enabled", False),
        whatsapp_provider=payload.get("whatsapp_provider") or "webhook",
        whatsapp_api_url=payload.get("whatsapp_api_url"),
        whatsapp_phone_number_id=payload.get("whatsapp_phone_number_id"),
        ai_api_url=payload.get("ai_api_url"),
    )
    _apply_profile_tokens(profile, payload)
    db.add(profile)
    db.commit()
    db.refresh(profile)

    branch_ids = payload.get("branch_ids") or []
    if branch_ids:
        _assign_branches_to_profile(db=db, profile_id=profile.id, branch_ids=branch_ids)

    return get_integration_profile(db=db, profile_id=profile.id)


def update_integration_profile(db: Session, profile_id: int, payload: dict) -> dict:
    profile = db.query(BranchIntegrationProfile).filter(BranchIntegrationProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de integración no encontrado")

    if payload.get("name") is not None:
        name = payload["name"].strip()
        existing = (
            db.query(BranchIntegrationProfile)
            .filter(BranchIntegrationProfile.name == name, BranchIntegrationProfile.id != profile_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un perfil con ese nombre")
        profile.name = name

    for field in ("is_shared", "whatsapp_enabled", "whatsapp_provider", "whatsapp_api_url", "whatsapp_phone_number_id", "ai_api_url"):
        if payload.get(field) is not None:
            setattr(profile, field, payload[field])

    _apply_profile_tokens(profile, payload)

    if payload.get("branch_ids") is not None:
        _assign_branches_to_profile(db=db, profile_id=profile.id, branch_ids=payload["branch_ids"])

    db.commit()
    db.refresh(profile)
    return get_integration_profile(db=db, profile_id=profile.id)


def delete_integration_profile(db: Session, profile_id: int) -> None:
    profile = db.query(BranchIntegrationProfile).filter(BranchIntegrationProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de integración no encontrado")

    db.query(Branch).filter(Branch.integration_profile_id == profile_id).update({Branch.integration_profile_id: None})
    db.delete(profile)
    db.commit()


def _assign_branches_to_profile(db: Session, profile_id: int, branch_ids: list[int]) -> None:
    normalized = sorted(set(branch_ids))
    if not normalized:
        return

    branches = db.query(Branch).filter(Branch.id.in_(normalized)).all()
    found = {branch.id for branch in branches}
    missing = [item for item in normalized if item not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sucursales no encontradas: {', '.join(str(item) for item in missing)}",
        )

    for branch in branches:
        branch.integration_profile_id = profile_id
    db.commit()


def _get_or_create_own_profile(db: Session, branch: Branch) -> BranchIntegrationProfile:
    if branch.integration_profile_id:
        profile = (
            db.query(BranchIntegrationProfile)
            .filter(BranchIntegrationProfile.id == branch.integration_profile_id)
            .first()
        )
        if profile and not profile.is_shared:
            return profile

    profile_name = f"{branch.name} (propia)"
    profile = BranchIntegrationProfile(
        name=profile_name,
        is_shared=False,
        whatsapp_enabled=False,
        whatsapp_provider="webhook",
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    branch.integration_profile_id = profile.id
    db.commit()
    return profile


def get_branch_integrations(db: Session, branch_id: int) -> dict:
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal no encontrada")

    profile = None
    shared_branch_ids: list[int] = []
    if branch.integration_profile_id:
        profile = (
            db.query(BranchIntegrationProfile)
            .filter(BranchIntegrationProfile.id == branch.integration_profile_id)
            .first()
        )
        if profile:
            shared_branch_ids = [
                linked.id
                for linked in db.query(Branch).filter(Branch.integration_profile_id == profile.id).all()
            ]

    use_shared = bool(profile and profile.is_shared)

    return {
        "branch_id": branch.id,
        "branch_name": branch.name,
        "integration_profile_id": profile.id if profile else None,
        "integration_profile_name": profile.name if profile else None,
        "use_shared_profile": use_shared,
        "shared_branch_ids": shared_branch_ids,
        "whatsapp_enabled": profile.whatsapp_enabled if profile else False,
        "whatsapp_provider": (profile.whatsapp_provider if profile else None) or "webhook",
        "whatsapp_api_url": profile.whatsapp_api_url if profile else None,
        "whatsapp_phone_number_id": profile.whatsapp_phone_number_id if profile else None,
        "whatsapp_has_token": bool(profile.whatsapp_api_token) if profile else False,
        "ai_api_url": profile.ai_api_url if profile else None,
        "ai_has_token": bool(profile.ai_api_token) if profile else False,
    }


def update_branch_integrations(db: Session, branch_id: int, payload: dict) -> dict:
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal no encontrada")

    mode = payload.get("mode") or "own"

    if mode == "shared":
        profile_id = payload.get("integration_profile_id")
        if not profile_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selecciona un perfil compartido",
            )
        profile = (
            db.query(BranchIntegrationProfile)
            .filter(BranchIntegrationProfile.id == profile_id, BranchIntegrationProfile.is_shared.is_(True))
            .first()
        )
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Perfil compartido no encontrado",
            )
        branch.integration_profile_id = profile.id
        db.commit()
        return get_branch_integrations(db=db, branch_id=branch_id)

    profile = _get_or_create_own_profile(db=db, branch=branch)

    if payload.get("whatsapp_enabled") is not None:
        profile.whatsapp_enabled = payload["whatsapp_enabled"]
    if payload.get("whatsapp_provider") is not None:
        profile.whatsapp_provider = payload["whatsapp_provider"]
    if "whatsapp_api_url" in payload:
        profile.whatsapp_api_url = payload["whatsapp_api_url"]
    if "whatsapp_phone_number_id" in payload:
        profile.whatsapp_phone_number_id = payload["whatsapp_phone_number_id"]
    if "ai_api_url" in payload:
        profile.ai_api_url = payload["ai_api_url"]
    _apply_profile_tokens(profile, payload)

    db.commit()
    return get_branch_integrations(db=db, branch_id=branch_id)


def get_whatsapp_config_for_branch(db: Session, branch_id: Optional[int]) -> Optional[WhatsAppBranchConfig]:
    if not branch_id:
        return None

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch or not branch.integration_profile_id:
        return None

    profile = (
        db.query(BranchIntegrationProfile)
        .filter(BranchIntegrationProfile.id == branch.integration_profile_id)
        .first()
    )
    if not profile:
        return None

    return WhatsAppBranchConfig(
        enabled=profile.whatsapp_enabled,
        provider=(profile.whatsapp_provider or "webhook").strip().lower(),
        api_url=profile.whatsapp_api_url,
        api_token=profile.whatsapp_api_token,
        phone_number_id=profile.whatsapp_phone_number_id,
    )
