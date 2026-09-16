"""Seeder integral de carga para eLashes.

Objetivo
========
Poblar de forma coherente TODAS las tablas del backend para pruebas de carga,
reportes, paginacion, filtros y exportaciones.

Por defecto crea 5000 registros de PRUEBA en cada tabla de negocio/catálogo
escalable. Las tablas de configuración con semántica singleton o de autorización
(app_settings, admin_ai_settings, roles, permissions, role_permissions) se
mantienen con una cantidad razonable para no romper la lógica del sistema.

Los datos generados usan el prefijo LOAD5K para distinguirlos de datos reales y
para que el script sea re-ejecutable sin duplicar sus propios registros.

Uso recomendado (SOLO desarrollo/pruebas):

    python -m app.infrastructure.database.seed_full_load_test_5000 \
        --count 5000 --branches 2 --confirm

IMPORTANTE: bloquea ENVIRONMENT=production/prod.
"""
from __future__ import annotations

import argparse
import random
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.infrastructure.database import Base, SessionLocal
from app.infrastructure.database.init_db import init_db

# Importar TODOS los modelos para registrarlos en Base.metadata.
from app.domain.entities.admin_ai_settings import AdminAiSettings
from app.domain.entities.app_settings import AppSettings
from app.domain.entities.audit_log import AuditLog
from app.domain.entities.branch import Branch
from app.domain.entities.branch_integration_profile import BranchIntegrationProfile
from app.domain.entities.cash_close import CashClose, CommissionReceipt
from app.domain.entities.client import (
    CLIENT_STATUS_EN_ESPERA,
    CLIENT_STATUS_EN_SERVICIO,
    CLIENT_STATUS_FINALIZADO,
    CLIENT_STATUS_RESERVA,
    Client,
)
from app.domain.entities.commission_payment import CommissionPayment
from app.domain.entities.expense import Expense
from app.domain.entities.inventory import Batch, Category, InventoryMovement, Product
from app.domain.entities.lash_design_final import DisenoFinal, DisenoGuardado, Tecnologia
from app.domain.entities.marketplace_product import MarketplaceProduct
from app.domain.entities.payment import Payment
from app.domain.entities.pos_sale import PosSale, PosSaleProduct
from app.domain.entities.service_agenda import (
    Appointment,
    AppointmentService,
    BranchService,
    Service,
    ServiceCategory,
)
from app.domain.entities.tracking import (
    Design,
    Effect,
    EyeType,
    LashDesign,
    Question,
    Questionnaire,
    Tracking,
    Volume,
)
from app.domain.entities.user import (
    Permission,
    Role,
    User,
    role_permissions,
    user_permissions,
)

TAG = "LOAD5K"
DEFAULT_COUNT = 5000
DEFAULT_BRANCHES = 2
CHUNK = 500

# Hash bcrypt valido para la contraseña: LoadTest123!
# Se reutiliza en usuarios sinteticos para evitar hashear 5000 veces.
LOAD_USER_PASSWORD_HASH = "$2b$12$CDYz/6EpMyUF7vdgUD8IneRdvclYlwnMKln7J5dpGbTA4xGkaeHle"

BASE_PERMISSIONS = [
    "clients:view", "clients:manage",
    "catalog:view", "catalog:manage",
    "tracking:view", "tracking:manage",
    "forms:view", "forms:manage",
    "users:manage", "settings:view",
    "payments:view", "payments:manage",
    "inventory:view", "inventory:manage",
    "services:view", "services:manage",
    "appointments:view", "appointments:manage",
    "branches:view", "branches:manage",
    "ai:view", "ai:manage",
    "dashboard:view", "audit:view",
]

BASE_ROLES = [
    "SuperAdmin", "Admin", "Operaria", "Secretaria", "EncargadaAlmacen", "Cajera"
]

FIRST_NAMES = [
    "Ana", "Maria", "Sofia", "Valentina", "Camila", "Lucia", "Daniela",
    "Gabriela", "Carla", "Natalia", "Paola", "Andrea", "Fernanda", "Alejandra",
    "Mariana", "Laura", "Isabel", "Micaela", "Nicole", "Adriana",
]
LAST_NAMES = [
    "Perez", "Gomez", "Rojas", "Cruz", "Torres", "Vargas", "Flores", "Rios",
    "Salinas", "Mendez", "Lopez", "Rodriguez", "Fernandez", "Sanchez",
    "Romero", "Mamani", "Quispe", "Choque", "Rivera", "Aguilar",
]
CITIES = [
    ("Cochabamba", "Cochabamba"),
    ("Santa Cruz de la Sierra", "Santa Cruz"),
    ("La Paz", "La Paz"),
    ("Sucre", "Chuquisaca"),
    ("Tarija", "Tarija"),
]
PAYMENT_METHODS = ["cash", "qr", "card", "transfer"]
APPOINTMENT_STATUSES = ["completed", "pending", "confirmed", "in_service", "cancelled"]
APPOINTMENT_WEIGHTS = [50, 20, 15, 5, 10]


def _is_production() -> bool:
    env = (settings.environment or "").strip().lower()
    return env in {"production", "prod"}


def _commit_chunks(db: Session, items: Sequence[object], chunk: int = CHUNK) -> None:
    for start in range(0, len(items), chunk):
        db.add_all(items[start:start + chunk])
        db.commit()


def _prefix_values(db: Session, column, prefix: str) -> set[str]:
    return {row[0] for row in db.query(column).filter(column.like(f"{prefix}%")).all()}


def _ensure_base_authorization(db: Session) -> tuple[dict[str, Permission], dict[str, Role]]:
    permissions: dict[str, Permission] = {}
    for name in BASE_PERMISSIONS:
        item = db.query(Permission).filter(Permission.name == name).first()
        if not item:
            item = Permission(name=name)
            db.add(item)
            db.flush()
        permissions[name] = item

    roles: dict[str, Role] = {}
    for name in BASE_ROLES:
        item = db.query(Role).filter(Role.name == name).first()
        if not item:
            item = Role(name=name)
            db.add(item)
            db.flush()
        roles[name] = item

    # Mantener permisos coherentes sin crear miles de permisos artificiales.
    role_map = {
        "SuperAdmin": BASE_PERMISSIONS,
        "Admin": BASE_PERMISSIONS,
        "Operaria": [
            "clients:view", "clients:manage", "catalog:view", "tracking:view",
            "tracking:manage", "forms:view", "services:view", "services:manage",
            "appointments:view", "appointments:manage", "payments:view", "branches:view",
        ],
        "Secretaria": [
            "clients:view", "clients:manage", "catalog:view", "tracking:view",
            "tracking:manage", "forms:view", "payments:view", "payments:manage",
            "services:view", "services:manage", "appointments:view", "appointments:manage",
            "branches:view", "inventory:view", "dashboard:view", "audit:view",
        ],
        "EncargadaAlmacen": ["inventory:view", "inventory:manage", "catalog:view", "branches:view"],
        "Cajera": [
            "payments:view", "payments:manage", "clients:view", "clients:manage",
            "catalog:view", "services:view", "branches:view", "appointments:view",
            "appointments:manage", "inventory:view",
        ],
    }
    for role_name, permission_names in role_map.items():
        role = roles[role_name]
        wanted = [permissions[name] for name in permission_names]
        # Asignacion solo si falta algo; evita duplicados en tabla secundaria.
        current_ids = {p.id for p in role.permissions}
        for permission in wanted:
            if permission.id not in current_ids:
                role.permissions.append(permission)

    db.commit()
    return permissions, roles


def _ensure_singletons(db: Session) -> None:
    if not db.query(AppSettings).filter(AppSettings.id == 1).first():
        db.add(AppSettings(id=1, logo_url=None, logo_original_name=None))
    if not db.query(AdminAiSettings).filter(AdminAiSettings.id == 1).first():
        db.add(AdminAiSettings(
            id=1,
            ai_enabled=False,
            ai_api_url=None,
            ai_api_token=None,
            ai_model="gpt-4o-mini",
        ))
    db.commit()


def _ensure_profiles_and_branches(db: Session, branch_count: int) -> tuple[list[BranchIntegrationProfile], list[Branch]]:
    """
    Usa primero las sucursales reales del sistema:
      - Sucursal Principal
      - Sucursal Norte

    Si --branches es mayor que 2, completa el resto con sucursales sinteticas LOAD5K.
    Con --branches 2, TODOS los datos masivos se reparten entre las dos sucursales reales.
    """
    preferred_names = ["Sucursal Principal", "Sucursal Norte"]

    real_branches: list[Branch] = []
    for name in preferred_names:
        branch = db.query(Branch).filter(Branch.name == name).first()
        if branch:
            real_branches.append(branch)

    if len(real_branches) < 2:
        found = ", ".join(b.name for b in real_branches) or "ninguna"
        raise RuntimeError(
            "Faltan las sucursales base requeridas. "
            f"Encontradas: {found}. "
            "Se esperan 'Sucursal Principal' y 'Sucursal Norte'."
        )

    # branch_count representa el TOTAL de sucursales usadas por el seeder.
    # Nunca usamos menos de las dos sucursales reales.
    total_branches = max(2, branch_count)
    synthetic_needed = max(0, total_branches - len(real_branches))

    profiles: list[BranchIntegrationProfile] = []
    synthetic_branches: list[Branch] = []

    if synthetic_needed > 0:
        profile_prefix = f"{TAG} Perfil "
        existing_profiles = _prefix_values(db, BranchIntegrationProfile.name, profile_prefix)
        new_profiles = []

        for i in range(1, synthetic_needed + 1):
            name = f"{profile_prefix}{i:05d}"
            if name not in existing_profiles:
                new_profiles.append(BranchIntegrationProfile(
                    name=name,
                    is_shared=(i % 3 != 0),
                    whatsapp_enabled=(i % 4 == 0),
                    whatsapp_provider="webhook",
                    whatsapp_api_url=f"https://example.test/whatsapp/{i}" if i % 4 == 0 else None,
                    whatsapp_api_token=None,
                    whatsapp_phone_number_id=f"TEST-{i:05d}" if i % 4 == 0 else None,
                    ai_api_url=f"https://example.test/ai/{i}" if i % 5 == 0 else None,
                    ai_api_token=None,
                ))

        _commit_chunks(db, new_profiles)

        profiles = (
            db.query(BranchIntegrationProfile)
            .filter(BranchIntegrationProfile.name.like(f"{profile_prefix}%"))
            .order_by(BranchIntegrationProfile.id)
            .limit(synthetic_needed)
            .all()
        )

        branch_prefix = f"{TAG} Sucursal "
        existing_branches = _prefix_values(db, Branch.name, branch_prefix)
        new_branches = []

        for i in range(1, synthetic_needed + 1):
            name = f"{branch_prefix}{i:05d}"
            if name in existing_branches:
                continue

            city, department = CITIES[(i - 1) % len(CITIES)]
            profile = profiles[(i - 1) % len(profiles)] if profiles else None

            new_branches.append(Branch(
                name=name,
                address=f"Av. Prueba #{1000 + i}",
                city=city,
                department=department,
                country_code="BO",
                opening_hours=[],
                qr_image_url=None,
                maps_url=f"https://maps.example.test/load5k/{i}",
                integration_profile_id=profile.id if profile else None,
            ))

        _commit_chunks(db, new_branches)

        synthetic_branches = (
            db.query(Branch)
            .filter(Branch.name.like(f"{branch_prefix}%"))
            .order_by(Branch.id)
            .limit(synthetic_needed)
            .all()
        )

    branches = real_branches + synthetic_branches

    print(">>> Sucursales usadas por el seeder:")
    for branch in branches:
        print(f"    - {branch.id}: {branch.name}")

    return profiles, branches


def _ensure_users(
    db: Session,
    count: int,
    rng: random.Random,
    roles: dict[str, Role],
    branches: list[Branch],
    permissions: dict[str, Permission],
) -> list[User]:
    prefix = f"{TAG.lower()}_user_"
    existing = _prefix_values(db, User.username, prefix)
    now = datetime.now(timezone.utc)
    role_choices = [
        roles["Operaria"], roles["Operaria"], roles["Operaria"],
        roles["Secretaria"], roles["Cajera"], roles["EncargadaAlmacen"], roles["Admin"],
    ]
    new_items = []
    for i in range(1, count + 1):
        username = f"{prefix}{i:06d}"
        if username in existing:
            continue
        role = rng.choice(role_choices)
        branch = branches[(i - 1) % len(branches)]
        temp_branch = branches[(i + 7) % len(branches)] if i % 10 == 0 else None
        is_operaria = role.name == "Operaria"
        new_items.append(User(
            username=username,
            email=f"{username}@gmail.com",
            phone=f"+5918{i:08d}"[-13:],
            hashed_password=LOAD_USER_PASSWORD_HASH,
            is_active=(i % 17 != 0),
            created_at=now - timedelta(days=i % 1000),
            skill_level=(1 + i % 5) if is_operaria else None,
            commission_rate=round(0.30 + (i % 21) / 100, 2),
            role_id=role.id,
            branch_id=branch.id,
            temp_branch_id=temp_branch.id if temp_branch else None,
            temp_branch_until=(date.today() + timedelta(days=7 + i % 30)) if temp_branch else None,
        ))
    _commit_chunks(db, new_items)

    users = (
        db.query(User)
        .filter(User.username.like(f"{prefix}%"))
        .order_by(User.id)
        .limit(count)
        .all()
    )
    if len(users) < count:
        raise RuntimeError(f"Se esperaban {count} usuarios LOAD5K y existen {len(users)}")

    # Una asignacion directa por usuario para llenar user_permissions de forma coherente.
    stmt = (
        select(user_permissions.c.user_id)
        .select_from(user_permissions.join(User, user_permissions.c.user_id == User.id))
        .where(User.username.like(f"{prefix}%"))
    )
    existing_user_ids = {row[0] for row in db.execute(stmt).all()}
    perm_list = list(permissions.values())
    rows = []
    for i, user in enumerate(users):
        if user.id not in existing_user_ids:
            rows.append({
                "user_id": user.id,
                "permission_id": perm_list[i % len(perm_list)].id,
            })
    for start in range(0, len(rows), CHUNK):
        db.execute(user_permissions.insert(), rows[start:start + CHUNK])
        db.commit()
    return users


def _ensure_named_catalog(db: Session, model, column, prefix: str, count: int, factory) -> list:
    existing = _prefix_values(db, column, prefix)
    new_items = []
    for i in range(1, count + 1):
        key = f"{prefix}{i:06d}"
        if key not in existing:
            new_items.append(factory(i, key))
    _commit_chunks(db, new_items)
    return db.query(model).filter(column.like(f"{prefix}%")).order_by(model.id).limit(count).all()


def _ensure_tracking_catalogs(db: Session, count: int) -> tuple[list, list, list, list, list]:
    eyes = _ensure_named_catalog(
        db, EyeType, EyeType.name, f"{TAG} Ojo ", count,
        lambda i, key: EyeType(name=key, description=f"Tipo de ojo sintetico {i}", image=None),
    )
    effects = _ensure_named_catalog(
        db, Effect, Effect.name, f"{TAG} Efecto ", count,
        lambda i, key: Effect(name=key, image=None),
    )
    volumes = _ensure_named_catalog(
        db, Volume, Volume.name, f"{TAG} Volumen ", count,
        lambda i, key: Volume(name=key, description=f"Volumen sintetico {i}", image=None),
    )
    lash_designs = _ensure_named_catalog(
        db, LashDesign, LashDesign.name, f"{TAG} LashDesign ", count,
        lambda i, key: LashDesign(name=key, image=None),
    )
    designs = _ensure_named_catalog(
        db, Design, Design.name, f"{TAG} Design ", count,
        lambda i, key: Design(
            name=key,
            effect=effects[(i - 1) % len(effects)].name,
            eye_type=eyes[(i - 1) % len(eyes)].name,
            lash_design=lash_designs[(i - 1) % len(lash_designs)].name,
            volume=volumes[(i - 1) % len(volumes)].name,
            note=f"[{TAG}] Diseño sugerido #{i}",
            image=None,
        ),
    )
    return eyes, effects, volumes, lash_designs, designs


def _ensure_service_catalog(db: Session, count: int, branches: list[Branch], rng: random.Random) -> tuple[list[ServiceCategory], list[Service]]:
    cat_prefix = f"{TAG} ServiceCategory "
    categories = _ensure_named_catalog(
        db, ServiceCategory, ServiceCategory.name, cat_prefix, count,
        lambda i, key: ServiceCategory(
            name=key,
            description=f"Categoria de servicio de carga #{i}",
            image_url=None,
            is_mobile=(i % 4 == 0),
            has_maintenance=(i % 3 != 0),
            has_removal=(i % 4 != 0),
        ),
    )

    service_prefix = f"{TAG} Servicio "
    existing = _prefix_values(db, Service.name, service_prefix)
    new_items = []
    for i in range(1, count + 1):
        name = f"{service_prefix}{i:06d}"
        if name in existing:
            continue
        category = categories[(i - 1) % len(categories)]
        price = float(50 + (i % 26) * 10)
        new_items.append(Service(
            name=name,
            description=f"Servicio sintetico para carga #{i}",
            image_url=None,
            category_id=category.id,
            duration_minutes=30 + (i % 9) * 15,
            price=price,
            commission_rate=round(0.30 + (i % 16) / 100, 2),
            maintenance_days=(15 + i % 16) if category.has_maintenance else None,
            removal_days=(25 + i % 21) if category.has_removal else None,
            is_active=(i % 13 != 0),
            discount_percent=float([0, 0, 0, 5, 10, 15][i % 6]) or None,
        ))
    _commit_chunks(db, new_items)
    services = db.query(Service).filter(Service.name.like(f"{service_prefix}%")).order_by(Service.id).limit(count).all()

    # 1 relacion sucursal-servicio por servicio => count filas LOAD5K.
    service_ids = [s.id for s in services]
    existing_service_ids = {
        row[0]
        for row in (
            db.query(BranchService.service_id)
            .filter(BranchService.service_id.in_(service_ids[:900]))
            .all()
        )
    } if len(service_ids) <= 900 else set()
    # Para evitar limite de variables SQLite, cuando son muchos hacemos consulta por JOIN/prefijo.
    if len(service_ids) > 900:
        existing_service_ids = {
            row[0]
            for row in (
                db.query(BranchService.service_id)
                .join(Service, BranchService.service_id == Service.id)
                .filter(Service.name.like(f"{service_prefix}%"))
                .all()
            )
        }
    links = []
    for i, service in enumerate(services):
        if service.id not in existing_service_ids:
            links.append(BranchService(
                branch_id=branches[i % len(branches)].id,
                service_id=service.id,
                is_active=(i % 11 != 0),
            ))
    _commit_chunks(db, links)
    return categories, services


def _ensure_inventory(db: Session, count: int, branches: list[Branch]) -> tuple[list[Category], list[Product], list[Batch]]:
    categories = _ensure_named_catalog(
        db, Category, Category.name, f"{TAG} CategoriaProducto ", count,
        lambda i, key: Category(name=key, description=f"Categoria inventario sintetica #{i}"),
    )

    sku_prefix = f"{TAG}-SKU-"
    existing_skus = _prefix_values(db, Product.sku, sku_prefix)
    new_products = []
    for i in range(1, count + 1):
        sku = f"{sku_prefix}{i:06d}"
        if sku in existing_skus:
            continue
        cost = float(5 + i % 120)
        price = round(cost * (1.35 + (i % 30) / 100), 2)
        new_products.append(Product(
            sku=sku,
            name=f"{TAG} Producto {i:06d}",
            category_id=categories[(i - 1) % len(categories)].id,
            price=price,
            cost=cost,
            status=(i % 19 != 0),
            image_url=None,
            min_stock=float(5 + i % 25),
        ))
    _commit_chunks(db, new_products)
    products = db.query(Product).filter(Product.sku.like(f"{sku_prefix}%")).order_by(Product.id).limit(count).all()

    # Un lote por producto sintetico.
    existing_product_ids = {
        row[0]
        for row in (
            db.query(Batch.product_id)
            .join(Product, Batch.product_id == Product.id)
            .filter(Product.sku.like(f"{sku_prefix}%"))
            .all()
        )
    }
    now = datetime.utcnow()
    new_batches = []
    for i, product in enumerate(products, 1):
        if product.id in existing_product_ids:
            continue
        qty = float(50 + i % 450)
        new_batches.append(Batch(
            product_id=product.id,
            branch_id=branches[(i - 1) % len(branches)].id,
            initial_quantity=qty,
            current_quantity=qty,
            cost_per_unit=product.cost,
            sale_price_per_unit=product.price,
            entry_date=now - timedelta(days=i % 365),
        ))
    _commit_chunks(db, new_batches)
    batches = (
        db.query(Batch)
        .join(Product, Batch.product_id == Product.id)
        .filter(Product.sku.like(f"{sku_prefix}%"))
        .order_by(Batch.id)
        .limit(count)
        .all()
    )
    return categories, products, batches


def _ensure_questionnaires(db: Session, count: int) -> tuple[list[Questionnaire], list[Question]]:
    prefix = f"{TAG} Cuestionario "
    existing_titles = _prefix_values(db, Questionnaire.title, prefix)
    new_q = []
    for i in range(1, count + 1):
        title = f"{prefix}{i:06d}"
        if title not in existing_titles:
            new_q.append(Questionnaire(
                title=title,
                description=f"Cuestionario sintetico de carga #{i}",
                is_active=(i % 11 != 0),
            ))
    _commit_chunks(db, new_q)
    questionnaires = db.query(Questionnaire).filter(Questionnaire.title.like(f"{prefix}%")).order_by(Questionnaire.id).limit(count).all()

    existing_questionnaire_ids = {
        row[0]
        for row in (
            db.query(Question.questionnaire_id)
            .join(Questionnaire, Question.questionnaire_id == Questionnaire.id)
            .filter(Questionnaire.title.like(f"{prefix}%"))
            .all()
        )
    }
    types = ["text", "number", "bool", "select", "multi_select"]
    new_questions = []
    for i, q in enumerate(questionnaires, 1):
        if q.id not in existing_questionnaire_ids:
            new_questions.append(Question(
                questionnaire_id=q.id,
                text=f"[{TAG}] Pregunta de prueba #{i}",
                question_type=types[(i - 1) % len(types)],
                is_required=(i % 3 == 0),
                sort_order=0,
            ))
    _commit_chunks(db, new_questions)
    questions = (
        db.query(Question)
        .join(Questionnaire, Question.questionnaire_id == Questionnaire.id)
        .filter(Questionnaire.title.like(f"{prefix}%"))
        .order_by(Question.id)
        .limit(count)
        .all()
    )
    return questionnaires, questions


def _ensure_final_designs(
    db: Session,
    count: int,
    effects: list[Effect],
    eyes: list[EyeType],
    volumes: list[Volume],
) -> tuple[list[Tecnologia], list[DisenoFinal]]:
    tecnologias = _ensure_named_catalog(
        db, Tecnologia, Tecnologia.name, f"{TAG} Tecnologia ", count,
        lambda i, key: Tecnologia(name=key, description=f"Tecnologia sintetica #{i}", image=None),
    )
    prefix = f"{TAG} DisenoFinal "
    existing = _prefix_values(db, DisenoFinal.nombre_unico, prefix)
    new_items = []
    now = datetime.utcnow()
    for i in range(1, count + 1):
        name = f"{prefix}{i:06d}"
        if name in existing:
            continue
        new_items.append(DisenoFinal(
            nombre_unico=name,
            tecnologia_id=tecnologias[(i - 1) % len(tecnologias)].id,
            efecto_id=effects[(i - 1) % len(effects)].id,
            tipo_ojo_id=eyes[(i - 1) % len(eyes)].id,
            volumen_id=volumes[(i - 1) % len(volumes)].id,
            created_at=now - timedelta(days=i % 730),
        ))
    _commit_chunks(db, new_items)
    finals = db.query(DisenoFinal).filter(DisenoFinal.nombre_unico.like(f"{prefix}%")).order_by(DisenoFinal.id).limit(count).all()
    return tecnologias, finals


def _ensure_clients(db: Session, count: int, branches: list[Branch], eyes: list[EyeType]) -> list[Client]:
    prefix = f"{TAG}-CI-"
    existing = _prefix_values(db, Client.ci, prefix)
    new_items = []
    now = datetime.now(timezone.utc)
    for i in range(1, count + 1):
        ci = f"{prefix}{i:06d}"
        if ci in existing:
            continue
        first = FIRST_NAMES[(i - 1) % len(FIRST_NAMES)]
        last = LAST_NAMES[((i - 1) // len(FIRST_NAMES)) % len(LAST_NAMES)]
        new_items.append(Client(
            name=first,
            last_name=f"{last} L5K{i:06d}",
            age=18 + i % 55,
            phone=f"79{i:08d}"[-10:],
            email=f"load5k.client.{i:06d}@gmail.com",
            branch_id=branches[(i - 1) % len(branches)].id,
            eye_type_id=eyes[(i - 1) % len(eyes)].id,
            status=CLIENT_STATUS_EN_ESPERA,
            # < 1 dia para que el schema no lo convierta automaticamente en sin_estado.
            last_activity_at=now - timedelta(minutes=i % 720),
            ci=ci,
            marketplace_enabled=(i % 7 != 0),
        ))
    _commit_chunks(db, new_items)
    return db.query(Client).filter(Client.ci.like(f"{prefix}%")).order_by(Client.id).limit(count).all()


def _ensure_appointments(
    db: Session,
    count: int,
    rng: random.Random,
    clients: list[Client],
    services: list[Service],
    users: list[User],
    roles: dict[str, Role],
) -> list[Appointment]:
    prefix = f"{TAG}-TKT-"
    existing = _prefix_values(db, Appointment.ticket_code, prefix)
    operarias = [u for u in users if u.role_id == roles["Operaria"].id and u.is_active]
    if not operarias:
        operarias = users
    now = datetime.utcnow().replace(second=0, microsecond=0)
    new_items = []
    for i in range(1, count + 1):
        code = f"{prefix}{i:06d}"
        if code in existing:
            continue
        client = clients[(i - 1) % len(clients)]
        service = services[(i - 1) % len(services)]
        professional = operarias[(i - 1) % len(operarias)]
        creator = users[(i * 7) % len(users)]
        status = rng.choices(APPOINTMENT_STATUSES, weights=APPOINTMENT_WEIGHTS, k=1)[0]
        if status in {"completed", "cancelled"}:
            start = now - timedelta(days=rng.randint(1, 730), hours=rng.randint(0, 10))
        elif status in {"pending", "confirmed"}:
            start = now + timedelta(days=rng.randint(0, 90), hours=rng.randint(0, 10))
        else:  # in_service
            start = now - timedelta(minutes=rng.randint(0, 60))
        start = start.replace(hour=8 + i % 10, minute=(i % 4) * 15)
        end = start + timedelta(minutes=max(service.duration_minutes or 30, 15))
        advance = round(float(service.effective_price) * 0.25, 2) if i % 4 == 0 else 0.0
        new_items.append(Appointment(
            ticket_code=code,
            client_id=client.id,
            created_by_id=creator.id,
            professional_id=professional.id,
            service_id=service.id,
            branch_id=client.branch_id,
            sale_id=None,
            is_ia=(i % 9 == 0),
            start_time=start,
            end_time=end,
            status=status,
            advance_payment_amount=advance,
        ))
    _commit_chunks(db, new_items)
    appointments = db.query(Appointment).filter(Appointment.ticket_code.like(f"{prefix}%")).order_by(Appointment.id).limit(count).all()

    # Ajustar status del cliente segun su cita LOAD5K.
    for appointment, client in zip(appointments, clients):
        if appointment.status == "completed":
            client.status = CLIENT_STATUS_FINALIZADO
        elif appointment.status in {"pending", "confirmed"}:
            client.status = CLIENT_STATUS_RESERVA
        elif appointment.status == "in_service":
            client.status = CLIENT_STATUS_EN_SERVICIO
        else:
            client.status = CLIENT_STATUS_EN_ESPERA
    db.commit()

    # Exactamente una fila appointment_services por cita LOAD5K.
    existing_appt_ids = {
        row[0]
        for row in (
            db.query(AppointmentService.appointment_id)
            .join(Appointment, AppointmentService.appointment_id == Appointment.id)
            .filter(Appointment.ticket_code.like(f"{prefix}%"))
            .all()
        )
    }
    links = []
    for appointment in appointments:
        if appointment.id not in existing_appt_ids:
            links.append(AppointmentService(
                appointment_id=appointment.id,
                service_id=appointment.service_id,
                sort_order=0,
            ))
    _commit_chunks(db, links)
    return appointments


def _ensure_sales_and_products(
    db: Session,
    count: int,
    rng: random.Random,
    clients: list[Client],
    appointments: list[Appointment],
    products: list[Product],
    users: list[User],
) -> list[PosSale]:
    prefix = f"{TAG}-SALE-"
    existing = _prefix_values(db, PosSale.sale_code, prefix)
    new_items = []
    now = datetime.utcnow()
    for i in range(1, count + 1):
        code = f"{prefix}{i:06d}"
        if code in existing:
            continue
        client = clients[(i - 1) % len(clients)]
        appointment = appointments[(i - 1) % len(appointments)]
        product = products[(i - 1) % len(products)]
        product_qty = float(1 + i % 3)
        product_total = round(product.price * product_qty, 2)
        service_total = 0.0
        if appointment.status == "completed" and appointment.service is not None:
            service_total = float(appointment.service.effective_price)
        subtotal = round(service_total + product_total, 2)
        discount_type = "percent" if i % 9 == 0 else "amount"
        discount_value = 10.0 if discount_type == "percent" else (5.0 if i % 13 == 0 else 0.0)
        total = round(
            subtotal * (1 - discount_value / 100.0)
            if discount_type == "percent"
            else max(0.0, subtotal - discount_value),
            2,
        )
        if appointment.status == "completed":
            sale_status = "paid"
        else:
            sale_status = rng.choices(["paid", "reserved", "cancelled"], weights=[75, 15, 10], k=1)[0]
        new_items.append(PosSale(
            sale_code=code,
            client_id=client.id,
            branch_id=client.branch_id,
            created_by_id=users[(i * 3) % len(users)].id,
            subtotal=subtotal,
            discount_type=discount_type,
            discount_value=discount_value,
            total=total,
            payment_method=PAYMENT_METHODS[(i - 1) % len(PAYMENT_METHODS)],
            status=sale_status,
            notes=f"[{TAG}] Venta sintetica #{i}",
            created_at=appointment.start_time if appointment.status == "completed" else now - timedelta(days=i % 730),
        ))
    _commit_chunks(db, new_items)
    sales = db.query(PosSale).filter(PosSale.sale_code.like(f"{prefix}%")).order_by(PosSale.id).limit(count).all()

    # Vincular venta a cita SOLO si la cita esta completada.
    for appointment, sale in zip(appointments, sales):
        if appointment.status == "completed":
            appointment.sale_id = sale.id
    db.commit()

    # Una linea de producto por venta.
    existing_sale_ids = {
        row[0]
        for row in (
            db.query(PosSaleProduct.sale_id)
            .join(PosSale, PosSaleProduct.sale_id == PosSale.id)
            .filter(PosSale.sale_code.like(f"{prefix}%"))
            .all()
        )
    }
    lines = []
    for i, sale in enumerate(sales):
        if sale.id in existing_sale_ids:
            continue
        product = products[i % len(products)]
        qty = float(1 + (i % 3))
        lines.append(PosSaleProduct(
            sale_id=sale.id,
            product_id=product.id,
            quantity=qty,
            unit_price=product.price,
            subtotal=round(product.price * qty, 2),
        ))
    _commit_chunks(db, lines)
    return sales


def _ensure_payments(
    db: Session,
    count: int,
    sales: list[PosSale],
    appointments: list[Appointment],
    users: list[User],
) -> list[Payment]:
    prefix = f"{TAG}-PAY-"
    existing = _prefix_values(db, Payment.reference, prefix)
    new_items = []
    for i in range(1, count + 1):
        reference = f"{prefix}{i:06d}"
        if reference in existing:
            continue
        sale = sales[(i - 1) % len(sales)]
        appointment = appointments[(i - 1) % len(appointments)]
        method = sale.payment_method
        if sale.status == "paid":
            payment_status = "paid"
            amount = sale.total
        elif sale.status == "cancelled":
            payment_status = "cancelled"
            amount = sale.total
        else:
            payment_status = "pending"
            amount = round(sale.total * 0.30, 2)
        cash_received = None
        cash_change = None
        if method == "cash" and payment_status == "paid":
            cash_received = float(int(amount / 10 + 1) * 10)
            if cash_received < amount:
                cash_received = amount
            cash_change = round(cash_received - amount, 2)
        linked_appt = appointment if appointment.sale_id == sale.id else None
        new_items.append(Payment(
            client_id=sale.client_id,
            branch_id=sale.branch_id,
            appointment_id=linked_appt.id if linked_appt else None,
            sale_id=sale.id,
            registered_by_id=users[(i * 5) % len(users)].id,
            amount=amount,
            method=method,
            status=payment_status,
            reference=reference,
            notes=f"[{TAG}] Pago sintetico #{i}",
            paid_at=sale.created_at + timedelta(minutes=5),
            cash_received=cash_received,
            cash_change=cash_change,
        ))
    _commit_chunks(db, new_items)
    return db.query(Payment).filter(Payment.reference.like(f"{prefix}%")).order_by(Payment.id).limit(count).all()


def _ensure_trackings(
    db: Session,
    count: int,
    clients: list[Client],
    appointments: list[Appointment],
    users: list[User],
    roles: dict[str, Role],
    eyes: list[EyeType],
    effects: list[Effect],
    volumes: list[Volume],
    lash_designs: list[LashDesign],
    questionnaires: list[Questionnaire],
) -> list[Tracking]:
    prefix = f"[{TAG}] Seguimiento "
    existing_notes = _prefix_values(db, Tracking.design_notes, prefix)
    operarias = [u for u in users if u.role_id == roles["Operaria"].id]
    if not operarias:
        operarias = users
    now = datetime.utcnow()
    new_items = []
    for i in range(1, count + 1):
        note = f"{prefix}{i:06d}"
        if note in existing_notes:
            continue
        client = clients[(i - 1) % len(clients)]
        appointment = appointments[(i - 1) % len(appointments)]
        app_date = appointment.end_time if appointment.status == "completed" else now - timedelta(days=i % 365)
        new_items.append(Tracking(
            client_id=client.id,
            appointment_id=appointment.id if appointment.status == "completed" else None,
            branch_id=client.branch_id,
            professional_id=operarias[(i - 1) % len(operarias)].id,
            eye_type_id=eyes[(i - 1) % len(eyes)].id,
            effect_id=effects[(i - 1) % len(effects)].id,
            volume_id=volumes[(i - 1) % len(volumes)].id,
            lash_design_id=lash_designs[(i - 1) % len(lash_designs)].id,
            questionnaire_id=questionnaires[(i - 1) % len(questionnaires)].id,
            design_notes=note,
            last_application_date=app_date,
            questionnaire_responses={
                "alergias": "no" if i % 10 else "revisar",
                "usa_lentes": "si" if i % 6 == 0 else "no",
                "sensibilidad": ["baja", "media", "alta"][i % 3],
            },
            next_maintenance_date=app_date + timedelta(days=20 + i % 8),
            next_removal_date=app_date + timedelta(days=35 + i % 12),
            maintenance_reminder_sent=(i % 5 == 0),
            removal_reminder_sent=(i % 7 == 0),
        ))
    _commit_chunks(db, new_items)
    return db.query(Tracking).filter(Tracking.design_notes.like(f"{prefix}%")).order_by(Tracking.id).limit(count).all()


def _ensure_saved_designs(db: Session, count: int, clients: list[Client], finals: list[DisenoFinal]) -> list[DisenoGuardado]:
    # Identificar existentes por JOIN a clientes LOAD5K y diseños LOAD5K.
    prefix_client = f"{TAG}-CI-"
    prefix_final = f"{TAG} DisenoFinal "
    existing_pairs = {
        (row[0], row[1])
        for row in (
            db.query(DisenoGuardado.client_id, DisenoGuardado.diseno_final_id)
            .join(Client, DisenoGuardado.client_id == Client.id)
            .join(DisenoFinal, DisenoGuardado.diseno_final_id == DisenoFinal.id)
            .filter(Client.ci.like(f"{prefix_client}%"), DisenoFinal.nombre_unico.like(f"{prefix_final}%"))
            .all()
        )
    }
    now = datetime.utcnow()
    new_items = []
    for i in range(count):
        client = clients[i % len(clients)]
        final = finals[i % len(finals)]
        if (client.id, final.id) not in existing_pairs:
            new_items.append(DisenoGuardado(
                client_id=client.id,
                diseno_final_id=final.id,
                fecha_guardado=now - timedelta(days=i % 365),
            ))
    _commit_chunks(db, new_items)
    return (
        db.query(DisenoGuardado)
        .join(Client, DisenoGuardado.client_id == Client.id)
        .filter(Client.ci.like(f"{prefix_client}%"))
        .order_by(DisenoGuardado.id)
        .limit(count)
        .all()
    )


def _ensure_expenses(db: Session, count: int, rng: random.Random, branches: list[Branch], users: list[User]) -> None:
    prefix = f"[{TAG}] Gasto "
    existing = db.query(Expense).filter(Expense.description.like(f"{prefix}%")).count()
    now_aware = datetime.now(timezone.utc)
    items = []
    for i in range(existing + 1, count + 1):
        items.append(Expense(
            branch_id=branches[(i - 1) % len(branches)].id,
            amount=round(10 + rng.random() * 490, 2),
            description=f"{prefix}{i:06d} - insumos/operacion",
            expense_date=date.today() - timedelta(days=i % 730),
            photo_url=None,
            created_at=now_aware - timedelta(days=i % 730),
            created_by_id=users[(i * 11) % len(users)].id,
        ))
    _commit_chunks(db, items)


def _ensure_inventory_movements(db: Session, count: int, products: list[Product], batches: list[Batch]) -> None:
    prefix = f"[{TAG}] Movimiento "
    existing = db.query(InventoryMovement).filter(InventoryMovement.note.like(f"{prefix}%")).count()
    now = datetime.utcnow()
    items = []
    movement_types = ["IN", "OUT", "ADJUSTMENT", "SERVICE_USE"]
    for i in range(existing + 1, count + 1):
        product = products[(i - 1) % len(products)]
        batch = batches[(i - 1) % len(batches)]
        movement_type = movement_types[(i - 1) % len(movement_types)]
        qty = float(1 + i % 8)
        items.append(InventoryMovement(
            product_id=product.id,
            batch_id=batch.id,
            branch_id=batch.branch_id,
            movement_type=movement_type,
            quantity=qty,
            note=f"{prefix}{i:06d}",
            created_at=now - timedelta(hours=i % (24 * 365)),
        ))
        # Mantener stock final plausible para ese unico movimiento principal.
        if movement_type == "IN":
            batch.current_quantity = batch.initial_quantity + qty
        elif movement_type in {"OUT", "SERVICE_USE"}:
            batch.current_quantity = max(0.0, batch.initial_quantity - qty)
        else:
            batch.current_quantity = max(0.0, batch.initial_quantity + ((-1) ** i) * qty)
    _commit_chunks(db, items)
    db.commit()


def _ensure_cash_closes(db: Session, count: int, rng: random.Random, branches: list[Branch], users: list[User]) -> None:
    prefix = f"[{TAG}] Caja "
    existing = db.query(CashClose).filter(CashClose.notes.like(f"{prefix}%")).count()
    now = datetime.utcnow()
    items = []
    # Solo las ultimas N sesiones (una por sucursal) quedan abiertas.
    open_start = max(1, count - len(branches) + 1)
    for i in range(existing + 1, count + 1):
        branch = branches[(i - 1) % len(branches)]
        is_open = i >= open_start
        opened_at = now - timedelta(days=(count - i) // max(1, len(branches)), hours=i % 8)
        opening = round(100 + rng.random() * 400, 2)
        cash_sales = round(rng.random() * 2000, 2)
        cash_expenses = round(rng.random() * 250, 2)
        expected = round(opening + cash_sales - cash_expenses, 2)
        diff = round(rng.uniform(-10, 10), 2)
        counted = round(expected + diff, 2)
        items.append(CashClose(
            date=opened_at.date().isoformat(),
            branch_id=branch.id,
            status="open" if is_open else "closed",
            opened_by_id=users[(i * 2) % len(users)].id,
            opened_at=opened_at,
            opening_amount=opening,
            closed_by_id=None if is_open else users[(i * 2 + 1) % len(users)].id,
            closed_at=None if is_open else opened_at + timedelta(hours=10),
            grand_total=round(cash_sales + rng.random() * 1500, 2),
            grand_commission=round(rng.random() * 500, 2),
            total_paid=round(cash_sales + rng.random() * 1000, 2),
            total_unpaid=round(rng.random() * 300, 2),
            cash_sales=cash_sales,
            cash_expenses=cash_expenses,
            expected_cash=expected,
            counted_amount=None if is_open else counted,
            difference=None if is_open else diff,
            next_fund_amount=None if is_open else round(min(counted, 300.0), 2),
            notes=f"{prefix}{i:06d}",
        ))
    _commit_chunks(db, items)


def _ensure_commissions(
    db: Session,
    count: int,
    rng: random.Random,
    branches: list[Branch],
    users: list[User],
    roles: dict[str, Role],
) -> None:
    operarias = [u for u in users if u.role_id == roles["Operaria"].id]
    if not operarias:
        operarias = users
    registrars = users
    now_aware = datetime.now(timezone.utc)
    now = datetime.utcnow()

    prefix_payment = f"[{TAG}] ComisionPago "
    existing_payments = db.query(CommissionPayment).filter(CommissionPayment.notes.like(f"{prefix_payment}%")).count()
    payments = []
    for i in range(existing_payments + 1, count + 1):
        professional = operarias[(i - 1) % len(operarias)]
        period_end = date.today() - timedelta(days=i % 365)
        period_start = period_end - timedelta(days=14)
        payments.append(CommissionPayment(
            professional_id=professional.id,
            amount=round(50 + rng.random() * 950, 2),
            period_start=period_start.isoformat(),
            period_end=period_end.isoformat(),
            notes=f"{prefix_payment}{i:06d}",
            registered_at=now_aware - timedelta(days=i % 365),
            registered_by_id=registrars[(i * 3) % len(registrars)].id,
        ))
    _commit_chunks(db, payments)

    prefix_receipt = f"[{TAG}] "
    existing_receipts = db.query(CommissionReceipt).filter(CommissionReceipt.professional_name.like(f"{prefix_receipt}%")).count()
    receipts = []
    for i in range(existing_receipts + 1, count + 1):
        professional = operarias[(i - 1) % len(operarias)]
        receipts.append(CommissionReceipt(
            date=(date.today() - timedelta(days=i % 365)).isoformat(),
            branch_id=professional.branch_id,
            professional_id=professional.id,
            professional_name=f"{prefix_receipt}{professional.username}",
            amount=round(50 + rng.random() * 950, 2),
            confirmed_by_id=registrars[(i * 5) % len(registrars)].id,
            confirmed_at=now - timedelta(days=i % 365),
        ))
    _commit_chunks(db, receipts)


def _ensure_audit_logs(db: Session, count: int, branches: list[Branch], users: list[User]) -> None:
    prefix = f"[{TAG}] Auditoria "
    existing = db.query(AuditLog).filter(AuditLog.description.like(f"{prefix}%")).count()
    actions = ["create", "update", "delete", "cancel"]
    entities = ["client", "appointment", "pos_sale", "payment", "product", "service"]
    now = datetime.now(timezone.utc)
    items = []
    for i in range(existing + 1, count + 1):
        items.append(AuditLog(
            user_id=users[(i - 1) % len(users)].id,
            branch_id=branches[(i - 1) % len(branches)].id,
            action=actions[(i - 1) % len(actions)],
            entity_type=entities[(i - 1) % len(entities)],
            entity_id=1 + i % count,
            description=f"{prefix}{i:06d}",
            created_at=now - timedelta(minutes=i),
        ))
    _commit_chunks(db, items)


def _ensure_marketplace(db: Session, count: int) -> None:
    prefix = f"{TAG} Marketplace "
    existing = _prefix_values(db, MarketplaceProduct.name, prefix)
    now = datetime.utcnow()
    items = []
    categories = ["Pestañas", "Cuidado", "Herramientas", "Accesorios", "Cosmetica"]
    for i in range(1, count + 1):
        name = f"{prefix}{i:06d}"
        if name in existing:
            continue
        price = float(20 + i % 500)
        items.append(MarketplaceProduct(
            name=name,
            brand=f"Marca {1 + i % 50}",
            description=f"Producto marketplace sintetico #{i}",
            price=price,
            original_price=round(price * 1.15, 2) if i % 4 == 0 else None,
            image_url=None,
            category=categories[(i - 1) % len(categories)],
            rating=round(1 + (i % 41) / 10, 1),
            review_count=i % 500,
            is_active=(i % 17 != 0),
            created_at=now - timedelta(days=i % 730),
            updated_at=now - timedelta(days=i % 30),
        ))
    _commit_chunks(db, items)


def _table_counts(db: Session) -> list[tuple[str, int]]:
    counts = []
    for table_name in sorted(Base.metadata.tables.keys()):
        table = Base.metadata.tables[table_name]
        try:
            total = db.execute(select(table.count()) if False else select(table)).fetchmany(0)
        except Exception:
            pass
        try:
            from sqlalchemy import func
            total = db.execute(select(func.count()).select_from(table)).scalar_one()
        except Exception:
            total = -1
        counts.append((table_name, int(total)))
    return counts


def seed_full(db: Session, count: int, branch_count: int, seed: int) -> None:
    rng = random.Random(seed)
    print(f">>> Base de datos: {settings.database_url}")
    print(f">>> Generando carga: {count} registros por tabla escalable")
    print(f">>> Sucursales a usar: {max(2, branch_count)}")

    _ensure_singletons(db)
    permissions, roles = _ensure_base_authorization(db)
    profiles, branches = _ensure_profiles_and_branches(db, branch_count)
    print("   [1/16] configuracion, permisos, roles, perfiles y sucursales OK")

    users = _ensure_users(db, count, rng, roles, branches, permissions)
    print(f"   [2/16] users + user_permissions: {len(users)} usuarios LOAD5K")

    eyes, effects, volumes, lash_designs, designs = _ensure_tracking_catalogs(db, count)
    print("   [3/16] eye_types/effects/volumes/lash_designs/designs OK")

    service_categories, services = _ensure_service_catalog(db, count, branches, rng)
    print("   [4/16] service_categories/services/branch_services OK")

    inventory_categories, products, batches = _ensure_inventory(db, count, branches)
    print("   [5/16] categories/products/batches OK")

    questionnaires, questions = _ensure_questionnaires(db, count)
    print("   [6/16] questionnaires/questions OK")

    tecnologias, final_designs = _ensure_final_designs(db, count, effects, eyes, volumes)
    print("   [7/16] tecnologias/disenos_finales OK")

    clients = _ensure_clients(db, count, branches, eyes)
    print(f"   [8/16] clients: {len(clients)}")

    appointments = _ensure_appointments(db, count, rng, clients, services, users, roles)
    print(f"   [9/16] appointments + appointment_services: {len(appointments)}")

    sales = _ensure_sales_and_products(db, count, rng, clients, appointments, products, users)
    print(f"   [10/16] pos_sales + pos_sale_products: {len(sales)}")

    payments = _ensure_payments(db, count, sales, appointments, users)
    print(f"   [11/16] payments: {len(payments)}")

    trackings = _ensure_trackings(
        db, count, clients, appointments, users, roles,
        eyes, effects, volumes, lash_designs, questionnaires,
    )
    _ensure_saved_designs(db, count, clients, final_designs)
    print(f"   [12/16] client_tracking + disenos_guardados: {len(trackings)}")

    _ensure_expenses(db, count, rng, branches, users)
    _ensure_inventory_movements(db, count, products, batches)
    print("   [13/16] expenses + inventory_movements OK")

    _ensure_cash_closes(db, count, rng, branches, users)
    _ensure_commissions(db, count, rng, branches, users, roles)
    print("   [14/16] cash_closes + commission_payments + commission_receipts OK")

    _ensure_audit_logs(db, count, branches, users)
    print("   [15/16] audit_logs OK")

    _ensure_marketplace(db, count)
    print("   [16/16] marketplace_products OK")

    print("\n>>> RESUMEN FINAL: filas totales por tabla <<<")
    for table_name, total in _table_counts(db):
        print(f"   {table_name:<28} {total:>8}")

    print("\nNotas:")
    print("- app_settings y admin_ai_settings son singleton por diseño (1 fila).")
    print("- roles/permissions/role_permissions son configuracion de seguridad; no se inflan a 5000.")
    print("- Las demas tablas escalables reciben hasta COUNT filas sinteticas LOAD5K.")
    print("- Con --branches 2, los datos se reparten entre Sucursal Principal y Sucursal Norte.")
    print("- Usuario sintetico: load5k_user_000001, contraseña: LoadTest123!")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seeder integral de carga para eLashes")
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT)
    parser.add_argument("--branches", type=int, default=DEFAULT_BRANCHES)
    parser.add_argument("--seed", type=int, default=20260915)
    parser.add_argument("--confirm", action="store_true")
    args = parser.parse_args()

    if not args.confirm:
        print(
            "Cancelado: agrega --confirm. Ejemplo:\n"
            "python -m app.infrastructure.database.seed_full_load_test_5000 "
            "--count 5000 --branches 2 --confirm",
            file=sys.stderr,
        )
        raise SystemExit(2)
    if args.count < 1:
        raise SystemExit("--count debe ser > 0")
    if args.branches < 1:
        raise SystemExit("--branches debe ser > 0")
    if _is_production():
        print("BLOQUEADO: este seeder no puede ejecutarse con ENVIRONMENT=production/prod.", file=sys.stderr)
        raise SystemExit(3)

    # Gracias a los imports de modelos de arriba, init_db registra tambien
    # tablas que init_db.py no importa directamente (audit_logs, expenses,
    # marketplace_products, etc.).
    init_db()
    db = SessionLocal()
    try:
        seed_full(db, args.count, args.branches, args.seed)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
