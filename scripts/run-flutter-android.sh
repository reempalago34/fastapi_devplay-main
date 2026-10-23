#!/usr/bin/env bash
set -euo pipefail

api_port="${DEVPLAY_API_PORT:-8000}"

if ! command -v adb >/dev/null 2>&1; then
  echo "Error: no se encontró adb. Instala Android platform-tools y vuelve a intentarlo." >&2
  exit 1
fi

if ! command -v uvicorn >/dev/null 2>&1; then
  echo "Error: no se encontró uvicorn. Activa el entorno virtual del backend." >&2
  exit 1
fi

if ! adb get-state >/dev/null 2>&1; then
  echo "Error: conecta y autoriza un emulador o teléfono Android con depuración USB." >&2
  exit 1
fi

adb reverse "tcp:${api_port}" "tcp:${api_port}"
echo "Android localhost:${api_port} -> computador localhost:${api_port}"
echo "Iniciando DevPlay API. Ctrl+C detiene el servidor."

exec uvicorn app.main:app --reload --host 127.0.0.1 --port "${api_port}"
