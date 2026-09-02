from collections import Counter
from datetime import datetime
from io import BytesIO
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import enforce_own_branch
from app.domain.entities.branch import Branch
from app.domain.entities.cash_close import CashClose
from app.domain.entities.client import Client, CLIENT_STATUS_EN_ESPERA
from app.domain.entities.inventory import Batch, Product
from app.domain.entities.payment import Payment
from app.domain.entities.pos_sale import PosSale, PosSaleProduct
from app.domain.entities.service_agenda import Appointment, Service
from app.domain.entities.user import User
from app.presentation.schemas.pos_sale import PosSaleCreate, PosSaleUpdate
from app.application.services.service_agenda_service import create_appointment
from app.application.services.client_service import get_or_create_generic_client, update_client_status
from app.application.services.inventory_service import deduct_stock_fifo, restock_from_sale, sale_stock_tag

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
except ImportError:  # pragma: no cover - entorno sin dependencia opcional
    A4 = None
    mm = None
    canvas = None


ALLOWED_POS_PAYMENT_METHODS = {"cash", "card", "transfer", "qr"}
ALLOWED_DISCOUNT_TYPES = {"amount", "percent"}


def _appointment_service_counts(appt: Appointment) -> Counter:
    if appt.appointment_services:
        return Counter(row.service_id for row in appt.appointment_services)
    if appt.service_id:
        return Counter([appt.service_id])
    return Counter()


def _sale_query(db: Session):
    return db.query(PosSale).options(
        joinedload(PosSale.client),
        joinedload(PosSale.created_by),
        joinedload(PosSale.appointments)
        .joinedload(Appointment.client),
        joinedload(PosSale.appointments)
        .joinedload(Appointment.service),
        joinedload(PosSale.appointments)
        .joinedload(Appointment.professional),
        joinedload(PosSale.appointments)
        .joinedload(Appointment.created_by),
        joinedload(PosSale.appointments)
        .joinedload(Appointment.branch),
        joinedload(PosSale.payments)
        .joinedload(Payment.client),
        joinedload(PosSale.payments)
        .joinedload(Payment.branch),
        joinedload(PosSale.payments)
        .joinedload(Payment.registered_by),
        joinedload(PosSale.product_lines)
        .joinedload(PosSaleProduct.product),
    )


def _generate_sale_code(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"POS-{today}-"
    last = (
        db.query(PosSale)
        .filter(PosSale.sale_code.like(f"{prefix}%"))
        .order_by(PosSale.id.desc())
        .first()
    )
    if last and last.sale_code:
        try:
            num = int(last.sale_code.split("-")[-1]) + 1
        except (IndexError, ValueError):
            num = 1
    else:
        num = 1
    return f"{prefix}{num:04d}"


def _normalize_payment_method(method: str) -> str:
    return method.strip().lower()


def _validate_pos_relations(
    db: Session,
    client_id: int,
    branch_id: Optional[int],
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")

    if branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La sucursal indicada no existe")


def get_sale_by_id(db: Session, sale_id: int) -> PosSale:
    sale = _sale_query(db).filter(PosSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta POS no encontrada")
    return sale


def list_sales(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    branch_id: Optional[int] = None,
    client_id: Optional[int] = None,
):
    # Sin estos filtros, el límite se aplica sobre TODAS las sucursales/clientas
    # combinadas — una sucursal con poco movimiento podía quedar sin ver sus
    # propias ventas recientes, y el historial de una clienta mostraba ventas
    # de otras clientas si el límite se llenaba antes de llegar a las suyas.
    query = _sale_query(db)
    if branch_id is not None:
        query = query.filter(PosSale.branch_id == branch_id)
    if client_id is not None:
        query = query.filter(PosSale.client_id == client_id)
    return (
        query
        .order_by(PosSale.created_at.desc(), PosSale.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_sale(
    db: Session,
    payload: PosSaleCreate,
    current_user: User,
) -> PosSale:
    enforce_own_branch(payload.branch_id, current_user)
    for item in payload.items:
        enforce_own_branch(item.branch_id, current_user)

    # Sin clienta elegida: se usa el "Cliente Mostrador" de la sucursal para no
    # frenar el servicio — se puede completar con los datos reales después.
    if payload.client_id is None:
        generic = get_or_create_generic_client(db=db, branch_id=payload.branch_id)
        payload.client_id = generic.id

    _validate_pos_relations(db=db, client_id=payload.client_id, branch_id=payload.branch_id)

    if payload.branch_id is not None:
        open_session = (
            db.query(CashClose)
            .filter(CashClose.branch_id == payload.branch_id, CashClose.status == "open")
            .first()
        )
        if not open_session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta sucursal no tiene la caja abierta. Abrila en Salones → Caja antes de vender.",
            )

    # Pago mixto: valida métodos y que la suma cubra el total
    if payload.mixed_payments:
        for entry in payload.mixed_payments:
            m = _normalize_payment_method(entry.method)
            if m not in ALLOWED_POS_PAYMENT_METHODS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Método de pago mixto no válido '{entry.method}'. Usa: {', '.join(sorted(ALLOWED_POS_PAYMENT_METHODS))}",
                )
        payment_method = "mixed"
    else:
        payment_method = _normalize_payment_method(payload.payment_method)
        if payment_method not in ALLOWED_POS_PAYMENT_METHODS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Método de pago no válido. Usa uno de: {', '.join(sorted(ALLOWED_POS_PAYMENT_METHODS))}",
            )

    if payload.discount_type not in ALLOWED_DISCOUNT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de descuento no válido",
        )

    if not payload.items and not payload.product_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agrega al menos un servicio o producto a la venta",
        )

    # Recolectar todos los service IDs (items individuales y grupales)
    all_service_ids: set[int] = set()
    for item in payload.items:
        if item.service_ids:
            all_service_ids.update(item.service_ids)
        elif item.service_id is not None:
            all_service_ids.add(item.service_id)

    if payload.items and not all_service_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cada item debe tener al menos service_id o service_ids",
        )

    services = db.query(Service).filter(Service.id.in_(all_service_ids)).all() if all_service_ids else []
    service_map = {service.id: service for service in services}
    if len(service_map) != len(all_service_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uno o más servicios no existen",
        )

    # Subtotal: suma precios de todos los servicios (individuales + grupales)
    subtotal = 0.0
    for item in payload.items:
        if item.service_ids:
            subtotal += sum(service_map[sid].price for sid in item.service_ids if sid in service_map)
        elif item.service_id is not None:
            subtotal += service_map[item.service_id].price

    # Productos: validar existencia/estado + stock disponible en la sucursal
    # ANTES de tocar nada — si algo falla, la venta entera no se crea.
    product_map: dict[int, Product] = {}
    if payload.product_items:
        if payload.branch_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selecciona una sucursal para vender productos",
            )
        product_ids = {item.product_id for item in payload.product_items}
        products = db.query(Product).filter(Product.id.in_(product_ids)).all()
        product_map = {p.id: p for p in products}
        if len(product_map) != len(product_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uno o más productos no existen")
        for item in payload.product_items:
            product = product_map[item.product_id]
            if not product.status:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El producto '{product.name}' no está activo",
                )
            available = (
                db.query(func.coalesce(func.sum(Batch.current_quantity), 0.0))
                .filter(Batch.product_id == product.id, Batch.branch_id == payload.branch_id)
                .scalar()
            )
            if float(available or 0) < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Stock insuficiente de '{product.name}' en esta sucursal (disponible {available or 0}, pedido {item.quantity})",
                )
            subtotal += product.price * item.quantity

    subtotal = float(subtotal)
    discount_value = float(payload.discount_value)

    if payload.discount_type == "percent":
        discount_amount = subtotal * (discount_value / 100)
    else:
        discount_amount = discount_value

    if discount_amount < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El descuento no puede ser negativo")

    total = max(0.0, subtotal - discount_amount)

    link_appt: Optional[Appointment] = None
    if payload.link_appointment_id is not None:
        link_appt = (
            db.query(Appointment)
            .options(joinedload(Appointment.appointment_services))
            .filter(Appointment.id == payload.link_appointment_id)
            .first()
        )
        if not link_appt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
        if link_appt.sale_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta reserva ya tiene una venta registrada",
            )
        if link_appt.client_id != payload.client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El cliente del cobro no coincide con la reserva",
            )
        payload_service_counts: Counter = Counter()
        for item in payload.items:
            if item.service_ids:
                payload_service_counts.update(item.service_ids)
            elif item.service_id is not None:
                payload_service_counts[item.service_id] += 1
        if _appointment_service_counts(link_appt) != payload_service_counts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Los servicios cobrados deben coincidir exactamente con los de la reserva",
            )

    sale_status = "reserved" if payload.reservation_only else "paid"

    sale = PosSale(
        sale_code=_generate_sale_code(db),
        client_id=payload.client_id,
        branch_id=payload.branch_id,
        created_by_id=current_user.id,
        subtotal=subtotal,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        total=total,
        payment_method=payment_method,
        status=sale_status,
        notes=payload.notes,
    )
    db.add(sale)
    db.flush()

    if link_appt is not None:
        starts = [item.start_time for item in payload.items]
        ends = [item.end_time for item in payload.items]
        link_appt.sale_id = sale.id
        link_appt.start_time = min(starts)
        link_appt.end_time = max(ends)
        first_item = payload.items[0]
        if first_item.professional_id is not None:
            link_appt.professional_id = first_item.professional_id
        if payload.branch_id is not None:
            link_appt.branch_id = payload.branch_id
        link_appt.status = "completed"
    elif payload.sale_without_appointments:
        pass
    else:
        appointment_status = "pending"
        for item in payload.items:
            create_appointment(
                db=db,
                client_id=payload.client_id,
                created_by_id=current_user.id,
                professional_id=item.professional_id,
                service_id=item.service_id if not item.service_ids else None,
                service_ids=item.service_ids or None,
                branch_id=item.branch_id or payload.branch_id,
                sale_id=sale.id,
                is_ia=item.is_ia,
                start_time=item.start_time,
                end_time=item.end_time,
                status_value=appointment_status,
                skip_availability_check=True,
            )

    if not payload.reservation_only:
        if payload.mixed_payments:
            mixed_sum = sum(e.amount for e in payload.mixed_payments)
            if round(mixed_sum, 2) < round(total, 2):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"La suma del pago mixto ({mixed_sum:.2f}) no cubre el total ({total:.2f}).",
                )
            for entry in payload.mixed_payments:
                db.add(Payment(
                    client_id=payload.client_id,
                    branch_id=payload.branch_id,
                    sale_id=sale.id,
                    registered_by_id=current_user.id,
                    amount=float(entry.amount),
                    method=_normalize_payment_method(entry.method),
                    status="paid",
                    notes=payload.notes,
                    paid_at=datetime.utcnow(),
                ))
        else:
            cash_received = None
            cash_change = None
            if payment_method == "cash" and payload.cash_received is not None:
                if round(payload.cash_received, 2) < round(total, 2):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"El monto recibido ({payload.cash_received:.2f}) es menor al total a cobrar ({total:.2f}).",
                    )
                cash_received = float(payload.cash_received)
                cash_change = round(cash_received - total, 2)

            db.add(Payment(
                client_id=payload.client_id,
                branch_id=payload.branch_id,
                sale_id=sale.id,
                registered_by_id=current_user.id,
                amount=total,
                method=payment_method,
                status="paid",
                notes=payload.notes,
                paid_at=datetime.utcnow(),
                cash_received=cash_received,
                cash_change=cash_change,
            ))

    # Productos: se registran y descuentan stock al final, después de validar
    # que el pago (incl. mixto) cubre el total — create_inventory_movement
    # hace commit por su cuenta, así que todo lo anterior ya debe ser válido.
    for item in payload.product_items:
        product = product_map[item.product_id]
        db.add(PosSaleProduct(
            sale_id=sale.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_price=product.price,
            subtotal=product.price * item.quantity,
        ))
        deduct_stock_fifo(
            db=db,
            product_id=product.id,
            branch_id=payload.branch_id,
            quantity=item.quantity,
            note=f"{sale_stock_tag(sale.id, sale.created_at)} Venta {sale.sale_code} (línea producto: {product.name})",
        )

    db.commit()

    update_client_status(db, payload.client_id, CLIENT_STATUS_EN_ESPERA)

    return get_sale_by_id(db, sale.id)


def update_sale(
    db: Session,
    sale_id: int,
    payload: PosSaleUpdate,
) -> PosSale:
    sale = get_sale_by_id(db=db, sale_id=sale_id)

    if payload.client_id is not None and payload.client_id != sale.client_id:
        _validate_pos_relations(db=db, client_id=payload.client_id, branch_id=sale.branch_id)
        sale.client_id = payload.client_id

    if payload.payment_method is not None:
        payment_method = _normalize_payment_method(payload.payment_method)
        if payment_method not in ALLOWED_POS_PAYMENT_METHODS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Método de pago no válido. Usa uno de: {', '.join(sorted(ALLOWED_POS_PAYMENT_METHODS))}",
            )
        sale.payment_method = payment_method
        for payment in sale.payments:
            payment.method = payment_method

    if payload.notes is not None:
        sale.notes = payload.notes

    if payload.discount_type is not None:
        if payload.discount_type not in ALLOWED_DISCOUNT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tipo de descuento no válido",
            )
        sale.discount_type = payload.discount_type

    if payload.discount_value is not None:
        if payload.discount_value < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El descuento no puede ser negativo")
        sale.discount_value = payload.discount_value

    if payload.status is not None:
        was_already_cancelled = sale.status == "cancelled"
        sale.status = payload.status
        if payload.status == "cancelled":
            for appointment in sale.appointments:
                appointment.status = "cancelled"
            for payment in sale.payments:
                payment.status = "cancelled"
            if not was_already_cancelled and sale.product_lines:
                restock_from_sale(db, sale.id, sale.sale_code, sale.created_at)
        elif payload.status == "paid":
            for payment in sale.payments:
                payment.status = "paid"

    # Recalcula desde BD para reflejar cambios reales de tickets/servicios editados.
    subtotal_db = (
        db.query(func.coalesce(func.sum(Service.price), 0.0))
        .select_from(Appointment)
        .outerjoin(Service, Appointment.service_id == Service.id)
        .filter(
            Appointment.sale_id == sale.id,
            Appointment.status != "cancelled",
        )
        .scalar()
    )
    products_subtotal_db = 0.0
    if sale.status != "cancelled":
        products_subtotal_db = (
            db.query(func.coalesce(func.sum(PosSaleProduct.subtotal), 0.0))
            .filter(PosSaleProduct.sale_id == sale.id)
            .scalar()
        )
    subtotal = float(subtotal_db or 0.0) + float(products_subtotal_db or 0.0)
    discount_value = float(sale.discount_value or 0)
    if sale.discount_type == "percent":
        discount_amount = subtotal * (discount_value / 100)
    else:
        discount_amount = discount_value

    sale.subtotal = subtotal
    sale.total = max(0.0, subtotal - discount_amount)

    for payment in sale.payments:
        if payment.status != "cancelled":
            payment.amount = sale.total

    db.commit()
    return get_sale_by_id(db, sale_id)


def cancel_sale(
    db: Session,
    sale_id: int,
) -> PosSale:
    return update_sale(db=db, sale_id=sale_id, payload=PosSaleUpdate(status="cancelled"))


def delete_sale(
    db: Session,
    sale_id: int,
) -> None:
    sale = get_sale_by_id(db=db, sale_id=sale_id)

    # Si ya estaba cancelada, update_sale ya restituyó el stock — repetirlo
    # acá lo devolvería dos veces.
    if sale.product_lines and sale.status != "cancelled":
        restock_from_sale(db, sale.id, sale.sale_code, sale.created_at)

    # Libera relaciones para no romper FK al eliminar la venta.
    for appointment in sale.appointments:
        db.delete(appointment)
    for payment in sale.payments:
        db.delete(payment)
    for product_line in sale.product_lines:
        db.delete(product_line)

    db.delete(sale)
    db.commit()


def generate_sale_receipt_pdf(
    db: Session,
    sale_id: int,
    print_format: str = "a4",
) -> bytes:
    if canvas is None or A4 is None or mm is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo generar el PDF. Instala la dependencia reportlab.",
        )

    sale = get_sale_by_id(db=db, sale_id=sale_id)

    receipt_format = (print_format or "a4").strip().lower()
    if receipt_format not in {"a4", "thermal"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato inválido. Usa 'a4' o 'thermal'.",
        )

    if receipt_format == "thermal":
        page_width = 80 * mm
        page_height = 220 * mm
        side_margin = 6 * mm
        title_font = 11
        body_font = 8
    else:
        page_width, page_height = A4
        side_margin = 20 * mm
        title_font = 16
        body_font = 10

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(page_width, page_height))
    y = page_height - side_margin

    def write_line(text: str, size: int = body_font, leading: float = 1.35, bold: bool = False):
        nonlocal y
        if y <= side_margin:
            pdf.showPage()
            y = page_height - side_margin
        font_name = "Helvetica-Bold" if bold else "Helvetica"
        pdf.setFont(font_name, size)
        pdf.drawString(side_margin, y, str(text))
        y -= size * leading

    def dashed_separator():
        nonlocal y
        pdf.setDash(3, 3)
        pdf.line(side_margin, y, page_width - side_margin, y)
        pdf.setDash()
        y -= 10

    created_at = sale.created_at or datetime.utcnow()
    client_name = f"{sale.client.name} {sale.client.last_name}".strip() if sale.client else "N/D"
    payment_method = (sale.payment_method or "").capitalize()

    write_line("COMPROBANTE", size=title_font, bold=True, leading=1.5)
    write_line(created_at.strftime("%d/%m/%Y %H:%M"), size=body_font)
    y -= 4
    dashed_separator()

    write_line(f"Codigo venta: {sale.sale_code}", bold=True)
    write_line(f"Cliente: {client_name}")
    write_line(f"Metodo de pago: {payment_method}")
    write_line(f"Estado: {sale.status}")
    if sale.notes:
        write_line(f"Notas: {sale.notes}")

    y -= 4
    dashed_separator()

    if not sale.appointments and not sale.product_lines:
        write_line("Sin ítems asociados.")

    if sale.appointments:
        write_line("Servicios", bold=True)
        for appt in sale.appointments:
            service_names = [svc.name for svc in (appt.services or []) if svc and svc.name]
            if not service_names and appt.service and appt.service.name:
                service_names = [appt.service.name]
            service_label = ", ".join(service_names) if service_names else "Servicio"

            professional = appt.professional.username if appt.professional else "Sin asignar"
            start_time = appt.start_time.strftime("%H:%M") if appt.start_time else "Sin hora"
            ticket_code = appt.ticket_code or f"#{appt.id}"

            write_line(f"- {ticket_code}: {service_label}", bold=True)
            write_line(f"  Operaria: {professional} | Hora: {start_time}", size=max(body_font - 1, 7))
            y -= 2

    if sale.product_lines:
        if sale.appointments:
            y -= 4
        write_line("Productos", bold=True)
        for line in sale.product_lines:
            product_name = line.product.name if line.product else f"Producto #{line.product_id}"
            write_line(f"- {product_name} x{line.quantity:g}", bold=True)
            write_line(f"  Bs {line.unit_price:.2f} c/u = Bs {line.subtotal:.2f}", size=max(body_font - 1, 7))
            y -= 2

    dashed_separator()
    write_line(f"Subtotal: Bs {float(sale.subtotal or 0):.2f}", bold=False)
    if float(sale.discount_value or 0) > 0:
        if sale.discount_type == "percent":
            write_line(f"Descuento: {float(sale.discount_value):.2f}%")
        else:
            write_line(f"Descuento: Bs {float(sale.discount_value):.2f}")
    write_line(f"TOTAL: Bs {float(sale.total or 0):.2f}", size=body_font + 2, bold=True, leading=1.5)

    if (sale.payment_method or "").lower() == "qr":
        y -= 6
        write_line("QR referencia:", bold=True)
        write_line(sale.sale_code)

    y -= 8
    write_line("Gracias por su compra.", size=max(body_font - 1, 7))

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()
