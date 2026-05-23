# Prompt / especificación: replicar adminElashes en Flutter

> **Uso:** Copia y pega este documento completo (o por secciones) en Cursor, ChatGPT, Claude, etc., para generar una app Flutter equivalente al panel admin **adminElashes**, conectada al backend **elashesbackend** (FastAPI).

---

## 1. Contexto del proyecto

**adminElashes** es el panel web de administración de un salón de extensiones de pestañas (Elashes). Está hecho con:

| Capa | Tecnología |
|------|------------|
| UI | React 19 + TypeScript + Vite 7 |
| Estilos | Tailwind CSS 4 (verde oscuro `#094732`, sidebar `#031910`) |
| Estado global | Redux Toolkit (`auth` reducer) |
| HTTP | Axios (`baseURL` desde `VITE_API_URL`, default `http://localhost:8000`) |
| Rutas | React Router 7 (`PrivateRoute` / `GuestRoute`) |
| Gráficos | Recharts |
| PDF/Excel | jsPDF, jspdf-autotable, xlsx |
| Notificaciones | react-toastify |
| Desktop opcional | Tauri CLI en `package.json` |

**Backend activo:** `elashesbackend` — API REST Parte 2 (auth, clientes, agenda, POS, inventario, dashboard). Documentación: `elashesbackend/API_DOCUMENTATION.md` y `API_PART2_FULL.md`.

**Objetivo Flutter:** App móvil/tablet (y opcional desktop) con las mismas secciones, mismos endpoints y flujos de negocio, adaptando UI a Material 3 / Cupertino según plataforma.

---

## 2. Autenticación y sesión

### Endpoints

```
POST /auth/login     → { username, password } → access_token + user
GET  /auth/me        → usuario actual (Bearer)
GET  /auth/session
POST /auth/refresh
POST /auth/logout
POST /auth/register
```

### Almacenamiento local (web actual)

| Clave | Uso |
|-------|-----|
| `_tkn` | JWT access token |
| `user_data` | JSON usuario |
| `user_roles` | roles |
| `user_permissions` | permisos |
| `session_expires_at` | expiración ISO |
| `selected_branch_id` | sucursal activa (evento `branchchange`) |

### Interceptor HTTP

Todas las peticiones autenticadas llevan:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Rutas protegidas

- Sin token → redirigir a **Login** (`/login`).
- Con token → layout principal con sidebar.
- Timeout por inactividad: aviso a las 2 h, logout a las 3 h (opcional en Flutter).

### Permisos (sidebar y pantallas)

Formato backend: `recurso:accion` (ej. `clients:view`, `services:manage`).  
`SuperAdmin` ve todo; otros roles filtran menú por `hasPermissionByName`.

Permisos usados en menú:

- `clients:view`, `clients:manage`
- `catalog:view`, `catalog:manage`
- `services:view`, `services:manage`
- `payments:view`, `payments:manage`
- `appointments:view`, `appointments:manage`
- `inventory:view`, `inventory:manage`
- `branches:view`, `branches:manage`
- `forms:view`, `forms:manage`
- `settings:view`

---

## 3. Mapa completo de rutas y menú

### Rutas públicas (guest)

| Ruta | Pantalla | Descripción |
|------|----------|-------------|
| `/login` | Login | Usuario + contraseña |
| `/register` | Register | Registro (si está habilitado) |

### Rutas privadas (layout con sidebar)

| Ruta | Archivo React | Módulo |
|------|---------------|--------|
| `/` | `pages/Dashboard.tsx` | Dashboard KPIs y gráficos |
| `/clients` | `pages/admin/clients/Main.tsx` | Lista CRUD clientes |
| `/effects` | `pages/Effects.tsx` | Catálogo efectos |
| `/lash-designs` | `pages/LashDesigns.tsx` | Tecnología / diseños lash |
| `/eye-types` | `pages/EyeTypes.tsx` | Tipos de ojo |
| `/designs` | `pages/Designs.tsx` | Diseños |
| `/volumen` | `pages/admin/Volumen.tsx` | Volúmenes |
| `/users` | `pages/Users.tsx` | Usuarios admin (SuperAdmin) |
| `/settings` | `pages/Settings.tsx` | Ajustes app |
| `/questionnaire` | `pages/admin/Questionnaire/index.tsx` | Cuestionarios |
| `/lash-tracking` | `pages/admin/follow-up/pages/FollowUpPage.tsx` | Seguimiento clientas |
| `/admin/products` | `pages/admin/products/Main.tsx` | Inventario productos |
| `/admin/salons` | `pages/admin/salons/Main.tsx` | Sucursales |
| `/admin/services` | `pages/admin/services/Main.tsx` | Catálogo servicios |
| `/admin/services/categories` | (misma página, tab) | Categorías de servicio |
| `/admin/services/queue` | `pages/admin/control-de-servicios/queue/index.tsx` | Cola de servicios |
| `/admin/turns` | `pages/admin/control-de-servicios/TurnScreen.tsx` | Pantalla de turnos |
| `/admin/tickets` | `pages/admin/tickets/Main.tsx` | Tickets activos |
| `/admin/tickets/finalizados` | `pages/admin/pos-tracking/CompletedTicketsHistory.tsx` | Tickets finalizados |
| `/admin/professionals/history` | `pages/admin/professionals/History.tsx` | Historial servicios por profesional |
| `/admin/professionals/tickets` | `pages/admin/professionals/TicketsHistory.tsx` | Historial tickets |
| `/admin/calendar` | `pages/admin/calendar/Main.tsx` | Calendario mensual / citas |
| `/admin/calendar/citas` | (alias calendario) | Vista citas |
| `/admin/calendar/agenda` | `pages/admin/calendar/DailyAgendaPage.tsx` | Agenda del día (planilla) |
| `/admin/pos` | `pages/admin/pos/Main.tsx` | POS nueva venta |
| `/admin/pos/history` | `pages/admin/pos/Main.tsx` (section=history) | Historial ventas POS |
| `/admin/pos-tracking` | `pages/admin/pos-tracking/PosTrackingHub.tsx` | Hub: caja + cola + calendario + agenda |
| `/admin/pos-tracking/queue` | (tab hub) | Cola dentro del hub |
| `/admin/pos-tracking/calendar` | (tab hub) | Calendario en hub |
| `/admin/pos-tracking/agenda` | (tab hub) | Agenda del día en hub |
| `/admin/pos-tracking/tracking` | (tab hub) | Seguimiento técnico |

### Accesos rápidos (Dashboard / SecretariaDesktop)

- Clientes → `/clients`
- Tickets → `/admin/tickets`
- Calendario → `/admin/calendar`
- Agenda del día → `/admin/calendar/agenda`
- Caja & seguimiento → `/admin/pos-tracking`
- Cola → `/admin/services/queue`
- POS → `/admin/pos`

---

## 4. Arquitectura recomendada en Flutter

```
lib/
  main.dart
  app.dart                    # MaterialApp + rutas
  core/
    config/env.dart           # API_URL
    network/dio_client.dart   # Dio + interceptors Bearer
    storage/secure_storage.dart
    utils/branch_context.dart # sucursal seleccionada
    theme/app_theme.dart      # primary #094732
  features/
    auth/
    dashboard/
    clients/
    catalog/                  # effects, eye-types, designs, volumen, lash-designs
    services/
    tickets/
    calendar/
    pos/
    inventory/
    branches/
    users/
    questionnaire/
    tracking/
    settings/
  shared/
    widgets/data_table.dart
    widgets/stat_card.dart
    widgets/confirm_dialog.dart
    widgets/filter_bar.dart
```

**Paquetes sugeridos:** `dio`, `flutter_riverpod` o `bloc`, `go_router`, `flutter_secure_storage`, `intl`, `fl_chart`, `pdf` / `printing`, `cached_network_image`, `image_picker`.

**Patrón por feature:** `data/` (api + models) → `domain/` (repositories) → `presentation/` (screens + controllers).

---

## 5. Servicios API (capa data) — resumen por módulo

### 5.1 Clientes — `ClientService`

| Método | Endpoint |
|--------|----------|
| GET | `/clients/?skip&limit&search&branch_id` |
| GET | `/clients/{id}` |
| POST | `/clients/` |
| PUT | `/clients/{id}` |
| DELETE | `/clients/{id}` |
| GET | `/catalogs/eye-types` (selector tipo ojo) |

**Modelo UI (`IClient`):**

```dart
class Client {
  int id;
  String nombre;      // API: name
  String apellido;    // API: last_name
  int edad;           // API: age
  String tipoOjos;    // eye_type.name
  int? eye_type_id;
  int? branch_id;
  String? phone;
  int visitas;        // visit_count
  String status;      // en_servicio, reserva, pagado, etc.
}
```

**Pantalla actual (`/clients`):**

- Tabla con búsqueda global, filtros por columna, paginación (5/10/20/50).
- Tabs: Lista general | Clientes frecuentes (`visitas > 5`).
- Acciones: **Editar**, **Eliminar** (sin ventas/tickets/ficha/pagos — simplificado).
- Modal crear/editar: nombre, apellido, edad, teléfono (+ código país), sexo, tipo de ojo, sucursal.
- Export PDF listado.
- Stats: total clientes, clientes frecuentes.
- Filtro por `branch_id` desde sucursal global.

---

### 5.2 Catálogos de diseño — `CatalogService` + páginas `Effects`, `EyeTypes`, etc.

| Recurso | GET list | CRUD |
|---------|----------|------|
| Tipos de ojo | `/catalogs/eye-types` | POST/PUT/DELETE según API |
| Efectos | `/catalogs/effects` | idem |
| Volúmenes | `/catalogs/volumes` | idem |
| Diseños lash | `/catalogs/lash-designs` | idem |
| Diseños | página Designs | catálogo relacionado |

Cada pantalla: **DataTable** o grid de cards, modal crear/editar (nombre, descripción, imagen opcional), permiso `catalog:manage`.

---

### 5.3 Cuestionarios — `/questionnaire`

| Método | Endpoint |
|--------|----------|
| GET | `/catalogs/questionnaires` |
| GET | `/catalogs/questionnaires/{id}` |
| POST | `/catalogs/questionnaires` |
| PUT | `/catalogs/questionnaires/{id}` |

Preguntas embebidas: `text`, `question_type` (`text|number|bool|select|multi_select`), `is_required`, `sort_order`.

---

### 5.4 Sucursales — `/admin/salons`

| Método | Endpoint |
|--------|----------|
| GET | `/branches/` |
| CRUD | `/branches/{id}` |

Campos típicos: nombre, dirección, teléfono, activo. Permiso `branches:view` / `branches:manage`.

---

### 5.5 Servicios y categorías — `AgendaService`

**Categorías:** `/services/categories` (no bajo `/agenda`).

**Servicios:** `/agenda/services`

| Acción | Endpoint |
|--------|----------|
| Listar servicios | GET `/agenda/services?branch_id&category_id` |
| Crear/actualizar/borrar | POST/PUT/DELETE `/agenda/services/{id}` |
| Subir imagen servicio | POST `/agenda/services/upload-image` (multipart) |
| Categorías CRUD | `/services/categories` + upload-image |
| Selectores | GET `/agenda/clients-for-select`, `/agenda/professionals-for-select` |

**Modelo servicio:**

```dart
class ServiceOption {
  int id;
  String name;
  String? description;
  String? image_url;
  int? category_id;
  int duration_minutes;
  double price;
  List<int>? branch_ids;
}
```

**Pantalla `/admin/services`:**

- Tab catálogo: cards o tabla de servicios, filtros por categoría/sucursal.
- Tab categorías: CRUD categorías + flag `is_mobile`.
- Modal formulario servicio con imagen, precio, duración, sucursales.

---

### 5.6 Agenda, tickets y citas — `AgendaService`

| Acción | Endpoint |
|--------|----------|
| Listar tickets/citas | GET `/agenda/appointments` (filtros: `client_id`, `status_filter`, `branch_id`, fechas, `search`, `ticket_code`) |
| Crear cita/ticket | POST `/agenda/appointments` |
| Actualizar | PUT `/agenda/appointments/{id}` |
| Disponibilidad móvil | GET `/agenda/appointments/mobile/available` |

**Estados ticket/cita:** `reserva`, `en_espera`, `en_servicio`, `siendo_atendido`, `atendido`, `pagado`, `finalizado`, `cancelado`, `no_se_presento`, `reagendado`.

**Modelo ticket (`TicketItem`):**

```dart
class TicketItem {
  int id;
  String? ticket_code;
  int client_id;
  String client_name;
  String? client_phone;
  int? professional_id;
  String? professional_name;
  int? service_id;
  List<int>? service_ids;
  String? service_name;
  List<String>? service_names;
  double? service_price;
  List<double>? service_prices;
  DateTime start_time;
  DateTime end_time;
  String status;
  int? sale_id;  // venta POS vinculada
  String? branch_name;
  bool is_ia;
}
```

#### Pantalla Tickets (`/admin/tickets`)

- Lista tickets activos con filtros (estado, sucursal, búsqueda).
- Acciones: cambiar estado, asignar profesional, vincular pago, abrir en cola.
- Pantalla finalizados: histórico con filtros de fecha.

#### Cola de servicios (`/admin/services/queue`)

- Vista operativa del día: tickets en espera → en servicio → atendidos.
- Integración con pagos y turnos.
- Navegación desde POS o secretaría.

#### TurnScreen (`/admin/turns`)

- Pantalla fullscreen para TV/monitor de turnos llamados.

#### Calendario (`/admin/calendar`)

- Vista mensual/semanal de citas.
- Crear/editar cita: cliente, servicio(s), profesional, sucursal, `start_time`/`end_time` ISO local.

#### Agenda del día (`/admin/calendar/agenda`)

- Planilla diaria (~1300 líneas en React): franjas horarias, profesionales, reservas sin venta POS, drag o acciones rápidas.
- **Crítico para Flutter:** replicar vista día con columnas por profesional o por hora.

---

### 5.7 POS — ventas — `PosSaleService`

| Método | Endpoint |
|--------|----------|
| Listar | GET `/pos-sales/?client_id&branch_id&status&from&to` |
| Detalle | GET `/pos-sales/{id}` |
| Crear venta | POST `/pos-sales/` |
| Actualizar | PUT `/pos-sales/{id}` |
| Cancelar | POST `/pos-sales/{id}/cancel` |
| PDF comprobante | GET `/pos-sales/{id}/receipt.pdf` |

**Payload crear venta:**

```json
{
  "client_id": 1,
  "branch_id": 1,
  "payment_method": "cash|card|transfer|qr",
  "discount_type": "amount|percent",
  "discount_value": 0,
  "notes": "",
  "items": [
    {
      "service_id": 2,
      "professional_id": 5,
      "is_ia": false,
      "start_time": "2026-05-20T10:00:00",
      "end_time": "2026-05-20T11:30:00",
      "branch_id": 1
    }
  ],
  "link_appointment_id": null,
  "sale_without_appointments": false
}
```

**Flujo POS (`/admin/pos`):**

1. **Paso 1:** elegir categoría → servicios → carrito (`CartLine`: servicio, profesional, hora, `is_ia`, precio).
2. **Drawer:** cliente (buscar o registrar), método de pago, descuento, notas.
3. **Vista previa tickets:** al checkout se crean citas/tickets en agenda (salvo `link_appointment_id` para cobrar reserva existente).
4. **Paso 2:** confirmación, comprobante PDF, códigos de ticket generados.
5. **Historial:** tabla ventas con filtros, detalle, cancelación, reimpresión.
6. Borrador local por sucursal (`pos-sale-draft-v1:{branchId}`).

**Moneda:** BOB (`es-BO`), formato `Intl` / `NumberFormat` en Flutter.

---

### 5.8 Pagos — `PaymentService`

| Método | Endpoint |
|--------|----------|
| Listar | GET `/payments/` |
| Por cliente | GET `/payments/?client_id=` o endpoint dedicado |
| Crear | POST `/payments/` |

Campos: `client_id`, `appointment_id` (ticket), `amount`, `method`, `status` (`paid`), `paid_at`.

Usado en cola, tickets y (antes) modal pagos en clientes.

---

### 5.9 Inventario — `ProductService`, `CategoryService`

| Recurso | Prefijo |
|---------|---------|
| Categorías producto | `/inventory/categories` |
| Productos | `/inventory/products` |
| Lotes | `/inventory/batches` |
| Movimientos | `/inventory/movements` |
| Stock resumen | `/inventory/stock-summary` |

**Pantalla productos:** tabla SKU, nombre, categoría, precio, costo, stock, imagen, filtros `branch_id`, alertas stock bajo.

---

### 5.10 Dashboard — `DashboardService`

| Endpoint | Uso |
|----------|-----|
| GET `/dashboard/overview?from&to&branch_id&service_id` | KPIs cards |
| GET `/dashboard/revenue-series?group_by=day\|month` | gráfico barras ingresos |
| GET `/dashboard/service-distribution` | pie servicios |
| GET `/dashboard/inventory-distribution` | stock por producto |
| GET `/reports/*.csv` | export CSV |

**KPIs típicos:** clientes totales, citas por estado, pagos, ventas POS, empleados activos, productos, stock bajo.

**Pantalla Dashboard:** filtros fecha desde/hasta, sucursal, servicio; StatCards; gráficos Recharts → en Flutter usar `fl_chart`; export Excel/PDF de secciones.

---

### 5.11 Seguimiento clientas — `TrackingService` + `FollowUpPage`

| Método | Endpoint |
|--------|----------|
| CRUD | `/tracking/` |
| Registro | POST `/tracking/register` (desde cliente) |

Pantalla `/lash-tracking`: historial de aplicaciones/seguimiento por `clientId` query param.

---

### 5.12 Usuarios y roles — `/users` (SuperAdmin)

Prefijo API: `/admin/users`, `/admin/roles`, `/admin/permissions`.

Pantalla con tabs: usuarios, roles, permisos; asignación `permission_ids` a roles.

---

### 5.13 Ajustes — `/settings`

Preferencias de tema (light/ocean/dark), sucursal por defecto, configuración móvil — según implementación en `Settings.tsx`.

---

## 6. Componentes UI reutilizables (equivalente Flutter)

| React | Función | Widget Flutter sugerido |
|-------|---------|---------------------------|
| `Layout` + `AppSidebar` | Shell navegación | `Scaffold` + `NavigationRail` / `Drawer` |
| `DataTable` | Tabla paginada, sort, filtros, acciones | `PaginatedDataTable` o paquete `data_table_2` |
| `StatCard` | KPI numérico | `Card` + `ListTile` |
| `SectionCard` | Bloque contenido | `Card` con padding |
| `FilterActionBar` | Toolbar filtros + botones | `Row` + `Wrap` chips |
| `GenericModal` / modales feature | Formularios | `showModalBottomSheet` / `Dialog` |
| `ConfirmDialog` | Confirmar borrado | `AlertDialog` |
| `RegisterClientModal` | Alta cliente | `Form` en bottom sheet |
| `LoaderScreen` | Splash auth | `CircularProgressIndicator` |
| `EmptyState` | Sin datos | ilustración + texto |
| `generateTablePdf` | Export PDF tablas | paquete `pdf` |
| `toast` react-toastify | Feedback | `SnackBar` / `fluttertoast` |

**Colores marca:**

- Primary: `#094732`
- Sidebar fondo: `#031910`
- Acentos emerald/slate en badges de estado

---

## 7. Estado global y sucursal

- **Redux auth:** `user`, `isAuthenticated`, `permissions`, `roles`.
- **Sucursal activa:** `localStorage` key `selected_branch_id`; al cambiar, recargar listas con `branch_id`.
- En Flutter: `Provider`/`Riverpod` para `AuthNotifier` + `BranchNotifier`.

---

## 8. Flujos de negocio críticos (orden sugerido de implementación)

1. **Auth** → Login → Home Dashboard  
2. **Sucursales** → selector global  
3. **Clientes** CRUD  
4. **Servicios + categorías**  
5. **Tickets + cola**  
6. **Calendario + agenda del día**  
7. **POS venta + historial**  
8. **Pagos** (en cola/tickets)  
9. **Inventario productos**  
10. **Catálogos** (efectos, ojos, etc.)  
11. **Dashboard reportes**  
12. **Usuarios/roles** (admin)  
13. **Cuestionarios y seguimiento**

---

## 9. Interfaces y modelos — qué existe y qué debes crear

En **adminElashes (TypeScript)** los “interfaces” viven en `src/core/types/`, `src/core/services/*.ts` y tipos por página.  
En **Flutter** debes crear **clases Dart** (recomendado: `freezed` + `json_serializable`) y, opcionalmente, **contratos abstractos** (`abstract class XRepository`) para cada feature.

### Leyenda

| Símbolo | Significado |
|---------|-------------|
| ✅ **Existe** | Ya definido en adminElashes — réplicalo en Dart |
| 🆕 **Crear en Flutter** | No hay archivo TS dedicado o es solo UI — debes definirlo tú |
| 🔄 **Mapeo** | El JSON de la API usa `snake_case`; el modelo UI puede usar español/camelCase |

### Estructura de carpetas de modelos (Flutter)

```
lib/
  core/models/           # transversales (api, auth, pagination)
  features/
    clients/data/models/
    pos/data/models/
    agenda/data/models/
    ...
  features/*/domain/repositories/   # abstract class ...Repository
```

---

### 9.1 Core — transversales (obligatorias)

| Interface TS (origen) | Uso | Crear en Flutter |
|----------------------|-----|------------------|
| `IApiResponse<T>` | Envoltorio genérico respuesta | 🆕 `ApiResponse<T>` si el backend lo usa; muchos endpoints devuelven el array/objeto directo |
| `IApiError` | Errores HTTP | 🆕 `ApiException` con `message`, `statusCode`, `fieldErrors` |
| `IPagination` / `IPaginationRequest` | Listados paginados servidor | 🆕 `PaginationMeta`, `ListQueryParams` |
| `IAuth` | Usuario en sesión | ✅ `AuthUser` |
| `IAuthRequest` | Login/registro | ✅ `LoginRequest`, `RegisterRequest` |
| — | Token login | 🆕 `AuthTokenResponse` (`access_token`, `token_type`, `expires_in`) según API real |
| `IPermission` | Permiso string o objeto | ✅ `Permission` (`name: String`) |
| — | Sucursal activa | 🆕 `BranchContext` / `SelectedBranchState` |

**Dart — core (ejemplo):**

```dart
// lib/core/models/auth_user.dart
@JsonSerializable()
class AuthUser {
  final int id;
  final String? email;
  @JsonKey(name: 'full_name') final String? fullName;
  final List<String>? roles;
  final List<String>? permissions;
  @JsonKey(name: 'is_active') final bool? isActive;
}

// lib/core/models/login_request.dart
class LoginRequest {
  final String username; // email o username
  final String password;
}

// lib/core/models/api_exception.dart
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final Map<String, dynamic>? errors;
}
```

**Repositorios abstractos core:**

```dart
abstract class AuthRepository {
  Future<AuthTokenResponse> login(LoginRequest request);
  Future<AuthUser> me();
  Future<void> logout();
}
```

---

### 9.2 Clientes

| Interface TS | Archivo | Crear en Flutter |
|--------------|---------|------------------|
| `IClient` | `core/types/IClient.ts` | ✅ `Client` (UI) |
| `IClientAssessment` | idem | ✅ opcional (ficha médica futura) |
| `IClientConsent` | idem | ✅ opcional (expediente) |
| `ClientFormState` | idem | 🆕 `ClientFormState` (formulario, sin id) |
| `EyeTypeOption` | `client.service.ts` | ✅ `EyeTypeOption` |
| `ClientCreatePayload` | idem | ✅ `ClientCreateDto` → JSON `name`, `last_name`, … |
| `ClientUpdatePayload` | idem | ✅ `ClientUpdateDto` |

**Estados de cliente (`IClient.status`):**

`en_servicio` | `en_espera` | `pagado` | `reserva` | `finalizado` | `sin_estado` | `siendo_atendido` | `atendido` | `cancelado` | `no_se_presento` | `reagendado`

→ En Dart: `enum ClientStatus` + extensión `displayName`.

**Mapeo API ↔ UI:**

| API (`BackendClient`) | UI (`IClient` / `Client`) |
|-----------------------|---------------------------|
| `name` | `nombre` |
| `last_name` | `apellido` |
| `age` | `edad` |
| `visit_count` | `visitas` |
| `eye_type.name` | `tipoOjos` |
| `eye_type_id` | `eye_type_id` |

```dart
abstract class ClientRepository {
  Future<List<Client>> list({int? branchId, String? search});
  Future<Client> getById(int id);
  Future<Client> create(ClientCreateDto dto);
  Future<Client> update(int id, ClientUpdateDto dto);
  Future<void> delete(int id);
  Future<List<EyeTypeOption>> listEyeTypes();
}
```

---

### 9.3 Catálogos (efectos, ojos, volúmenes, diseños)

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `CatalogItem` | ✅ `CatalogItem` (id, name, description, image) |
| `LashVolume` / `VolumenFormState` | ✅ `LashVolume`, `VolumeFormState` |
| — CRUD payloads | 🆕 `CatalogCreateDto`, `CatalogUpdateDto` por recurso |

Endpoints comparten forma; un solo modelo sirve para eye-types, effects, volumes, lash-designs:

```dart
abstract class CatalogRepository {
  Future<List<CatalogItem>> listEyeTypes();
  Future<List<CatalogItem>> listEffects();
  Future<List<CatalogItem>> listVolumes();
  Future<List<CatalogItem>> listLashDesigns();
  // create/update/delete según permisos API
}
```

---

### 9.4 Cuestionarios

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `QuestionnaireItem` | ✅ |
| `QuestionnaireCreatePayload` / `Update` | ✅ |
| `Question` (página Questionnaire) | ✅ `QuestionnaireQuestion` |
| `QuestionType` | ✅ enum: `text`, `number`, `bool`, `select`, `multi_select` (+ legacy UI: `yes_no`, `selection`) |

```dart
abstract class QuestionnaireRepository {
  Future<List<QuestionnaireItem>> list();
  Future<QuestionnaireItem> getById(int id);
  Future<QuestionnaireItem> create(QuestionnaireCreateDto dto);
  Future<QuestionnaireItem> update(int id, QuestionnaireUpdateDto dto);
}
```

---

### 9.5 Sucursales

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `BackendBranch` / `Salon` | ✅ `Branch` |
| `BranchPayload` / `SalonForm` | ✅ `BranchCreateDto` |
| `SalonDayScheduleForm` | ✅ `OpeningHoursDay` + `TimeRange` |

```dart
abstract class BranchRepository {
  Future<List<Branch>> list();
  Future<Branch> create(BranchCreateDto dto);
  Future<Branch> update(int id, BranchCreateDto dto);
  Future<void> delete(int id);
}
```

---

### 9.6 Servicios y categorías (agenda)

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `ServiceOption` | ✅ |
| `ServiceCategoryOption` | ✅ |
| `ServiceCreatePayload` / `Update` | ✅ |
| `ServiceCategoryCreatePayload` / `Update` | ✅ |
| `ServiceImageUploadResponse` | ✅ `{ imageUrl }` |
| `ClientForSelect` | ✅ |
| `ProfessionalForSelect` | ✅ |

```dart
abstract class ServiceRepository {
  Future<List<ServiceOption>> listServices({int? branchId, int? categoryId});
  Future<ServiceOption> createService(ServiceCreateDto dto);
  Future<List<ServiceCategoryOption>> listCategories();
  Future<String> uploadServiceImage(File file);
  Future<List<ClientForSelect>> clientsForSelect({int? branchId, String? search});
  Future<List<ProfessionalForSelect>> professionalsForSelect({String? roleName});
}
```

---

### 9.7 Tickets / citas (agenda)

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `TicketItem` | ✅ |
| `AppointmentCreatePayload` | ✅ |
| `AppointmentUpdatePayload` | ✅ |
| — Filtros listado | 🆕 `AppointmentListFilters` (status, branch_id, dates, search, client_id) |

**Estados cita/ticket:** mismo set que `ClientStatus` en agenda.

```dart
abstract class AppointmentRepository {
  Future<List<TicketItem>> listTickets(AppointmentListFilters filters);
  Future<TicketItem> create(AppointmentCreateDto dto);
  Future<TicketItem> update(int id, AppointmentUpdateDto dto);
  Future<List<TimeSlot>> mobileAvailable({required int professionalId, required String date});
}
```

**Agenda del día (UI):**

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `SlotRow` (`calendar.utils.ts`) | 🆕 `AgendaSlotRow` |
| `DailyAgendaPageProps` | 🆕 estado pantalla, no DTO API |

---

### 9.8 POS — ventas

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `PosSaleItemPayload` | ✅ |
| `PosSaleCreatePayload` | ✅ |
| `PosSaleUpdatePayload` | ✅ |
| `PosSaleItem` (venta completa) | ✅ |
| `PosSaleAppointment` | ✅ |
| `PosSalePayment` | ✅ |
| `CartLine` | 🆕 **solo estado local** (carrito) |
| `PosSaleDraft` | 🆕 persistencia local borrador |
| `PosCheckoutTicketPreview` | 🆕 UI preview antes de cobrar |
| `LineAvailabilityState` | 🆕 `Map<String, AvailabilityResult>` |
| `PosSaleClientOption` | 🆕 alias de selector cliente |
| `ReceiptTicketEdit` | 🆕 edición comprobante |

```dart
// Estado local POS (no viene del API)
class CartLine {
  final String localId;
  final int? appointmentId;
  final int serviceId;
  final int? professionalId;
  final DateTime? startDateTime;
  final bool withoutTime;
  final double price;
  final int durationMinutes;
}

abstract class PosSaleRepository {
  Future<List<PosSaleItem>> list({int? clientId, int? branchId, String? status});
  Future<PosSaleItem> getById(int id);
  Future<PosSaleItem> create(PosSaleCreateDto dto);
  Future<PosSaleItem> update(int id, PosSaleUpdateDto dto);
  Future<void> cancel(int id);
  Future<List<int>> downloadReceiptPdf(int id); // bytes
}
```

**Enums Flutter:**

- `DiscountType`: `amount`, `percent`
- `PaymentMethod`: `cash`, `card`, `transfer`, `qr`

---

### 9.9 Pagos

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `PaymentItem` | ✅ |
| `PaymentCreatePayload` | ✅ |

```dart
abstract class PaymentRepository {
  Future<List<PaymentItem>> list({int? clientId, int? appointmentId, int? branchId});
  Future<PaymentItem> create(PaymentCreateDto dto);
}
```

---

### 9.10 Inventario

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `Product` (`IProduct.ts`) | ✅ modelo UI |
| `ProductCreatePayload` / `Update` | ✅ |
| `ProductCategoryOption` | ✅ |
| `ProductBatchCreatePayload` | ✅ |
| `BackendStockSummary` (interno) | ✅ `StockSummaryRow` |
| — Movimiento inventario | 🆕 `InventoryMovement`, `InventoryMovementCreateDto` |

```dart
abstract class ProductRepository {
  Future<List<Product>> list({int? branchId, int? categoryId});
  Future<Product> create(ProductCreateDto dto);
  Future<List<StockSummaryRow>> stockSummary({int? branchId});
}
```

---

### 9.11 Dashboard

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `DashboardFilters` | ✅ |
| `DashboardOverview` | ✅ |
| `RevenueSeriesItem` | ✅ |
| `ServiceDistributionItem` | ✅ |
| `InventoryDistributionItem` | ✅ |

```dart
abstract class DashboardRepository {
  Future<DashboardOverview> overview(DashboardFilters f);
  Future<RevenueSeriesResponse> revenueSeries(DashboardFilters f, {String groupBy});
  Future<List<ServiceDistributionItem>> serviceDistribution(DashboardFilters f);
  Future<List<InventoryDistributionItem>> inventoryDistribution({int? branchId});
}
```

---

### 9.12 Seguimiento (tracking / lash-tracking)

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `TrackingCreatePayload` | ✅ |
| `TrackingResponse` | ✅ |
| `IFollowUp` | ✅ modelo UI extendido (curva, tamaño, grosor, diseño) — puede mapearse desde `TrackingResponse` + campos locales |

```dart
abstract class TrackingRepository {
  Future<List<TrackingResponse>> list({int? clientId});
  Future<TrackingResponse> create(TrackingCreateDto dto);
}
```

---

### 9.13 Usuarios, roles y permisos (admin)

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `UserItem` | ✅ |
| `RoleItem` | ✅ |
| `PermissionItem` | ✅ |
| `SectionTab` | 🆕 enum UI: `users`, `roles`, `permissions` |
| — Crear usuario | 🆕 `AdminUserCreateDto`, `AdminRoleCreateDto` |

```dart
abstract class AdminRepository {
  Future<List<UserItem>> listUsers();
  Future<List<RoleItem>> listRoles();
  Future<List<PermissionItem>> listPermissions();
  Future<RoleItem> createRole(String name, List<int> permissionIds);
  // Solo si el usuario es SuperAdmin
}
```

---

### 9.14 Cola de servicios

| Interface TS | Crear en Flutter |
|--------------|------------------|
| `QueueEntry` | 🆕 `QueueEntry` |
| `ServiceQueue` | 🆕 |
| `ServiceHistoryEntry` | 🆕 |

La cola consume `TicketItem` + `PaymentItem`; estos modelos agrupan estado de pantalla.

```dart
class QueueEntry {
  final TicketItem ticket;
  final PaymentItem? lastPayment;
  final bool enabledToday;
}
```

---

### 9.15 Componentes UI compartidos (solo Flutter / estado)

No son DTO de API; **debes crearlos** para replicar `DataTable`, filtros, etc.:

| Concepto React | Interface / clase Flutter |
|----------------|---------------------------|
| `DataTableColumn<T>` | 🆕 `DataColumnDef<T>` |
| `DataTableAction<T>` | 🆕 `DataRowAction<T>` |
| `DataTablePagination` | 🆕 `TablePagination` |
| `StatCard` props | 🆕 `StatCardData` |
| `PdfColumn` / `GenerateTablePdfOptions` | 🆕 `PdfExportConfig` |
| `Theme` | 🆕 `AppThemeExtension` |

```dart
class DataColumnDef<T> {
  final String key;
  final String header;
  final bool sortable;
  final bool filterable;
  final String Function(T item)? getValue;
  final Widget Function(T item) builder;
}

class DataRowAction<T> {
  final String label;
  final IconData icon;
  final void Function(T item) onTap;
  final bool Function(T item)? visible;
}
```

---

### 9.16 Checklist — interfaces mínimas a crear en Flutter

Copia esta lista al iniciar el proyecto:

**Capa API (DTO, `json_serializable`, snake_case):**

- [ ] `AuthTokenResponse`, `AuthUser`, `LoginRequest`
- [ ] `ClientDto`, `ClientCreateDto`, `EyeTypeOption`
- [ ] `CatalogItem`, `CatalogCreateDto`
- [ ] `Branch`, `BranchCreateDto`, `OpeningHoursDay`
- [ ] `ServiceOption`, `ServiceCategoryOption`, `ServiceCreateDto`
- [ ] `TicketItem`, `AppointmentCreateDto`, `AppointmentUpdateDto`
- [ ] `PosSaleCreateDto`, `PosSaleItem`, `PosSaleAppointment`
- [ ] `PaymentItem`, `PaymentCreateDto`
- [ ] `ProductDto`, `ProductCreateDto`, `StockSummaryRow`
- [ ] `DashboardOverview`, `RevenueSeriesItem`, …
- [ ] `TrackingResponse`, `TrackingCreateDto`
- [ ] `QuestionnaireItem`, `QuestionnaireQuestion`
- [ ] `UserItem`, `RoleItem`, `PermissionItem`

**Capa UI / dominio (camelCase o español):**

- [ ] `Client` (mapeo desde `ClientDto`)
- [ ] `CartLine`, `PosSaleDraft`, `PosCheckoutPreview`
- [ ] `QueueEntry`, `AgendaSlotRow`
- [ ] `ClientFormState`, enums (`ClientStatus`, `PaymentMethod`, `DiscountType`)

**Repositorios abstractos (1 por feature):**

- [ ] `AuthRepository`
- [ ] `ClientRepository`
- [ ] `BranchRepository`
- [ ] `CatalogRepository`
- [ ] `ServiceRepository`
- [ ] `AppointmentRepository`
- [ ] `PosSaleRepository`
- [ ] `PaymentRepository`
- [ ] `ProductRepository`
- [ ] `DashboardRepository`
- [ ] `TrackingRepository`
- [ ] `QuestionnaireRepository`
- [ ] `AdminRepository`

**Providers / estado (Riverpod):**

- [ ] `AuthNotifier`, `SelectedBranchNotifier`
- [ ] Por pantalla: `ClientsListNotifier`, `PosCartNotifier`, `AgendaDayNotifier`, etc.

---

### 9.17 Tabla origen TypeScript → archivo Flutter sugerido

| TS (adminElashes) | Dart (Flutter) sugerido |
|-------------------|-------------------------|
| `core/types/IClient.ts` | `features/clients/data/models/client.dart` |
| `core/services/client/client.service.ts` | `features/clients/data/client_api.dart` + DTOs |
| `core/services/agenda/agenda.service.ts` | `features/agenda/data/models/*.dart` |
| `pages/admin/pos/pos.types.ts` | `features/pos/domain/cart_line.dart` (UI) |
| `core/services/pos-sale/pos-sale.service.ts` | `features/pos/data/models/pos_sale.dart` |
| `core/services/payment/payment.service.ts` | `features/payments/data/models/payment.dart` |
| `core/services/dashboard/dashboard.service.ts` | `features/dashboard/data/models/dashboard.dart` |
| `components/common/table/DataTable.tsx` | `shared/widgets/app_data_table.dart` |
| `pages/admin/users/types.ts` | `features/admin/data/models/user_admin.dart` |

---

## 10. PROMPT LISTO PARA COPIAR (dáselo a la IA)

```
Eres un desarrollador senior Flutter. Debes crear una aplicación móvil/tablet que replique el panel admin "adminElashes" (salón de pestañas Elashes), consumiendo la API REST FastAPI en {BASE_URL} (default http://localhost:8000).

REQUISITOS TÉCNICOS:
- Flutter 3.x, Dart 3, arquitectura feature-first con Riverpod o Bloc.
- HTTP: Dio con interceptor Bearer JWT (token en flutter_secure_storage, clave equivalente a "_tkn").
- Navegación: go_router con rutas públicas (/login) y shell autenticado con NavigationRail/Drawer.
- Tema: ColorScheme primary #094732, fondo sidebar #031910.
- i18n es-BO, moneda BOB.
- Manejo de errores API con mensajes del campo "detail" de FastAPI.

AUTENTICACIÓN:
- POST /auth/login, GET /auth/me, POST /auth/logout.
- Guardar usuario, roles y permisos; filtrar menú por permisos (clients:view, services:manage, etc.).

SUCURSAL GLOBAL:
- Persistir branch_id seleccionado; pasarlo como query en listados de clientes, servicios, tickets, POS, dashboard.

PANTALLAS OBLIGATORIAS (paridad con adminElashes):
1. Dashboard: KPIs /dashboard/overview, gráficos revenue-series, service-distribution, filtros fecha y sucursal.
2. Clientes: CRUD /clients/, tabla con búsqueda, filtro frecuentes (visitas>5), export PDF.
3. Catálogos: eye-types, effects, volumes, lash-designs, designs vía /catalogs/*.
4. Servicios: /agenda/services y /services/categories con imágenes multipart.
5. Tickets: /agenda/appointments listado y estados; pantalla finalizados.
6. Cola de servicios: flujo operativo del día (en_espera → en_servicio → atendido).
7. Calendario y Agenda del día: citas por fecha/profesional; soporte crear/editar cita.
8. POS: carrito multi-servicio, cliente, descuento, POST /pos-sales/ creando tickets en agenda; historial y PDF /pos-sales/{id}/receipt.pdf.
9. Inventario: productos, categorías, movimientos, stock-summary.
10. Sucursales: /branches/.
11. Cuestionarios: /catalogs/questionnaires.
12. Seguimiento: /tracking/ y vista por clientId.
13. Usuarios/Roles: /admin/users solo SuperAdmin.
14. Ajustes y login/register.

MODELOS E INTERFACES (ver sección 9 del doc):
- Crear TODOS los DTO con json_serializable (snake_case desde API).
- Crear modelos UI donde adminElashes mapea (ej. Client: name→nombre).
- Crear estado local: CartLine, PosSaleDraft, QueueEntry, AgendaSlotRow, DataColumnDef.
- Crear abstract class Repository por feature: AuthRepository, ClientRepository, ServiceRepository, AppointmentRepository, PosSaleRepository, PaymentRepository, ProductRepository, DashboardRepository, TrackingRepository, AdminRepository.
- Enums: ClientStatus, PaymentMethod (cash|card|transfer|qr), DiscountType (amount|percent), QuestionType.

COMPONENTES: DataTable paginada, StatCard, filtros, modales formulario, ConfirmDialog, SnackBar éxito/error.

ENTREGABLES POR FASE:
- Fase 1: auth + dashboard + clientes + sucursales.
- Fase 2: servicios + tickets + cola.
- Fase 3: calendario + agenda día.
- Fase 4: POS completo.
- Fase 5: inventario + catálogos + admin usuarios.

Documentación API completa en el repo backend: API_DOCUMENTATION.md (Parte 2 activa). No uses endpoints /face/* (no registrados en producción).

Genera estructura de carpetas, modelos, repositories, pantallas y widgets compartidos. Código production-ready, null-safe, con pruebas unitarias en repositories críticos (auth, pos-sale create).
```

---

## 11. Variables de entorno

```env
# Web (Vite)
VITE_API_URL=http://localhost:8000

# Flutter (.env o --dart-define)
API_URL=http://localhost:8000
```

---

## 12. Referencias en el repo

| Ruta | Contenido |
|------|-----------|
| `adminElashes/src/router/index.tsx` | Todas las rutas |
| `adminElashes/src/components/AppSidebar.tsx` | Menú y permisos |
| `adminElashes/src/core/services/` | Clientes axios por dominio |
| `adminElashes/src/pages/admin/pos/Main.tsx` | Lógica POS más compleja |
| `adminElashes/src/pages/admin/calendar/DailyAgendaPage.tsx` | Agenda del día |
| `elashesbackend/API_DOCUMENTATION.md` | Contratos API |
| `elashesbackend/API_PART2_FULL.md` | Detalle endpoints |

---

*Generado para migración / réplica Flutter del panel adminElashes — Mayo 2026.*
