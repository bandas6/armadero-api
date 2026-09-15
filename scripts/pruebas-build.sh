#!/usr/bin/env bash
# Build para el entorno de pruebas en Render (un solo servicio gratuito):
# compila la API y, al lado, clona y compila el front SSR.
set -euo pipefail

# Render exporta NODE_ENV=production y npm ci omitiría typescript, @types y @angular/cli.

WEB_REPO="${WEB_REPO:-https://github.com/bandas6/armadero.git}"
WEB_BRANCH="${WEB_BRANCH:-main}"

npm ci --include=dev
npm run build

rm -rf web
git clone --depth 1 --branch "$WEB_BRANCH" "$WEB_REPO" web
cd web
npm ci --include=dev
npm run build
