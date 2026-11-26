#!/bin/sh
# Ejecución completa y repetible de las pruebas de la Entrega 3 (una RUN).
#
# Uso (desde la raíz del repo, con Git Bash en Windows):
#   sh scripts/u3-run.sh RUN01 "Florencia"
#
# Qué hace, en orden:
#   0. Guarda el contexto: fecha y hora con zona, commit, versiones de Docker.
#   1. Levanta el sistema y lo deja en el estado inicial (scripts/reset.sh).
#   2. Fase normal:     recorridos críticos en escritorio y móvil (Playwright).
#   3. Fase caido:      detiene inventory y prueba el fallo controlado.
#   4. Fase recuperado: vuelve a levantar inventory y prueba la recuperación.
#   5. Fase demora:     inventory con 7 s de demora (el gateway corta a los 5 s).
#   6. Fase expira:     auth con sesiones de 20 s, para probar la sesión expirada.
#   7. pytest (tests/api): controles de API, incluida la regresión de INC07.
#   8. Saca los logs de los servicios de cada X-Request-ID que vio el navegador
#      y revisa en Mongo los pedidos que crearon las pruebas (persistencia).
#
# Todo queda en evidencias/u3/<RUN>/. Si una carpeta con ese ID ya existe, no
# se sobrescribe: cada ejecución lleva un ID nuevo (los fallos también se guardan).
set -u
# Git Bash no debe convertir rutas como /salida a rutas de Windows
export MSYS_NO_PATHCONV=1

if [ $# -lt 1 ]; then
  echo "Uso: sh scripts/u3-run.sh <RUN> [ejecutor]   (ejemplo: sh scripts/u3-run.sh RUN01 Florencia)" >&2
  exit 2
fi
RUN=$1
EJECUTOR=${2:-$(git config user.name 2>/dev/null || echo "sin nombre")}
DIR=evidencias/u3/$RUN
if [ -e "$DIR" ]; then
  echo "Ya existe $DIR. Usa un ID nuevo: las ejecuciones anteriores no se borran ni se reemplazan." >&2
  exit 1
fi
mkdir -p "$DIR/logs"
export RUN

ahora_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }
# Hora local del computador con su desfase (en Chile, -0300 en verano). No se pone el
# nombre de la zona: Git Bash no reconoce "America/Santiago" y mostraba UTC con esa
# etiqueta (corregido después de RUN01)
ahora_local() { date "+%Y-%m-%d %H:%M:%S %z (hora del computador)"; }
paso() { echo; echo "=== $* ($(ahora_local))"; echo "$(ahora_local)  $*" >> "$DIR/bitacora-run.txt"; }

SERVICIOS="frontend gateway auth clients inventory orders payments graphql-gateway"

# Guarda los logs de los servicios desde el inicio de una fase (antes de recrear contenedores)
guardar_logs() {
  docker compose logs --no-color --no-log-prefix --since "$2" $SERVICIOS > "$DIR/logs/$1-servicios.log" 2>/dev/null || true
}

# Cuando un servicio se recrea puede cambiar de IP: se reinician los que lo llaman
# para que no queden conexiones abiertas al contenedor anterior
reconectar() {
  docker compose restart gateway graphql-gateway orders payments clients > /dev/null 2>&1
  docker compose up -d --no-deps --wait gateway graphql-gateway orders payments clients > /dev/null 2>&1
}

# Corre una fase de Playwright y guarda la consola y el código de salida
fase() {
  nombre=$1; shift
  paso "Fase $nombre"
  inicio=$(ahora_utc)
  FASE=$nombre docker compose run --rm --no-deps e2e "$@" > "$DIR/consola-$nombre.txt" 2>&1
  codigo=$?
  tail -n 8 "$DIR/consola-$nombre.txt"
  echo "$nombre: codigo de salida $codigo" >> "$DIR/resumen-fases.txt"
  guardar_logs "$nombre" "$inicio"
}

# ---------- 0. Contexto ----------
paso "Contexto de la ejecución $RUN"
{
  echo "RUN: $RUN"
  echo "Ejecutor: $EJECUTOR"
  echo "Inicio: $(ahora_local)"
  echo "Commit: $(git rev-parse HEAD 2>/dev/null)"
  echo "Version: $(git describe --tags --always --dirty 2>/dev/null)"
  echo "Cambios sin commit:"; git status --porcelain 2>/dev/null | sed 's/^/  /'
  echo "Rama: $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  echo "Sistema: $(uname -a 2>/dev/null)"
  echo "Docker: $(docker version --format '{{.Server.Version}}' 2>/dev/null)"
  echo "Compose: $(docker compose version --short 2>/dev/null)"
  echo "Navegador: Chromium de mcr.microsoft.com/playwright:v1.49.1-noble"
  echo "Viewports: escritorio 1366x768; movil 390x844 (emulacion en Chromium, no un telefono fisico)"
  echo "Pagos: proveedor SIMULADO (doble de prueba), no Webpay"
} > "$DIR/entorno.txt"
cat "$DIR/entorno.txt"

# ---------- 1. Estado inicial ----------
paso "Levantar el sistema y restaurar los datos"
docker compose up -d --build --wait > "$DIR/levantar.txt" 2>&1 || { echo "El sistema no levantó: ver $DIR/levantar.txt" >&2; exit 1; }
docker compose --profile herramientas build e2e pruebas >> "$DIR/levantar.txt" 2>&1
sh scripts/reset.sh > "$DIR/reset.txt" 2>&1 || { echo "Falló el reset: ver $DIR/reset.txt" >&2; exit 1; }
docker compose ps --format "table {{.Service}}\t{{.Status}}" > "$DIR/servicios-inicio.txt"

# ---------- 2. Normal ----------
fase normal --grep-invert "@caido|@recuperado|@demora|@expira"

# ---------- 3 y 4. Inventory caído y recuperado ----------
docker compose stop inventory > /dev/null 2>&1
fase caido --grep @caido
docker compose start inventory > /dev/null 2>&1
docker compose up -d --no-deps --wait inventory > /dev/null 2>&1
reconectar
fase recuperado --grep @recuperado

# ---------- 5. Inventory demorado ----------
INVENTORY_FAULT_DELAY_MS=7000 docker compose up -d --no-deps --wait inventory > /dev/null 2>&1
reconectar
fase demora --grep @demora
INVENTORY_FAULT_DELAY_MS=0 docker compose up -d --no-deps --wait inventory > /dev/null 2>&1

# ---------- 6. Sesión expirada ----------
export AUTH_TOKEN_TTL=20
docker compose up -d --no-deps --wait auth > /dev/null 2>&1
reconectar
fase expira --grep @expira
unset AUTH_TOKEN_TTL
docker compose up -d --no-deps --wait auth > /dev/null 2>&1
reconectar

# ---------- 7. pytest ----------
paso "pytest (controles de API)"
# El gateway limita los logins a 20 por minuto por IP: se espera a que se libere
sleep 60
mkdir -p "$DIR/pytest"
inicio=$(ahora_utc)
PYTEST_SALIDA=u3/$RUN/pytest docker compose run --rm pruebas > /dev/null 2>&1
echo "pytest: codigo de salida $?" >> "$DIR/resumen-fases.txt"
tail -n 3 "$DIR/pytest/resultado.txt" 2>/dev/null
guardar_logs pytest "$inicio"

# ---------- 8. Logs por solicitud y persistencia ----------
paso "Logs por X-Request-ID y persistencia"
cat "$DIR"/playwright/*/red.jsonl 2>/dev/null \
  | grep -o '"request_id":"[^"]*"' | cut -d'"' -f4 | grep -v '^null$' | sort -u > "$DIR/logs/request-ids.txt"
for archivo in "$DIR"/logs/*-servicios.log; do
  [ -e "$archivo" ] || continue
  destino=$(echo "$archivo" | sed 's/-servicios\.log$/-trazas.log/')
  grep -F -f "$DIR/logs/request-ids.txt" "$archivo" > "$destino" 2>/dev/null || true
done

: > "$DIR/persistencia.txt"
for pedido in PED-0001 PED-0002 $(cat "$DIR"/playwright/*/operaciones.jsonl 2>/dev/null | grep -o '"id":"PED-[0-9]*"' | cut -d'"' -f4 | sort -u); do
  echo "### check pedido $pedido" >> "$DIR/persistencia.txt"
  docker compose run --rm check pedido "$pedido" >> "$DIR/persistencia.txt" 2>&1
done
for producto in 650000000000000000000001 650000000000000000000002 650000000000000000000003; do
  echo "### check producto $producto" >> "$DIR/persistencia.txt"
  docker compose run --rm check producto "$producto" >> "$DIR/persistencia.txt" 2>&1
done

# ---------- Control de credenciales ----------
paso "Revisión de credenciales en la evidencia"
if grep -rlE "session_token=|Cliente2026|Diego2026|Despacho2026|Admin2026|VAULT_ROOT_TOKEN|hvs\." "$DIR" > "$DIR/revision-credenciales.txt" 2>/dev/null; then
  echo "ATENCIÓN: hay archivos con posibles credenciales (ver revision-credenciales.txt). Revisar antes de subir." | tee -a "$DIR/revision-credenciales.txt"
else
  echo "Sin coincidencias de cookies, claves de prueba ni tokens de Vault." > "$DIR/revision-credenciales.txt"
fi
cat "$DIR/revision-credenciales.txt"

# ---------- Resumen ----------
{
  echo "Fin: $(ahora_local)"
  for junit in "$DIR"/playwright/*/junit.xml "$DIR"/pytest/junit.xml; do
    [ -e "$junit" ] || continue
    # Lee cada atributo por separado: pytest y Playwright los escriben en distinto orden
    linea=$(grep -o '<testsuites [^>]*>\|<testsuite [^>]*>' "$junit" | head -1)
    conteo=""
    for attr in tests failures skipped errors; do
      conteo="$conteo $attr=$(echo "$linea" | grep -o " $attr=\"[0-9]*\"" | grep -o '[0-9]*')"
    done
    echo "$junit:$conteo"
  done
} >> "$DIR/resumen-fases.txt"
paso "Listo"
cat "$DIR/resumen-fases.txt"
echo
echo "Evidencia en $DIR. Falta completar la ficha: cp evidencias/plantilla-ficha-u3.md $DIR/ficha.md"
