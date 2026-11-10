# M1. Matriz de servicios y contratos

**Caso:** 19, Sistema de Ventas Online, adaptado a Chocomanía (chocolatería)
**Fuente de la lista de servicios:** reparto de roles v2, sección 5.
**Contratos confirmados con el código de `main` (3ba032e):** S01 a S08 y S11 a S19, comparados con `gateway.py`, `auth`, `inventory`, `orders`, `payments`, `graphql-gateway` y `frontend/js`. S09, S09V y S10 se confirmaron con `backend/clients/main.py` (agregados el 9 de noviembre).
**Datos de los ejemplos:** salen de `scripts/seed.py` y de las evidencias de `evidencias/u2/`.

## 1. Identificadores

| Prefijo | Qué es | Regla |
|---|---|---|
| R | Requisito funcional del Caso 19. R01 = RF1, R02 = RF2, y así hasta R13 | No se renumeran en la U3 |
| S | Servicio o contrato expuesto por el gateway | No se renumeran en la U3 |
| F | Flujo de usuario | Base del inventario de flujos de la U3 |

### Requisitos (R)

| ID | Requisito (resumen del Caso 19) |
|---|---|
| R01 | El cliente arma un pedido con los productos disponibles |
| R02 | El pedido se prepara solo después de confirmar el pago |
| R03 | El cliente puede anular una compra indicando el motivo |
| R04 | Las ventas web se asocian a la caja de un cajero virtual (funcionario) |
| R05 | Registro de clientes con sus datos y validación del correo |
| R06 | El registro puede hacerlo el cliente en la web o el administrador en el local |
| R07 | Administrar la disponibilidad (stock) de cada producto |
| R08 | Boleta digital por cada venta, enviada al correo del cliente |
| R09 | Reporte de ventas por período para el dueño |
| R10 | Mantenedores de productos, usuarios y clientes |
| R11 | Validar que el correo existe y está activo mediante una API de mensajería |
| R12 | Autenticación de usuarios con acceso según el perfil |
| R13 | Órdenes de despacho en el orden en que llegan |

### Flujos (F)

| ID | Flujo | Rol | Requisitos |
|---|---|---|---|
| F01 | Consultar catálogo | Anónimo | R01, R07 |
| F02 | Registrarse como cliente | Anónimo | R05, R06, R11 |
| F03 | Iniciar y cerrar sesión | Todos los roles | R12 |
| F04 | Comprar y pagar | CLIENTE | R01, R02, R04 |
| F05 | Ver mis pedidos | CLIENTE | R01, R03 |
| F06 | Anular un pedido | CLIENTE dueño, ADMIN | R03 |
| F07 | Administrar productos | ADMIN | R07, R10 |
| F08 | Atender la cola de despacho | DESPACHO, ADMIN | R02, R13 |
| F09 | Consultar reporte de ventas | DUENO, ADMIN | R09 |

## 2. Matriz de servicios

| ID | R | F | Pantalla y acción | Propósito | Verbo y ruta | Acceso | Clasificación | Destino | Estado |
|---|---|---|---|---|---|---|---|---|---|
| S01 | R01, R07 | F01 | Catálogo: cargar la lista (también llena la ficha y el carrito) | Listar productos con su disponibilidad | `GET /api/v1/productos` | Anónimo | Consulta | inventory | Implementado y conectado |
| S02 | R01 | F01 | Ficha del producto | Ver el detalle de un producto | `GET /api/v1/productos/{id}` | Anónimo | Consulta | inventory | Implementado; el front no lo llama, la ficha usa los datos de S01 |
| S03 | R07, R10 | F07 | Panel: crear producto | Agregar un producto al catálogo | `POST /api/v1/productos` | ADMIN | Transaccional | inventory | Implementado; sin pantalla (el panel interno no está en la U2) |
| S04 | R07, R10 | F07 | Panel: editar producto | Cambiar datos, precio o stock | `PUT /api/v1/productos/{id}` | ADMIN | Transaccional | inventory | Implementado; sin pantalla (el panel interno no está en la U2) |
| S05 | R10 | F07 | Panel: eliminar producto | Quitar un producto del catálogo | `DELETE /api/v1/productos/{id}` | ADMIN | Transaccional | inventory | Implementado; sin pantalla (el panel interno no está en la U2) |
| S06 | R12 | F03 | Login: botón "Ingresar" | Iniciar sesión | `POST /api/v1/auth/login` | Anónimo | Transaccional | auth (vía gateway) | Implementado y conectado |
| S07 | R12 | F03 | Menú: "Cerrar sesión" | Cerrar sesión | `POST /api/v1/auth/logout` | Autenticado | Transaccional | auth (vía gateway) | Implementado y conectado |
| S08 | R12 | F03 | Todas: cargar el usuario actual | Saber quién es y qué rol tiene | `GET /api/v1/auth/me` | Autenticado | Consulta | auth (vía gateway) | Implementado y conectado |
| S09 | R05, R06, R11 | F02 | Registro: botón "Crear cuenta" | Registrar un cliente | `POST /api/v1/clientes` | Anónimo | Transaccional | clients | Implementado (S09V `POST /api/v1/clientes/{id}/verificar` para el código) (el registro sigue en localStorage) |
| S10 | R05 | F04, F05 | Perfil propio | Ver el perfil propio | `GET /api/v1/clientes/me` | CLIENTE | Consulta | clients | Implementado |
| S11 | R01, R04 | F04 | Checkout: botón "Continuar al pago" | Crear un pedido, asociado a la caja del cajero virtual | `POST /api/v1/pedidos` | CLIENTE | Transaccional | orders | Implementado y conectado |
| S12 | R01, R08 | F04 | Pago y Boleta: cargar el pedido | Ver el detalle de un pedido | `GET /api/v1/pedidos/{id}` | CLIENTE dueño, DESPACHO (pedidos pagados), ADMIN | Consulta | orders | Implementado y conectado |
| S13 | R03 | F06 | Mis pedidos: botón "Anular" | Anular un pedido con motivo | `POST /api/v1/pedidos/{id}/anular` | CLIENTE dueño, ADMIN | Transaccional | orders | Implementado y conectado |
| S14 | R02, R13 | F08 | Panel: cola de despacho | Listar pedidos pagados en orden de llegada | `GET /api/v1/pedidos?estado=PAGADO` | DESPACHO, ADMIN | Consulta | orders | Implementado; sin pantalla (el panel interno no está en la U2) |
| S15 | R13 | F08 | Panel: cambiar estado | Marcar en despacho o entregado | `PATCH /api/v1/pedidos/{id}/estado` | DESPACHO, ADMIN | Transaccional | orders | Implementado; sin pantalla (el panel interno no está en la U2) |
| S16 | R02, R08 | F04 | Pago: botón "Pagar" | Pagar un pedido propio y emitir la boleta | `POST /api/v1/pagos` | CLIENTE | Transaccional | payments | Implementado y conectado |
| S17 | R02 | F04 | Sin pantalla (lo llama el proveedor) | Recibir el aviso de pago | `POST /api/v1/pagos/aviso` | Proveedor (secreto propio) | Integración | payments | Implementado (proveedor simulado) |
| S18 | R01 | F05 | Mis pedidos: cargar la lista | Pedidos propios con datos actuales del producto | `POST /api/v1/graphql` (`misPedidos`, `pedido`) | Autenticado (las queries exigen CLIENTE) | Agregación | graphql-gateway | Implementado y conectado |
| S19 | R09 | F09 | Panel: reporte de ventas | Ventas por período | `GET /api/v1/reportes/ventas` | DUENO, ADMIN | Analítica | orders | Implementado; sin pantalla (el panel interno no está en la U2) |

**Acceso en dos capas:** el gateway revisa la sesión y el rol de la tabla (lista blanca en `gateway.py`). Para S12, S13 y S18 el gateway solo exige sesión, y la regla de propiedad la aplica orders (o graphql-gateway) con la identidad que le pasa el gateway.

## 3. Reglas comunes a todos los contratos

1. **Formato de error único:** `{ "error": { "code", "message", "request_id" } }`. S18 es la excepción cuando el error es de un campo: responde 200 con `errors[]` y `extensions.code` (formato GraphQL).
2. **Validación:** si faltan campos o tienen un tipo o valor inválido, la respuesta es **422** `VALIDATION_ERROR` e indica qué campos fallaron, nunca los valores recibidos.
3. **Correlación:** toda respuesta trae el header `X-Request-ID`. El gateway reutiliza el que manda el front si tiene entre 8 y 64 caracteres (letras, números, `-` o `_`); si no, genera uno. Lo propaga a todos los servicios internos.
4. **Lo calcula el servidor, nunca el navegador:** precio de cada línea, total del pedido, `cajero_id`, estado del pedido, monto y estado del pago, número de boleta, neto e IVA, y disponibilidad del producto (se calcula a partir del stock). Si el front manda esos campos, se ignoran.
5. **Identidad:** el gateway descarta los headers `X-Authenticated-*` que vengan del navegador y los vuelve a poner (`X-Authenticated-User`, `X-Authenticated-Roles`) con la sesión validada.
6. **Recurso ajeno:** si un cliente pide un pedido que no es suyo, la respuesta es la misma que si no existiera: 404 `ORDER_NOT_FOUND` en S12, S13 y S16, y `null` en la query `pedido` de S18.
7. **Idempotencia:** S11 y S16 exigen el header `Idempotency-Key` (8 a 64 caracteres: letras, números, `-` o `_`). Sin él, 400 `IDEMPOTENCY_KEY_REQUIRED`. Repetir la misma clave con el mismo contenido devuelve el mismo pedido o pago sin crear otro; repetirla con otro contenido da 409 `IDEMPOTENCY_CONFLICT`. La clave es por cliente.
8. **Servicio caído o lento:** 502 `UPSTREAM_UNAVAILABLE` si el servicio no responde y 504 `UPSTREAM_TIMEOUT` si se pasa del plazo (con `docker-compose.yml`: 5 s desde el gateway y 3 s desde orders, payments y graphql-gateway). En S18 una caída de inventory no tumba la respuesta: ver S18.
9. **Estados en mayúsculas**, igual que en el M2. Pedido: PENDIENTE_PAGO, PAGADO, EN_DESPACHO, ENTREGADO, ANULADO. Pago: PENDIENTE, APROBADO, RECHAZADO, REVERTIDO.
10. **Fechas** en ISO 8601 con zona UTC (por ejemplo `2026-11-06T14:16:29+00:00`).
11. Todos los datos de los ejemplos son ficticios y coinciden con `scripts/seed.py` y con las evidencias de `evidencias/u2/`.

## 4. Detalle de cada contrato

### S01 `GET /api/v1/productos`

- **Entrada:** query opcional `categoria` (barras, bombones, trufas) y `pagina` (desde 1).
- **Salida:** 200 con la lista de productos, la página y el total.
- **Errores:** 422 si `categoria` no es una de las tres o `pagina` es menor que 1.

```json
{
  "productos": [
    { "id": "650000000000000000000001", "nombre": "Chocolate Dubai", "descripcion": "Barra de chocolate con leche rellena de crema de pistacho", "categoria": "barras", "precio": 8990, "stock": 20, "disponible": true, "imagen": "img/chocolate-dubai.jpg" },
    { "id": "650000000000000000000005", "nombre": "Trufas de chocolate", "descripcion": "Trufas artesanales con cobertura de chocolate", "categoria": "trufas", "precio": 5490, "stock": 0, "disponible": false, "imagen": "img/trufas-de-chocolate.jpg" }
  ],
  "pagina": 1,
  "total": 5
}
```

### S02 `GET /api/v1/productos/{id}`

- **Entrada:** `id` en la ruta.
- **Salida:** 200 con el producto.
- **Errores:** 400 `INVALID_ID` si el ID tiene formato inválido, 404 `PRODUCT_NOT_FOUND` si no existe.

```json
{ "id": "650000000000000000000003", "nombre": "Bombones rellenos", "descripcion": "Bombones de chocolate con centro de crema", "categoria": "bombones", "precio": 6990, "stock": 10, "disponible": true, "imagen": "img/bombones-rellenos.jpg" }
```

### S03 `POST /api/v1/productos`

- **Entrada:** nombre, descripcion (opcional), categoria (barras, bombones o trufas), precio (entero > 0), stock (entero ≥ 0) e imagen (opcional). `disponible` no se recibe: se calcula del stock.
- **Salida:** 201 con el producto creado.
- **Errores:** 401 sin sesión, 403 `FORBIDDEN` si no es ADMIN (lo revisan el gateway e inventory), 422 datos inválidos.

```json
{ "nombre": "Trufas de café", "descripcion": "Trufas rellenas de ganache de café", "categoria": "trufas", "precio": 5990, "stock": 12, "imagen": null }
```

### S04 `PUT /api/v1/productos/{id}`

- **Entrada:** uno o más campos de S03 (solo se cambian los que vienen).
- **Salida:** 200 con el producto actualizado.
- **Errores:** 400 si no viene ningún campo o el ID es inválido, 401, 403, 404, 422.

```json
{ "precio": 9490, "stock": 18 }
```

### S05 `DELETE /api/v1/productos/{id}`

- **Entrada:** `id` en la ruta.
- **Salida:** 200 con un mensaje de confirmación.
- **Errores:** 400 ID inválido, 401, 403 si no es ADMIN, 404.

```json
{ "mensaje": "Producto eliminado correctamente" }
```

### S06 `POST /api/v1/auth/login`

- **Entrada:** correo y clave.
- **Salida:** 200 `{ "status": "OK" }` y la sesión queda en una cookie `httponly` (`session_token`) que expira según `AUTH_TOKEN_TTL`. El token no se devuelve en el cuerpo.
- **Errores:** 400 si el cuerpo no es JSON, 422 si falta correo o clave, 401 `INVALID_CREDENTIALS` (mismo mensaje si el correo no existe o la clave está mal). El límite de intentos (429) queda para la Etapa 4.

```json
{ "correo": "cliente@correo.cl", "clave": "Cliente2026" }
```

```json
{ "status": "OK" }
```

### S07 `POST /api/v1/auth/logout`

- **Entrada:** cookie de sesión.
- **Salida:** 200 `{ "status": "OK" }`. La sesión se borra en auth y se elimina la cookie. Si no había sesión, responde igual.

### S08 `GET /api/v1/auth/me`

- **Entrada:** cookie de sesión.
- **Salida:** 200 con el usuario actual.
- **Errores:** 401 `UNAUTHENTICATED` sin cookie, 401 `SESSION_INVALID` si la sesión expiró o no existe.

```json
{ "user_id": "USR-0001", "roles": ["CLIENTE"], "nombre": "Valentina Soto" }
```

### S09 `POST /api/v1/clientes`

Registro del cliente (`registro.html`). clients guarda el perfil y le pide a auth crear la credencial (rol CLIENTE, inactiva). La clave viaja una sola vez y auth guarda solo su hash bcrypt.

- **Entrada:** run, nombre, direccion, comuna, provincia, region, nacimiento (fecha), sexo, correo, telefono y clave (mínimo 6). El servidor vuelve a validar todo: RUN con dígito verificador, correo, teléfono y fecha no futura.
- **Salida:** 201 con `{id, verificado: false, codigo_simulado}`. `codigo_simulado` reemplaza al correo mientras no exista la mensajería (brecha R11).
- **Errores:** 409 `CLIENT_EXISTS` (RUN o correo ya registrado, mismo mensaje para no revelar cuál), 422 datos inválidos, 429 `RATE_LIMITED`, 502 si auth no responde.

```json
{ "run": "12.345.678-5", "nombre": "Valentina Soto", "direccion": "Av. Providencia 1234", "comuna": "Providencia", "provincia": "Santiago", "region": "Región Metropolitana de Santiago", "nacimiento": "1999-04-12", "sexo": "Femenino", "correo": "nueva@correo.cl", "telefono": "+56912345678", "clave": "ClaveFicticia1" }
```

```json
{ "id": "USR-3FA2B91C", "verificado": false, "codigo_simulado": "482913" }
```

### S09V `POST /api/v1/clientes/{id}/verificar`

Verificación del correo (`verificar.html`). Si el código coincide con su hash, clients marca el perfil y auth activa la credencial. Antes de esto el login responde 401.

- **Entrada:** `{ "codigo": "482913" }` (6 dígitos).
- **Salida:** 200 `{ "id": "USR-3FA2B91C", "verificado": true }`.
- **Errores:** 400 `INVALID_CODE` (código malo, cuenta inexistente o ya verificada: mismo mensaje), 422, 429.

### S10 `GET /api/v1/clientes/me`

Perfil propio. El id sale de la identidad que pone el gateway, nunca de la URL, así que no hay forma de pedir el perfil de otro.

- **Salida:** 200 con `{id, run (enmascarado), nombre, correo, telefono, direccion, comuna, provincia, region, verificado}`. No devuelve clave, código, fecha de nacimiento ni sexo (no los necesita ninguna pantalla).
- **Errores:** 401 sin sesión, 403 si el rol no es CLIENTE, 404 si el usuario no tiene perfil.

```json
{ "id": "USR-0001", "run": "**.***.111-1", "nombre": "Valentina Soto", "correo": "cliente@correo.cl", "telefono": "+56911111111", "direccion": "Calle Ficticia 1", "comuna": "Providencia", "provincia": "Santiago", "region": "Region Metropolitana de Santiago", "verificado": true }
```

### S11 `POST /api/v1/pedidos`

- **Entrada:** header `Idempotency-Key` y cuerpo con `lineas` (1 a 20, cada una con `producto_id` y `cantidad` de 1 a 20, sin repetir producto) y `despacho` (`direccion` de 3 a 120 caracteres, `comuna` de 2 a 60 y `telefono` opcional de hasta 20). Si viene precio, total, estado o cajero, se ignoran.
- **Salida:** 201 con el pedido en estado PENDIENTE_PAGO. orders reserva el stock en inventory (que devuelve el precio vigente), calcula subtotales y total, y **asigna el `cajero_id` del cajero virtual** USR-0005 (R04). Si se repite el mismo `Idempotency-Key` con el mismo cuerpo, devuelve el mismo pedido sin descontar stock otra vez.
- **Errores:** 400 `IDEMPOTENCY_KEY_REQUIRED`, 400 `BAD_REQUEST` si un producto aparece dos veces, 400 `INVALID_ID` si un `producto_id` tiene formato inválido, 401, 403 `FORBIDDEN` si no es CLIENTE, 404 `PRODUCT_NOT_FOUND`, 409 `STOCK_INSUFICIENTE`, 409 `IDEMPOTENCY_CONFLICT`, 422, 502 o 504 si inventory no responde.
- **Evidencia:** `evidencias/u2/pedido-idempotente/`.

```json
{ "lineas": [ { "producto_id": "650000000000000000000001", "cantidad": 2 } ], "despacho": { "direccion": "Calle Ficticia 1", "comuna": "Providencia", "telefono": null } }
```

```json
{
  "id": "PED-0003", "cliente_id": "USR-0001", "estado": "PENDIENTE_PAGO", "cajero_id": "USR-0005",
  "lineas": [ { "producto_id": "650000000000000000000001", "nombre": "Chocolate Dubai", "precio_unitario": 8990, "cantidad": 2, "subtotal": 17980 } ],
  "total": 17980,
  "creado_en": "2026-11-06T14:16:29+00:00",
  "historial": [ { "estado": "PENDIENTE_PAGO", "fecha": "2026-11-06T14:16:29+00:00", "por": "USR-0001" } ],
  "despacho": { "direccion": "Calle Ficticia 1", "comuna": "Providencia", "telefono": null }
}
```

### S12 `GET /api/v1/pedidos/{id}`

- **Entrada:** `id` en la ruta.
- **Salida:** 200 con el pedido, en el mismo formato de S11. Si está pagado trae `boleta` (R08 parcial); si está anulado trae `motivo_anulacion`. El `despacho` solo lo ven el dueño, DESPACHO y ADMIN (M7). Lo usan `pago.html` y `boleta.html`.
- **Errores:** 400 `INVALID_ID`, 401, 404 `ORDER_NOT_FOUND` si no existe o es de otro cliente (DESPACHO tampoco ve pedidos sin pagar).

```json
{
  "id": "PED-0003", "cliente_id": "USR-0001", "estado": "PAGADO", "cajero_id": "USR-0005",
  "lineas": [ { "producto_id": "650000000000000000000001", "nombre": "Chocolate Dubai", "precio_unitario": 8990, "cantidad": 2, "subtotal": 17980 } ],
  "total": 17980,
  "creado_en": "2026-11-06T14:16:29+00:00",
  "historial": [
    { "estado": "PENDIENTE_PAGO", "fecha": "2026-11-06T14:16:29+00:00", "por": "USR-0001" },
    { "estado": "PAGADO", "fecha": "2026-11-06T14:16:31+00:00", "por": "payments" }
  ],
  "despacho": { "direccion": "Calle Ficticia 1", "comuna": "Providencia", "telefono": null },
  "boleta": { "numero": "B-000002", "fecha": "2026-11-06T14:16:31+00:00", "neto": 15109, "iva": 2871, "total": 17980 }
}
```

### S13 `POST /api/v1/pedidos/{id}/anular`

- **Entrada:** `motivo` (obligatorio, de 3 a 200 caracteres, RF3).
- **Salida:** 200 con el pedido en estado ANULADO y `motivo_anulacion`. El registro no se borra. El cambio de estado es atómico: si llegan dos anulaciones juntas, solo una devuelve el stock. Si inventory no responde al devolver, el pedido igual queda anulado, se guarda `stock_devuelto: false` y se registra el evento `stock_return_failed` en el log.
- **Errores:** 400 `INVALID_ID`, 401, 404 `ORDER_NOT_FOUND` ajeno o inexistente, 409 `TRANSICION_INVALIDA` si el pedido ya no está en PENDIENTE_PAGO, 422 sin motivo o muy corto.

```json
{ "motivo": "me equivoque de producto" }
```

### S14 `GET /api/v1/pedidos?estado=PAGADO`

- **Entrada:** query opcional `estado` (en mayúsculas), `pagina` (desde 1) y `por_pagina` (1 a 50, por defecto 20).
- **Salida:** 200 con `{ pedidos, pagina, total }`, del más antiguo al más nuevo según `creado_en` (RF13). Sin `estado`, DESPACHO recibe PAGADO, EN_DESPACHO y ENTREGADO, y ADMIN recibe todos.
- **Errores:** 401, 403 si el rol no es DESPACHO ni ADMIN (lo revisa el gateway) o si DESPACHO pide un estado sin pagar (PENDIENTE_PAGO o ANULADO), 422 estado desconocido.

```json
{
  "pedidos": [
    { "id": "PED-0001", "cliente_id": "USR-0001", "estado": "PAGADO", "cajero_id": "USR-0005",
      "lineas": [ { "producto_id": "650000000000000000000001", "nombre": "Chocolate Dubai", "precio_unitario": 8990, "cantidad": 1, "subtotal": 8990 },
                  { "producto_id": "650000000000000000000003", "nombre": "Bombones rellenos", "precio_unitario": 6990, "cantidad": 2, "subtotal": 13980 } ],
      "total": 22970, "creado_en": "2026-11-02T15:00:00+00:00",
      "despacho": { "direccion": "Calle Ficticia 123", "comuna": "Providencia", "telefono": "+56900000000" },
      "boleta": { "numero": "B-000001", "fecha": "2026-11-02T15:00:00+00:00", "neto": 19303, "iva": 3667, "total": 22970 } }
  ],
  "pagina": 1,
  "total": 1
}
```

(Ejemplo resumido: cada pedido trae también su `historial`.)

### S15 `PATCH /api/v1/pedidos/{id}/estado`

- **Entrada:** `estado` nuevo. Solo se permite PAGADO → EN_DESPACHO y EN_DESPACHO → ENTREGADO. PAGADO lo pone únicamente payments.
- **Salida:** 200 con el pedido actualizado y una entrada nueva en `historial`.
- **Errores:** 400 `INVALID_ID`, 401, 403, 404 `ORDER_NOT_FOUND`, 409 `TRANSICION_INVALIDA` (por ejemplo, de PENDIENTE_PAGO a ENTREGADO, o pedir PAGADO o ANULADO), 422 estado desconocido.

```json
{ "estado": "EN_DESPACHO" }
```

### S16 `POST /api/v1/pagos`

- **Entrada:** header `Idempotency-Key` y `pedido_id`. El monto lo saca payments desde orders; no se reciben datos de tarjeta (M7).
- **Salida:** 201 con el pago. Con el proveedor simulado en modo `inmediato` (el de `docker-compose.yml`), el pago vuelve APROBADO y payments le avisa a orders, que pasa el pedido a PAGADO y numera la boleta. En modo `aviso`, el pago queda PENDIENTE hasta que llega S17. Si el pago está aprobado pero orders no alcanzó a registrarlo, viene `pedido_sincronizado: false` y payments reintenta cada 15 s.
- **Errores:** 400 `IDEMPOTENCY_KEY_REQUIRED`, 401, 403 si no es CLIENTE, 404 `ORDER_NOT_FOUND` pedido ajeno o inexistente, 409 `PEDIDO_NO_PAGABLE` si el pedido no está en PENDIENTE_PAGO, 409 `IDEMPOTENCY_CONFLICT`, 422, 502 o 504 si orders no responde al consultar el pedido.
- **Nota:** el proveedor es un doble de prueba que respeta el contrato (no es Webpay).
- **Evidencia:** `evidencias/u2/pago-idempotente/` y `evidencias/u2/pago-orders-caido/`.

```json
{ "pedido_id": "PED-0003" }
```

```json
{
  "id": "PAG-0002", "pedido_id": "PED-0003", "monto": 17980, "estado": "APROBADO", "proveedor": "simulado",
  "creado_en": "2026-11-06T14:16:31+00:00",
  "pedido_sincronizado": true,
  "boleta": { "numero": "B-000002", "fecha": "2026-11-06T14:16:31+00:00", "neto": 15109, "iva": 2871, "total": 17980 }
}
```

### S17 `POST /api/v1/pagos/aviso`

- **Entrada:** header `X-Proveedor-Secret` (secreto propio del proveedor) y cuerpo con `pago_id`, `resultado` (APROBADO o RECHAZADO) y `referencia_proveedor`. El gateway la deja pasar sin sesión porque la llama el proveedor; payments revisa el secreto.
- **Salida:** 200 con el pago. Si el resultado es APROBADO, payments avisa a orders y el pedido pasa a PAGADO con su boleta. Solo payments decide que un pedido está pagado. Un aviso repetido no cambia nada (si el pago estaba aprobado pero sin sincronizar, aprovecha de reintentar). Si el pedido ya estaba pagado con otro pago, este queda REVERTIDO.
- **Errores:** 401 `INVALID_PROVIDER_SIGNATURE` secreto inválido, 404 `PAYMENT_NOT_FOUND`, 422.

```json
{ "pago_id": "PAG-0002", "resultado": "APROBADO", "referencia_proveedor": "SIM-PAG-0002" }
```

### S18 `POST /api/v1/graphql`

- **Entrada:** cuerpo `{ query, variables }`. Solo POST y sin GraphiQL. Dos queries, ambas solo para CLIENTE:
  - `misPedidos(pagina, porPagina)`: pedidos propios del más antiguo al más nuevo (`porPagina` de 1 a 20, por defecto 10). Devuelve `{ items, pagina, porPagina, total }`.
  - `pedido(id)`: un pedido propio; si es ajeno o no existe, `null`.
- **Tipos:** Pedido (`id`, `estado`, `total`, `creadoEn`, `boleta`, `despacho`, `lineas`), Linea (`productoId`, `nombre`, `cantidad`, `precioUnitario`, `subtotal`, `producto`, `pedido`), Producto (`id`, `nombre`, `categoria`, `imagen`, `disponible`, `stock`), Boleta y Despacho (`direccion` y `comuna`, sin teléfono).
- **Salida:** 200 con `data`. Junta orders (pedidos) e inventory (estado actual de cada producto) con una sola llamada a inventory por consulta (DataLoader).
- **Límites:** profundidad 6, 10 alias y 1000 tokens. Si se pasan, la consulta se rechaza entera.
- **Errores:** 401 sin sesión (HTTP, lo responde el gateway). Los demás van en `errors[]` con `extensions.code`: `FORBIDDEN` si el rol no es CLIENTE, `BAD_REQUEST` paginación fuera de rango, `FORBIDDEN_FIELD` si se pide `stock` sin ser ADMIN, `UPSTREAM_UNAVAILABLE`, `UPSTREAM_TIMEOUT` o `UPSTREAM_ERROR` si un servicio falla. Si inventory no responde, los pedidos igual llegan y `producto` viene `null` con su error (error parcial).
- **Evidencia:** `evidencias/u2/graphql-agregacion/` y `evidencias/u2/graphql-error-parcial/`.

```json
{ "query": "query MisPedidos($pagina: Int!) { misPedidos(pagina: $pagina, porPagina: 10) { total items { id estado total boleta { numero } lineas { nombre cantidad producto { disponible imagen } } } } }", "variables": { "pagina": 1 } }
```

```json
{ "data": { "misPedidos": { "total": 2, "items": [
  { "id": "PED-0001", "estado": "PAGADO", "total": 22970, "boleta": { "numero": "B-000001" },
    "lineas": [ { "nombre": "Chocolate Dubai", "cantidad": 1, "producto": { "disponible": true, "imagen": "img/chocolate-dubai.jpg" } },
                { "nombre": "Bombones rellenos", "cantidad": 2, "producto": { "disponible": true, "imagen": "img/bombones-rellenos.jpg" } } ] },
  { "id": "PED-0003", "estado": "PENDIENTE_PAGO", "total": 15980, "boleta": null,
    "lineas": [ { "nombre": "Chocolate Dubai", "cantidad": 1, "producto": { "disponible": true, "imagen": "img/chocolate-dubai.jpg" } },
                { "nombre": "Bombones rellenos", "cantidad": 1, "producto": { "disponible": true, "imagen": "img/bombones-rellenos.jpg" } } ] }
] } } }
```

Con inventory caído (error parcial, resumido):

```json
{ "data": { "misPedidos": { "items": [ { "id": "PED-0001", "estado": "PAGADO", "lineas": [ { "nombre": "Chocolate Dubai", "producto": null } ] } ] } },
  "errors": [ { "message": "inventory no esta disponible", "path": ["misPedidos", "items", 0, "lineas", 0, "producto"], "extensions": { "code": "UPSTREAM_UNAVAILABLE" } } ] }
```

### S19 `GET /api/v1/reportes/ventas`

- **Entrada:** query opcional `desde` y `hasta` (fechas `AAAA-MM-DD`). Sin fechas, cuenta todo.
- **Salida:** 200 con la cantidad de pedidos, el total vendido y el detalle por producto (de mayor a menor monto). Solo cuenta pedidos PAGADO, EN_DESPACHO o ENTREGADO, y los ubica en el día en que se pagaron (`pagado_en`), no en el que se crearon. No incluye datos personales de clientes.
- **Errores:** 400 `BAD_REQUEST` si `desde` es mayor que `hasta`, 401, 403 si el rol no es DUENO ni ADMIN, 422 fechas inválidas.

```json
{
  "desde": "2026-11-01", "hasta": "2026-11-30",
  "cantidad_pedidos": 1, "total_ventas": 22970,
  "por_producto": [
    { "producto_id": "650000000000000000000003", "nombre": "Bombones rellenos", "cantidad": 2, "monto": 13980 },
    { "producto_id": "650000000000000000000001", "nombre": "Chocolate Dubai", "cantidad": 1, "monto": 8990 }
  ]
}
```

(Datos de `scripts/seed.py` recién reseteado.)

## 5. Estado de los requisitos

| Requisito | Estado | Dónde se cubre o se declara |
|---|---|---|
| R01 | **Cubierto** | S01, S11, S12, S18 |
| R02 | **Cubierto.** El pedido pasa a PAGADO solo cuando payments lo confirma, y solo los pagados entran a la cola de despacho | S14, S16, S17 |
| R03 | **Cubierto.** Anulación con motivo, sin borrar el registro y con devolución de stock | S13 |
| R04 | **Cubierto.** orders asigna el `cajero_id` USR-0005 (cajero virtual) a cada pedido web | S11 |
| R05 | Registro con RUN validado y verificación del correo (simulada, sin mensajería) en el servicio clients | S09, S09V, S10 |
| R06 | **Brecha declarada.** No hay registro por el administrador | Informe |
| R07 | **Cubierto** en el backend; sin pantalla (el panel interno no está en la U2) | S01, S03, S04 |
| R08 | **Parcial.** Se emite una boleta numerada con neto e IVA (19 %) al pagar y se ve en `boleta.html`; no se envía por correo | S12, S16, informe |
| R09 | **Cubierto** en el backend; sin pantalla (el panel interno no está en la U2) | S19 |
| R10 | **Parcial.** Mantenedor de productos sí (S03 a S05); usuarios y clientes no | Informe |
| R11 (y la validación de correo de R05) | **Brecha declarada.** La validación se simula en `verificar.html`, sin envío real | M7, informe |
| R12 | **Cubierto.** Sesión con cookie httponly y permisos por rol en el gateway y en cada servicio | S06, S07, S08, M4 |
| R13 | **Cubierto** en el backend; sin pantalla (el panel interno no está en la U2) | S14, S15 |

## 6. Cambios respecto de la versión anterior (INCR-04)

| Servicio | Antes | Ahora (código de `main`) |
|---|---|---|
| S02 | Lo usaba la ficha del producto | El front no lo llama: la ficha usa los datos de S01 |
| S09, S09V, S10 | Confirmados con `backend/clients/main.py` y `tests/api/test_clientes.py` | Implementados |
| S11 | `direccion_despacho` como texto; respuesta sin `cliente_id`, `creado_en` ni `historial` | `despacho { direccion, comuna, telefono }`; respuesta completa; errores 400 `IDEMPOTENCY_KEY_REQUIRED`, 400 producto repetido, 404 `PRODUCT_NOT_FOUND`, 409 `STOCK_INSUFICIENTE` y 409 `IDEMPOTENCY_CONFLICT` |
| S12 | Flujo F05, solo dueño y ADMIN; respuesta resumida con `fecha` | Flujo F04 (lo usan Pago y Boleta; Mis pedidos usa S18); también DESPACHO (pedidos pagados); trae `boleta` y `historial` |
| S14 | Respuesta `{ pedidos }` con `fecha_pago` | `{ pedidos, pagina, total }` con el pedido completo, paginado y ordenado por `creado_en` |
| S16 | Requisitos R02 y R04; el pago volvía PENDIENTE | Requisitos R02 y R08 (emite la boleta); vuelve APROBADO con la boleta (modo inmediato) o PENDIENTE (modo aviso); se agrega `pedido_sincronizado` y el error 409 `PEDIDO_NO_PAGABLE` |
| S17 | Sin códigos de error | 401 `INVALID_PROVIDER_SIGNATURE`, 404 `PAYMENT_NOT_FOUND` y estado REVERTIDO |
| S18 | `misPedidos` devolvía una lista | `misPedidos` devuelve `{ items, pagina, porPagina, total }`; se agrega `pedido(id)`, los límites y los códigos de error |
| S19 | Contaba por fecha del pedido | Cuenta por `pagado_en`; agrega `producto_id` en el detalle |
| R08 | Brecha | Parcial (boleta sin correo) |
