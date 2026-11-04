#!/bin/sh
# Carga los secretos de desarrollo en Vault y crea un token de solo lectura
# para el gateway. Nunca imprime los valores de los secretos.
set -eu

: "${VAULT_ADDR:?Falta VAULT_ADDR}"
: "${VAULT_TOKEN:?Falta VAULT_TOKEN}"
: "${GATEWAY_VAULT_TOKEN:?Falta GATEWAY_VAULT_TOKEN}"
: "${GATEWAY_INVENTORY_SECRET:?Falta GATEWAY_INVENTORY_SECRET}"
: "${AUTH_INTROSPECTION_SECRET:?Falta AUTH_INTROSPECTION_SECRET}"

vault kv put secret/gateway \
  backend_shared_secret="$GATEWAY_INVENTORY_SECRET" \
  auth_introspection_secret="$AUTH_INTROSPECTION_SECRET" > /dev/null
echo "vault-init: secretos cargados en secret/gateway"

echo 'path "secret/data/gateway" { capabilities = ["read"] }' | vault policy write gateway - > /dev/null
echo "vault-init: politica gateway (solo lectura de secret/gateway)"

if vault token lookup "$GATEWAY_VAULT_TOKEN" > /dev/null 2>&1; then
  echo "vault-init: el token del gateway ya existia"
else
  vault token create -id="$GATEWAY_VAULT_TOKEN" -policy=gateway -orphan -no-default-policy > /dev/null
  echo "vault-init: token del gateway creado con la politica gateway"
fi
