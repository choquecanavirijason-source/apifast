# Revisión: retirados y reservas

Reutiliza RetoquesTab y GET /clients/retoques?tipo=retiro, conservando el endpoint combinado sin tipo por compatibilidad. Estado de retoques usa tipo=mantenimiento. Categoría.has_removal, Service.removal_days y Tracking.next_removal_date determinan la recomendación desde last_application_date; no se fija un intervalo en código ni se añaden tablas.

La tabla conserva filtros, búsqueda, sucursal, fecha de aplicación, fecha recomendada y días restantes/vencidos. Sustituye Cita futura por Reserva de retiro y elimina visualmente Estado del retiro. Sus verificaciones siguen en backend: una atención posterior exige revisión y bloquea recordatorios; un seguimiento posterior sin próximas fechas sustituye la recomendación anterior sin borrar el historial. Nunca se identifica un retiro realizado solo por el nombre del servicio.

## Estados y limitación explícita

- Sin reserva: no consta una cita futura activa identificada en la sucursal autorizada.
- Por verificar: existe cita futura sin clasificación fiable del servicio como retiro.
- Reservado: presentación preparada para un contrato backend explícitamente verificado, con fecha/hora. Los campos actuales NO permiten emitirlo de verdad. has_removal indica cuidados posteriores, no la finalidad del servicio. Falta una clasificación explícita del servicio como retiro o una relación verificada entre esa cita y el retiro. No se añadió una heurística por nombre/categoría ni una clasificación persistida inventada.

La prueba de Reservado es un contrato simulado del frontend; no prueba clasificación de datos reales. Las citas canceladas/completadas/no_show no cuentan. Reprogramación actualiza la fecha futura; no convierte una cita ambigua en retiro confirmado. No se exponen citas/historial de otras sucursales; un usuario restringido sin sucursal no obtiene una lista global.

## Recordatorios y validación

Reutiliza la confirmación, consentimiento, permisos, canales y recibo persistente del PR de recordatorios con tipo=retiro. No añade servicio de envío ni altera Agenda. Una atención posterior se comprueba al listar, al confirmar y antes de entregar. Se mantiene la deduplicación independiente por tipo/fecha.

Pruebas: test_removal_notifications.py y test_removal_reservations.py, con datos ficticios, rutas reales y proveedores falsos. Cubren fechas próximas/vencidas, servicio sin retiro, seguimiento posterior, historia sin borrar, citas ambiguas/finales/reprogramadas, permisos, consentimiento, sucursales y replay. Frontend: node --test src/pages/admin/notificaciones/removalReservation.test.cjs. Chromium verificó columnas, estados, botón bloqueado y respuesta perdida con envíos simulados. Build Vite aprobado; no se afirma que el chequeo TypeScript global esté limpio.

CI debe ejecutar esas pruebas y el PR padre antes del merge. Staging debe probar ambas pestañas, Próximas citas y Comunicados, con envíos deshabilitados. Reutiliza la configuración/migración documentada en RETOUCH_REMINDERS.md; no necesita otra migración. No incluye fixtures, capturas, bases o proveedores de la demo local.

PR encadenado sobre feat/retouch-manual-reminders. No desplegar por aprobar el PR: siguen pendientes las condiciones operativas del padre y la limitación de clasificación de reservas.
