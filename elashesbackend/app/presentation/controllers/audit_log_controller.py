"""Auditoría del sistema — quién editó/eliminó/canceló qué y cuándo.
Visible solo para roles con audit:view (SuperAdmin, Admin, Secretaria por
seed — no Cajera/Operaria/EncargadaAlmacen)."""
from datetime import date, datetime, time
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, require_any_permission
from app.domain.entities.audit_log import AuditLog
from app.domain.entities.user import User

router = APIRouter(prefix="/audit-logs", tags=["Auditoría"])


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    user_name: Optional[str]
    branch_id: Optional[int]
    branch_name: Optional[str]
    action: str
    entity_type: str
    entity_id: Optional[int]
    description: str
    created_at: str

    class Config:
        from_attributes = True


def _to_out(log: AuditLog) -> AuditLogOut:
    return AuditLogOut(
        id=log.id,
        user_id=log.user_id,
        user_name=log.user.username if log.user else None,
        branch_id=log.branch_id,
        branch_name=log.branch.name if log.branch else None,
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        description=log.description,
        created_at=log.created_at.isoformat() if log.created_at else "",
    )


@router.get("", response_model=List[AuditLogOut])
def list_audit_logs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=300),
    user_id: Optional[int] = Query(default=None, ge=1),
    branch_id: Optional[int] = Query(default=None, ge=1),
    action: Optional[str] = Query(default=None),
    entity_type: Optional[str] = Query(default=None),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("audit:view")),
):
    q = db.query(AuditLog).options(joinedload(AuditLog.user), joinedload(AuditLog.branch))
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if branch_id:
        q = q.filter(AuditLog.branch_id == branch_id)
    if action:
        q = q.filter(AuditLog.action == action)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if from_date:
        q = q.filter(AuditLog.created_at >= datetime.combine(from_date, time.min))
    if to_date:
        q = q.filter(AuditLog.created_at <= datetime.combine(to_date, time.max))

    logs = (
        q.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_to_out(log) for log in logs]
