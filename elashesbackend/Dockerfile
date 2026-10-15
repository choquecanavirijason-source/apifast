FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Con opencv-python-headless no hacen falta libgl1 ni libglib2.0-0, así que no
# se instalan paquetes del sistema. Si se agrega una dependencia nativa,
# instalarla aquí: apt-get update && apt-get install -y --no-install-recommends <pkg> && rm -rf /var/lib/apt/lists/*

# Dependencias antes del código para aprovechar la caché de capas.
# INSTALL_DEV=true instala además pytest (requirements-dev.txt) para correr los tests.
ARG INSTALL_DEV=false
COPY requirements.txt requirements-dev.txt /app/
RUN if [ "$INSTALL_DEV" = "true" ]; then \
        pip install --no-cache-dir -r /app/requirements-dev.txt; \
    else \
        pip install --no-cache-dir -r /app/requirements.txt; \
    fi

COPY . /app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
