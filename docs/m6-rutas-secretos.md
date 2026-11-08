# M6. Matriz de rutas e inventario de secretos

**Fuente:** `backend/gateway/gateway.py`, `backend/graphql-gateway/main.py`, `docker-compose.yml`, `scripts/vault-init.sh` y `.env.example` en `main` (commit `5ee71b8`). Clients (S09, S10) no está implementado en la U2.

## 1. Un solo gateway

Hay un único API Gateway (`gateway`, puerto 8000). Es el único contenedor en la red pública; todos los demás (auth, inventory, orders, payments, graphql-gateway, Vault y Mongo) están en la red privada `privada`, marcada como `internal` en `docker-compose.yml`, sin entrada ni salida desde fuera. Con el volumen del caso (ver `docs/m9-carga.md`) un gateway basta.

## 2. Controles comunes a todas las rutas

| Control | Cómo funciona |
|---|---|
| Lista blanca | Solo existen las rutas de la tabla `RUTAS` y los archivos estáticos del front. Cualquier otra ruta o verbo responde 404 o 405 |
| Validación de parámetros | Los `{id}` de la ruta deben cumplir `^[A-Za-z0-9_-]{1,64}$`; si no, 400 `INVALID_ID` |
| Sesión | Cookie `session_token` (`httponly`, `samesite=lax`), validada en cada solicitud con `/introspect` de auth |
| Identidad hacia los servicios | El gateway pone `X-Authenticated-User` y `X-Authenticated-Roles` y descarta los que mande el navegador |
| Headers reenviados | Solo `content-type`, `idempotency-key` y `x-proveedor-secret`, además de los que agrega el gateway |
| Correlación | `X-Request-ID` (8 a 64 caracteres válidos se reutiliza; si no, se genera) en la respuesta y en los logs |
| Secreto por servicio | Cada servicio interno exige `X-Gateway-Secret` con el valor de su propia integración |
| Plazos | 5 s hacia los servicios (`UPSTREAM_TIMEOUT_SECONDS`): 504 si no responden, 502 si no están disponibles |
| Límite de solicitudes | No implementado en la U2 (pasa a la Etapa 4) |

## 3. Matriz de rutas

| ID | Gateway | Verbo | Ruta externa | Acceso y rol | Destino (servicio y ruta interna) | Controles propios | Referencia de credencial |
|---|---|---|---|---|---|---|---|
| S01 | gateway | GET | `/api/v1/productos` | Anónimo | inventory `/productos` | Paginación y filtro por categoría validados en inventory | `secret/gateway#backend_shared_secret` |
| S02 | gateway | GET | `/api/v1/productos/{id}` | Anónimo | inventory `/productos/{id}` | ID validado | `secret/gateway#backend_shared_secret` |
| S03 | gateway | POST | `/api/v1/productos` | ADMIN | inventory `/productos` | Rol revisado en gateway e inventory | `secret/gateway#backend_shared_secret` |
| S04 | gateway | PUT | `/api/v1/productos/{id}` | ADMIN | inventory `/productos/{id}` | Rol revisado en gateway e inventory | `secret/gateway#backend_shared_secret` |
| S05 | gateway | DELETE | `/api/v1/productos/{id}` | ADMIN | inventory `/productos/{id}` | Rol revisado en gateway e inventory | `secret/gateway#backend_shared_secret` |
| S06 | gateway | POST | `/api/v1/auth/login` | Anónimo | auth `/login` | Misma respuesta si el correo no existe o la clave está mal; deja la cookie | Ninguna (auth `/login` solo es alcanzable desde la red privada) |
| S07 | gateway | POST | `/api/v1/auth/logout` | Con o sin sesión | auth `/logout` | Borra la sesión en auth y la cookie | `secret/gateway#auth_introspection_secret` |
| S08 | gateway | GET | `/api/v1/auth/me` | Autenticado | auth `/introspect` | No reenvía el token a otros servicios | `secret/gateway#auth_introspection_secret` |
| S09 | gateway | POST | `/api/v1/clientes` | Anónimo | clients | No implementado (recorte declarado) | — |
| S10 | gateway | GET | `/api/v1/clientes/me` | CLIENTE | clients | No implementado (recorte declarado) | — |
| S11 | gateway | POST | `/api/v1/pedidos` | CLIENTE | orders `/pedidos` | `Idempotency-Key` obligatorio; precio desde inventory | `secret/gateway#orders_shared_secret` |
| S12 | gateway | GET | `/api/v1/pedidos/{id}` | Autenticado | orders `/pedidos/{id}` | Propiedad revisada en orders | `secret/gateway#orders_shared_secret` |
| S13 | gateway | POST | `/api/v1/pedidos/{id}/anular` | Autenticado | orders `/pedidos/{id}/anular` | Propiedad y estado revisados en orders | `secret/gateway#orders_shared_secret` |
| S14 | gateway | GET | `/api/v1/pedidos` | DESPACHO, ADMIN | orders `/pedidos` | DESPACHO filtrado a pedidos vendidos | `secret/gateway#orders_shared_secret` |
| S15 | gateway | PATCH | `/api/v1/pedidos/{id}/estado` | DESPACHO, ADMIN | orders `/pedidos/{id}/estado` | Solo transiciones de despacho | `secret/gateway#orders_shared_secret` |
| S16 | gateway | POST | `/api/v1/pagos` | CLIENTE | payments `/pagos` | `Idempotency-Key` obligatorio; monto desde orders | `secret/gateway#payments_shared_secret` |
| S17 | gateway | POST | `/api/v1/pagos/aviso` | Proveedor (sin sesión) | payments `/pagos/aviso` | `X-Proveedor-Secret` revisado en payments; aviso repetido no cambia nada | `secret/gateway#payments_shared_secret` y `PAYMENT_PROVIDER_SECRET` |
| S18 | gateway | POST | `/api/v1/graphql` | Autenticado | graphql-gateway `/graphql` | Rol y campo revisados en graphql-gateway; límites de profundidad, alias, tokens y paginación; solo POST | `secret/gateway#graphql_shared_secret` |
| S19 | gateway | GET | `/api/v1/reportes/ventas` | DUENO, ADMIN | orders `/reportes/ventas` | Rol revisado en gateway y orders | `secret/gateway#orders_shared_secret` |
| — | gateway | GET | `/` y archivos del front (`index.html`, `js/`, `css/`, `img/`) | Anónimo | Carpeta `frontend/`, montada en solo lectura | Solo archivos de esa carpeta; va después de las rutas de la API, así que no las tapa | Ninguna |

### Filas GraphQL

Detalle en `docs/m8-graphql.md`.

| Operación | Tipo | Campos autorizados | Resolver | Subsistemas |
|---|---|---|---|---|
| `misPedidos(pagina, porPagina)` | Query | Pedidos del CLIENTE con líneas, boleta, despacho (sin teléfono) y producto; `stock` solo ADMIN | `Query.misPedidos` + `Linea.producto` (DataLoader) | orders (`GRAPHQL_ORDERS_SECRET`) e inventory (`GRAPHQL_INVENTORY_SECRET`) |
| `pedido(id)` | Query | Un pedido propio; ajeno o inexistente devuelve `null` | `Query.pedido` + `Linea.producto` | orders e inventory |

## 4. Inventario de secretos

Solo se registran **referencias**, nunca valores. Los valores están en el archivo `.env` de cada computador, que está en `.gitignore`; `.env.example` los lista vacíos.

| Referencia | Tipo | Emisor | Consumidor | Finalidad | Ubicación | Alcance | Rotación |
|---|---|---|---|---|---|---|---|
| `VAULT_ROOT_TOKEN` | Token raíz de Vault (modo dev) | Vault al iniciar | `vault-init` | Cargar los secretos y crear el token del gateway | `.env` | Total sobre Vault | Manual, al recrear el entorno |
| `GATEWAY_VAULT_TOKEN` | Token de Vault | `vault-init` | gateway | Leer sus secretos | `.env` (variable `VAULT_TOKEN` del gateway) | Solo lectura de `secret/gateway` (política `gateway`) | Revocar y crear otro con `vault-init` |
| `secret/gateway#backend_shared_secret` (`GATEWAY_INVENTORY_SECRET`) | Secreto compartido | `.env` → `vault-init` | gateway → inventory | Que inventory solo acepte solicitudes del gateway | Vault (lado gateway) y `.env` (lado inventory) | S01 a S05 | Cambiar en `.env`, recargar Vault y reiniciar inventory |
| `secret/gateway#auth_introspection_secret` (`AUTH_INTROSPECTION_SECRET`) | Secreto compartido | `.env` → `vault-init` | gateway → auth | Validar y cerrar sesiones | Vault (lado gateway) y `.env` (lado auth) | `/introspect` y `/logout` | Igual que el anterior |
| `secret/gateway#orders_shared_secret` (`GATEWAY_ORDERS_SECRET`) | Secreto compartido | `.env` → `vault-init` | gateway → orders | Que orders solo acepte solicitudes del gateway | Vault (lado gateway) y `.env` (lado orders) | S11 a S15 y S19 | Igual que el anterior |
| `secret/gateway#payments_shared_secret` (`GATEWAY_PAYMENTS_SECRET`) | Secreto compartido | `.env` → `vault-init` | gateway → payments | Que payments solo acepte solicitudes del gateway | Vault (lado gateway) y `.env` (lado payments) | S16 y S17 | Igual que el anterior |
| `secret/gateway#graphql_shared_secret` (`GATEWAY_GRAPHQL_SECRET`) | Secreto compartido | `.env` → `vault-init` | gateway → graphql-gateway | Que graphql-gateway solo acepte solicitudes del gateway | Vault (lado gateway) y `.env` (lado graphql-gateway) | S18 | Igual que el anterior |
| `GRAPHQL_ORDERS_SECRET` | Secreto compartido (solo lectura) | `.env` | graphql-gateway → orders | Leer pedidos | `.env` (no está en Vault) | `GET /pedidos` y `GET /pedidos/{id}` | Cambiar en `.env` y reiniciar graphql-gateway y orders |
| `GRAPHQL_INVENTORY_SECRET` | Secreto compartido (solo lectura) | `.env` | graphql-gateway → inventory | Leer productos por lote | `.env` (no está en Vault) | `POST /interno/productos/lote` | Cambiar en `.env` y reiniciar graphql-gateway e inventory |
| `ORDERS_INVENTORY_SECRET` | Secreto compartido | `.env` | orders → inventory | Reservar y devolver stock | `.env` (no está en Vault) | `/interno/reservas` y `/interno/devoluciones` | Cambiar en `.env` y reiniciar orders e inventory |
| `PAYMENTS_ORDERS_SECRET` | Secreto compartido | `.env` | payments → orders | Consultar el pedido y marcarlo pagado | `.env` (no está en Vault) | `/interno/pedidos/*` | Cambiar en `.env` y reiniciar payments y orders |
| `PAYMENT_PROVIDER_SECRET` | Secreto del proveedor | `.env` (lo comparte el proveedor simulado) | proveedor → payments | Autenticar el aviso de pago | `.env` (no está en Vault) | S17 | Cambiar en `.env` y en el proveedor, reiniciar payments |
| `MONGO_ROOT_USER` / `MONGO_ROOT_PASSWORD` | Usuario y clave de base de datos | `.env` | auth, inventory, orders, payments, seed y check (graphql-gateway no usa Mongo) | Acceso a Mongo | `.env` | Usuario raíz: acceso a todas las bases | Manual, al recrear el volumen |
| `session_token` | Token de sesión | auth al iniciar sesión | navegador → gateway | Mantener la sesión | Cookie `httponly` en el navegador; en auth solo su hash SHA-256 | Una sesión | Expira por `AUTH_TOKEN_TTL` (900 s) o al cerrar sesión |

Las contraseñas de los usuarios no son secretos de integración: se guardan solo como hash bcrypt (ver `docs/m7-datos-sensibles.md`).

## 5. Qué hacer si se filtra una clave

1. Registrar la incidencia en `docs/incidencias.md` (sin escribir el valor filtrado).
2. Dar el valor por quemado: no se vuelve a usar nunca.
3. Generar un valor nuevo en `.env`.
4. Si es un secreto que está en Vault, volver a correr `vault-init` para cargarlo y reiniciar el servicio del otro lado. El gateway toma el valor nuevo en máximo 60 segundos, que es lo que dura su caché (`VAULT_CACHE_SECONDS`).
5. Si es un secreto que solo está en `.env`, reiniciar los dos servicios que lo comparten.
6. Si es el token del gateway, revocarlo en Vault y crear otro.
7. Si es una sesión, cerrarla con S07 o esperar que expire.
8. Revisar los logs con `scripts/logs.sh` para ver si se usó.

Valores que ya se dan por quemados (quedaron en el historial de git en semanas anteriores): los secretos y el token de laboratorio de las semanas 8 y 9. No se reutilizan.

## 6. Qué pasa si Vault no responde

- El gateway sigue funcionando con los secretos en caché durante 60 segundos.
- Después responde **503 `SECRETS_UNAVAILABLE`** a todas las rutas de la API, incluido el catálogo anónimo (también necesita el secreto de inventory), y registra `vault_unavailable` en su log. Las páginas del front se siguen cargando, porque no usan secretos, pero muestran el error al llamar a la API.
- Los servicios internos no dependen de Vault en la U2, porque reciben sus secretos por variables de entorno.
- Vault corre en modo dev: si se reinicia pierde los secretos, y hay que volver a correr `vault-init` (lo hace `docker compose up`).

## 7. Revisión de secretos en el repo, capturas y logs

| Dónde | Resultado |
|---|---|
| `.env` | En `.gitignore`, no está en el repo |
| `.env.example` | Solo nombres, todos vacíos |
| Logs | El gateway registra `secret_loaded` con los nombres de las claves, nunca los valores. Los logs no incluyen tokens, cookies, contraseñas ni correos |
| Evidencias (`evidencias/u2/`) | Revisadas: sin secretos ni tokens; solo datos ficticios |
| `backend/gateway/README.md` | **Pendiente de corregir:** todavía tiene las instrucciones de la Semana 8 con los secretos de laboratorio quemados. Flo lo borra en el PR de cierre |
| `frontend/js/login.js` | Muestra las cuentas de prueba del seed con sus claves, para el laboratorio. Son ficticias, pero incluyen ADMIN: no se pueden usar fuera del entorno local |

## 8. Brechas declaradas

1. **Solo el gateway lee secretos desde Vault.** Los servicios internos reciben los suyos como variables de entorno desde `.env`, y los secretos entre servicios (`ORDERS_INVENTORY_SECRET`, `PAYMENTS_ORDERS_SECRET`, `PAYMENT_PROVIDER_SECRET`, `GRAPHQL_ORDERS_SECRET` y `GRAPHQL_INVENTORY_SECRET`) no están en Vault.
2. **Una sola credencial de Mongo para todo.** Cada servicio usa su propia base (`auth`, `inventory`, `orders`, `payments`), pero todos se conectan con el usuario raíz, así que la separación no la hace cumplir la base de datos.
3. **Vault en modo dev**, con datos en memoria y token raíz en `.env`. Sirve para el entorno local, no para producción.
4. **Sin límite de solicitudes** en la U2.
5. **Cookie sin `secure`** en local (`COOKIE_SECURE=false`), porque no hay HTTPS.
