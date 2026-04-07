# Deploy Backend en Google Cloud VM (Ubuntu)

Este flujo despliega el backend FastAPI en una VM Ubuntu usando `systemd` + `nginx`.

## 1) Preparar VM en Google Cloud

1. Crea una VM Ubuntu (22.04 recomendado).
2. Abre firewall para HTTP/HTTPS en la instancia.
3. Conecta por SSH desde consola GCP.

## 2) Instalar dependencias del sistema

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx git libgl1 libglib2.0-0
```

## 3) Clonar proyecto y preparar entorno

```bash
sudo mkdir -p /opt/elashes
sudo chown -R $USER:$USER /opt/elashes
cd /opt/elashes

git clone <URL_DE_TU_REPO> -b <TU_RAMA> elashesbackend
cd elashesbackend

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 4) Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Variables clave de produccion:
- `DEBUG=false`
- `SECRET_KEY=<clave-larga-segura>`
- `ACCESS_TOKEN_EXPIRE_MINUTES=1440`
- `ALLOWED_ORIGINS=["https://tu-dominio.com","http://tu-ip-publica"]`
- `DATABASE_URL=sqlite:///./elashes.db` (o tu URL real de DB)

## 5) Configurar systemd

```bash
sudo cp deploy/gcp/elashesbackend.service /etc/systemd/system/elashesbackend.service
sudo sed -i 's|/opt/elashes/elashesbackend|/opt/elashes/elashesbackend|g' /etc/systemd/system/elashesbackend.service
sudo chown -R www-data:www-data /opt/elashes/elashesbackend

sudo systemctl daemon-reload
sudo systemctl enable elashesbackend
sudo systemctl start elashesbackend
sudo systemctl status elashesbackend
```

Logs en vivo:
```bash
sudo journalctl -u elashesbackend -f
```

## 6) Configurar nginx como reverse proxy

```bash
sudo cp deploy/gcp/nginx-elashesbackend.conf /etc/nginx/sites-available/elashesbackend
sudo ln -sf /etc/nginx/sites-available/elashesbackend /etc/nginx/sites-enabled/elashesbackend
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl restart nginx
sudo systemctl status nginx
```

## 7) Validacion

Desde VM:
```bash
curl http://127.0.0.1:8000/docs
```

Desde navegador externo:
- `http://<IP_PUBLICA_VM>/docs`

## 8) HTTPS (recomendado)

Si tienes dominio apuntando a la VM:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

## 9) Actualizar backend

```bash
cd /opt/elashes/elashesbackend
git pull
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart elashesbackend
```

## Notas

- El token JWT ya queda configurado a 24 horas (`1440` minutos).
- Si usas sqlite en producción, haz backups frecuentes.
- Para alta concurrencia, migra a PostgreSQL y ajusta workers.

## Frontend (Admin)

Para desplegar el frontend en la misma VM y dejar API + web en un mismo dominio, usa:

- `deploy/gcp/DEPLOY_FRONTEND_GCP_UBUNTU.md`
