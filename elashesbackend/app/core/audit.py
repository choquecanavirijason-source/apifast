from typing import Optional
from sqlalchemy.orm import Session

from app.domain.entities.audit_log import AuditLog
from app.domain.entities.user import User


def record_audit(
    db: Session,
    user: Optional[User],
    action: str,
    entity_type: str,
    entity_id: Optional[int],
    description: str,
    branch_id: Optional[int] = None,
) -> None:
    """Registra una acción sensible (create/update/delete/cancel) para el
    módulo de Auditoría. No hace commit propio — se guarda junto con el
    commit de la operación que la originó (o inmediatamente después si esa
    operación ya commiteó), así nunca queda un log huérfano de una acción
    que en realidad falló."""
    log = AuditLog(
        user_id=user.id if user else None,
        branch_id=branch_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
    )
    db.add(log)
    db.commit()
