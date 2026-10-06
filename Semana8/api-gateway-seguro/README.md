# Gateway Seguro de Chocomanía

Este Gateway coordina autenticación (vía Auth Service), administración de secretos (Vault) y autorización por rol, antes de enrutar hacia la API de Productos.

## Arquitectura
Frontend -> Gateway (:8000) -> Auth Service (:8100) para login/sesión
Gateway -> Vault (:8200) para secretos
Gateway -> Backend Productos (:8001) con identidad propagada

## 1. Levantar Vault

docker run --name vault-dev -p 8200:8200 -e VAULT_DEV_ROOT_TOKEN_ID=dev-only-token -d hashicorp/vault

## 2. Guardar los secretos en Vault

docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=dev-only-token vault-dev vault kv put secret/gateway backend_shared_secret="gateway-api-secret-456" auth_introspection_secret="gateway-auth-secret-789"

## 3. Levantar el Auth Service

Desde Semana9/auth-service:
$env:AUTH_INTROSPECTION_SECRET="gateway-auth-secret-789"
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8100

## 4. Levantar la API de Productos protegida

Desde Semana6/bocato-api:
$env:INTERNAL_GATEWAY_SECRET="gateway-api-secret-456"
uvicorn main:app --host 0.0.0.0 --port 8001

## 5. Levantar el Gateway

Desde esta carpeta:
$env:VAULT_ADDR="http://127.0.0.1:8200"
$env:VAULT_TOKEN="dev-only-token"
$env:AUTH_URL="http://127.0.0.1:8100"
$env:BACKEND_URL="http://127.0.0.1:8001"
pip install -r requirements.txt
uvicorn gateway:app --host 0.0.0.0 --port 8000

## 6. Probar los escenarios

Backend directo sin secreto (esperado 403):
curl http://localhost:8001/productos

Login incorrecto (esperado 401):
curl -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d "{\"username\":\"ana\",\"password\":\"incorrecta\"}"

Login correcto como ana (esperado 200, guarda la cookie):
curl -c cookies.txt -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d "{\"username\":\"ana\",\"password\":\"1234\"}"

Consultar productos autenticada (esperado 200):
curl -b cookies.txt http://localhost:8000/api/productos

Ana intenta borrar (esperado 403, no es admin):
curl -b cookies.txt -X DELETE http://localhost:8000/api/productos/alguna-id

Login como ernesto (admin) y borrar (esperado 200):
curl -c cookies-admin.txt -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d "{\"username\":\"ernesto\",\"password\":\"admin123\"}"
curl -b cookies-admin.txt -X DELETE http://localhost:8000/api/productos/alguna-id

Logout (esperado 200), y luego /auth/me debería dar 401:
curl -b cookies.txt -X POST http://localhost:8000/auth/logout
curl -b cookies.txt http://localhost:8000/auth/me
