# M1. Matriz de servicios y contratos

**Caso:** 19, Sistema de Ventas Online, adaptado a Chocomanía (chocolatería)
**Fuente de la lista de servicios:** reparto de roles v2, sección 5.
**Contratos confirmados con el código:** S01 a S05 (PR B, gateway e inventory) y S06 a S08 (PR C, auth). S09 a S19 se confirman con los PR D, E y F.

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

| ID | R | F | Pantalla y acción | Propósito | Verbo y ruta | Acceso | Clasificación | Destino |
|---|---|---|---|---|---|---|---|---|
| S01 | R01, R07 | F01 | Catálogo: cargar la lista | Listar productos con su disponibilidad | `GET /api/v1/productos` | Anónimo | Consulta | inventory |
| S02 | R01 | F01 | Catálogo: abrir un producto | Ver el detalle de un producto | `GET /api/v1/productos/{id}` | Anónimo | Consulta | inventory |
| S03 | R07, R10 | F07 | Panel: crear producto | Agregar un producto al catálogo | `POST /api/v1/productos` | ADMIN | Transaccional | inventory |
| S04 | R07, R10 | F07 | Panel: editar producto | Cambiar datos, precio o stock | `PUT /api/v1/productos/{id}` | ADMIN | Transaccional | inventory |
| S05 | R10 | F07 | Panel: eliminar producto | Quitar un producto del catálogo | `DELETE /api/v1/productos/{id}` | ADMIN | Transaccional | inventory |
| S06 | R12 | F03 | Login: botón "Ingresar" | Iniciar sesión | `POST /api/v1/auth/login` | Anónimo | Transaccional | auth |
| S07 | R12 | F03 | Menú: "Cerrar sesión" | Cerrar sesión | `POST /api/v1/auth/logout` | Autenticado | Transaccional | auth |
| S08 | R12 | F03 | Todas: cargar el usuario actual | Saber quién es y qué rol tiene | `GET /api/v1/auth/me` | Autenticado | Consulta | auth |
| S09 | R05, R06, R11 | F02 | Registro: botón "Crear cuenta" | Registrar un cliente | `POST /api/v1/clientes` | Anónimo | Transaccional | clients |
| S10 | R05 | F04, F05 | Perfil y checkout: cargar datos | Ver el perfil propio | `GET /api/v1/clientes/me` | CLIENTE | Consulta | clients |
| S11 | R01, R04 | F04 | Checkout: botón "Confirmar pedido" | Crear un pedido, asociado a la caja del cajero virtual | `POST /api/v1/pedidos` | CLIENTE | Transaccional | orders |
| S12 | R01 | F05 | Mis pedidos: abrir un pedido | Ver el detalle de un pedido propio | `GET /api/v1/pedidos/{id}` | CLIENTE dueño, ADMIN | Consulta | orders |
| S13 | R03 | F06 | Mis pedidos: botón "Anular" | Anular un pedido con motivo | `POST /api/v1/pedidos/{id}/anular` | CLIENTE dueño, ADMIN | Transaccional | orders |
| S14 | R02, R13 | F08 | Panel: cola de despacho | Listar pedidos pagados en orden de llegada | `GET /api/v1/pedidos?estado=PAGADO` | DESPACHO, ADMIN | Consulta | orders |
| S15 | R13 | F08 | Panel: cambiar estado | Marcar en despacho o entregado | `PATCH /api/v1/pedidos/{id}/estado` | DESPACHO, ADMIN | Transaccional | orders |
| S16 | R02, R04 | F04 | Pago: botón "Pagar" | Iniciar el pago de un pedido | `POST /api/v1/pagos` | CLIENTE | Transaccional | payments |
| S17 | R02 | F04 | Sin pantalla (lo llama el proveedor) | Recibir el aviso de pago | `POST /api/v1/pagos/aviso` | Proveedor (secreto propio) | Integración | payments |
| S18 | R01 | F05 | Mis pedidos: cargar la lista | Pedidos propios con datos del producto | `POST /api/v1/graphql` (`misPedidos`) | Autenticado | Agregación | graphql-gateway |
| S19 | R09 | F09 | Panel: reporte de ventas | Ventas por período | `GET /api/v1/reportes/ventas` | DUENO, ADMIN | Analítica | orders |

## 3. Reglas comunes a todos los contratos

1. **Formato de error único:** `{ "error": { "code", "message", "request_id" } }`
2. **Validación:** si faltan campos o tienen un tipo o valor inválido, la respuesta es **422** `VALIDATION_ERROR` e indica qué campos fallaron, nunca los valores recibidos.
3. **Correlación:** toda respuesta trae el header `X-Request-ID`. El gateway lo genera o reutiliza el que manda el front, y lo propaga a los servicios internos.
4. **Lo calcula el servidor, nunca el navegador:** precio de cada línea, total del pedido, monto del pago, estado de pago y disponibilidad del producto (se calcula a partir del stock). Si el front manda esos campos, se ignoran.
5. **Identidad:** el gateway descarta los headers `X-Authenticated-*` que vengan del navegador y los vuelve a poner (`X-Authenticated-User`, `X-Authenticated-Roles`) con la sesión validada.
6. **Recurso ajeno:** si un cliente pide un pedido que no es suyo, la respuesta es 404 sin datos (no se confirma que exista).
7. **Estados en mayúsculas**, igual que en el M2: PENDIENTE_PAGO, PAGADO, EN_DESPACHO, ENTREGADO, ANULADO.
8. Todos los datos de los ejemplos son ficticios y coinciden con `scripts/seed.py` y `frontend/js/datos.js`.

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

- **Entrada:** run, nombre, direccion, comuna, provincia, region, fecha_nacimiento, sexo, correo, telefono y clave (campos del Caso 19, RF5).
- **Salida:** 201 con el cliente creado y `correo_verificado: false`.
- **Errores:** 400 RUN con dígito verificador inválido, 409 RUN o correo ya registrado, 422 datos faltantes.
- **Nota:** la validación del correo con una API de mensajería (R11) es una brecha declarada: el código se simula y se muestra en pantalla, sin envío real.

```json
{ "run": "12.345.678-5", "nombre": "Valentina Soto", "direccion": "Av. Providencia 1234", "comuna": "Providencia", "provincia": "Santiago", "region": "Región Metropolitana de Santiago", "fecha_nacimiento": "1999-04-12", "sexo": "F", "correo": "cliente@correo.cl", "telefono": "+56912345678", "clave": "Cliente2026" }
```

```json
{ "id": "CLI-0001", "correo": "cliente@correo.cl", "correo_verificado": false }
```

### S10 `GET /api/v1/clientes/me`

- **Entrada:** cookie de sesión.
- **Salida:** 200 con el perfil propio (el RUN se muestra enmascarado).
- **Errores:** 401, 403 si el rol no es CLIENTE.

```json
{ "id": "CLI-0001", "run": "**.***.678-5", "nombre": "Valentina Soto", "correo": "cliente@correo.cl", "direccion": "Av. Providencia 1234", "comuna": "Providencia", "correo_verificado": true }
```

### S11 `POST /api/v1/pedidos`

- **Entrada:** header `Idempotency-Key`, lista de líneas (producto_id y cantidad) y dirección de despacho. Si viene precio, total o cajero, se ignoran.
- **Salida:** 201 con el pedido en estado PENDIENTE_PAGO. orders toma el precio desde inventory y **asigna el `cajero_id` del cajero virtual** (R04): así cada venta web queda asociada a una caja.
- **Errores:** 401, 409 stock insuficiente, 422 líneas vacías o cantidad ≤ 0. Si se repite el mismo `Idempotency-Key`, devuelve el mismo pedido sin crear otro.

```json
{ "lineas": [ { "producto_id": "650000000000000000000001", "cantidad": 2 } ], "direccion_despacho": "Av. Providencia 1234, Providencia" }
```

```json
{ "id": "PED-0001", "estado": "PENDIENTE_PAGO", "cajero_id": "USR-0005", "lineas": [ { "producto_id": "650000000000000000000001", "nombre": "Chocolate Dubai", "cantidad": 2, "precio_unitario": 8990, "subtotal": 17980 } ], "total": 17980 }
```

### S12 `GET /api/v1/pedidos/{id}`

- **Entrada:** `id` en la ruta.
- **Salida:** 200 con el pedido.
- **Errores:** 401, 404 si no existe o es de otro cliente (sin datos).

```json
{ "id": "PED-0001", "estado": "PAGADO", "fecha": "2026-11-05T15:20:00-03:00", "cajero_id": "USR-0005", "total": 17980 }
```

### S13 `POST /api/v1/pedidos/{id}/anular`

- **Entrada:** motivo (obligatorio, RF3).
- **Salida:** 200 con el pedido en estado ANULADO. El stock se devuelve a inventory. El registro no se borra.
- **Errores:** 401, 404 ajeno o inexistente, 409 el pedido ya no está en PENDIENTE_PAGO, 422 sin motivo.

```json
{ "motivo": "Me equivoqué en la cantidad" }
```

### S14 `GET /api/v1/pedidos?estado=PAGADO`

- **Entrada:** query `estado` (en mayúsculas).
- **Salida:** 200 con los pedidos pagados, del más antiguo al más nuevo (RF13).
- **Errores:** 401, 403 si el rol no es DESPACHO ni ADMIN, 422 estado desconocido.

```json
{ "pedidos": [ { "id": "PED-0001", "fecha_pago": "2026-11-05T15:22:00-03:00", "direccion_despacho": "Av. Providencia 1234, Providencia", "lineas": [ { "nombre": "Chocolate Dubai", "cantidad": 2 } ] } ] }
```

### S15 `PATCH /api/v1/pedidos/{id}/estado`

- **Entrada:** estado nuevo (EN_DESPACHO o ENTREGADO).
- **Salida:** 200 con el pedido actualizado.
- **Errores:** 401, 403, 404, 409 transición no permitida (por ejemplo, de PENDIENTE_PAGO a ENTREGADO), 422 estado desconocido.

```json
{ "estado": "EN_DESPACHO" }
```

### S16 `POST /api/v1/pagos`

- **Entrada:** header `Idempotency-Key` y pedido_id. El monto lo saca payments desde orders.
- **Salida:** 201 con el pago en estado PENDIENTE.
- **Errores:** 401, 404 pedido ajeno o inexistente, 409 el pedido ya está pagado, 422. Si se repite el mismo `Idempotency-Key`, devuelve el mismo pago.
- **Nota:** el proveedor es un adaptador de prueba que respeta el contrato (no es Webpay).

```json
{ "pedido_id": "PED-0001" }
```

```json
{ "id": "PAG-0001", "pedido_id": "PED-0001", "monto": 17980, "estado": "PENDIENTE" }
```

### S17 `POST /api/v1/pagos/aviso`

- **Entrada:** header con el secreto propio del proveedor, pago_id, resultado y referencia del proveedor.
- **Salida:** 200. Si el resultado es APROBADO, payments avisa a orders y el pedido pasa a PAGADO. Solo payments decide que un pedido está pagado.
- **Errores:** 401 secreto inválido, 404 pago inexistente, 422. Un aviso repetido no cambia nada.

```json
{ "pago_id": "PAG-0001", "resultado": "APROBADO", "referencia_proveedor": "SIM-000123" }
```

### S18 `POST /api/v1/graphql` (`misPedidos`)

- **Entrada:** query `misPedidos` con paginación.
- **Salida:** 200 con los pedidos del usuario y el nombre de cada producto. Junta datos de orders e inventory.
- **Errores:** 401, error por superar el límite de profundidad. Si inventory no responde, la respuesta trae `errors` y marca los datos faltantes en vez de mostrarlos como completos.

```json
{ "query": "query { misPedidos(pagina: 1) { id estado total lineas { cantidad producto { nombre } } } }" }
```

```json
{ "data": { "misPedidos": [ { "id": "PED-0001", "estado": "PAGADO", "total": 17980, "lineas": [ { "cantidad": 2, "producto": { "nombre": "Chocolate Dubai" } } ] } ] } }
```

### S19 `GET /api/v1/reportes/ventas`

- **Entrada:** query `desde` y `hasta` (fechas).
- **Salida:** 200 con el total vendido y el detalle por producto. Solo cuenta pedidos PAGADO, EN_DESPACHO o ENTREGADO.
- **Errores:** 400 si `desde` es mayor que `hasta`, 401, 403, 422 fechas inválidas.

```json
{ "desde": "2026-11-01", "hasta": "2026-11-30", "total_ventas": 17980, "cantidad_pedidos": 1, "por_producto": [ { "nombre": "Chocolate Dubai", "cantidad": 2, "monto": 17980 } ] }
```

## 5. Requisitos sin servicio propio

| Requisito | Decisión | Dónde se cubre o se declara |
|---|---|---|
| R04 | **Cubierto.** orders asigna un `cajero_id` (el cajero virtual) a cada pedido web | S11 |
| R08 | **Brecha declarada.** No se emite boleta digital ni se envía por correo en la U2 | Informe, sección de brechas |
| R11 (y la validación de correo de R05) | **Brecha declarada.** La validación con API de mensajería se simula, sin envío real | S09, M7 e informe |
| R06, R10 | Pendiente: registro de clientes por el admin y mantenedores de usuarios y clientes | Por decidir con Flo |
