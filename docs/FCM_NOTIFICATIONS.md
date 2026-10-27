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
