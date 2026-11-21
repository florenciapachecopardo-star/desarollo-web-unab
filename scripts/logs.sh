#!/bin/sh
# Muestra, ordenadas por hora, todas las lineas de log de una solicitud.
# Uso: sh scripts/logs.sh <request_id>
# (En PowerShell usar scripts/logs.ps1)
set -eu
if [ $# -ne 1 ]; then
  echo "Uso: sh scripts/logs.sh <request_id>" >&2
  exit 1
fi
docker compose logs --no-color --no-log-prefix frontend gateway auth clients inventory orders payments graphql-gateway 2>/dev/null \
  | grep -E "\"request_id\": ?\"$1\"" \
  | sort
