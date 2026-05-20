
# PARTE 2 — API de negocio Elashes (referencia completa)

Documentación alineada con `main.py` y controladores en `app/controllers/` y `app/routes/`.

---

## Configuración e inicio

### Variables de entorno (`.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto HTTP | `8000` |
| `SECRET_KEY` | Firma JWT | clave segura en producción |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Duración token | `1440` (24 h) |
| `DATABASE_URL` | Conexión DB | `sqlite:///./elashes.db` |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL alternativo | Docker/producción |

### Arranque

```bash
cd elashesbackend
pip install -r requirements.txt
python main.py
```

Servidor por defecto: `http://127.0.0.1:8000` (en `.exe` suele ser `127.0.0.1`).

### Usuarios de prueba (seeders)

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `admin` | `admin123` | SuperAdmin |
| `operaria1` | `operaria123` | Operaria |
| `secretaria1` | `secretaria123` | Secretaria |
| `almacen1` | `almacen123` | EncargadaAlmacen |

### Cabeceras HTTP

```http
Content-Type: application/json
Authorization: Bearer <access_token>
```

Para subida de imágenes: `Content-Type: multipart/form-data`.

---

## Tabla maestra de endpoints

| Método | Ruta | Auth | Permiso / rol |
|--------|------|------|----------------|
| **Auth** |
| POST | `/auth/login` | No | — |
| GET | `/auth/me` | Sí | activo |
| GET | `/auth/session` | Sí | activo |
| POST | `/auth/refresh` | Sí | activo |
| POST | `/auth/logout` | Sí | activo |
| POST | `/auth/register` | Sí | SuperAdmin |
| **Clientes** |
| GET | `/clients/` | Sí | `clients:view` |
| GET | `/clients/{id}` | Sí | `clients:view` |
| POST | `/clients/` | Sí | `clients:manage` |
| PUT | `/clients/{id}` | Sí | `clients:manage` |
| DELETE | `/clients/{id}` | Sí | `clients:manage` |
| **Sucursales** |
| GET | `/branches/` | Sí | `branches:view` |
| GET | `/branches/{id}` | Sí | `branches:view` |
| POST | `/branches/` | Sí | `branches:manage` |
| PUT | `/branches/{id}` | Sí | `branches:manage` |
| DELETE | `/branches/{id}` | Sí | `branches:manage` |
| **Categorías de servicio** |
| GET | `/services/categories` | Sí | `services:view` o `appointments:view` |
| GET | `/services/categories/{id}` | Sí | idem |
| POST | `/services/categories` | Sí | `services:manage` o `appointments:manage` |
| PUT | `/services/categories/{id}` | Sí | idem |
| DELETE | `/services/categories/{id}` | Sí | idem |
| POST | `/services/categories/upload-image` | Sí | idem |
| **Agenda — servicios** |
| GET | `/agenda/services` | Sí | `services:view` |
| GET | `/agenda/services/{id}` | Sí | `services:view` |
| POST | `/agenda/services` | Sí | `services:manage` |
| PUT | `/agenda/services/{id}` | Sí | `services:manage` |
| DELETE | `/agenda/services/{id}` | Sí | `services:manage` |
| POST | `/agenda/services/upload-image` | Sí | `services:manage` |
| GET | `/agenda/services/image/{filename}` | No* | archivo público |
| **Agenda — selectores** |
| GET | `/agenda/clients-for-select` | Sí | `appointments:view` \| `payments:view` \| `clients:view` |
| GET | `/agenda/professionals-for-select` | Sí | `appointments:view` \| `appointments:manage` |
| **Agenda — tickets** |
| GET | `/agenda/appointments` | Sí | `appointments:view` |
| GET | `/agenda/appointments/mobile/available` | Sí | `appointments:view` |
| GET | `/agenda/appointments/{id}` | Sí | `appointments:view` |
| POST | `/agenda/appointments` | Sí | `appointments:manage` |
| PUT | `/agenda/appointments/{id}` | Sí | `appointments:manage` |
| DELETE | `/agenda/appointments/{id}` | Sí | `appointments:manage` |
| POST | `/agenda/appointments/call-next` | Sí | `appointments:manage` |
| **Catálogos** (`/catalogs`) |
| GET/POST | `/eye-types`, `/eye-types/{id}` | Sí | `catalog:view` / `catalog:manage` |
| GET/POST | `/effects`, `/effects/{id}` | Sí | idem |
| GET/POST | `/volumes`, `/volumes/{id}` | Sí | idem |
| GET/POST | `/lash-designs`, `/lash-designs/{id}` | Sí | idem |
| **Cuestionarios** (`/catalogs/questionnaires`) |
| GET/POST | `/questionnaires`, `/questionnaires/{id}` | Sí | `forms:view` / `forms:manage` |
| **Seguimiento** |
| GET | `/tracking/` | Sí | `tracking:view` |
| GET | `/tracking/{id}` | Sí | `tracking:view` |
| GET | `/tracking/client/{client_id}/latest` | Sí | `tracking:view` |
| POST | `/tracking/` | Sí | `tracking:manage` |
| PUT | `/tracking/{id}` | Sí | `tracking:manage` |
| DELETE | `/tracking/{id}` | Sí | `tracking:manage` |
| **Pagos** |
| GET | `/payments/` | Sí | `payments:view` |
| GET | `/payments/{id}` | Sí | `payments:view` |
| POST | `/payments/` | Sí | `payments:manage` |
| PUT | `/payments/{id}` | Sí | `payments:manage` |
| DELETE | `/payments/{id}` | Sí | `payments:manage` |
| **POS** |
| GET | `/pos-sales/` | Sí | `appointments:view` \| `payments:view` |
| GET | `/pos-sales/{id}` | Sí | idem |
| POST | `/pos-sales/` | Sí | `appointments:manage` |
| PATCH | `/pos-sales/{id}` | Sí | `appointments:manage` |
| POST | `/pos-sales/{id}/cancel` | Sí | `appointments:manage` |
| DELETE | `/pos-sales/{id}` | Sí | `appointments:manage` |
| GET | `/pos-sales/{id}/receipt/pdf` | Sí | idem |
| **Inventario** |
| GET/POST/PUT/DELETE | `/inventory/categories` | Sí | `inventory:view` / `manage` |
| GET/POST/PUT/DELETE | `/inventory/products` | Sí | idem |
| GET/POST/PUT | `/inventory/batches` | Sí | idem |
| GET/POST | `/inventory/movements` | Sí | idem |
| GET | `/inventory/stock-summary` | Sí | `inventory:view` |
| **Dashboard** |
| GET | `/dashboard/overview` | Sí | varios (ver sección) |
| GET | `/dashboard/revenue-series` | Sí | `payments:view` \| `appointments:view` |
| GET | `/dashboard/service-distribution` | Sí | `appointments:view` \| `services:view` |
| GET | `/dashboard/inventory-distribution` | Sí | `inventory:view` \| `branches:view` |
| GET | `/reports/payments.csv` | Sí | `payments:view` \| `appointments:view` |
| GET | `/reports/tickets.csv` | Sí | idem |
| GET | `/reports/pos-sales.csv` | Sí | idem |
| **Admin** |
| CRUD | `/admin/permissions` | Sí | SuperAdmin |
| CRUD | `/admin/roles` | Sí | SuperAdmin |
| CRUD | `/admin/users` | Sí | SuperAdmin |

\*La imagen de servicio no exige JWT, pero la URL solo es conocida tras subir con permiso.

---

## Constantes y enumeraciones

### Estados de ticket (`Appointment.status`)

| Valor | Descripción |
|-------|-------------|
| `pending` | En cola / pendiente |
| `confirmed` | Confirmado |
| `waiting` | En espera |
| `in_service` | En atención |
| `completed` | Finalizado |
| `cancelled` | Cancelado |

### Estados de cliente (`Client.status`)

| Valor | Notas |
|-------|-------|
| `en_espera` | Default al crear |
| `en_servicio` | En atención |
| `finalizado` | Servicio terminado |
| `sin_estado` | Calculado si `last_activity_at` > 1 día |

### Métodos de pago (`Payment.method` / POS `payment_method`)

`cash` · `card` · `transfer` · `qr`

### Estados de pago (`Payment.status`)

`paid` · `pending` · `cancelled` · `refunded`

### Estados de venta POS (`PosSale.status`)

`paid` · `cancelled`

### Descuento POS (`discount_type`)

`amount` (monto fijo) · `percent` (porcentaje)

### Movimientos de inventario (`movement_type`)

`in` · `out` · `adjustment` · `service_use`

### Tipos de pregunta en cuestionarios (`question_type`)

`text` · `number` · `bool` · `select` · `multi_select`

---

## Autenticación

**Prefijo:** `/auth`

### POST /auth/login

```json
{
  "username": "admin",
  "password": "admin123"
}
```

**200 — `LoginResponse`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@elashes.com",
    "phone": "+59170000001",
    "is_active": true,
    "role_id": 1,
    "branch_id": 1,
    "role": { "id": 1, "name": "SuperAdmin" },
    "branch": { "id": 1, "name": "Sucursal Principal" }
  },
  "expires_at": "2026-05-21T12:00:00+00:00",
  "expires_in_minutes": 1440
}
```

### GET /auth/me

Devuelve `UserResponse` del usuario autenticado.

### GET /auth/session

Incluye `remaining_seconds` hasta expiración del JWT.

### POST /auth/refresh

Nuevo `access_token` sin volver a enviar contraseña.

### POST /auth/logout

```json
{ "message": "Logout correcto. El cliente debe eliminar el token." }
```

### POST /auth/register

**Rol:** SuperAdmin.

```json
{
  "username": "nuevo_user",
  "email": "user@elashes.com",
  "phone": "+59171234567",
  "password": "clave123",
  "role_id": 2,
  "branch_id": 1,
  "is_active": true
}
```

---

## Clientes

**Prefijo:** `/clients`

### GET /clients/

| Query | Tipo | Descripción |
|-------|------|-------------|
| `skip` | int ≥ 0 | Offset (default 0) |
| `limit` | int 1–100 | Tamaño página (default 20) |
| `search` | string | Nombre, apellido, teléfono |
| `branch_id` | int | Filtrar sucursal |

### GET /clients/{client_id}

### POST /clients/

**Body — `ClientCreate`:**
```json
{
  "name": "María",
  "last_name": "Pérez",
  "age": 28,
  "phone": "+59170000000",
  "branch_id": 1,
  "eye_type_id": 2,
  "status": "en_espera"
}
```

### PUT /clients/{client_id}

**Body — `ClientUpdate`:** todos los campos opcionales.

### DELETE /clients/{client_id}

**200:**
```json
{ "message": "Cliente eliminado correctamente" }
```

### Respuesta `ClientResponse`

```json
{
  "id": 15,
  "name": "María",
  "last_name": "Pérez",
  "age": 28,
  "phone": "+59170000000",
  "branch_id": 1,
  "eye_type_id": 2,
  "status": "en_espera",
  "last_activity_at": "2026-05-20T15:30:00",
  "eye_type": { "id": 2, "name": "Almendrado" },
  "branch": { "id": 1, "name": "Sucursal Principal" }
}
```

---

## Sucursales

**Prefijo:** `/branches`

### GET /branches/

`skip`, `limit`, `city`, `department`

### POST /branches/

```json
{
  "name": "Sucursal Centro",
  "address": "Av. Principal 123",
  "city": "La Paz",
  "department": "La Paz",
  "opening_hours": [
    {
      "day": "lunes",
      "ranges": [{ "open_time": "09:00", "close_time": "18:00" }]
    }
  ],
  "user_ids": [2, 3]
}
```

### PUT /branches/{branch_id}

Mismos campos, opcionales. `opening_hours` reemplaza el horario si se envía.

### DELETE /branches/{branch_id}

---

## Categorías de servicio

**Prefijo:** `/services/categories`

### GET /services/categories

Lista todas (sin paginación).

### POST /services/categories

```json
{
  "name": "Móvil",
  "description": "Servicios a domicilio",
  "image_url": "data:image/png;base64,iVBOR...",
  "is_mobile": true
}
```

### POST /services/categories/upload-image

- **Content-Type:** `multipart/form-data`
- **Campo:** `file` (imagen)
- **Respuesta:** `{ "image_url": "data:image/jpeg;base64,..." }`
- Límite según `settings.max_image_size` (5 MB por defecto)

---

## Agenda — servicios

**Prefijo:** `/agenda/services`

### GET /agenda/services

`skip`, `limit` (máx. 500), `branch_id`, `category_id`

### POST /agenda/services

```json
{
  "name": "Lifting",
  "description": "Lifting de pestañas",
  "image_url": "http://127.0.0.1:8000/agenda/services/image/a1b2c3.jpg",
  "category_id": 2,
  "duration_minutes": 60,
  "price": 150.0,
  "branch_ids": [1, 2]
}
```

### POST /agenda/services/upload-image

Multipart `file` → guarda en `uploads/services/` → devuelve URL absoluta en `image_url`.

### GET /agenda/services/image/{filename}

Sirve el archivo (sin JWT).

---

## Agenda — selectores

### GET /agenda/clients-for-select

```json
[
  { "id": 15, "nombre": "Ana", "apellido": "López", "phone": "+59177777777" }
]
```

### GET /agenda/professionals-for-select

`role_name` opcional para filtrar por rol.

```json
[
  { "id": 8, "username": "operaria1", "email": "operaria1@elashes.com" }
]
```

---

## Agenda — tickets (citas)

**Prefijo:** `/agenda/appointments`

### GET /agenda/appointments

| Query | Descripción |
|-------|-------------|
| `skip`, `limit` | Paginación |
| `client_id`, `professional_id`, `service_id`, `branch_id` | Filtros |
| `status_filter` | Estado del ticket |
| `ticket_code` | Código exacto parcial |
| `client_name` | Nombre o apellido |
| `search` | Código **o** nombre cliente |
| `start_date`, `end_date` | `YYYY-MM-DD` |
| `is_ia` | `true` / `false` — tickets marcados IA |

### GET /agenda/appointments/mobile/available

Tickets en estado `pending`, `confirmed` o `waiting` cuyo servicio pertenece a una categoría con `is_mobile=true`.

**Query:** `skip`, `limit`, `branch_id`, `start_date`, `end_date`, `search`

### GET /agenda/appointments/{appointment_id}

### POST /agenda/appointments

```json
{
  "client_id": 15,
  "professional_id": null,
  "service_id": 4,
  "service_ids": [4, 9],
  "branch_id": 1,
  "sale_id": null,
  "is_ia": false,
  "start_time": "2026-05-20T10:00:00",
  "end_time": "2026-05-20T11:00:00",
  "status": "pending"
}
```

- `service_ids`: varios servicios en un mismo ticket.
- `ticket_code`: generado automáticamente (ej. `B1-20260520-0008`).
- `created_by_id`: asignado en backend al usuario autenticado.

### PUT /agenda/appointments/{appointment_id}

Actualización parcial (`AppointmentUpdate`).

### POST /agenda/appointments/call-next

Toma el ticket más antiguo en `pending` o `confirmed` de la sucursal y lo pasa a `in_service`.

```json
{
  "branch_id": 1,
  "professional_id": 8
}
```

### DELETE /agenda/appointments/{appointment_id}

### Respuesta `AppointmentResponse` (ejemplo)

```json
{
  "id": 220,
  "ticket_code": "B1-20260520-0008",
  "client_id": 15,
  "created_by_id": 1,
  "professional_id": 8,
  "service_id": 4,
  "service_ids": [4, 9],
  "branch_id": 1,
  "sale_id": null,
  "is_ia": false,
  "start_time": "2026-05-20T10:00:00",
  "end_time": "2026-05-20T11:00:00",
  "status": "in_service",
  "client": {
    "id": 15,
    "name": "Ana",
    "last_name": "López",
    "status": "en_servicio"
  },
  "professional": { "id": 8, "username": "operaria1", "email": "operaria1@elashes.com" },
  "service": {
    "id": 4,
    "name": "Lifting",
    "price": 150.0,
    "category": { "id": 2, "name": "Móvil", "is_mobile": true }
  },
  "services": [
    { "id": 4, "name": "Lifting", "price": 150.0 },
    { "id": 9, "name": "Retoque", "price": 80.0 }
  ],
  "branch": { "id": 1, "name": "Sucursal Principal" }
}
```

---

## Catálogos de diseño

**Prefijo:** `/catalogs`  
**Permisos catálogo visual:** `catalog:view` · `catalog:manage`

Recursos: `eye-types`, `effects`, `volumes`, `lash-designs`.

Patrón CRUD en cada uno: `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}`.

**Query listados:** `skip`, `limit` (máx. 500)

**Tipo de ojo — POST:**
```json
{
  "name": "Almendrado",
  "description": "Ojo almendrado",
  "image": "data:image/png;base64,..."
}
```

**Efecto — POST:** `{ "name": "Natural", "image": "..." }`

**Volumen — POST:** `{ "name": "2D", "description": "...", "image": "..." }`

**Diseño — POST:** `{ "name": "Cat eye", "image": "..." }`

---

## Cuestionarios (formularios)

**Rutas:** `/catalogs/questionnaires`  
**Permisos:** `forms:view` · `forms:manage` (no usa `catalog:*`)

### GET /catalogs/questionnaires

`skip`, `limit`, `is_active` (bool opcional)

### POST /catalogs/questionnaires

```json
{
  "title": "Ficha de salud",
  "description": "Antes del servicio",
  "is_active": true,
  "questions": [
    {
      "text": "¿Tiene alergias?",
      "question_type": "bool",
      "is_required": true,
      "sort_order": 1
    },
    {
      "text": "Observaciones",
      "question_type": "text",
      "is_required": false,
      "sort_order": 2
    }
  ]
}
```

---

## Seguimiento de clientas

**Prefijo:** `/tracking`

### GET /tracking/client/{client_id}/latest

Último registro de seguimiento de la clienta.

### POST /tracking/

```json
{
  "client_id": 15,
  "appointment_id": 220,
  "branch_id": 1,
  "professional_id": 8,
  "eye_type_id": 2,
  "effect_id": 1,
  "volume_id": 3,
  "lash_design_id": 5,
  "questionnaire_id": 1,
  "design_notes": "Natural volumen medio",
  "last_application_date": "2026-05-15T14:00:00",
  "questionnaire_responses": {
    "alergias": false,
    "observaciones": "Ninguna"
  }
}
```

---

## Pagos

**Prefijo:** `/payments`

### GET /payments/

`skip`, `limit`, `client_id`, `appointment_id`, `branch_id`, `method`, `status_filter`

### POST /payments/

```json
{
  "client_id": 15,
  "branch_id": 1,
  "appointment_id": 220,
  "sale_id": null,
  "amount": 150.0,
  "method": "cash",
  "status": "paid",
  "reference": "REC-001",
  "notes": "Pago en caja",
  "paid_at": "2026-05-20T12:00:00"
}
```

Si `paid_at` se omite, el servidor usa la fecha actual. `registered_by_id` = usuario autenticado.

### Respuesta `PaymentResponse`

Incluye `client`, `branch`, `registered_by`.

---

## POS — ventas

**Prefijo:** `/pos-sales`

### POST /pos-sales/

Crea venta + pagos + citas (salvo `sale_without_appointments`).

```json
{
  "client_id": 15,
  "branch_id": 1,
  "payment_method": "cash",
  "discount_type": "percent",
  "discount_value": 10,
  "notes": "Promo mayo",
  "items": [
    {
      "service_id": 4,
      "professional_id": 8,
      "is_ia": false,
      "start_time": "2026-05-20T10:00:00",
      "end_time": "2026-05-20T11:00:00",
      "branch_id": 1
    }
  ],
  "link_appointment_id": null,
  "sale_without_appointments": false
}
```

| Campo | Descripción |
|-------|-------------|
| `link_appointment_id` | Enlaza venta a cita existente |
| `sale_without_appointments` | Solo cobro, sin crear citas |

### PATCH /pos-sales/{sale_id}

Actualiza `client_id`, descuento, `payment_method`, `notes`, `status` (`paid` \| `cancelled`).

### POST /pos-sales/{sale_id}/cancel

Marca venta y pagos asociados como cancelados.

### DELETE /pos-sales/{sale_id}

**204** sin cuerpo.

### GET /pos-sales/{sale_id}/receipt/pdf

| Query | Valores |
|-------|---------|
| `format` | `a4` (default), `thermal` |

Respuesta: `application/pdf` (descarga).

### Respuesta `PosSaleResponse`

```json
{
  "id": 50,
  "sale_code": "V-20260520-0012",
  "client_id": 15,
  "branch_id": 1,
  "subtotal": 230.0,
  "discount_type": "percent",
  "discount_value": 10,
  "total": 207.0,
  "payment_method": "cash",
  "status": "paid",
  "created_at": "2026-05-20T12:00:00",
  "client": { "id": 15, "name": "Ana", "last_name": "López" },
  "appointments": [],
  "payments": []
}
```

---

## Inventario

**Prefijo:** `/inventory`

### Categorías — `/inventory/categories`

CRUD: `name`, `description` (opcional).

### Productos — `/inventory/products`

**GET query:** `skip`, `limit`, `category_id`, `active_only`

**POST:**
```json
{
  "sku": "PEG-001",
  "name": "Pegamento profesional",
  "category_id": 1,
  "price": 45.0,
  "cost": 20.0,
  "status": true,
  "image_url": null,
  "initial_stock": 10,
  "branch_id": 1
}
```

`initial_stock` crea lote inicial en la sucursal indicada.

### Lotes — `/inventory/batches`

**POST:**
```json
{
  "product_id": 1,
  "branch_id": 1,
  "quantity": 50,
  "cost_per_unit": 20.0,
  "sale_price_per_unit": 45.0
}
```

**PUT:** solo `cost_per_unit`, `sale_price_per_unit`.

### Movimientos — `/inventory/movements`

**POST:**
```json
{
  "product_id": 1,
  "batch_id": 3,
  "branch_id": 1,
  "movement_type": "out",
  "quantity": 2,
  "note": "Uso en servicio"
}
```

Tipos: `in`, `out`, `adjustment`, `service_use`.

### Stock — GET /inventory/stock-summary

`branch_id`, `product_id` opcionales.

```json
[
  {
    "product_id": 1,
    "product_name": "Pegamento",
    "product_sku": "PEG-001",
    "branch_id": 1,
    "branch_name": "Sucursal Principal",
    "total_stock": 48.0
  }
]
```

---

## Dashboard y reportes

### GET /dashboard/overview

**Permisos (cualquiera):** `payments:view`, `appointments:view`, `inventory:view`, `branches:view`, `catalog:view`

**Query:** `from`, `to` (`YYYY-MM-DD`), `branch_id`, `service_id`, `low_stock_threshold` (default 5)

**Respuesta:**
```json
{
  "period": { "from": "2026-05-01", "to": "2026-05-20" },
  "scope": {
    "branch_id": 1,
    "branch_name": "Sucursal Principal",
    "service_id": null
  },
  "cards": {
    "clients_total": 500,
    "clients_with_activity": 120,
    "appointments_total": 85,
    "appointments_pending": 12,
    "appointments_confirmed": 8,
    "appointments_completed": 60,
    "appointments_cancelled": 5,
    "payments_paid_total": 15000.0,
    "payments_count": 80,
    "avg_payment": 187.5,
    "pos_sales_count": 45,
    "active_employees": 6,
    "services_count": 12,
    "products_active_count": 30,
    "low_stock_items": 3
  }
}
```

### GET /dashboard/revenue-series

`group_by`: `day` | `month`

```json
{
  "group_by": "day",
  "series": [
    { "bucket": "2026-05-20", "paid_amount": 1200.0, "payments_count": 8 }
  ]
}
```

### GET /dashboard/service-distribution

`limit` (1–20, default 8). Filas con `service_id`, `service_name`, `tickets_count`, `completed_count`, `estimated_revenue`.

### GET /dashboard/inventory-distribution

Stock por producto (`product_id`, `product_name`, `total_stock`).

### Reportes CSV

| Ruta | Filtros principales |
|------|---------------------|
| `/reports/payments.csv` | `from`, `to`, `branch_id`, `service_id`, `method`, `status_filter` |
| `/reports/tickets.csv` | `from`, `to`, `branch_id`, `service_id`, `status_filter` |
| `/reports/pos-sales.csv` | `from`, `to`, `branch_id`, `service_id`, `payment_method`, `status_filter` |

Respuesta: archivo CSV descargable.

---

## Administración

**Prefijo:** `/admin` · **Rol:** `SuperAdmin`

### Permisos

```json
{ "name": "custom:action" }
```

### Roles

**Crear:**
```json
{
  "name": "Recepcion",
  "permission_ids": [1, 2, 5, 9, 10]
}
```

**Actualizar:** `name`, `permission_ids` (opcionales).

### Usuarios

**GET /admin/users** — `skip`, `limit`, `search`

**Crear:**
```json
{
  "username": "nueva_operaria",
  "email": "op@elashes.com",
  "phone": "+59179876543",
  "password": "clave123",
  "role_id": 2,
  "branch_id": 1,
  "is_active": true
}
```

**Actualizar:** campos opcionales + `password` para reset.

No puedes eliminar tu propio usuario (`current_user_id` validado en servicio).

---

## Permisos y roles

### Listado de permisos

`clients:view` · `clients:manage` · `catalog:view` · `catalog:manage` · `tracking:view` · `tracking:manage` · `forms:view` · `forms:manage` · `users:manage` · `settings:view` · `payments:view` · `payments:manage` · `inventory:view` · `inventory:manage` · `services:view` · `services:manage` · `appointments:view` · `appointments:manage` · `branches:view` · `branches:manage`

### Roles por defecto

| Rol | Acceso resumido |
|-----|-----------------|
| **SuperAdmin** | Todos los permisos + `/admin/*` |
| **Operaria** | Clientes, catálogo, tracking, formularios, servicios, tickets, pagos (ver), sucursales (ver) |
| **Secretaria** | Clientes, tracking, formularios (ver), pagos, servicios, tickets, sucursales (ver) |
| **EncargadaAlmacen** | Inventario, catálogo (ver), sucursales (ver) |

---

## Códigos de estado HTTP (Parte 2)

| Código | Uso |
|--------|-----|
| 200 | OK |
| 201 | Creado |
| 204 | Sin contenido (DELETE POS) |
| 400 | Validación de negocio |
| 401 | Token inválido |
| 403 | Sin permiso / usuario inactivo |
| 404 | No encontrado |
| 422 | Error Pydantic (campos) |
| 500 | Error interno |

**Error 500 (handler global):**
```json
{
  "detail": "mensaje del error",
  "type": "NombreExcepcion"
}
```

**Error 403:**
```json
{ "detail": "Se requiere el permiso: appointments:manage" }
```

---

## Ejemplos frontend

### Login + petición autenticada

```javascript
const loginRes = await fetch("http://127.0.0.1:8000/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "admin123" }),
});
const { access_token } = await loginRes.json();

const clientsRes = await fetch("http://127.0.0.1:8000/clients/?limit=20", {
  headers: { Authorization: `Bearer ${access_token}` },
});
```

### Tickets móviles disponibles

```javascript
const res = await fetch(
  "http://127.0.0.1:8000/agenda/appointments/mobile/available?branch_id=1&start_date=2026-05-20&end_date=2026-05-20",
  { headers: { Authorization: `Bearer ${token}` } }
);
```

### Subir imagen de servicio

```javascript
const form = new FormData();
form.append("file", fileInput.files[0]);
const res = await fetch("http://127.0.0.1:8000/agenda/services/upload-image", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const { image_url } = await res.json();
```

### Venta POS completa

```javascript
await fetch("http://127.0.0.1:8000/pos-sales/", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    client_id: 15,
    branch_id: 1,
    payment_method: "qr",
    discount_type: "amount",
    discount_value: 0,
    items: [
      {
        service_id: 4,
        professional_id: 8,
        start_time: "2026-05-20T14:00:00",
        end_time: "2026-05-20T15:00:00",
        branch_id: 1,
      },
    ],
  }),
});
```

---

## Apéndice — Parte 1 (reconocimiento facial)

La **Parte 1** de este documento (índice anterior) describe endpoints `/face/*` e `/items/*` pensados para reconocimiento facial y análisis de pestañas con Flutter. Esos routers **no están registrados** en `main.py` actual; existen pruebas en `tests/test_face_recognition.py`. Para activarlos habría que incluir el módulo facial en la aplicación FastAPI.

---

## Documentación relacionada

| Archivo | Contenido |
|---------|-----------|
| `TICKETS_AUTH_CLIENTS_API.md` | Guía rápida auth + clientes + tickets |
| `Documentation-API/` | Requests Bruno/OpenAPI |
| `elashes backend QA/` | Colecciones YAML de prueba |

---

*API Elashes Backend — Referencia Parte 2 completa · v1.0.0*
