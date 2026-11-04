#!/bin/sh
# Muestra, ordenadas por hora, todas las lineas de log de una solicitud.
# Uso: scripts/logs.sh <request_id>
set -eu
if [ $# -ne 1 ]; then
  echo "Uso: scripts/logs.sh <request_id>" >&2
  exit 1
fi
docker compose logs --no-color --no-log-prefix gateway auth inventory 2>/dev/null \
  | grep -F "\"request_id\": \"$1\"" \
  | sort
