"""Cupón de descuento por cumpleaños: configuración, elegibilidad y canje.

Reglas:
  - Lo configura el administrador (activo, % de descuento, días de vigencia alrededor del
    cumpleaños). Desactivado por defecto.
  - Solo clientas registradas con fecha de nacimiento; la clienta de mostrador (compartida)
    no lo recibe.
  - Se puede usar UNA vez por cumpleaños, dentro de la ventana de días configurada.
  - El servidor calcula el descuento: no se confía en el valor que mande la pantalla.
  - Si la venta se cancela o se elimina, el uso se libera.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.entities.birthday_coupon import KIND_BIRTHDAY, BirthdayCouponConfig, CouponRedemption
from app.domain.entities.client import Client
from app.presentation.schemas.client import today_la_paz

REASON_MESSAGES = {
    "disabled": "El cupón de cumpleaños no está activo.",
    "no_client": "Elige una clienta para aplicar el cupón de cumpleaños.",
    "generic": "El cupón de cumpleaños no aplica a la clienta de mostrador.",
    "no_birth_date": "La clienta no tiene fecha de nacimiento registrada.",
    "outside_window": "La clienta no está en su período de cumpleaños.",
    "already_used": "La clienta ya usó su cupón de cumpleaños este año.",
}


def get_config(db: Session) -> BirthdayCouponConfig:
    row = db.query(BirthdayCouponConfig).filter(BirthdayCouponConfig.id == 1).first()
    if row:
        return row
    row = BirthdayCouponConfig(id=1, enabled=False, percent=0, window_days=0)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_config(db: Session, enabled: bool, percent: float, window_days: int, user_id: Optional[int]) -> BirthdayCouponConfig:
    row = get_config(db)
    row.enabled = enabled
    row.percent = percent
    row.window_days = window_days
    row.updated_at = datetime.now(timezone.utc)
    row.updated_by_id = user_id
    db.commit()
    db.refresh(row)
    return row


def _birthday_in_year(birth: date, year: int) -> date:
    """El cumpleaños de `birth` en `year` (el 29 de febrero se celebra el 28 en años no bisiestos)."""
    try:
        return birth.replace(year=year)
    except ValueError:
        return date(year, 2, 28)


def birthday_occurrence(birth: date, today: date, window_days: int) -> Optional[date]:
    """El cumpleaños (fecha concreta) más cercano que cubre `today` con la ventana dada, o None.
    Se prueban el año anterior, el actual y el siguiente para no fallar en el cambio de año
    (cumple el 2 de enero y hoy es 30 de diciembre)."""
    best: Optional[date] = None
    for year in (today.year - 1, today.year, today.year + 1):
        occurrence = _birthday_in_year(birth, year)
        if abs((today - occurrence).days) <= window_days:
            if best is None or abs((today - occurrence).days) < abs((today - best).days):
                best = occurrence
    return best


def check_eligibility(db: Session, client_id: Optional[int], today: Optional[date] = None) -> dict:
    """Resultado de elegibilidad con el motivo si no corresponde. No modifica nada."""
    config = get_config(db)
    base = {"percent": float(config.percent or 0), "window_days": int(config.window_days or 0)}

    def no(reason: str, birthday: Optional[date] = None) -> dict:
        return {"eligible": False, "reason": reason, "message": REASON_MESSAGES[reason], "birthday": birthday, **base}

    if not config.enabled or (config.percent or 0) <= 0:
        return no("disabled")
    if client_id is None:
        return no("no_client")
    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        return no("no_client")
    if client.is_generic:
        return no("generic")
    if client.birth_date is None:
        return no("no_birth_date")

    today = today or today_la_paz()
    occurrence = birthday_occurrence(client.birth_date, today, int(config.window_days or 0))
    if occurrence is None:
        return no("outside_window")

    used = (
        db.query(CouponRedemption.id)
        .filter(
            CouponRedemption.client_id == client.id,
            CouponRedemption.kind == KIND_BIRTHDAY,
            CouponRedemption.cycle_year == occurrence.year,
        )
        .first()
    )
    if used is not None:
        return no("already_used", occurrence)
    return {"eligible": True, "reason": None, "message": None, "birthday": occurrence, **base}


def require_eligible(db: Session, client_id: Optional[int]) -> dict:
    result = check_eligibility(db, client_id)
    if not result["eligible"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
    return result


def redeem(db: Session, *, client_id: int, sale_id: int, eligibility: dict, discount_amount: float, user_id: Optional[int]) -> CouponRedemption:
    """Registra el uso dentro de la misma transacción de la venta. La restricción única
    (clienta, tipo, año) evita que dos ventas simultáneas usen el mismo cupón."""
    redemption = CouponRedemption(
        kind=KIND_BIRTHDAY,
        client_id=client_id,
        sale_id=sale_id,
        cycle_year=eligibility["birthday"].year,
        percent=eligibility["percent"],
        discount_amount=round(float(discount_amount), 2),
        applied_by_id=user_id,
    )
    db.add(redemption)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=REASON_MESSAGES["already_used"])
    return redemption


def release_for_sale(sale) -> None:
    """La venta se canceló: el cupón queda libre otra vez. Se hace por la relación de la propia
    venta (delete-orphan) para que la respuesta ya no muestre el cupón y no quede una lista vieja
    en memoria. Al ELIMINAR la venta no hace falta: el borrado en cascada se lleva el uso."""
    sale.redemptions.clear()


def list_redemptions(db: Session, limit: int = 50):
    return (
        db.query(CouponRedemption)
        .order_by(CouponRedemption.created_at.desc(), CouponRedemption.id.desc())
        .limit(limit)
        .all()
    )


def count_redemptions(db: Session) -> int:
    return db.query(func.count(CouponRedemption.id)).scalar() or 0
