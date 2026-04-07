# Deploy Frontend (Admin) en Google Cloud VM Ubuntu

Guia para levantar frontend + backend en una misma VM con Nginx.

## Requisitos

- VM Ubuntu 22.04 (GCP)
- Proyecto completo clonado en: `/opt/elashes/apifast`
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
cd /opt/elashes/apifast/adminElashes
cp .env.production.example .env.production
```

Debe quedar:

```env
VITE_API_URL=/api
```

## 3) Build del frontend

```bash
cd /opt/elashes/apifast/adminElashes
npm ci
npm run build
```

Con tu `vite.config.ts`, el build se publica en:

`/opt/elashes/apifast/server/public/app`

## 4) Configurar Nginx Fullstack

```bash
sudo cp /opt/elashes/apifast/elashesbackend/deploy/gcp/nginx-elashes-fullstack.conf /etc/nginx/sites-available/elashes
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
cd /opt/elashes/apifast/adminElashes
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

## Diagnostico cuando "no carga nada"

1) Verifica build frontend

```bash
ls -la /opt/elashes/apifast/server/public/app
```

Debe existir `index.html` y carpeta `assets`.

2) Verifica nginx

```bash
sudo nginx -t
sudo systemctl status nginx
sudo journalctl -u nginx -n 100 --no-pager
```

3) Verifica backend

```bash
sudo systemctl status elashesbackend
curl -I http://127.0.0.1:8000/docs
curl -I http://127.0.0.1/api/docs
```

4) Verifica que no tengas rutas mezcladas

Si tu backend corre en `/opt/elashes/apifast/...` pero nginx apunta a otra ruta, no cargara. Usa una sola base de ruta en todos los archivos.

5) Firewall GCP y VM

- En Google Cloud, habilita regla de ingreso para `tcp:80` (y `tcp:443` si usas HTTPS).
- Si usas `ufw` en la VM:

```bash
sudo ufw status verbose
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

6) Prueba local y externa

```bash
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/api/docs
```

Luego prueba desde tu navegador:
- `http://136.115.241.231/`
- `http://136.115.241.231/api/docs`
