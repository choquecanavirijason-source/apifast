from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_any_permission
from app.models.user import User
from app.schemas.admin_ai import (
    AdminAiChatRequest,
    AdminAiChatResponse,
    AdminAiSettingsResponse,
    AdminAiSettingsUpdate,
)
from app.services.admin_ai_service import (
    ask_admin_ai,
    build_business_context,
    get_admin_ai_settings,
    update_admin_ai_settings,
)

router = APIRouter(prefix="/admin/ai", tags=["IA Admin"])


@router.get("/settings", response_model=AdminAiSettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("ai:view", "ai:manage")),
):
    return get_admin_ai_settings(db=db)


@router.put("/settings", response_model=AdminAiSettingsResponse)
def update_settings(
    payload: AdminAiSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("ai:manage", "ai:view")),
):
    return update_admin_ai_settings(db=db, payload=payload.model_dump(exclude_unset=True))


@router.get("/context")
def get_context(
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("ai:view", "ai:manage")),
):
    return build_business_context(db=db, branch_id=branch_id)


@router.post("/chat", response_model=AdminAiChatResponse)
async def chat(
    payload: AdminAiChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("ai:view", "ai:manage")),
):
    return await ask_admin_ai(db=db, message=payload.message, branch_id=payload.branch_id)
