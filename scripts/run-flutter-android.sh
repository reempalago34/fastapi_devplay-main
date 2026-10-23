#!/usr/bin/env bash
set -euo pipefail

api_port="${DEVPLAY_API_PORT:-8000}"

if [[ ! "$api_port" =~ ^[0-9]+$ ]]; then
  echo "Error: DEVPLAY_API_PORT debe ser un puerto entre 1 y 65535." >&2
  exit 1
fi
api_port_number=$((10#$api_port))
if (( api_port_number < 1 || api_port_number > 65535 )); then
  echo "Error: DEVPLAY_API_PORT debe ser un puerto entre 1 y 65535." >&2
  exit 1
fi
api_port="$api_port_number"

if ! command -v adb >/dev/null 2>&1; then
  echo "Error: no se encontró adb. Instala Android platform-tools y vuelve a intentarlo." >&2
  exit 1
fi

if ! command -v uvicorn >/dev/null 2>&1; then
  echo "Error: no se encontró uvicorn. Activa el entorno virtual del backend." >&2
  exit 1
fi

if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  adb_command=(adb -s "$ANDROID_SERIAL")
  if ! device_state="$("${adb_command[@]}" get-state 2>/dev/null)" || [[ "$device_state" != "device" ]]; then
    echo "Error: ANDROID_SERIAL='$ANDROID_SERIAL' no identifica un dispositivo Android conectado y autorizado." >&2
    echo "Consulta los seriales disponibles con: adb devices" >&2
    exit 1
  fi
else
  if ! device_list="$(adb devices 2>/dev/null)"; then
    echo "Error: adb no pudo enumerar los dispositivos conectados." >&2
    exit 1
  fi

  mapfile -t connected_devices < <(printf '%s\n' "$device_list" | awk 'NR > 1 && $2 == "device" { print $1 }')
  if (( ${#connected_devices[@]} == 0 )); then
    echo "Error: conecta y autoriza un emulador o teléfono Android con depuración USB." >&2
    exit 1
  elif (( ${#connected_devices[@]} > 1 )); then
    printf 'Error: hay varios dispositivos conectados: %s\n' "${connected_devices[*]}" >&2
    echo "Elige uno indicando ANDROID_SERIAL. Ejemplo: ANDROID_SERIAL=${connected_devices[0]} bash scripts/run-flutter-android.sh" >&2
    exit 1
  fi

  adb_command=(adb -s "${connected_devices[0]}")
fi

cleanup() {
  "${adb_command[@]}" reverse --remove "tcp:${api_port}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${adb_command[@]}" reverse "tcp:${api_port}" "tcp:${api_port}"
echo "Android localhost:${api_port} -> computador localhost:${api_port}"
echo "Iniciando DevPlay API. Ctrl+C detiene el servidor y elimina el túnel ADB."

uvicorn app.main:app --reload --host 127.0.0.1 --port "${api_port}"
