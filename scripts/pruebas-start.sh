#!/usr/bin/env bash
# Arranque para el entorno de pruebas: API en :3000 (interno) y el front SSR en $PORT
# (el puerto público de Render). El SSR reenvía /api, /fotos y /sitemap.xml a API_URL.
set -euo pipefail

API_PORT=3000
PORT="$API_PORT" node dist/server.js &
API_PID=$!

export API_URL="http://localhost:$API_PORT"
# Angular SSR solo atiende los hosts listados; se toma del dominio público de SITE_URL.
SITE_HOST="$(echo "${SITE_URL:-}" | sed -E 's#^https?://##; s#[/:].*$##')"
export NG_ALLOWED_HOSTS="${NG_ALLOWED_HOSTS:-${SITE_HOST:-localhost}}"
node web/dist/web/server/server.mjs &
WEB_PID=$!

# Si cualquiera de los dos muere, cae el servicio y Render lo reinicia.
wait -n "$API_PID" "$WEB_PID"
kill "$API_PID" "$WEB_PID" 2>/dev/null || true
exit 1
