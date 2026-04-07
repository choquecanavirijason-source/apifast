# API Tickets, Auth y Clientes

Base URL: `http://localhost:8000`

Documentacion interactiva:
- Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 1) Autenticacion

Todas las rutas protegidas usan header:

`Authorization: Bearer <access_token>`

### 1.1 Login

`POST /auth/login`

Request JSON:
```json
{
  "username": "admin",
  "password": "123456"
}
```

Response JSON (200):
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@elashes.com"
  },
  "expires_at": "2026-04-07T20:00:00+00:00",
  "expires_in_minutes": 480
}
```

### 1.2 Usuario actual

`GET /auth/me`

Response JSON (200):
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@elashes.com"
}
```

### 1.3 Estado de sesion

`GET /auth/session`

Response JSON (200):
```json
{
  "user": {
    "id": 1,
    "username": "admin"
  },
  "expires_at": "2026-04-07T20:00:00+00:00",
  "expires_in_minutes": 480,
  "remaining_seconds": 12345
}
```

### 1.4 Refresh token

`POST /auth/refresh`

Response JSON (200):
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "admin"
  },
  "expires_at": "2026-04-07T22:00:00+00:00",
  "expires_in_minutes": 480
}
```

---

## 2) Clientes

### 2.1 Listar y buscar clientes

`GET /clients/`

Query params:
- `skip` (int)
- `limit` (int)
- `search` (string): busca por nombre, apellido, telefono, etc.
- `branch_id` (int)

Ejemplo:
`GET /clients/?skip=0&limit=20&search=ana&branch_id=1`

Response JSON (200):
```json
[
  {
    "id": 15,
    "name": "Ana",
    "last_name": "Lopez",
    "phone": "+59177777777",
    "branch_id": 1
  }
]
```

### 2.2 Obtener cliente por id

`GET /clients/{client_id}`

### 2.3 Crear cliente

`POST /clients/`

Request JSON (ejemplo):
```json
{
  "name": "Maria",
  "last_name": "Perez",
  "phone": "+59170000000",
  "branch_id": 1
}
```

### 2.4 Actualizar cliente

`PUT /clients/{client_id}`

### 2.5 Eliminar cliente

`DELETE /clients/{client_id}`

---

## 3) Tickets (Agenda)

Permiso requerido:
- Ver: `appointments:view`
- Crear/editar/eliminar/call-next: `appointments:manage`

### 3.1 Listar tickets (general + historial)

`GET /agenda/appointments`

Query params disponibles:
- `skip`, `limit`
- `client_id`
- `professional_id`
- `service_id`
- `branch_id`
- `status_filter` (`pending`, `confirmed`, `waiting`, `in_service`, `completed`, `cancelled`)
- `ticket_code`
- `client_name`
- `search` (codigo o nombre de cliente)
- `start_date` (`YYYY-MM-DD`)
- `end_date` (`YYYY-MM-DD`)
- `is_ia` (true/false)

Ejemplos de historial:
- Historial del dia:
`GET /agenda/appointments?start_date=2026-04-07&end_date=2026-04-07`
- Solo IA:
`GET /agenda/appointments?is_ia=true`
- Finalizados de una sucursal:
`GET /agenda/appointments?branch_id=1&status_filter=completed&start_date=2026-04-01&end_date=2026-04-30`

### 3.2 NUEVO: Tickets disponibles con servicio movil

`GET /agenda/appointments/mobile/available`

Retorna tickets disponibles (estados `pending`, `confirmed`, `waiting`) que tengan al menos un servicio cuya categoria tenga `is_mobile=true`.

Query params:
- `skip`, `limit`
- `branch_id`
- `start_date`, `end_date`
- `search` (codigo o cliente)

Ejemplo:
`GET /agenda/appointments/mobile/available?branch_id=1&start_date=2026-04-07&end_date=2026-04-07`

Response JSON (200):
```json
[
  {
    "id": 220,
    "ticket_code": "B1-20260407-0008",
    "client_id": 15,
    "professional_id": null,
    "service_id": 4,
    "service_ids": [4, 9],
    "branch_id": 1,
    "sale_id": null,
    "is_ia": true,
    "start_time": "2026-04-07T10:00:00",
    "end_time": "2026-04-07T11:00:00",
    "status": "pending",
    "client": {
      "id": 15,
      "name": "Ana",
      "last_name": "Lopez"
    },
    "professional": null,
    "service": {
      "id": 4,
      "name": "Lifting",
      "category": {
        "id": 2,
        "name": "Movil",
        "is_mobile": true
      }
    },
    "services": [
      {
        "id": 4,
        "name": "Lifting"
      },
      {
        "id": 9,
        "name": "Retoque"
      }
    ],
    "branch": {
      "id": 1,
      "name": "Sucursal Centro"
    }
  }
]
```

### 3.3 Obtener ticket por id

`GET /agenda/appointments/{appointment_id}`

### 3.4 Crear ticket

`POST /agenda/appointments`

Request JSON (ejemplo):
```json
{
  "client_id": 15,
  "professional_id": null,
  "service_id": 4,
  "service_ids": [4, 9],
  "branch_id": 1,
  "sale_id": null,
  "is_ia": true,
  "start_time": "2026-04-07T10:00:00",
  "end_time": "2026-04-07T11:00:00",
  "status": "pending"
}
```

### 3.5 Actualizar ticket (estado, operaria, horario, IA)

`PUT /agenda/appointments/{appointment_id}`

#### 3.5.1 Cambio de estado
Request JSON:
```json
{
  "status": "in_service"
}
```

#### 3.5.2 Asignacion de operaria
Request JSON:
```json
{
  "professional_id": 8
}
```

#### 3.5.3 Cambio de horario
Request JSON:
```json
{
  "start_time": "2026-04-07T11:30:00",
  "end_time": "2026-04-07T12:30:00"
}
```

#### 3.5.4 Marcar/desmarcar IA
Request JSON:
```json
{
  "is_ia": true
}
```

#### 3.5.5 Actualizacion combinada
Request JSON:
```json
{
  "professional_id": 8,
  "status": "in_service",
  "is_ia": true
}
```

### 3.6 Llamar siguiente ticket

`POST /agenda/appointments/call-next`

Request JSON:
```json
{
  "branch_id": 1,
  "professional_id": 8
}
```

### 3.7 Eliminar ticket

`DELETE /agenda/appointments/{appointment_id}`

Response JSON (200):
```json
{
  "message": "Cita eliminada correctamente"
}
```

---

## 4) JSON rapido para consumir en frontend

### 4.1 Login + guardar token

```js
const loginRes = await fetch("http://localhost:8000/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "123456" })
});
const loginData = await loginRes.json();
localStorage.setItem("token", loginData.access_token);
```

### 4.2 Buscar clientes

```js
const token = localStorage.getItem("token");
const res = await fetch("http://localhost:8000/clients/?search=ana&limit=20", {
  headers: { Authorization: `Bearer ${token}` }
});
const clients = await res.json();
```

### 4.3 Historial de tickets

```js
const token = localStorage.getItem("token");
const res = await fetch(
  "http://localhost:8000/agenda/appointments?branch_id=1&start_date=2026-04-01&end_date=2026-04-30",
  { headers: { Authorization: `Bearer ${token}` } }
);
const ticketsHistory = await res.json();
```

### 4.4 Tickets moviles disponibles

```js
const token = localStorage.getItem("token");
const res = await fetch(
  "http://localhost:8000/agenda/appointments/mobile/available?branch_id=1&start_date=2026-04-07&end_date=2026-04-07",
  { headers: { Authorization: `Bearer ${token}` } }
);
const mobileAvailableTickets = await res.json();
```

### 4.5 Asignar operaria y cambiar estado

```js
const token = localStorage.getItem("token");
await fetch("http://localhost:8000/agenda/appointments/220", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    professional_id: 8,
    status: "in_service"
  })
});
```

---

## 5) Notas importantes

- `is_ia` viene desde backend en la entidad `Appointment` y se expone en API.
- El endpoint nuevo de moviles solo incluye tickets en estado disponible.
- Para trazabilidad (historial), usa rangos de fechas y filtros por sucursal/estado.
- Si quieres, el siguiente paso puede ser generar una coleccion Postman/OpenAPI focalizada solo en Auth + Clientes + Tickets.
