# elashesbackend

Backend para el sistema de análisis de pestañas con reconocimiento facial.

## Autenticación

El sistema incluye un módulo completo de autenticación con las siguientes características:

### Endpoints de Autenticación

- **POST /auth/register**: Registro de nuevos usuarios
- **POST /auth/login**: Inicio de sesión y obtención de token JWT
- **POST /auth/logout**: Cierre de sesión
- **GET /auth/me**: Obtener información del usuario autenticado

### Seguridad

- Contraseñas hasheadas con bcrypt
- Tokens JWT con expiración configurable (24 horas por defecto)
- **Logout con revocación de tokens**: Los tokens se invalidan del lado del servidor
- Validación de emails
- Protección de rutas con dependencias de autenticación
- Manejo de errores con HTTPExceptions apropiadas

### Uso

1. Registrar un usuario:
```bash
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123", "full_name": "User Name"}'
```

2. Iniciar sesión:
```bash
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

3. Cerrar sesión (revoca el token):
```bash
curl -X POST "http://localhost:8000/auth/logout" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

4. Usar el token en requests protegidos:
```bash
curl -X GET "http://localhost:8000/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Deploy en Google Cloud VM (Ubuntu)

Se agregó una guía completa de despliegue con `systemd` + `nginx` en:

- `deploy/gcp/DEPLOY_GCP_UBUNTU.md`
