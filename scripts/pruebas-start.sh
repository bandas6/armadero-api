#!/usr/bin/env bash
# Arranque para el entorno de pruebas: API en un puerto interno y el front SSR en $PORT
# (el puerto público de Render). El SSR reenvía /api, /fotos y /sitemap.xml a API_URL.
set -euo pipefail

# Puerto público (Render lo inyecta; 10000 por defecto). La API va en otro distinto,
# elegido para no chocar con $PORT aunque alguien lo configure a mano.
PORT="${PORT:-10000}"
API_PORT=3100
if [ "$PORT" = "$API_PORT" ]; then API_PORT=3101; fi

PORT="$API_PORT" node dist/server.js &
API_PID=$!

export API_URL="http://localhost:$API_PORT"
# Angular SSR solo atiende los hosts listados; se toma del dominio público de SITE_URL.
SITE_HOST="$(echo "${SITE_URL:-}" | sed -E 's#^https?://##; s#[/:].*$##')"
export NG_ALLOWED_HOSTS="${NG_ALLOWED_HOSTS:-${SITE_HOST:-localhost}}"
# Render es un proxy inverso: sin esto Angular descarta X-Forwarded-* y avisa en cada request.
export NG_TRUST_PROXY_HEADERS="${NG_TRUST_PROXY_HEADERS:-x-forwarded-for,x-forwarded-proto,x-forwarded-host,x-forwarded-port}"
PORT="$PORT" node web/dist/web/server/server.mjs &
WEB_PID=$!

# Si cualquiera de los dos muere, cae el servicio y Render lo reinicia.
wait -n "$API_PID" "$WEB_PID"
kill "$API_PID" "$WEB_PID" 2>/dev/null || true
exit 1
