from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.domain.entities.audit_log import AuditLog
from app.domain.entities.user import User


def describe_changes(old_values: Dict[str, Any], new_obj: Any, field_labels: Dict[str, str]) -> str:
    """Compara valores de "antes" (capturados a mano antes del update) contra
    los atributos actuales de new_obj (ya actualizado), y arma un texto tipo
    "precio Bs 15.0 -> Bs 18.0" solo con los campos que de verdad cambiaron.
    Usado para que el log de auditoría muestre el antes/después en vez de un
    genérico "editó X" que no sirve para investigar qué pasó realmente."""
    parts = []
    for attr, label in field_labels.items():
        old_val = old_values.get(attr)
        new_val = getattr(new_obj, attr, None)
        if old_val != new_val:
            parts.append(f"{label} {old_val} → {new_val}")
    return "; ".join(parts) if parts else "sin cambios en los campos monitoreados"


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
