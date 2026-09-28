# Gateway Seguro de Chocomanía

Este Gateway agrega autenticación con Bearer Token y administración de secretos con HashiCorp Vault, delante de la API de Productos (Semana6/bocato-api).

## Requisitos
- Docker (para correr Vault)
- Python 3.11+

## 1. Levantar Vault (modo desarrollo)
docker run --name vault-dev -p 8200:8200 -e VAULT_DEV_ROOT_TOKEN_ID=dev-only-token -d hashicorp/vault

## 2. Guardar los secretos en Vault
docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=dev-only-token vault-dev vault kv put secret/gateway client_token="student-token-123" backend_shared_secret="gateway-api-secret-456"

## 3. Levantar la API de Productos protegida (Semana6/bocato-api)

Requiere la variable `INTERNAL_GATEWAY_SECRET` (debe ser igual al `backend_shared_secret` guardado en Vault).

En Windows PowerShell:
$env:INTERNAL_GATEWAY_SECRET="gateway-api-secret-456"
uvicorn main:app --host 0.0.0.0 --port 8001

## 4. Levantar el Gateway Seguro

En Windows PowerShell, desde esta carpeta:
$env:VAULT_ADDR="http://127.0.0.1:8200"
$env:VAULT_TOKEN="dev-only-token"
$env:BACKEND_URL="http://127.0.0.1:8001"
pip install -r requirements.txt
uvicorn gateway:app --host 0.0.0.0 --port 8000


## 5. Probar los escenarios de seguridad

Sin token (esperado: 401):
curl http://localhost:8000/api/productos


Token incorrecto (esperado: 401):
curl -H "Authorization: Bearer token-incorrecto" http://localhost:8000/api/productos

Token válido (esperado: 200):

curl -H "Authorization: Bearer student-token-123" http://localhost:8000/api/productos


Acceso directo al backend sin secreto interno (esperado: 403):

curl http://localhost:8001/productos

Nota: a partir de este PR, el Gateway anterior (Semana7/api-gateway) deja de poder llamar a la API de Productos sin el header X-Gateway-Secret, ya que el backend ahora exige esa credencial. Este Gateway Seguro es el que reemplaza a ese flujo.
