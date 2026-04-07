# Deploy Frontend (Admin) en Google Cloud VM Ubuntu

Guia para levantar frontend + backend en una misma VM con Nginx.

## Requisitos

- VM Ubuntu 22.04 (GCP)
- Proyecto completo clonado en: `/opt/elashes/-Proyect-elashes`
- Backend ya funcionando por systemd en `127.0.0.1:8000`

## 1) Instalar Node.js

```bash
sudo apt update
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 2) Configurar frontend para produccion

```bash
cd /opt/elashes/-Proyect-elashes/adminElashes
cp .env.production.example .env.production
```

Debe quedar:

```env
VITE_API_URL=/api
```

## 3) Build del frontend

```bash
cd /opt/elashes/-Proyect-elashes/adminElashes
npm ci
npm run build
```

Con tu `vite.config.ts`, el build se publica en:

`/opt/elashes/-Proyect-elashes/server/public/app`

## 4) Configurar Nginx Fullstack

```bash
sudo cp /opt/elashes/-Proyect-elashes/elashesbackend/deploy/gcp/nginx-elashes-fullstack.conf /etc/nginx/sites-available/elashes
sudo ln -sf /etc/nginx/sites-available/elashes /etc/nginx/sites-enabled/elashes
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 5) Verificar

- Frontend: `http://IP_PUBLICA_VM/`
- Backend docs por proxy: `http://IP_PUBLICA_VM/api/docs`

## 6) Cada vez que actualices frontend

```bash
cd /opt/elashes/-Proyect-elashes/adminElashes
git pull
npm ci
npm run build
sudo systemctl reload nginx
```

## 7) HTTPS (opcional recomendado)

Si tienes dominio apuntando a la VM:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

## Notas

- Si cambias de ruta de proyecto, actualiza `root` en Nginx.
- El frontend llama a `/api/*`, y Nginx redirige al backend interno `127.0.0.1:8000`.
