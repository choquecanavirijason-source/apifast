# Avisos de citas mediante FCM

El backend envía por FCM los avisos programados (`manana`, `hoy`,
`mantenimiento`, `retiro`) cuando llega su hora de mostrarse, para que lleguen
con la app cerrada. El sondeo corre cada minuto; cada aviso aceptado por FCM se
anota por instalación en `fcm_notice_deliveries` para no reenviarlo. El flujo
existente de `/avisos/programados` y WebSocket se conserva.

Los recordatorios manuales (`recordatorio_manual`) no pasan por este sondeo:
`push_service` los envía en el momento en que se crean.

## Configuración del backend

- Mantén `CLIENT_NOTICES_ENABLED=true`.
- Configura `FCM_CREDENTIALS_FILE` con la ruta al JSON de la cuenta de servicio,
  fuera del repositorio (ver `elashesbackend/deploy/gcp/DEPLOY_GCP_UBUNTU.md`).
  Con docker compose se monta en `/run/secrets/elashes/fcm-service-account.json`.

Si la variable falta o el archivo no es válido, el backend arranca igual: se
avisa en el log y no se envía ningún push.

## Registro desde la app

Después de obtener el token de dispositivo propio desde `POST /dispositivos`,
la app debe enviar cada token FCM inicial o renovado con:

```http
PUT /dispositivos/actual/fcm-token
Authorization: Bearer <token de dispositivo>
Content-Type: application/json

{"fcm_token": "<token FCM>"}
```

El token se guarda en `client_devices.fcm_token`. Si otro dispositivo tenía el
mismo token, se le quita. `DELETE /dispositivos/actual/fcm-token` lo borra, y
también se borra al revocar el dispositivo o cuando FCM lo da por inválido.

## Formato del mensaje

Es un data message (sin bloque `notification`) de prioridad alta, igual que los
recordatorios manuales; la app es quien muestra la notificación:

```json
{
  "type": "scheduled_notice",
  "aviso_id": "123",
  "tipo": "hoy",
  "cita_id": "55",
  "titulo": "Hoy te toca tu cita",
  "cuerpo": "Extensiones de pestañas",
  "mostrar_en": "2026-10-14T08:00:00-04:00",
  "expira_en": "2026-10-14T09:30:00-04:00"
}
```

`cita_id` y `seguimiento_id` solo aparecen cuando no son null. La app debe
deduplicar por `aviso_id` contra las notificaciones locales que programó al
sincronizar, para no mostrar dos veces el mismo aviso.

## Comunicados (avisos, promociones y novedades)

El panel (Notificaciones > Comunicados) envía un mismo mensaje a un grupo de
clientas o a todas. A diferencia de los avisos de arriba, **lleva bloque
`notification`**: Android lo muestra solo aunque la app esté cerrada, con la
imagen si la hay. Va por el canal `elashes_marketplace_citas` y con
`tag = aviso_<aviso_id>`.

Data del mensaje (todo en strings; `imagen_url` falta si no hay imagen o el
servidor no tiene `PUBLIC_BASE_URL`):

```json
{
  "type": "broadcast",
  "tipo": "comunicado",
  "aviso_id": "987654",
  "categoria": "promocion",
  "titulo": "20% en lifting esta semana",
  "cuerpo": "Reserva por la app. Válido hasta el domingo.",
  "imagen_url": "https://elashes.com/api/media/broadcasts/abc.jpg",
  "enviado_en": "2026-10-29T15:40:00-04:00"
}
```

`categoria` es `aviso`, `promocion` o `novedad`.

### Bandeja en la app

Los comunicados de los últimos 7 días que le tocaron a la clienta (del más
nuevo al más viejo, máximo 20):

```http
GET /avisos/comunicados
Authorization: Bearer <token de dispositivo>
```

```json
{"comunicados": [{"aviso_id": 987654, "categoria": "promocion", "titulo": "…",
  "cuerpo": "…", "imagen_url": "https://…", "enviado_en": "2026-10-29T15:40:00-04:00"}]}
```

Está aparte de `/avisos/programados` a propósito: así la versión actual de la
app no recibe un `tipo` que no conoce. Deduplicar por `aviso_id` contra el push.

### Pendiente en la app (repo Flutter)

- Pantalla de bandeja que lea `GET /avisos/comunicados`.
- Con la app abierta, mostrar el push `type = broadcast` (en primer plano
  Android no lo muestra solo).
- iOS: para ver la imagen hace falta una *Notification Service Extension*
  (ver "Send an image in the notification payload" en la documentación de
  Firebase). Sin ella llega el texto sin imagen.
