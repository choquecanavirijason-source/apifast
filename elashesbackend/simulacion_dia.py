"""
Simula una JORNADA COMPLETA en una sucursal NUEVA y aislada ("Sucursal Simulación"), usando la API real del sistema,
parecida al "diario" del cuaderno del cliente: abre una caja con Bs 100, 10 atenciones de 3 operarias con distintos
métodos de pago, ventas de productos (vitaminas, rimel, crema, peines, parches), gastos, dos bonos y el pago de
comisiones (una del efectivo de la caja, otra por transferencia y una operaria queda pendiente). La caja queda ABIERTA
para ver el cierre y el "Cuadre del día" en pantalla.

Pensado para mostrarle el flujo al cliente. NO toca las otras sucursales. Para borrarla: python limpiar_simulacion.py --apply

Uso (dentro del contenedor del backend, carpeta /app):
  python simulacion_dia.py --dry-run     # solo muestra qué clientas y servicios usaría; no crea nada
  (si el archivo no está dentro de la imagen: docker exec -i elashes-backend python - --dry-run < elashesbackend/simulacion_dia.py)
  python simulacion_dia.py               # crea la sucursal y simula el día
  REUSE_BRANCH=3 python simulacion_dia.py  # reutiliza una sucursal de simulación ya creada (sin caja abierta)

Si ya existe una "Sucursal Simulación" no se repite (para no duplicar datos): bórrala o usa --forzar.
Las operarias de prueba usan correos @simulacion.com y la clave "secreto123".
"""
import argparse
import json
import math
import os
import sys
from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import or_

from main import app
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.inventory import Product
from app.domain.entities.service_agenda import Service
from app.domain.entities.user import Role, User
from app.infrastructure.database import SessionLocal
from app.infrastructure.security import create_access_token

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("--dry-run", action="store_true", help="solo mostrar lo que se usaría")
parser.add_argument("--forzar", action="store_true", help="crear otra sucursal de simulación aunque ya exista una")
args = parser.parse_args()

client = TestClient(app)
db = SessionLocal()
admin = (
    db.query(User).join(Role, Role.id == User.role_id)
    .filter(Role.name.in_(["SuperAdmin", "Admin"])).order_by(User.id).first()
)
operaria_role = db.query(Role).filter(Role.name == "Operaria").first()
if admin is None or operaria_role is None:
    print("Falta un usuario SuperAdmin/Admin o el rol Operaria.")
    sys.exit(1)
HEAD = {"Authorization": f"Bearer {create_access_token(subject=str(admin.id))}"}
TODAY = datetime.now().date()
STAMP = datetime.now().strftime("%H%M%S")

# Clientas y servicios: se buscan en la base (los ids cambian entre instalaciones).
# Se salta la clienta genérica "Cliente Mostrador" de cada sucursal: en la demo se ven mejor clientas con nombre.
clients = (
    db.query(Client)
    .filter(or_(Client.last_name.is_(None), ~Client.last_name.like("Mostrador%")))
    .order_by(Client.id)
    .limit(5)
    .all()
)
if not clients:
    print("No hay clientas registradas para simular las atenciones.")
    sys.exit(1)
WANTED = ["Extensiones Clásicas", "Lifting de Pestañas", "Extensiones Volumen 3D", "Retoque de Extensiones", "Permanente de Pestañas",
          "Extensiones Volumen 5D", "Remoción de Extensiones", "Tratamiento de Queratina"]
active = db.query(Service).filter(Service.is_active.isnot(False)).order_by(Service.id).all()
chosen: list[Service] = []
for name in WANTED:
    found = next((s for s in active if s.name == name and s not in chosen), None)
    if found:
        chosen.append(found)
for s in active:                       # si faltan, se completan con cualquier otro servicio activo
    if len(chosen) >= 8:
        break
    if s not in chosen:
        chosen.append(s)
if len(chosen) < 3:
    print(f"Hacen falta al menos 3 servicios activos (hay {len(chosen)}).")
    sys.exit(1)

print("Clientas:", ", ".join(f"{c.name} {c.last_name or ''}".strip() for c in clients))
print("Servicios:", ", ".join(f"{s.name} (Bs {s.effective_price})" for s in chosen))
if args.dry_run:
    print("\n(Solo vista previa: no se creó nada.)")
    sys.exit(0)

existing = db.query(Branch).filter(Branch.name.like("Sucursal Simulación%")).first()
if existing and not os.environ.get("REUSE_BRANCH") and not args.forzar:
    print(f"Ya existe '{existing.name}' (#{existing.id}). No se repite. Usa --forzar para crear otra.")
    sys.exit(0)


def call(method, url, **kw):
    resp = client.request(method, url, headers=HEAD, **kw)
    if resp.status_code >= 400:
        print(f"ERROR {method} {url} -> {resp.status_code}: {resp.text[:600]}")
        sys.exit(1)
    return resp.json() if resp.content else None


def ts(hour, minute=0):
    return datetime(TODAY.year, TODAY.month, TODAY.day, hour, minute).strftime("%Y-%m-%dT%H:%M:%S")


# ── 1) Sucursal nueva, operarias y productos ─────────────────────────────────
if os.environ.get("REUSE_BRANCH"):
    branch = call("GET", f"/branches/{os.environ['REUSE_BRANCH']}")
    print(f"\nSucursal reutilizada: #{branch['id']} {branch['name']}")
else:
    branch = call("POST", "/branches/", json={"name": f"Sucursal Simulación {TODAY:%d-%m} {STAMP}", "address": "Calle Prueba 1", "city": "La Paz", "department": "La Paz"})
    print(f"\nSucursal creada: #{branch['id']} {branch['name']}")
BID = branch["id"]

pros = {}
existing_users = {u.username: u for u in db.query(User).filter(User.email.like("%@simulacion.com"), User.branch_id == BID).all()}
for key in ("sim_ana", "sim_luna", "sim_mia"):
    found = next((u for name, u in existing_users.items() if name.startswith(key)), None)
    if found:
        pros[key] = found.id
        print(f"Operaria (ya existía): #{found.id} {found.username}")
        continue
    u = call("POST", "/admin/users", json={"username": f"{key}{STAMP}", "email": f"{key}{STAMP}@simulacion.com", "password": "secreto123",
                                           "role_id": operaria_role.id, "branch_id": BID})
    pros[key] = u["id"]
    print(f"Operaria: #{u['id']} {u['username']}")


def product(name, sku_prefix, price, cost, stock):
    found = db.query(Product).filter(Product.name == name).first()
    if found:
        return {"id": found.id, "price": found.price, "name": found.name}
    return call("POST", "/inventory/products", json={"sku": f"{sku_prefix}{STAMP}", "name": name, "price": price, "cost": cost, "status": True, "initial_stock": stock, "branch_id": BID})


vit = product("Vitaminas (sim)", "VIT", 55, 25, 40)
rim = product("Rimel (sim)", "RIM", 25, 10, 40)
cre = product("Crema (sim)", "CRE", 35, 15, 30)
pei = product("Peines (sim)", "PEI", 2, 1, 100)
par = product("Parches (sim)", "PAR", 5, 2, 100)

# ── 2) Abrir la caja con Bs 100 ───────────────────────────────────────────────
session = call("POST", "/cash-sessions/open", json={"branch_id": BID, "opening_amount": 100})
SID = session["id"]
print(f"Caja abierta: sesión #{SID} con Bs 100")


# ── 3) Atenciones (se cobra al iniciar el servicio) ──────────────────────────
def service_sale(client_obj, service, pro, start_h, method, complete=True):
    price = float(service.effective_price)
    body = {"client_id": client_obj.id, "branch_id": BID, "payment_method": method,
            "items": [{"service_id": service.id, "professional_id": pros[pro], "branch_id": BID,
                       "start_time": ts(start_h), "end_time": ts(start_h + 1)}]}
    if method == "mixed":
        qr = 80.0 if price > 100 else round(price / 2, 2)
        body["mixed_payments"] = [{"method": "cash", "amount": round(price - qr, 2)}, {"method": "qr", "amount": qr}]
    elif method == "cash":
        body["cash_received"] = float(math.ceil(price / 10) * 10)         # paga con billete redondo: hay vuelto
    sale = call("POST", "/pos-sales/", json=body)
    appt = sale["appointments"][0]
    call("PUT", f"/agenda/appointments/{appt['id']}", json={"status": "in_service"})
    if complete:
        call("PUT", f"/agenda/appointments/{appt['id']}", json={"status": "completed"})
    print(f"  {sale['sale_code']}: {method:8} Bs {price:>7.2f}  {service.name[:26]:26} {pro}  {'completado' if complete else 'EN SERVICIO'}")
    return appt["id"]


print("Atenciones:")
done = {"sim_ana": [], "sim_luna": [], "sim_mia": []}
PLAN = [  # (clienta, servicio, operaria, hora de inicio, método, completado)
    (0, 0, "sim_ana", 9, "cash", True),
    (1, 1, "sim_luna", 9, "transfer", True),
    (2, 2, "sim_mia", 10, "qr", True),
    (3, 3, "sim_ana", 11, "cash", True),
    (4, 4, "sim_luna", 12, "mixed", True),
    (0, 5, "sim_mia", 13, "transfer", True),
    (1, 6, "sim_ana", 14, "cash", True),
    (2, 7, "sim_luna", 15, "qr", True),
    (3, 0, "sim_mia", 16, "card", True),
    (4, 1, "sim_ana", 16, "card", False),            # este sigue en servicio: cobrado, pero aún sin comisión
]
for ci, si, pro, hour, method, complete in PLAN:
    appt_id = service_sale(clients[ci % len(clients)], chosen[si % len(chosen)], pro, hour, method, complete)
    if complete:
        done[pro].append(appt_id)

# ── 4) Venta de productos (como el "diario" del cuaderno) ────────────────────
print("Productos:")
PRODUCT_SALES = [  # (clienta o None = mostrador, [(producto, cantidad)], método)
    (0, [(vit, 2)], "qr"),
    (1, [(vit, 1), (cre, 1)], "transfer"),
    (None, [(pei, 8)], "cash"),
    (None, [(par, 1)], "cash"),
    (2, [(rim, 2)], "cash"),
    (None, [(cre, 1)], "qr"),
]
for ci, lines, method in PRODUCT_SALES:
    total = sum(p["price"] * q for p, q in lines)
    body = {"branch_id": BID, "payment_method": method, "items": [],
            "product_items": [{"product_id": p["id"], "quantity": q} for p, q in lines]}
    if ci is not None:
        body["client_id"] = clients[ci % len(clients)].id
    if method == "cash":
        body["cash_received"] = total
    sale = call("POST", "/pos-sales/", json=body)
    label = " + ".join(f"{p['name'].replace(' (sim)', '')} x{q:g}" for p, q in lines)
    print(f"  {sale['sale_code']}: {label:28} {method:8} Bs {sale['total']}")

# ── 5) Gastos de la cajera y bonos ───────────────────────────────────────────
print("Gastos y extras:")
for amount, desc in ((10, "Taxi"), (5, "Pasaje"), (30, "Oficina: útiles de limpieza"), (15, "Agua para las clientas")):
    call("POST", "/expenses", json={"branch_id": BID, "amount": amount, "description": desc, "expense_date": TODAY.isoformat()})
    print(f"  Gasto Bs {amount}: {desc}")
for pro, amount, reason, from_cash in (("sim_ana", 20, "Meta del día", True), ("sim_luna", 30, "Incentivo por atención", False)):
    call("POST", "/operator-bonuses", json={"professional_id": pros[pro], "amount": amount, "bonus_date": TODAY.isoformat(),
                                            "reason": reason, "branch_id": BID, "from_cash": from_cash})
    print(f"  Bono Bs {amount} a {pro} ({'del efectivo de la caja' if from_cash else 'por otro medio'})")

# ── 6) Comisiones al final del día ───────────────────────────────────────────
print("Comisiones:")
paid = call("POST", "/agenda/appointments/commission-payments", json={"appointment_ids": done["sim_ana"], "from_cash": True})
print(f"  sim_ana  → Bs {paid['total']} del EFECTIVO de la caja")
paid = call("POST", "/agenda/appointments/commission-payments", json={"appointment_ids": done["sim_luna"], "from_cash": False})
print(f"  sim_luna → Bs {paid['total']} por OTRO medio (transferencia)")
print(f"  sim_mia  → pendiente: {len(done['sim_mia'])} servicios sin pagar (para ver el botón Pagar)")

# ── 7) Lo que ve el sistema ──────────────────────────────────────────────────
detail = call("GET", f"/cash-sessions/{SID}/detail")
summary = call("GET", "/reports/cash-summary", params={"branch_id": BID, "start_date": TODAY.isoformat(), "end_date": TODAY.isoformat()})
print("\n=== Apertura y cierre (arqueo en vivo) ===")
print(json.dumps({k: detail[k] for k in ("cash_sales", "cash_expenses", "cash_commissions", "cash_extras", "expected_cash", "income_by_method")}, indent=2, ensure_ascii=False))
print("Productos vendidos:", [(r["name"], r["quantity"], r["total"]) for r in detail["products_sold"]])
print("Servicios realizados:", [(r["name"], r["count"], r["total"]) for r in detail["services_sold"]])
print("\n=== Corte de caja (resumen del día) ===")
print(json.dumps(summary, indent=2, ensure_ascii=False))
print(f"\nSUCURSAL_ID={BID} SESION_ID={SID}")
print("La caja quedó ABIERTA: elige esta sucursal en el selector y mira Ventas y caja → Apertura y cierre.")
