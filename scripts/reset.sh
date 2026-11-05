#!/bin/sh
# Deja la base en el estado inicial conocido: borra usuarios, sesiones y
# productos, y vuelve a cargar el seed. Requiere el stack levantado.
set -eu
docker compose run --rm seed --reset
