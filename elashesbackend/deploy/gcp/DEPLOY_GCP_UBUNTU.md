# Deploy Backend en Google Cloud VM (Ubuntu)

Este flujo despliega backend + frontend en una VM Ubuntu usando `systemd` + `nginx`.
Estructura objetivo:

- Frontend: `/opt/elashes/apifast/adminElashes`
- Backend: `/opt/elashes/apifast/elashesbackend`
- Build frontend servido por nginx: `/opt/elashes/apifast/server/public/app`

## 1) Preparar VM en Google Cloud

1. Crea una VM Ubuntu (22.04 recomendado).
2. Abre firewall para HTTP/HTTPS en la instancia.
3. Conecta por SSH desde consola GCP.

## 2) Instalar dependencias del sistema

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx git libgl1 libglib2.0-0

# Node.js 20 para compilar frontend
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3) Clonar proyecto y preparar entorno

```bash
sudo mkdir -p /opt/elashes
sudo chown -R $USER:$USER /opt/elashes
cd /opt/elashes

git clone <URL_DE_TU_REPO> -b <TU_RAMA> apifast
cd apifast/elashesbackend

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Build frontend (admin)
cd /opt/elashes/apifast/adminElashes
cp .env.production.example .env.production
npm ci
npm run build

# Volver al backend
cd /opt/elashes/apifast/elashesbackend
```

## 4) Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Variables clave de produccion:
- `DEBUG=false`
- `SECRET_KEY=pon_aqui_una_clave_larga_y_segura`
- `ACCESS_TOKEN_EXPIRE_MINUTES=1440`
- `ALLOWED_ORIGINS=["http://136.115.241.231"]`
- `DATABASE_URL=sqlite:///./elashes.db`

## 5) Configurar systemd

```bash
sudo cp deploy/gcp/elashesbackend.service /etc/systemd/system/elashesbackend.service
sudo chown -R www-data:www-data /opt/elashes/apifast/elashesbackend

sudo systemctl daemon-reload
sudo systemctl enable elashesbackend
sudo systemctl start elashesbackend
sudo systemctl status elashesbackend
```

Logs en vivo:
```bash
sudo journalctl -u elashesbackend -f
```

Nota: en este proyecto el `startup` ejecuta inicialización/migraciones, por eso en `elashesbackend.service` se recomienda `--workers 1` para evitar carreras entre procesos al arrancar.

## 6) Configurar nginx como reverse proxy

```bash
sudo cp deploy/gcp/nginx-elashes-fullstack.conf /etc/nginx/sites-available/elashes
sudo ln -sf /etc/nginx/sites-available/elashes /etc/nginx/sites-enabled/elashes
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl restart nginx
sudo systemctl status nginx
```

## 7) Validacion

Desde VM:
```bash
curl http://127.0.0.1:8000/docs
curl http://127.0.0.1/api/docs
```

Desde navegador externo:
- Frontend: `http://<IP_PUBLICA_VM>/`
- Backend docs por proxy: `http://<IP_PUBLICA_VM>/api/docs`

## 8) HTTPS (recomendado)

Si tienes dominio apuntando a la VM:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

## 9) Actualizar backend

```bash
cd /opt/elashes/apifast/elashesbackend
git pull
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart elashesbackend
```

Si actualizas frontend:

```bash
cd /opt/elashes/apifast/adminElashes
git pull
npm ci
npm run build
sudo systemctl reload nginx
```

## Notas

- El token JWT ya queda configurado a 24 horas (`1440` minutos).
- Si usas sqlite en producción, haz backups frecuentes.
- Para alta concurrencia, migra a PostgreSQL y ajusta workers.

## Frontend (Admin)

Para desplegar el frontend en la misma VM y dejar API + web en un mismo dominio, usa:

- `deploy/gcp/DEPLOY_FRONTEND_GCP_UBUNTU.md`
