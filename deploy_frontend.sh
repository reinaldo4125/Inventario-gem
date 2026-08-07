#!/usr/bin/env bash
set -euo pipefail

# Ruta del proyecto en el servidor
APP_DIR="/opt/inventario"

echo "[deploy] Entrando en ${APP_DIR}"
cd "${APP_DIR}"

echo "[deploy] Actualizando código (git pull)"
git pull

echo "[deploy] Construyendo imagen del frontend (docker compose build frontend)"
docker compose build frontend

echo "[deploy] Levantando contenedor del frontend (docker compose up -d frontend)"
docker compose up -d frontend

echo "[deploy] Obteniendo ID del contenedor de frontend"
CONTAINER_ID="$(docker compose ps -q frontend)"
if [[ -z "${CONTAINER_ID}" ]]; then
  echo "[deploy][ERROR] No se encontró contenedor para el servicio 'frontend'"
  exit 1
fi

echo "[deploy] Copiando build desde el contenedor (${CONTAINER_ID}) a ./frontend/build"
mkdir -p frontend
rm -rf frontend/build

docker cp "${CONTAINER_ID}:/usr/share/nginx/html" frontend/build

cd frontend/build

# En este punto, el contenido real está dentro de ./html/
# Queremos que index.html y static/ queden directamente en ./

echo "[deploy] Reorganizando contenido del build"
rm -rf index.html static
cp -a html/. .
rm -rf html

cd "${APP_DIR}"

echo "[deploy] Probando configuración de Nginx"
nginx -t

echo "[deploy] Recargando Nginx"
systemctl reload nginx

echo "[deploy] Despliegue de frontend completado"