from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.branch import Branch
from app.models.user import User, Role, Permission
from app.models.client import (
    Client,
    CLIENT_STATUS_EN_ESPERA,
    CLIENT_STATUS_EN_SERVICIO,
    CLIENT_STATUS_FINALIZADO,
)
from app.models.tracking import (
    EyeType,
    Effect,
    Volume,
    LashDesign,
    Questionnaire,
    Question,
    Tracking,
)
from app.models.service_agenda import ServiceCategory, Service, Appointment, BranchService
from app.models.payment import Payment
from app.models.inventory import Category, Product, Batch, InventoryMovement
from app.services.service_agenda_service import create_appointment


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
# Seeders principales
# =========================================================
def seed_permissions(db: Session):
    permissions_list = [
        # clients
        "clients:view",
        "clients:manage",
        # catalogs
        "catalog:view",
        "catalog:manage",
        # tracking
        "tracking:view",
        "tracking:manage",
        # forms/questionnaires
        "forms:view",
        "forms:manage",
        # users/admin
        "users:manage",
        "settings:view",
        # payments
        "payments:view",
        "payments:manage",
        # inventory
        "inventory:view",
        "inventory:manage",
        # services / appointments
        "services:view",
        "services:manage",
        "appointments:view",
        "appointments:manage",
        # branches
        "branches:view",
        "branches:manage",
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
        "Operaria": [
            permission_map["clients:view"],
            permission_map["clients:manage"],
            permission_map["catalog:view"],
            permission_map["tracking:view"],
            permission_map["tracking:manage"],
            permission_map["forms:view"],
            permission_map["services:view"],
            permission_map["appointments:view"],
            permission_map["appointments:manage"],
            permission_map["payments:view"],
            permission_map["branches:view"],
        ],
        "Secretaria": [
            permission_map["clients:view"],
            permission_map["clients:manage"],
            permission_map["tracking:view"],
            permission_map["forms:view"],
            permission_map["payments:view"],
            permission_map["payments:manage"],
            permission_map["services:view"],
            permission_map["appointments:view"],
            permission_map["appointments:manage"],
            permission_map["branches:view"],
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
        role, created = get_or_create(db, Role, name=role_name)
        role.permissions = permissions
        roles[role_name] = role

    safe_commit(db)
    return roles


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
        {
            "name": "Sucursal Sur",
            "address": "Av. Panamericana #890",
            "city": "La Paz",
            "department": "La Paz",
        },
    ]

    branches = {}
    for item in branches_data:
        branch, _ = get_or_create(
            db,
            Branch,
            name=item["name"],
            defaults={
                "address": item["address"],
                "city": item["city"],
                "department": item["department"],
            },
        )
        if branch.address != item["address"]:
            branch.address = item["address"]
        if branch.city != item["city"]:
            branch.city = item["city"]
        if branch.department != item["department"]:
            branch.department = item["department"]
        branches[item["name"]] = branch

    safe_commit(db)
    return branches


def seed_users(db: Session, roles: dict, branches: dict):
    users_data = [
        {
            "username": "admin",
            "email": "admin@elashes.com",
            "phone": "+59170000001",
            "password": "admin123",
            "role": "SuperAdmin",
            "branch": "Sucursal Principal",
            "is_active": True,
        },
        {
            "username": "operaria1",
            "email": "operaria1@elashes.com",
            "phone": "+59170000002",
            "password": "operaria123",
            "role": "Operaria",
            "branch": "Sucursal Principal",
            "is_active": True,
        },
        {
            "username": "secretaria1",
            "email": "secretaria1@elashes.com",
            "phone": "+59170000003",
            "password": "secretaria123",
            "role": "Secretaria",
            "branch": "Sucursal Norte",
            "is_active": True,
        },
        {
            "username": "almacen1",
            "email": "almacen1@elashes.com",
            "phone": "+59170000004",
            "password": "almacen123",
            "role": "EncargadaAlmacen",
            "branch": "Sucursal Sur",
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
            )
            db.add(user)
            db.flush()
        else:
            user.email = item["email"]
            user.phone = item["phone"]
            user.is_active = item["is_active"]
            user.role_id = roles[item["role"]].id
            user.branch_id = branches[item["branch"]].id

        users[item["username"]] = user

    safe_commit(db)
    return users


def seed_catalogs(db: Session):
    eye_types_data = [
        ("Almendrado", "Forma equilibrada y versátil"),
        ("Encapotado", "Párpado superior con ligera caída"),
        ("Redondo", "Apertura ocular más amplia"),
        ("Rasgado", "Forma alargada"),
        ("Asimétricos", "Un ojo difiere ligeramente del otro"),
    ]

    effects_data = [
        "Natural",
        "Foxy Eye",
        "Doll Eye",
        "Wet Look",
        "Kim K",
    ]

    volumes_data = [
        ("Clásico (1D)", "Efecto sutil y natural"),
        ("2D", "Más densidad sin exagerar"),
        ("3D", "Volumen elegante"),
        ("5D", "Volumen alto y glam"),
    ]

    lash_designs_data = [
        "Natural",
        "Cat Eye",
        "Doll",
        "Wispy",
        "Squirrel",
    ]

    eye_types = {}
    for name, description in eye_types_data:
        item, _ = get_or_create(
            db,
            EyeType,
            name=name,
            defaults={"description": description, "image": None},
        )
        if item.description != description:
            item.description = description
        eye_types[name] = item

    effects = {}
    for name in effects_data:
        item, _ = get_or_create(
            db,
            Effect,
            name=name,
            defaults={"image": None},
        )
        effects[name] = item

    volumes = {}
    for name, description in volumes_data:
        item, _ = get_or_create(
            db,
            Volume,
            name=name,
            defaults={"description": description, "image": None},
        )
        if item.description != description:
            item.description = description
        volumes[name] = item

    lash_designs = {}
    for name in lash_designs_data:
        item, _ = get_or_create(
            db,
            LashDesign,
            name=name,
            defaults={"image": None},
        )
        lash_designs[name] = item

    safe_commit(db)
    return eye_types, effects, volumes, lash_designs


def seed_questionnaires(db: Session):
    questionnaire = (
        db.query(Questionnaire)
        .filter(Questionnaire.title == "Ficha inicial de extensiones")
        .first()
    )

    questions_data = [
        # Adultos
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
        # Menores
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

    existing_questions = (
        db.query(Question)
        .filter(Question.questionnaire_id == questionnaire.id)
        .all()
    )

    existing_by_text = {q.text.strip(): q for q in existing_questions}
    for q in questions_data:
        if q["text"].strip() in existing_by_text:
            continue
        question = Question(
            questionnaire_id=questionnaire.id,
            text=q["text"],
            question_type=q["question_type"],
            is_required=q["is_required"],
            sort_order=q["sort_order"],
        )
        db.add(question)

    safe_commit(db)
    return questionnaire


def seed_clients(db: Session, eye_types: dict, branches: dict):
    now = datetime.now(timezone.utc)
    clients_data = [
        {
            "name": "Ana",
            "last_name": "Pérez",
            "age": 25,
            "phone": "70000001",
            "eye_type": "Almendrado",
            "branch": "Sucursal Principal",
            "status": CLIENT_STATUS_EN_ESPERA,
        },
        {
            "name": "María",
            "last_name": "Gómez",
            "age": 29,
            "phone": "70000002",
            "eye_type": "Encapotado",
            "branch": "Sucursal Principal",
            "status": CLIENT_STATUS_EN_SERVICIO,
        },
        {
            "name": "Lucía",
            "last_name": "Rojas",
            "age": 22,
            "phone": "70000003",
            "eye_type": "Redondo",
            "branch": "Sucursal Norte",
            "status": CLIENT_STATUS_FINALIZADO,
        },
    ]

    clients = {}
    for item in clients_data:
        client = (
            db.query(Client)
            .filter(
                Client.name == item["name"],
                Client.last_name == item["last_name"],
                Client.phone == item["phone"],
            )
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
            "notes": "Primera aplicación, look natural.",
            "responses": {
                "alergias": "no",
                "usa_lentes": "si",
                "extensiones_previas": "no",
                "sensibilidad": "leve",
            },
        },
        {
            "client_key": "María Gómez",
            "professional": "operaria1",
            "eye_type": "Encapotado",
            "effect": "Foxy Eye",
            "volume": "3D",
            "lash_design": "Cat Eye",
            "date": datetime.utcnow() - timedelta(days=10),
            "notes": "Se priorizó elongación visual.",
            "responses": {
                "alergias": "no",
                "usa_lentes": "no",
                "extensiones_previas": "si",
                "sensibilidad": "media",
            },
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
            .filter(
                Tracking.client_id == client.id,
                Tracking.last_application_date == item["date"],
            )
            .first()
        )
        if exists:
            continue

        tracking = Tracking(
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
            questionnaire_responses=item["responses"],
        )
        db.add(tracking)

    safe_commit(db)


def seed_services(db: Session, branches: dict):
    categories_data = [
        {"name": "Extensiones", "description": "Aplicaciones de extensiones de pestanas"},
        {"name": "Mantenimiento", "description": "Servicios de retoque y mantenimiento"},
    ]

    categories = {}
    for item in categories_data:
        category = db.query(ServiceCategory).filter(ServiceCategory.name == item["name"]).first()
        if not category:
            category = ServiceCategory(name=item["name"], description=item["description"])
            db.add(category)
            db.flush()
        else:
            category.description = item["description"]
        categories[item["name"]] = category

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
            "description": "Mantenimiento parcial",
            "category": "Mantenimiento",
            "duration_minutes": 60,
            "price": 80,
        },
    ]

    services = {}
    for item in services_data:
        service = db.query(Service).filter(Service.name == item["name"]).first()
        if not service:
            service = Service(
                name=item["name"],
                description=item["description"],
                category_id=categories[item["category"]].id,
                duration_minutes=item["duration_minutes"],
                price=item["price"],
            )
            db.add(service)
            db.flush()
        else:
            service.description = item["description"]
            service.category_id = categories[item["category"]].id
            service.duration_minutes = item["duration_minutes"]
            service.price = item["price"]

        services[item["name"]] = service

    safe_commit(db)

    for service in services.values():
        for branch in branches.values():
            exists = (
                db.query(BranchService)
                .filter(
                    BranchService.branch_id == branch.id,
                    BranchService.service_id == service.id,
                )
                .first()
            )
            if not exists:
                db.add(BranchService(branch_id=branch.id, service_id=service.id, is_active=True))

    safe_commit(db)
    return services


def seed_appointments(db: Session, clients: dict, users: dict, branches: dict, services: dict):
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)

    appointments_data = [
        {
            "client_key": "Ana Pérez",
            "professional": "operaria1",
            "service_ids": [
                services["Extensiones Clásicas"].id,
                services["Retoque de Extensiones"].id,
            ],
            "branch": "Sucursal Principal",
            "start_time": now + timedelta(hours=1),
            "end_time": now + timedelta(hours=3),
            "status": "pending",
        },
        {
            "client_key": "María Gómez",
            "professional": "operaria1",
            "service_ids": [services["Extensiones Volumen 3D"].id],
            "branch": "Sucursal Principal",
            "start_time": now + timedelta(hours=3),
            "end_time": now + timedelta(hours=5),
            "status": "in_service",
        },
        {
            "client_key": "Lucía Rojas",
            "professional": "operaria1",
            "service_ids": [services["Retoque de Extensiones"].id],
            "branch": "Sucursal Norte",
            "start_time": now - timedelta(hours=2),
            "end_time": now - timedelta(hours=1),
            "status": "completed",
        },
        {
            "client_key": "Ana Pérez",
            "professional": "operaria1",
            "service_ids": [services["Extensiones Clásicas"].id],
            "branch": "Sucursal Principal",
            "start_time": now + timedelta(days=1, hours=2),
            "end_time": now + timedelta(days=1, hours=4),
            "status": "confirmed",
        },
    ]

    appointments = {}
    for item in appointments_data:
        client = clients[item["client_key"]]
        professional = users[item["professional"]]
        branch = branches[item["branch"]]

        appointment = (
            db.query(Appointment)
            .filter(
                Appointment.client_id == client.id,
                Appointment.start_time == item["start_time"],
            )
            .first()
        )

        if appointment:
            appointments[f"{item['client_key']}|{item['start_time'].isoformat()}"] = appointment
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
        )
        appointments[f"{item['client_key']}|{item['start_time'].isoformat()}"] = created

    safe_commit(db)
    return appointments


def seed_payments(db: Session, clients: dict, branches: dict, appointments: dict):
    payment_data = [
        {
            "client_key": "María Gómez",
            "branch": "Sucursal Principal",
            "appointment_lookup": None,  # se asigna abajo
            "amount": 180,
            "method": "qr",
            "status": "paid",
            "reference": "QR-0001",
            "paid_at": datetime.utcnow() - timedelta(days=1),
        }
    ]

    # Buscar cita de María
    maria_appointment = None
    for key, appointment in appointments.items():
        if key.startswith("María Gómez|"):
            maria_appointment = appointment
            break

    if maria_appointment:
        payment_data[0]["appointment_lookup"] = maria_appointment.id

    for item in payment_data:
        existing = (
            db.query(Payment)
            .filter(Payment.reference == item["reference"])
            .first()
        )
        if existing:
            continue

        payment = Payment(
            client_id=clients[item["client_key"]].id,
            branch_id=branches[item["branch"]].id,
            appointment_id=item["appointment_lookup"],
            amount=item["amount"],
            method=item["method"],
            status=item["status"],
            reference=item["reference"],
            paid_at=item["paid_at"],
        )
        db.add(payment)

    safe_commit(db)


def seed_inventory(db: Session, branches: dict):
    categories_data = [
        ("Adhesivos", "Productos de adhesión"),
        ("Pestañas", "Extensiones y sets"),
        ("Removedores", "Productos de retiro"),
    ]

    categories = {}
    for name, description in categories_data:
        category, _ = get_or_create(
            db,
            Category,
            name=name,
            defaults={"description": description},
        )
        if category.description != description:
            category.description = description
        categories[name] = category

    safe_commit(db)

    products_data = [
        {
            "sku": "ADH-001",
            "name": "Adhesivo Premium",
            "category": "Adhesivos",
            "price": 120,
            "cost": 80,
            "status": True,
        },
        {
            "sku": "LAS-001",
            "name": "Set Pestañas Mink 0.07",
            "category": "Pestañas",
            "price": 95,
            "cost": 60,
            "status": True,
        },
        {
            "sku": "REM-001",
            "name": "Removedor Gel",
            "category": "Removedores",
            "price": 70,
            "cost": 40,
            "status": True,
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
                status=item["status"],
                image_url=None,
            )
            db.add(product)
            db.flush()
        else:
            product.name = item["name"]
            product.category_id = categories[item["category"]].id
            product.price = item["price"]
            product.cost = item["cost"]
            product.status = item["status"]

        products[item["sku"]] = product

    safe_commit(db)

    batches_data = [
        {
            "product_sku": "ADH-001",
            "branch": "Sucursal Principal",
            "initial_quantity": 20,
            "cost_per_unit": 75,
        },
        {
            "product_sku": "LAS-001",
            "branch": "Sucursal Principal",
            "initial_quantity": 30,
            "cost_per_unit": 55,
        },
        {
            "product_sku": "REM-001",
            "branch": "Sucursal Norte",
            "initial_quantity": 10,
            "cost_per_unit": 35,
        },
    ]

    for item in batches_data:
        product = products[item["product_sku"]]
        branch = branches[item["branch"]]

        batch = (
            db.query(Batch)
            .filter(
                Batch.product_id == product.id,
                Batch.branch_id == branch.id,
                Batch.initial_quantity == item["initial_quantity"],
            )
            .first()
        )

        if not batch:
            batch = Batch(
                product_id=product.id,
                branch_id=branch.id,
                initial_quantity=item["initial_quantity"],
                current_quantity=item["initial_quantity"],
                cost_per_unit=item["cost_per_unit"],
            )
            db.add(batch)
            db.flush()

            movement = InventoryMovement(
                product_id=product.id,
                batch_id=batch.id,
                branch_id=branch.id,
                movement_type="in",
                quantity=item["initial_quantity"],
                note="Seeder - carga inicial",
            )
            db.add(movement)

    safe_commit(db)

    # Movimientos realistas adicionales
    adhesive = products["ADH-001"]
    main_branch = branches["Sucursal Principal"]

    adhesive_batch = (
        db.query(Batch)
        .filter(Batch.product_id == adhesive.id, Batch.branch_id == main_branch.id)
        .order_by(Batch.id.asc())
        .first()
    )

    if adhesive_batch:
        existing_out = (
            db.query(InventoryMovement)
            .filter(
                InventoryMovement.batch_id == adhesive_batch.id,
                InventoryMovement.movement_type == "service_use",
                InventoryMovement.note == "Seeder - consumo en servicio",
            )
            .first()
        )
        if not existing_out and adhesive_batch.current_quantity >= 2:
            adhesive_batch.current_quantity -= 2
            movement = InventoryMovement(
                product_id=adhesive.id,
                batch_id=adhesive_batch.id,
                branch_id=main_branch.id,
                movement_type="service_use",
                quantity=2,
                note="Seeder - consumo en servicio",
            )
            db.add(movement)

    safe_commit(db)


# =========================================================
# Seeder maestro
# =========================================================
def run_seeders(db: Session):
    permissions = seed_permissions(db)
    roles = seed_roles(db)
    branches = seed_branches(db)
    users = seed_users(db, roles, branches)
    eye_types, effects, volumes, lash_designs = seed_catalogs(db)
    questionnaire = seed_questionnaires(db)
    clients = seed_clients(db, eye_types, branches)
    services = seed_services(db, branches)
    appointments = seed_appointments(db, clients, users, branches, services)
    seed_trackings(
        db=db,
        clients=clients,
        users=users,
        eye_types=eye_types,
        effects=effects,
        volumes=volumes,
        lash_designs=lash_designs,
        questionnaire=questionnaire,
        appointments=appointments,
    )
    seed_payments(db, clients, branches, appointments)
    seed_inventory(db, branches)

    print(">>> Seeders realistas ejecutados correctamente <<<")