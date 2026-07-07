# Deploy Marketplace en Google Cloud VM (Ubuntu)

Este servicio es un **repositorio separado** que corre en el puerto `8001`.
El backend principal (`elashesbackend`) le hace proxy y valida los tokens contra él.

## Estructura en la VM

```
/opt/elashes/
├── apifast/                          ← repo principal (elashesbackend + adminElashes)
│   └── elashesbackend/
│       └── deploy/gcp/
│           ├── marketplace.service   ← systemd para este servicio
│           └── ...
└── marketplaceapi/         ← este repo (puerto 8001)
    ├── main.py
    ├── .env
    └── .venv/
```

## 1) Clonar el repositorio del marketplace

```bash
cd /opt/elashes

git clone <URL_REPO_MARKETPLACE> marketplaceapi
cd marketplaceapi
```

## 2) Crear entorno virtual e instalar dependencias

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 3) Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Contenido mínimo para GCP (en la VM `localhost` funciona, no hay Docker):

```env
DATABASE_URL=sqlite:///./data/marketplace.db
SALON_BACKEND_URL=http://localhost:8000
ALLOWED_ORIGINS=http://34.55.150.142,https://34.55.150.142,http://localhost,http://127.0.0.1
MEDIA_BASE_PATH=/opt/elashes/marketplaceapi/media
```

> Si tienes dominio agrega también: `https://tu-dominio.com`
>
> `MEDIA_BASE_PATH` debe ser ruta absoluta en producción para que nginx sirva las imágenes correctamente.

## 4) Crear carpetas necesarias

```bash
mkdir -p /opt/elashes/marketplaceapi/data
mkdir -p /opt/elashes/marketplaceapi/media
sudo chown -R www-data:www-data /opt/elashes/marketplaceapi
```

## 5) Instalar el servicio systemd

```bash
sudo cp /opt/elashes/apifast/elashesbackend/deploy/gcp/marketplace.service \
        /etc/systemd/system/marketplace.service

sudo systemctl daemon-reload
sudo systemctl enable marketplace
sudo systemctl start marketplace
sudo systemctl status marketplace
```

Logs en vivo:
```bash
sudo journalctl -u marketplace -f
```

## 6) Verificar

Desde la VM:
```bash
curl http://127.0.0.1:8001/docs
curl http://127.0.0.1:8001/api/categories
```


El proxy del elashesbackend ya enruta `/marketplace-proxy/...` → `localhost:8001`
(configurado en `.env.gcp.example`: `MARKETPLACE_BACKEND_URL=http://localhost:8001`).

## 7) Actualizar marketplace

```bash
cd /opt/elashes/marketplaceapi
git pull
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart marketplace
```

## Relación con elashesbackend

```
Navegador → nginx /marketplace/ → :8001 (marketplace)
Navegador → nginx /api/         → :8000 (elashesbackend)
                                      ↑
elashesbackend proxy /marketplace-proxy/* → :8001
marketplace /auth/me validation          → :8000
```

Ambos se validan mutuamente via `localhost` — sin Docker, esto funciona directamente.
