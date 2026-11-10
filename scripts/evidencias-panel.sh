#!/usr/bin/env bash
# Evidencias por API de los servicios sin pantalla: S03-S05, S14-S15 y S19.
# Uso: con el sistema arriba y la base recien reseteada:
#   bash scripts/evidencias-panel.sh
set -u
API=http://localhost:8000
OUT=evidencias/u2/panel-api
mkdir -p "$OUT"
JAR=$(mktemp -d)
: > "$OUT/resumen.txt"

login() { # $1 sesion, $2 correo, $3 clave
  curl -s -o /dev/null -w "login $1: %{http_code}\n" -c "$JAR/$1" \
    -H 'Content-Type: application/json' \
    -d "{\"correo\":\"$2\",\"clave\":\"$3\"}" "$API/api/v1/auth/login"
}

pedir() { # $1 sesion, $2 archivo, $3 metodo, $4 ruta, $5 cuerpo (opcional)
  local args=(-s -b "$JAR/$1" -X "$3" -D "$OUT/$2.headers.txt" -o "$OUT/$2.json" -w "%{http_code}")
  [ -n "${5:-}" ] && args+=(-H 'Content-Type: application/json' -d "$5")
  local code rid
  code=$(curl "${args[@]}" "$API$4")
  rid=$(grep -i '^x-request-id' "$OUT/$2.headers.txt" | tr -d '\r' | cut -d' ' -f2)
  echo "$2 | $3 $4 | $code | $rid" | tee -a "$OUT/resumen.txt"
}

login admin    admin@chocomania.cl    Admin2026
login despacho despacho@chocomania.cl Despacho2026
login dueno    dueno@chocomania.cl    Dueno2026

# R07 y R10: ADMIN administra un producto
pedir admin s03-crear POST /api/v1/productos \
  '{"nombre":"Trufas de cafe","descripcion":"Producto de prueba","categoria":"trufas","precio":5990,"stock":12}'
ID=$(grep -o '"id": *"[^"]*"' "$OUT/s03-crear.json" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
echo "producto creado: ${ID:-NO SE ENCONTRO EL ID}"
pedir admin s04-editar   PUT    "/api/v1/productos/$ID" '{"precio":6490,"stock":10}'
pedir admin s05-eliminar DELETE "/api/v1/productos/$ID"

# R02 y R13: cola de despacho y cambios de estado
pedir despacho s14-cola           GET   "/api/v1/pedidos?estado=PAGADO"
pedir despacho s15-en-despacho    PATCH /api/v1/pedidos/PED-0001/estado '{"estado":"EN_DESPACHO"}'
pedir despacho s15-entregado      PATCH /api/v1/pedidos/PED-0001/estado '{"estado":"ENTREGADO"}'
pedir despacho s15-salto-invalido PATCH /api/v1/pedidos/PED-0002/estado '{"estado":"ENTREGADO"}'

# R09: reporte de ventas
pedir dueno    s19-reporte   GET /api/v1/reportes/ventas
pedir despacho s19-denegado  GET /api/v1/reportes/ventas
