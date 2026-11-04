# Revisión: recordatorios manuales de retoques

## Alcance

Estado de retoques incorpora Enviar recordatorio y una confirmación con destinataria, servicio, fecha, días, canales disponibles y mensaje generado por el servidor. Las solicitudes son explícitas: crear/completar citas no dispara esta función. Reutiliza Broadcast/BroadcastRecipient y sus proveedores SMTP/FCM. Permisos: clients:view y reminders:send.

Backend valida clienta, cita de origen completada, último seguimiento, sucursal e identidad del usuario, consentimiento, canales y versión de la vista previa. Una cita futura, incluso confirmed y del mismo servicio, no acredita que sea un retoque. Se muestra por verificar; el mensaje no afirma que sea una cita de mantenimiento confirmada.

La PK de retouch_reminders identifica clienta/seguimiento/tipo/día objetivo. Comunicado, destinataria, auditoría y recibo se confirman en una transacción. Doble clic, replay y concurrencia devuelven el recibo original sin encolar otro despacho. No se garantiza entrega exactamente una vez por un proveedor externo. No se reintentan automáticamente fallidos/interrumpidos: podría haberse aceptado el mensaje antes de perder la respuesta.

## Configuración y migración

Primera habilitación de la aplicación, siempre con envíos bloqueados:

```dotenv
ENVIRONMENT=production
RUN_STARTUP_SEEDERS=false
RETOUCH_REMINDERS_DELIVERY_MODE=disabled
```

En production/prod, si falta la nueva variable, también se deshabilita. Solo live permite crear nuevos despachos; esa habilitación exige consentimiento y una decisión operativa independiente. Push requiere FCM y dispositivo activo; correo requiere SMTP y email de la clienta. No se incorporan secretos al repositorio.

Antes de iniciar la nueva aplicación, con respaldo restaurable y DATABASE_URL configurada por el entorno autorizado, ejecutar desde el backend:

```sh
python deploy/retouch-release/schema.py upgrade
python deploy/retouch-release/schema.py check
```

Migración explícita PostgreSQL 16, transaccional, idempotente y con advisory lock. Crea solo retouch_reminders, con PK, UNIQUE y FK a broadcasts. check no modifica datos/esquema. Una estructura preexistente diferente produce error; no se adapta silenciosamente. init_db registra el modelo, pero no sustituye este procedimiento controlado.

Rollback de aplicación: conservar la tabla y recibos, sin restaurar automáticamente una BD anterior. downgrade rechaza tablas con recibos porque perderlos permitiría duplicados; solo es admisible con tabla vacía y escritores detenidos:

```sh
python deploy/retouch-release/schema.py downgrade
```

## Evidencia y validación del equipo

Pruebas focalizadas: tests/test_retouch_reminders.py (rutas reales, proveedores falsos, permisos/sucursales, consentimiento, errores, cambios tras preview y concurrencia). Las contraseñas de esos fixtures se generan en ejecución. Prueba opt-in tests/test_retouch_postgres_release.py: requiere RETOUCH_PG_TEST_URL hacia una BD LOCAL NUEVA llamada elashes_retouch_test_* en puerto 15432; rechaza otras ubicaciones y bases no vacías. Verificados PostgreSQL 16.6, migración/check/down-up, restricciones, dos conexiones concurrentes y replay. Un respaldo sintético se restauró preservando recibos.

El navegador local verificó doble clic, respuesta perdida, recuperación del resultado y recarga con fake SMTP/FCM. Compilación Vite aprobada. El chequeo TypeScript global sigue bloqueado por configuración/errores preexistentes fuera de esta función; no se presenta como aprobado.

El equipo debe ejecutar CI sobre la combinación final antes del merge; en staging validar preview, canales no disponibles, permisos/sucursales, revocación del consentimiento y replay, sin proveedores reales. Revisar también Próximas citas y Comunicados.

## Riesgos pendientes para despliegue

Este PR no autoriza despliegue ni envío real. La protección de seeders no desactiva init_db ni migraciones heredadas. El arranque existente silencia excepciones y m17 repone permisos IA. Esas operaciones requieren revisión/control independiente antes de publicar en producción. Los scripts ad hoc de publicación, sus baselines, credenciales de demo y artefactos locales no forman parte de este PR.

## Integración

Revisar sobre fix/guard-startup-seeders, para mostrar exclusivamente recordatorios. La rama de seeders se revisa sobre fix/sucursal-efectiva-pos por su historial existente; POS no es una dependencia técnica de los recordatorios. Orden de la pila: POS, seeders, recordatorios, retirados. Al integrar, preservar los commits con merge commits y actualizar bases de los PRs siguientes. Si el equipo exige squash, preparar ramas de integración nuevas sin sobrescribir ni hacer force push a las ramas revisadas.
