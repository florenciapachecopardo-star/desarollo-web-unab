#!/bin/sh
# Muestra todas las lineas de log de una solicitud, en el orden en que ocurrieron.
# Uso: sh scripts/logs.sh <request_id>
# (En PowerShell usar scripts/logs.ps1)
set -eu
if [ $# -ne 1 ]; then
  echo "Uso: sh scripts/logs.sh <request_id>" >&2
  exit 1
fi
lineas=$(docker compose logs --no-color --no-log-prefix frontend gateway auth clients inventory orders payments graphql-gateway 2>/dev/null \
  | grep -E "\"request_id\": ?\"$1\"" || true)

# El frontend (nginx) escribe su linea al terminar la respuesta y solo con segundos;
# se muestra primero porque es por donde entra la solicitud.
printf '%s\n' "$lineas" | grep '"service":"frontend"' || true
# El resto, ordenado solo por la hora (campo ts). El orden estable mantiene,
# dentro del mismo milisegundo, el orden en que cada servicio escribio sus lineas.
printf '%s\n' "$lineas" | grep -v '"service":"frontend"' | grep . | sort -s -t'"' -k4,4 || true
