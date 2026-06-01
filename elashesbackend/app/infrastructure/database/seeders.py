from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.infrastructure.security import get_password_hash
from app.domain.entities.branch import Branch
from app.domain.entities.user import User, Role, Permission
from app.domain.entities.client import (
    Client,
    CLIENT_STATUS_EN_ESPERA,
    CLIENT_STATUS_EN_SERVICIO,
    CLIENT_STATUS_FINALIZADO,
)
from app.domain.entities.tracking import (
    EyeType,
    Effect,
    Volume,
    LashDesign,
    Questionnaire,
    Question,
    Tracking,
)
from app.domain.entities.service_agenda import ServiceCategory, Service, Appointment, BranchService
from app.domain.entities.payment import Payment
from app.domain.entities.inventory import Category, Product, Batch, InventoryMovement
from app.application.services.service_agenda_service import create_appointment


# =========================================================
# Helpers
# =========================================================
def get_or_create(db: Session, model, defaults=None, **filters):
    instance = db.query(model).filter_by(**filters).first()
    if instance:
        return instance, False
    params = {**filters}
    if defaults:
        params.update(defaults)
    instance = model(**params)
    db.add(instance)
    db.flush()
    return instance, True


def safe_commit(db: Session):
    db.commit()


# =========================================================
# Permisos y roles (sin cambios)
# =========================================================
def seed_permissions(db: Session):
    permissions_list = [
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
    ]
    created = []
    for name in permissions_list:
        permission, _ = get_or_create(db, Permission, name=name)
        created.append(permission)
    safe_commit(db)
    return created


def seed_roles(db: Session):
    all_permissions = db.query(Permission).all()
    permission_map = {p.name: p for p in all_permissions}

    role_permissions = {
        "SuperAdmin": list(permission_map.values()),
        "Admin": [
            permission_map["clients:view"],
            permission_map["clients:manage"],
            permission_map["catalog:view"],
            permission_map["catalog:manage"],
            permission_map["tracking:view"],
            permission_map["tracking:manage"],
            permission_map["forms:view"],
            permission_map["forms:manage"],
            permission_map["payments:view"],
            permission_map["payments:manage"],
            permission_map["services:view"],
            permission_map["services:manage"],
            permission_map["appointments:view"],
            permission_map["appointments:manage"],
            permission_map["branches:view"],
            permission_map["inventory:view"],
            permission_map["inventory:manage"],
            permission_map["settings:view"],
            permission_map["users:manage"],
            permission_map["ai:view"],
            permission_map["ai:manage"],
        ],
        "Operaria": [
            permission_map["clients:view"],
            permission_map["clients:manage"],
            permission_map["catalog:view"],
            permission_map["tracking:view"],
            permission_map["tracking:manage"],
            permission_map["forms:view"],
            permission_map["services:view"],
            permission_map["services:manage"],
            permission_map["appointments:view"],
            permission_map["appointments:manage"],
            permission_map["payments:view"],
            permission_map["branches:view"],
        ],
        # Secretaria incluye inventory:view (acceso de solo lectura al inventario)
        "Secretaria": [
            permission_map["clients:view"],
            permission_map["clients:manage"],
            permission_map["catalog:view"],
            permission_map["tracking:view"],
            permission_map["tracking:manage"],
            permission_map["forms:view"],
            permission_map["payments:view"],
            permission_map["payments:manage"],
            permission_map["services:view"],
            permission_map["services:manage"],
            permission_map["appointments:view"],
            permission_map["appointments:manage"],
            permission_map["branches:view"],
            permission_map["inventory:view"],
        ],
        "EncargadaAlmacen": [
            permission_map["inventory:view"],
            permission_map["inventory:manage"],
            permission_map["catalog:view"],
            permission_map["branches:view"],
        ],
    }

    roles = {}
    for role_name, permissions in role_permissions.items():
        role, _ = get_or_create(db, Role, name=role_name)
        role.permissions = permissions
        roles[role_name] = role

    safe_commit(db)
    return roles


# =========================================================
# Sucursales — 2 sucursales activas para pruebas
# =========================================================
def seed_branches(db: Session):
    branches_data = [
        {
            "name": "Sucursal Principal",
            "address": "Av. Principal #100",
            "city": "Santa Cruz de la Sierra",
            "department": "Santa Cruz",
        },
        {
            "name": "Sucursal Norte",
            "address": "Av. America #250",
            "city": "Cochabamba",
            "department": "Cochabamba",
        },
    ]
    branches = {}
    for item in branches_data:
        branch, _ = get_or_create(db, Branch, name=item["name"], defaults={
            "address": item["address"],
            "city": item["city"],
            "department": item["department"],
        })
        branch.address = item["address"]
        branch.city = item["city"]
        branch.department = item["department"]
        branches[item["name"]] = branch
    safe_commit(db)
    return branches


# =========================================================
# Usuarios — admin, secretaria en Principal, 2 operarias
# en Principal (senior/junior), 1 operaria en Norte (senior),
# almacen en Principal
# =========================================================
def seed_users(db: Session, roles: dict, branches: dict):
    users_data = [
        {
            "username": "admin",
            "email": "admin@elashes.com",
            "phone": "+59170000001",
            "password": "admin123",
            "role": "SuperAdmin",
            "branch": "Sucursal Principal",
            "skill_level": None,
            "is_active": True,
        },
        {
            "username": "secretaria1",
            "email": "secretaria1@elashes.com",
            "phone": "+59170000002",
            "password": "secretaria123",
            "role": "Secretaria",
            "branch": "Sucursal Principal",
            "skill_level": None,
            "is_active": True,
        },
        {
            "username": "almacen1",
            "email": "almacen1@elashes.com",
            "phone": "+59170000007",
            "password": "almacen123",
            "role": "EncargadaAlmacen",
            "branch": "Sucursal Principal",
            "skill_level": None,
            "is_active": True,
        },
    ]

    users = {}
    for item in users_data:
        user = db.query(User).filter(User.username == item["username"]).first()
        if not user:
            user = User(
                username=item["username"],
                email=item["email"],
                phone=item["phone"],
                hashed_password=get_password_hash(item["password"]),
                is_active=item["is_active"],
                role_id=roles[item["role"]].id,
                branch_id=branches[item["branch"]].id,
                skill_level=item["skill_level"],
            )
            db.add(user)
            db.flush()
        else:
            user.email = item["email"]
            # No actualizar phone en usuarios existentes para evitar conflictos UNIQUE al re-seedear
            user.is_active = item["is_active"]
            user.role_id = roles[item["role"]].id
            user.branch_id = branches[item["branch"]].id
            user.skill_level = item["skill_level"]
        users[item["username"]] = user

    safe_commit(db)
    return users


# =========================================================
# Catálogos de seguimiento (tipos de ojo, efectos, etc.)
# =========================================================
def seed_catalogs(db: Session):
    eye_types_data = [
        ("Almendrado", "Forma equilibrada y versátil"),
        ("Encapotado", "Párpado superior con ligera caída"),
        ("Redondo", "Apertura ocular más amplia"),
        ("Rasgado", "Forma alargada"),
        ("Asimétricos", "Un ojo difiere ligeramente del otro"),
    ]
    effects_data = ["Natural", "Foxy Eye", "Doll Eye", "Wet Look", "Kim K"]
    volumes_data = [
        ("Clásico (1D)", "Efecto sutil y natural"),
        ("2D", "Más densidad sin exagerar"),
        ("3D", "Volumen elegante"),
        ("5D", "Volumen alto y glam"),
    ]
    lash_designs_data = ["Natural", "Cat Eye", "Doll", "Wispy", "Squirrel"]

    eye_types = {}
    for name, description in eye_types_data:
        item, _ = get_or_create(db, EyeType, name=name, defaults={"description": description, "image": None})
        item.description = description
        eye_types[name] = item

    effects = {}
    for name in effects_data:
        item, _ = get_or_create(db, Effect, name=name, defaults={"image": None})
        effects[name] = item

    volumes = {}
    for name, description in volumes_data:
        item, _ = get_or_create(db, Volume, name=name, defaults={"description": description, "image": None})
        item.description = description
        volumes[name] = item

    lash_designs = {}
    for name in lash_designs_data:
        item, _ = get_or_create(db, LashDesign, name=name, defaults={"image": None})
        lash_designs[name] = item

    safe_commit(db)
    return eye_types, effects, volumes, lash_designs


# =========================================================
# Cuestionario de salud (sin cambios)
# =========================================================
def seed_questionnaires(db: Session):
    questionnaire = (
        db.query(Questionnaire)
        .filter(Questionnaire.title == "Ficha inicial de extensiones")
        .first()
    )

    questions_data = [
        {"text": "¿Es su primera vez con extensiones de pestañas?", "question_type": "bool", "is_required": True, "sort_order": 1},
        {"text": "¿Tiene alergia al látex, adhesivos o cianocrilato?", "question_type": "bool", "is_required": True, "sort_order": 2},
        {"text": "¿Usa lentes de contacto habitualmente?", "question_type": "bool", "is_required": False, "sort_order": 3},
        {"text": "¿Ha tenido cirugía ocular reciente (últimos 6 meses)?", "question_type": "bool", "is_required": True, "sort_order": 4},
        {"text": "¿Sufre de ojo seco, conjuntivitis o orzuelos?", "question_type": "bool", "is_required": True, "sort_order": 5},
        {"text": "¿Está embarazada o en periodo de lactancia?", "question_type": "bool", "is_required": False, "sort_order": 6},
        {"text": "¿Duerme boca abajo frecuentemente?", "question_type": "bool", "is_required": False, "sort_order": 7},
        {"text": "¿Se maquilla los ojos diariamente?", "question_type": "bool", "is_required": False, "sort_order": 8},
        {"text": "¿Tiene piel grasa o muy oleosa en los párpados?", "question_type": "bool", "is_required": False, "sort_order": 9},
        {"text": "¿Toma medicamentos para la tiroides o cambios hormonales?", "question_type": "text", "is_required": False, "sort_order": 10},
        {"text": "¿Suele frotarse los ojos con frecuencia?", "question_type": "bool", "is_required": True, "sort_order": 11},
        {"text": "¿Se ha realizado lifting de pestañas recientemente?", "question_type": "bool", "is_required": True, "sort_order": 12},
        {"text": "¿Tiene sensibilidad a la luz (fotofobia)?", "question_type": "bool", "is_required": False, "sort_order": 13},
        {"text": "¿Padece de claustrofobia o ansiedad al estar acostada?", "question_type": "bool", "is_required": True, "sort_order": 14},
        {"text": "¿Usa productos desmaquillantes con aceite?", "question_type": "bool", "is_required": False, "sort_order": 15},
        {"text": "¿Tiene microblading o tatuaje de delineado reciente?", "question_type": "bool", "is_required": False, "sort_order": 16},
        {"text": "¿Sufre de alopecia o tricotilomanía?", "question_type": "bool", "is_required": True, "sort_order": 17},
        {"text": "¿Está en tratamiento de quimioterapia actualmente?", "question_type": "bool", "is_required": True, "sort_order": 18},
        {"text": "¿Qué estilo de diseño prefiere (Natural, Volumen, etc.)?", "question_type": "text", "is_required": False, "sort_order": 19},
        {"text": "¿Cómo nos conoció?", "question_type": "text", "is_required": False, "sort_order": 20},
        {"text": "¿Viene acompañada de un tutor legal?", "question_type": "bool", "is_required": True, "sort_order": 21},
        {"text": "¿Es su primera vez usando maquillaje o extensiones?", "question_type": "bool", "is_required": True, "sort_order": 22},
        {"text": "¿Tiene permiso para usar extensiones en la escuela?", "question_type": "bool", "is_required": False, "sort_order": 23},
        {"text": "¿Presenta alergias estacionales o a cosméticos?", "question_type": "bool", "is_required": True, "sort_order": 24},
        {"text": "¿Usa lentes de contacto?", "question_type": "bool", "is_required": False, "sort_order": 25},
        {"text": "¿Se frota los ojos constantemente?", "question_type": "bool", "is_required": True, "sort_order": 26},
        {"text": "¿Tiene alguna infección ocular activa?", "question_type": "bool", "is_required": True, "sort_order": 27},
        {"text": "¿Practica natación o deportes acuáticos frecuentes?", "question_type": "bool", "is_required": False, "sort_order": 28},
        {"text": "¿Entiende los cuidados posteriores requeridos?", "question_type": "bool", "is_required": True, "sort_order": 29},
        {"text": "Nombre y teléfono del padre/tutor responsable", "question_type": "text", "is_required": True, "sort_order": 30},
    ]

    if not questionnaire:
        questionnaire = Questionnaire(
            title="Ficha inicial de extensiones",
            description="Formulario base para nuevas clientas",
            is_active=True,
        )
        db.add(questionnaire)
        db.flush()

    existing_by_text = {
        q.text.strip(): q
        for q in db.query(Question).filter(Question.questionnaire_id == questionnaire.id).all()
    }
    for q in questions_data:
        if q["text"].strip() in existing_by_text:
            continue
        db.add(Question(
            questionnaire_id=questionnaire.id,
            text=q["text"],
            question_type=q["question_type"],
            is_required=q["is_required"],
            sort_order=q["sort_order"],
        ))

    safe_commit(db)
    return questionnaire


# =========================================================
# Clientes — variedad de sucursales y estados
# =========================================================
def seed_clients(db: Session, eye_types: dict, branches: dict):
    now = datetime.now(timezone.utc)
    clients_data = [
        # Principal — cliente recurrente, varios servicios
        {
            "name": "Ana",
            "last_name": "Pérez",
            "age": 25,
            "phone": "70000001",
            "eye_type": "Almendrado",
            "branch": "Sucursal Principal",
            "status": CLIENT_STATUS_EN_ESPERA,
        },
        # Principal — clienta activa
        {
            "name": "María",
            "last_name": "Gómez",
            "age": 29,
            "phone": "70000002",
            "eye_type": "Encapotado",
            "branch": "Sucursal Principal",
            "status": CLIENT_STATUS_EN_SERVICIO,
        },
        # Norte — prueba filtro por sucursal en cierre de caja
        {
            "name": "Lucía",
            "last_name": "Rojas",
            "age": 22,
            "phone": "70000003",
            "eye_type": "Redondo",
            "branch": "Sucursal Norte",
            "status": CLIENT_STATUS_FINALIZADO,
        },
        # Principal — clienta para probar movilidad de operaria
        {
            "name": "Valentina",
            "last_name": "Cruz",
            "age": 31,
            "phone": "70000004",
            "eye_type": "Rasgado",
            "branch": "Sucursal Principal",
            "status": CLIENT_STATUS_EN_ESPERA,
        },
        # Principal — clienta para turno pendiente
        {
            "name": "Isabella",
            "last_name": "Méndez",
            "age": 27,
            "phone": "70000005",
            "eye_type": "Almendrado",
            "branch": "Sucursal Principal",
            "status": CLIENT_STATUS_EN_ESPERA,
        },
    ]

    clients = {}
    for item in clients_data:
        client = (
            db.query(Client)
            .filter(Client.name == item["name"], Client.last_name == item["last_name"], Client.phone == item["phone"])
            .first()
        )
        if not client:
            client = Client(
                name=item["name"],
                last_name=item["last_name"],
                age=item["age"],
                phone=item["phone"],
                branch_id=branches[item["branch"]].id,
                eye_type_id=eye_types[item["eye_type"]].id,
                status=item["status"],
                last_activity_at=now,
            )
            db.add(client)
            db.flush()
        else:
            client.age = item["age"]
            client.branch_id = branches[item["branch"]].id
            client.eye_type_id = eye_types[item["eye_type"]].id
            client.status = item["status"]
            client.last_activity_at = now
        clients[f"{item['name']} {item['last_name']}"] = client

    safe_commit(db)
    return clients


# =========================================================
# Servicios — 4 servicios disponibles en ambas sucursales
# =========================================================
def seed_services(db: Session, branches: dict):
    categories_data = [
        {"name": "Extensiones", "description": "Aplicaciones de extensiones de pestañas"},
        {"name": "Mantenimiento", "description": "Retoques y mantenimiento"},
        {"name": "Lifting", "description": "Lifting y permanente de pestañas"},
    ]
    categories = {}
    for item in categories_data:
        cat = db.query(ServiceCategory).filter(ServiceCategory.name == item["name"]).first()
        if not cat:
            cat = ServiceCategory(name=item["name"], description=item["description"])
            db.add(cat)
            db.flush()
        else:
            cat.description = item["description"]
        categories[item["name"]] = cat

    services_data = [
        {
            "name": "Extensiones Clásicas",
            "description": "Aplicación 1D natural",
            "category": "Extensiones",
            "duration_minutes": 90,
            "price": 120,
        },
        {
            "name": "Extensiones Volumen 3D",
            "description": "Aplicación con mayor densidad",
            "category": "Extensiones",
            "duration_minutes": 120,
            "price": 180,
        },
        {
            "name": "Retoque de Extensiones",
            "description": "Mantenimiento parcial — rellenado de extensiones caídas",
            "category": "Mantenimiento",
            "duration_minutes": 60,
            "price": 80,
        },
        {
            "name": "Lifting de Pestañas",
            "description": "Curvado permanente con queratina",
            "category": "Lifting",
            "duration_minutes": 75,
            "price": 100,
        },
    ]

    services = {}
    for item in services_data:
        svc = db.query(Service).filter(Service.name == item["name"]).first()
        if not svc:
            svc = Service(
                name=item["name"],
                description=item["description"],
                category_id=categories[item["category"]].id,
                duration_minutes=item["duration_minutes"],
                price=item["price"],
            )
            db.add(svc)
            db.flush()
        else:
            svc.description = item["description"]
            svc.category_id = categories[item["category"]].id
            svc.duration_minutes = item["duration_minutes"]
            svc.price = item["price"]
        services[item["name"]] = svc

    safe_commit(db)

    # Activar todos los servicios en todas las sucursales
    for svc in services.values():
        for branch in branches.values():
            exists = (
                db.query(BranchService)
                .filter(BranchService.branch_id == branch.id, BranchService.service_id == svc.id)
                .first()
            )
            if not exists:
                db.add(BranchService(branch_id=branch.id, service_id=svc.id, is_active=True))

    safe_commit(db)
    return services


# =========================================================
# Citas — cubre todos los estados para cierre de caja,
# movilidad de operaria y agenda de mañana
# =========================================================
def seed_appointments(db: Session, clients: dict, users: dict, branches: dict, services: dict):
    # Hora base: inicio de la hora actual (sin minutos/segundos)
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)

    appointments_data = [
        # ── Sucursal Principal — HOY ─────────────────────────────────────────

        # Completada hace ~4h: operaria1 (senior) con Ana — servicio complejo
        {
            "client_key": "Ana Pérez",
            "professional": "operaria1",
            "service_ids": [services["Extensiones Clásicas"].id, services["Retoque de Extensiones"].id],
            "branch": "Sucursal Principal",
            "start_time": now - timedelta(hours=4),
            "end_time": now - timedelta(hours=2),
            "status": "completed",
        },

        # Completada hace ~3h: operaria2 (junior) con María — servicio simple
        {
            "client_key": "María Gómez",
            "professional": "operaria2",
            "service_ids": [services["Retoque de Extensiones"].id],
            "branch": "Sucursal Principal",
            "start_time": now - timedelta(hours=3),
            "end_time": now - timedelta(hours=2),
            "status": "completed",
        },

        # Cancelada: turno que no se presentó
        {
            "client_key": "Isabella Méndez",
            "professional": "operaria2",
            "service_ids": [services["Extensiones Clásicas"].id],
            "branch": "Sucursal Principal",
            "start_time": now - timedelta(hours=5),
            "end_time": now - timedelta(hours=3, minutes=30),
            "status": "cancelled",
        },

        # En servicio AHORA: movilidad de sucursal — operaria3 (de Norte)
        # trabajando en Principal por alta demanda
        {
            "client_key": "Valentina Cruz",
            "professional": "operaria3",
            "service_ids": [services["Extensiones Volumen 3D"].id],
            "branch": "Sucursal Principal",
            "start_time": now - timedelta(minutes=30),
            "end_time": now + timedelta(hours=1, minutes=30),
            "status": "in_service",
        },

        # Pendiente próximamente: operaria1 libre para turno de tarde
        {
            "client_key": "Isabella Méndez",
            "professional": "operaria1",
            "service_ids": [services["Lifting de Pestañas"].id],
            "branch": "Sucursal Principal",
            "start_time": now + timedelta(hours=1),
            "end_time": now + timedelta(hours=2, minutes=15),
            "status": "pending",
        },

        # Confirmado tarde: cliente recurrente con operaria2
        {
            "client_key": "Ana Pérez",
            "professional": "operaria2",
            "service_ids": [services["Retoque de Extensiones"].id],
            "branch": "Sucursal Principal",
            "start_time": now + timedelta(hours=2),
            "end_time": now + timedelta(hours=3),
            "status": "confirmed",
        },

        # Confirmado tarde: operaria1 con María — 2 servicios
        {
            "client_key": "María Gómez",
            "professional": "operaria1",
            "service_ids": [services["Extensiones Clásicas"].id, services["Lifting de Pestañas"].id],
            "branch": "Sucursal Principal",
            "start_time": now + timedelta(hours=3),
            "end_time": now + timedelta(hours=5, minutes=30),
            "status": "confirmed",
        },

        # ── Sucursal Norte — HOY ─────────────────────────────────────────────

        # Completada: operaria3 en su sucursal de origen esta mañana
        {
            "client_key": "Lucía Rojas",
            "professional": "operaria3",
            "service_ids": [services["Retoque de Extensiones"].id],
            "branch": "Sucursal Norte",
            "start_time": now - timedelta(hours=6),
            "end_time": now - timedelta(hours=5),
            "status": "completed",
        },

        # ── MAÑANA — reservas para probar agenda futura ──────────────────────

        {
            "client_key": "Valentina Cruz",
            "professional": "operaria1",
            "service_ids": [services["Extensiones Volumen 3D"].id],
            "branch": "Sucursal Principal",
            "start_time": now + timedelta(days=1, hours=1),
            "end_time": now + timedelta(days=1, hours=3),
            "status": "confirmed",
        },
        {
            "client_key": "Lucía Rojas",
            "professional": "operaria3",
            "service_ids": [services["Extensiones Clásicas"].id],
            "branch": "Sucursal Norte",
            "start_time": now + timedelta(days=1, hours=2),
            "end_time": now + timedelta(days=1, hours=3, minutes=30),
            "status": "pending",
        },
    ]

    appointments = {}
    for item in appointments_data:
        client = clients[item["client_key"]]
        professional = users[item["professional"]]
        branch = branches[item["branch"]]

        existing = (
            db.query(Appointment)
            .filter(
                Appointment.client_id == client.id,
                Appointment.start_time == item["start_time"],
            )
            .first()
        )

        if existing:
            appointments[f"{item['client_key']}|{item['start_time'].isoformat()}"] = existing
            continue

        created = create_appointment(
            db=db,
            client_id=client.id,
            created_by_id=professional.id,
            professional_id=professional.id,
            service_ids=item["service_ids"],
            branch_id=branch.id,
            start_time=item["start_time"],
            end_time=item["end_time"],
            status_value=item["status"],
            skip_availability_check=True,
        )
        appointments[f"{item['client_key']}|{item['start_time'].isoformat()}"] = created

    safe_commit(db)
    return appointments


# =========================================================
# Seguimientos de pestañas
# =========================================================
def seed_trackings(
    db: Session,
    clients: dict,
    users: dict,
    eye_types: dict,
    effects: dict,
    volumes: dict,
    lash_designs: dict,
    questionnaire: Questionnaire,
    appointments: dict,
):
    trackings_data = [
        {
            "client_key": "Ana Pérez",
            "professional": "operaria1",
            "eye_type": "Almendrado",
            "effect": "Natural",
            "volume": "Clásico (1D)",
            "lash_design": "Natural",
            "date": datetime.utcnow() - timedelta(days=20),
            "notes": "Primera aplicación, look natural. Piel sensible al adhesivo rápido.",
        },
        {
            "client_key": "María Gómez",
            "professional": "operaria1",
            "eye_type": "Encapotado",
            "effect": "Foxy Eye",
            "volume": "3D",
            "lash_design": "Cat Eye",
            "date": datetime.utcnow() - timedelta(days=10),
            "notes": "Se priorizó elongación visual. Prefiere pegamento lento.",
        },
        {
            "client_key": "Valentina Cruz",
            "professional": "operaria3",
            "eye_type": "Rasgado",
            "effect": "Wet Look",
            "volume": "5D",
            "lash_design": "Wispy",
            "date": datetime.utcnow() - timedelta(days=5),
            "notes": "Clienta nueva. Quiere volumen máximo para evento.",
        },
    ]

    for item in trackings_data:
        client = clients[item["client_key"]]
        appointment = next(
            (appt for key, appt in appointments.items() if key.startswith(f"{item['client_key']}|")),
            None,
        )
        exists = (
            db.query(Tracking)
            .filter(Tracking.client_id == client.id, Tracking.last_application_date == item["date"])
            .first()
        )
        if exists:
            continue

        db.add(Tracking(
            client_id=client.id,
            appointment_id=appointment.id if appointment else None,
            branch_id=appointment.branch_id if appointment else client.branch_id,
            professional_id=users[item["professional"]].id,
            eye_type_id=eye_types[item["eye_type"]].id,
            effect_id=effects[item["effect"]].id,
            volume_id=volumes[item["volume"]].id,
            lash_design_id=lash_designs[item["lash_design"]].id,
            questionnaire_id=questionnaire.id,
            design_notes=item["notes"],
            last_application_date=item["date"],
            questionnaire_responses={"alergias": "no", "usa_lentes": "no"},
        ))

    safe_commit(db)


# =========================================================
# Pagos — para citas completadas de hoy y de historial
# =========================================================
def seed_payments(db: Session, clients: dict, branches: dict, appointments: dict):
    # Buscar las citas completadas de hoy para asociar pagos
    def find_appointment(client_key: str):
        return next(
            (appt for key, appt in appointments.items() if key.startswith(f"{client_key}|")),
            None,
        )

    ana_appt = find_appointment("Ana Pérez")
    maria_appt = find_appointment("María Gómez")
    lucia_appt = find_appointment("Lucía Rojas")

    payment_data = [
        {
            "client_key": "Ana Pérez",
            "branch": "Sucursal Principal",
            "appointment": ana_appt,
            "amount": 200,  # Clásicas 120 + Retoque 80
            "method": "cash",
            "status": "paid",
            "reference": "CASH-001",
            "paid_at": datetime.utcnow() - timedelta(hours=2),
        },
        {
            "client_key": "María Gómez",
            "branch": "Sucursal Principal",
            "appointment": maria_appt,
            "amount": 80,   # Retoque
            "method": "qr",
            "status": "paid",
            "reference": "QR-001",
            "paid_at": datetime.utcnow() - timedelta(hours=2),
        },
        {
            "client_key": "Lucía Rojas",
            "branch": "Sucursal Norte",
            "appointment": lucia_appt,
            "amount": 80,   # Retoque
            "method": "transfer",
            "status": "paid",
            "reference": "TRF-001",
            "paid_at": datetime.utcnow() - timedelta(hours=5),
        },
    ]

    for item in payment_data:
        existing = db.query(Payment).filter(Payment.reference == item["reference"]).first()
        if existing:
            continue
        db.add(Payment(
            client_id=clients[item["client_key"]].id,
            branch_id=branches[item["branch"]].id,
            appointment_id=item["appointment"].id if item["appointment"] else None,
            amount=item["amount"],
            method=item["method"],
            status=item["status"],
            reference=item["reference"],
            paid_at=item["paid_at"],
        ))

    safe_commit(db)


# =========================================================
# Inventario — con min_stock para probar alertas de stock
# =========================================================
def seed_inventory(db: Session, branches: dict):
    categories_data = [
        ("Adhesivos", "Pegamentos y selladores"),
        ("Pestañas", "Extensiones y sets de fibras"),
        ("Removedores", "Productos de retiro seguro"),
        ("Accesorios", "Herramientas y utensilios"),
    ]
    categories = {}
    for name, description in categories_data:
        cat, _ = get_or_create(db, Category, name=name, defaults={"description": description})
        cat.description = description
        categories[name] = cat
    safe_commit(db)

    # min_stock definido — algunos productos estarán por debajo para probar alertas
    products_data = [
        {
            "sku": "ADH-001",
            "name": "Adhesivo Premium Negro",
            "category": "Adhesivos",
            "price": 120,
            "cost": 80,
            "min_stock": 5,
            "batches": [
                {"branch": "Sucursal Principal", "qty": 8, "cost": 75},
            ],
        },
        {
            "sku": "ADH-002",
            "name": "Adhesivo Sensitivo (baja retención)",
            "category": "Adhesivos",
            "price": 95,
            "cost": 60,
            "min_stock": 4,
            "batches": [
                {"branch": "Sucursal Principal", "qty": 2, "cost": 55},  # BAJO: 2 < 4
            ],
        },
        {
            "sku": "LAS-001",
            "name": "Set Pestañas Mink 0.07mm",
            "category": "Pestañas",
            "price": 95,
            "cost": 60,
            "min_stock": 10,
            "batches": [
                {"branch": "Sucursal Principal", "qty": 6, "cost": 55},  # BAJO: 6 < 10
                {"branch": "Sucursal Norte", "qty": 3, "cost": 55},       # BAJO: 3 < 10
            ],
        },
        {
            "sku": "LAS-002",
            "name": "Set Pestañas Seda 0.10mm",
            "category": "Pestañas",
            "price": 85,
            "cost": 50,
            "min_stock": 8,
            "batches": [
                {"branch": "Sucursal Principal", "qty": 20, "cost": 45},
            ],
        },
        {
            "sku": "REM-001",
            "name": "Removedor Gel",
            "category": "Removedores",
            "price": 70,
            "cost": 40,
            "min_stock": 3,
            "batches": [
                {"branch": "Sucursal Norte", "qty": 2, "cost": 35},  # BAJO: 2 < 3
            ],
        },
        {
            "sku": "REM-002",
            "name": "Removedor Crema",
            "category": "Removedores",
            "price": 65,
            "cost": 38,
            "min_stock": 3,
            "batches": [
                {"branch": "Sucursal Principal", "qty": 10, "cost": 35},
            ],
        },
        {
            "sku": "ACC-001",
            "name": "Pinzas Curvas Profesionales",
            "category": "Accesorios",
            "price": 150,
            "cost": 90,
            "min_stock": 2,
            "batches": [
                {"branch": "Sucursal Principal", "qty": 5, "cost": 85},
            ],
        },
    ]

    products = {}
    for item in products_data:
        product = db.query(Product).filter(Product.sku == item["sku"]).first()
        if not product:
            product = Product(
                sku=item["sku"],
                name=item["name"],
                category_id=categories[item["category"]].id,
                price=item["price"],
                cost=item["cost"],
                status=True,
                min_stock=item["min_stock"],
                image_url=None,
            )
            db.add(product)
            db.flush()
        else:
            product.name = item["name"]
            product.category_id = categories[item["category"]].id
            product.price = item["price"]
            product.cost = item["cost"]
            product.min_stock = item["min_stock"]
        products[item["sku"]] = product

    safe_commit(db)

    for item in products_data:
        product = products[item["sku"]]
        for batch_item in item["batches"]:
            branch = branches[batch_item["branch"]]
            batch = (
                db.query(Batch)
                .filter(
                    Batch.product_id == product.id,
                    Batch.branch_id == branch.id,
                    Batch.initial_quantity == batch_item["qty"],
                )
                .first()
            )
            if not batch:
                batch = Batch(
                    product_id=product.id,
                    branch_id=branch.id,
                    initial_quantity=batch_item["qty"],
                    current_quantity=batch_item["qty"],
                    cost_per_unit=batch_item["cost"],
                )
                db.add(batch)
                db.flush()
                db.add(InventoryMovement(
                    product_id=product.id,
                    batch_id=batch.id,
                    branch_id=branch.id,
                    movement_type="in",
                    quantity=batch_item["qty"],
                    note="Seeder - carga inicial",
                ))

    safe_commit(db)


# =========================================================
# Seeder maestro
# =========================================================
def run_seeders(db: Session):
    seed_permissions(db)
    roles = seed_roles(db)
    branches = seed_branches(db)
    seed_users(db, roles, branches)
    seed_catalogs(db)
    seed_questionnaires(db)
    seed_services(db, branches)
    seed_inventory(db, branches)

    print(">>> Seeders ejecutados correctamente <<<")
    print("   Usuarios: admin / secretaria1 / almacen1")
    print("   Contraseñas: admin123 | secretaria123 | almacen123")
    print("   Sucursales: Sucursal Principal | Sucursal Norte")
    print("   Sin clientes de prueba — créalos desde el POS")
