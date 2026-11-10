# M4. Matriz de permisos (parte 2)

La parte 1 (registro de stakeholders) está en `docs/m4-stakeholders.md`.

**Fuente:** código del gateway, auth, inventory, orders, payments y graphql-gateway en `main` (commit `5ee71b8`). S09 y S10 (clients) no están implementados en la U2: el registro y el perfil quedan en el front con localStorage.

## 1. Cómo se decide un permiso

1. **Gateway:** la ruta tiene que estar en la lista blanca (`RUTAS` en `backend/gateway/gateway.py`). Si la ruta pide sesión, el gateway valida la cookie con auth (`/introspect`). Si pide un rol, el gateway lo revisa. Después reenvía la identidad en `X-Authenticated-User` y `X-Authenticated-Roles`, y descarta los que haya mandado el navegador.
2. **Servicio:** cada servicio exige el secreto del gateway (`X-Gateway-Secret`) y vuelve a revisar el rol o la propiedad del recurso. La regla de propiedad (un cliente solo ve lo suyo) la revisan orders y payments, no solo el gateway.

Códigos: **✅** permitido, **401** sin sesión o sesión inválida, **403** rol sin permiso, **404** recurso ajeno o inexistente (no se confirma que exista), **409** el estado no lo permite.

## 2. Matriz por servicio y rol

| ID | Verbo y ruta | Servicio | Anónimo | CLIENTE | ADMIN | DUENO | CAJERO | DESPACHO | Condición | Dónde se verifica |
|---|---|---|---|---|---|---|---|---|---|---|
| S01 | `GET /api/v1/productos` | inventory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Ninguna | Gateway (ruta anónima) e inventory (secreto del gateway) |
| S02 | `GET /api/v1/productos/{id}` | inventory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Ninguna | Gateway e inventory |
| S03 | `POST /api/v1/productos` | inventory | 401 | 403 | ✅ | 403 | 403 | 403 | Solo ADMIN | Gateway (rol) e inventory (`verify_admin`) |
| S04 | `PUT /api/v1/productos/{id}` | inventory | 401 | 403 | ✅ | 403 | 403 | 403 | Solo ADMIN | Gateway e inventory |
| S05 | `DELETE /api/v1/productos/{id}` | inventory | 401 | 403 | ✅ | 403 | 403 | 403 | Solo ADMIN | Gateway e inventory |
| S06 | `POST /api/v1/auth/login` | auth | ✅ | — | — | — | — | — | Correo y clave correctos | auth (bcrypt) |
| S07 | `POST /api/v1/auth/logout` | auth | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Sin sesión responde igual (no hay nada que cerrar) | Gateway y auth |
| S08 | `GET /api/v1/auth/me` | auth | 401 | ✅ | ✅ | ✅ | ✅ | ✅ | Sesión vigente | Gateway (`/introspect` en auth) |
| S09 | `POST /api/v1/clientes` | clients | ✅ | — | — | — | — | — | Registro anónimo con límite de 10 por minuto por IP; RUN y correo únicos; la cuenta queda inactiva hasta verificar | Gateway (límite) y clients (validación); la credencial la crea auth con el secreto propio de clients |
| S09V | `POST /api/v1/clientes/{id}/verificar` | clients | ✅ | — | — | — | — | — | Código de 6 dígitos correcto; mismo error si la cuenta no existe | Gateway (límite) y clients (hash del código) |
| S10 | `GET /api/v1/clientes/me` | clients | 401 | Solo el suyo | 403 | 403 | 403 | 403 | El id sale de la sesión, no de la URL: no existe forma de pedir otro perfil | Gateway (rol) y clients (`cliente_autenticado`) |
| S11 | `POST /api/v1/pedidos` | orders | 401 | ✅ | 403 | 403 | 403 | 403 | Solo CLIENTE, con `Idempotency-Key` | Gateway (rol) y orders (rol) |
| S12 | `GET /api/v1/pedidos/{id}` | orders | 401 | Solo los suyos (ajeno 404) | ✅ todos | 404 | 404 | Solo pedidos vendidos (otros 404) | Propiedad del pedido | Gateway (sesión) y orders (`puede_ver`) |
| S13 | `POST /api/v1/pedidos/{id}/anular` | orders | 401 | Solo los suyos (ajeno 404) | ✅ | 404 | 404 | 404 | Pedido en PENDIENTE_PAGO (si no, 409) y motivo obligatorio | Gateway (sesión) y orders (propiedad y estado) |
| S14 | `GET /api/v1/pedidos` | orders | 401 | 403 | ✅ todos | 403 | 403 | Solo vendidos (pedir otro estado da 403) | Rol y estado pedido | Gateway (rol) y orders (filtro por rol) |
| S15 | `PATCH /api/v1/pedidos/{id}/estado` | orders | 401 | 403 | ✅ | 403 | 403 | ✅ | Solo PAGADO → EN_DESPACHO → ENTREGADO (otra transición 409) | Gateway (rol) y orders (rol y transición) |
| S16 | `POST /api/v1/pagos` | payments | 401 | Solo pedidos suyos (ajeno 404) | 403 | 403 | 403 | 403 | Pedido en PENDIENTE_PAGO (si no, 409), con `Idempotency-Key` | Gateway (rol) y payments (rol y propiedad) |
| S17 | `POST /api/v1/pagos/aviso` | payments | Solo el proveedor con su secreto (sin secreto 401) | | | | | | Header `X-Proveedor-Secret` válido | payments (`verify_proveedor`) |
| S18 | `POST /api/v1/graphql` | graphql-gateway | 401 | Solo sus pedidos (ajeno `null`) | Error `FORBIDDEN` | Error `FORBIDDEN` | Error `FORBIDDEN` | Error `FORBIDDEN` | Queries solo para CLIENTE; el campo `Producto.stock` solo para ADMIN (`FORBIDDEN_FIELD`) | Gateway (sesión), graphql-gateway (rol y campo) y orders (propiedad) |
| S19 | `GET /api/v1/reportes/ventas` | orders | 401 | 403 | ✅ | ✅ | 403 | 403 | Solo DUENO o ADMIN | Gateway (rol) y orders (rol) |

## 3. Operaciones internas (no expuestas por el gateway)

No están en la lista blanca, así que desde fuera responden 404. Solo las puede llamar el servicio que tiene el secreto de esa integración.

| Operación | Quién la llama | Secreto que exige | Para qué |
|---|---|---|---|
| `POST /interno/reservas` (inventory) | orders | `ORDERS_INVENTORY_SECRET` | Descontar stock y obtener el precio vigente al crear un pedido |
| `POST /interno/devoluciones` (inventory) | orders | `ORDERS_INVENTORY_SECRET` | Devolver el stock al anular un pedido |
| `GET /interno/pedidos/{id}` (orders) | payments | `PAYMENTS_ORDERS_SECRET` | Consultar dueño, estado y total del pedido (el monto nunca lo manda el navegador) |
| `POST /interno/pedidos/{id}/pagado` (orders) | payments | `PAYMENTS_ORDERS_SECRET` | Marcar el pedido como PAGADO y emitir la boleta. Solo payments puede hacerlo |
| `POST /introspect` y `POST /logout` (auth) | gateway | `auth_introspection_secret` | Validar y cerrar sesiones |
| `POST /graphql` (graphql-gateway) | gateway | `graphql_shared_secret` | Ejecutar las queries de S18 con la identidad ya validada |
| `GET /pedidos` y `GET /pedidos/{id}` (orders) | graphql-gateway | `GRAPHQL_ORDERS_SECRET` | Leer los pedidos del cliente. Con este secreto orders no acepta escrituras |
| `POST /interno/productos/lote` (inventory) | graphql-gateway | `GRAPHQL_INVENTORY_SECRET` | Leer varios productos en una sola llamada (batching) |

## 4. Reglas que salen de la matriz

1. **Propiedad:** un CLIENTE solo ve, anula y paga sus propios pedidos. Lo revisan orders (S12, S13, y S18 a través de GraphQL) y payments (S16), no solo el gateway. Un pedido ajeno responde 404 por REST y `null` por GraphQL, igual que uno inexistente.
2. **Anular no es borrar:** el pedido pasa a ANULADO, guarda el motivo y el historial, y devuelve el stock.
3. **PAGADO lo decide solo payments**, mediante una operación interna de orders. Ni el cliente ni DESPACHO pueden poner un pedido en PAGADO.
4. **DESPACHO** solo ve pedidos vendidos (PAGADO, EN_DESPACHO o ENTREGADO), y la dirección solo de esos pedidos.
5. **DUENO** solo ve el reporte de ventas (totales por producto, sin datos personales de clientes).
6. **CAJERO** no tiene rutas operativas en la U2: orders le asigna cada pedido web con `cajero_id` (R04). Puede iniciar y cerrar sesión.
7. **Defensa en profundidad:** las rutas con rol se revisan dos veces (gateway y servicio). Si alguien llegara a un servicio sin pasar por el gateway, no tendría el secreto y recibiría 403.
