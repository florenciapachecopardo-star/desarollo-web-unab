# M1. Matriz de servicios y contratos

**Caso:** 19, Sistema de Ventas Online, adaptado a Chocomanía (chocolatería)
**Fuente de la lista de servicios:** reparto de roles v2, sección 5. Se confirma al mergear el PR B (gateway).

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
| F04 | Comprar y pagar | CLIENTE | R01, R02, R04, R08 |
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
| S11 | R01, R04 | F04 | Checkout: botón "Confirmar pedido" | Crear un pedido | `POST /api/v1/pedidos` | CLIENTE | Transaccional | orders |
| S12 | R01 | F05 | Mis pedidos: abrir un pedido | Ver el detalle de un pedido propio | `GET /api/v1/pedidos/{id}` | CLIENTE dueño, ADMIN | Consulta | orders |
| S13 | R03 | F06 | Mis pedidos: botón "Anular" | Anular un pedido con motivo | `POST /api/v1/pedidos/{id}/anular` | CLIENTE dueño, ADMIN | Transaccional | orders |
| S14 | R02, R13 | F08 | Panel: cola de despacho | Listar pedidos pagados en orden de llegada | `GET /api/v1/pedidos?estado=pagado` | DESPACHO, ADMIN | Consulta | orders |
| S15 | R13 | F08 | Panel: cambiar estado | Marcar en despacho o entregado | `PATCH /api/v1/pedidos/{id}/estado` | DESPACHO, ADMIN | Transaccional | orders |
| S16 | R02, R04 | F04 | Pago: botón "Pagar" | Iniciar el pago de un pedido | `POST /api/v1/pagos` | CLIENTE | Transaccional | payments |
| S17 | R02 | F04 | Sin pantalla (lo llama el proveedor) | Recibir el aviso de pago | `POST /api/v1/pagos/aviso` | Proveedor (secreto propio) | Integración | payments |
| S18 | R01 | F05 | Mis pedidos: cargar la lista | Pedidos propios con datos del producto | `POST /api/v1/graphql` (`misPedidos`) | Autenticado | Agregación | graphql-gateway |
| S19 | R09 | F09 | Panel: reporte de ventas | Ventas por período | `GET /api/v1/reportes/ventas` | DUENO, ADMIN | Analítica | orders |

## 3. Reglas comunes a todos los contratos

1. **Formato de error único:** `{ "error": { "code", "message", "request_id" } }`
2. **Correlación:** toda respuesta trae el header `X-Request-ID`. El gateway lo genera o reutiliza el que manda el front.
3. **Lo calcula el servidor, nunca el navegador:** precio de cada línea, total del pedido, monto del pago y estado de pago. Si el front manda esos campos, se ignoran.
4. **Identidad:** el gateway descarta los headers `X-Authenticated-*` que vengan del navegador y los vuelve a poner con la sesión validada.
5. **Recurso ajeno:** si un cliente pide un pedido que no es suyo, la respuesta es 404 sin datos (no se confirma que exista).
6. Todos los datos de los ejemplos son ficticios.

## 4. Detalle de cada contrato

### S01 `GET /api/v1/productos`

- **Entrada:** query opcional `tipo` (chocolate, bombon, trufa) y `pagina`.
- **Salida:** 200 con la lista de productos.
- **Errores:** 400 si `tipo` no es válido.

```json
{
  "productos": [
    { "id": "665f1a2b3c4d5e6f7a8b9c01", "nombre": "Bombones surtidos 12 unidades", "tipo": "bombon", "precio": 8990, "disponible": true },
    { "id": "665f1a2b3c4d5e6f7a8b9c02", "nombre": "Trufas de cacao 70%", "tipo": "trufa", "precio": 6490, "disponible": false }
  ],
  "pagina": 1
}
```

### S02 `GET /api/v1/productos/{id}`

- **Entrada:** `id` en la ruta.
- **Salida:** 200 con el producto.
- **Errores:** 400 ID con formato inválido, 404 no existe.

```json
{ "id": "665f1a2b3c4d5e6f7a8b9c01", "nombre": "Bombones surtidos 12 unidades", "descripcion": "Caja de bombones rellenos", "tipo": "bombon", "precio": 8990, "stock": 25, "disponible": true }
```

### S03 `POST /api/v1/productos`

- **Entrada:** nombre, descripcion, tipo, precio (entero > 0), stock (entero ≥ 0).
- **Salida:** 201 con el producto creado.
- **Errores:** 400 datos inválidos, 401 sin sesión, 403 no es ADMIN.

```json
{ "nombre": "Tableta chocolate amargo", "descripcion": "Tableta de 100 g", "tipo": "chocolate", "precio": 3990, "stock": 40 }
```

### S04 `PUT /api/v1/productos/{id}`

- **Entrada:** los mismos campos de S03.
- **Salida:** 200 con el producto actualizado.
- **Errores:** 400, 401, 403, 404.

```json
{ "nombre": "Tableta chocolate amargo", "descripcion": "Tableta de 100 g", "tipo": "chocolate", "precio": 4290, "stock": 35 }
```

### S05 `DELETE /api/v1/productos/{id}`

- **Entrada:** `id` en la ruta.
- **Salida:** 204 sin cuerpo.
- **Errores:** 401, 403 no es ADMIN (se revisa en el gateway y en el servicio), 404.

```json
{ "error": { "code": "FORBIDDEN", "message": "Solo un administrador puede eliminar productos", "request_id": "b7e2c1d4-0a9f-4c3e-8f21-5d6a7b8c9e01" } }
```

### S06 `POST /api/v1/auth/login`

- **Entrada:** correo y clave.
- **Salida:** 200, deja la sesión en una cookie `httponly` y devuelve el usuario sin datos sensibles.
- **Errores:** 400 faltan campos, 401 credenciales inválidas (mismo mensaje si el correo no existe), 429 demasiados intentos (Etapa 4).

```json
{ "correo": "cliente1@chocomania.test", "clave": "clave-ficticia-1" }
```

```json
{ "usuario": { "id": "u-0001", "rol": "CLIENTE" } }
```

### S07 `POST /api/v1/auth/logout`

- **Entrada:** cookie de sesión.
- **Salida:** 204, la sesión se invalida y se borra la cookie.
- **Errores:** 401 sin sesión.

### S08 `GET /api/v1/auth/me`

- **Entrada:** cookie de sesión.
- **Salida:** 200 con el usuario actual.
- **Errores:** 401 sin sesión o sesión expirada.

```json
{ "id": "u-0001", "correo": "cliente1@chocomania.test", "rol": "CLIENTE" }
```

### S09 `POST /api/v1/clientes`

- **Entrada:** run, nombre, direccion, comuna, provincia, region, fecha_nacimiento, sexo, correo, telefono y clave (campos del Caso 19, RF5).
- **Salida:** 201 con el cliente creado y `correo_verificado: false`.
- **Errores:** 400 RUN con dígito verificador inválido o datos faltantes, 409 RUN o correo ya registrado.
- **Nota:** la validación del correo es simulada (código mostrado en pantalla, sin envío real). Se declara como brecha.

```json
{ "run": "12.345.678-5", "nombre": "Valentina Soto Pérez", "direccion": "Av. Ficticia 123", "comuna": "Maipú", "provincia": "Santiago", "region": "Metropolitana", "fecha_nacimiento": "1999-04-12", "sexo": "F", "correo": "valentina.soto@chocomania.test", "telefono": "+56900000000", "clave": "clave-ficticia-2" }
```

```json
{ "id": "c-0001", "correo": "valentina.soto@chocomania.test", "correo_verificado": false }
```

### S10 `GET /api/v1/clientes/me`

- **Entrada:** cookie de sesión.
- **Salida:** 200 con el perfil propio (el RUN se muestra enmascarado).
- **Errores:** 401, 403 si el rol no es CLIENTE.

```json
{ "id": "c-0001", "run": "**.***.678-5", "nombre": "Valentina Soto Pérez", "correo": "valentina.soto@chocomania.test", "direccion": "Av. Ficticia 123", "comuna": "Maipú", "correo_verificado": true }
```

### S11 `POST /api/v1/pedidos`

- **Entrada:** header `Idempotency-Key`, lista de líneas (producto_id y cantidad) y dirección de despacho. Si viene precio o total, se ignora.
- **Salida:** 201 con el pedido en estado PENDIENTE_PAGO. El precio lo toma orders desde inventory.
- **Errores:** 400 líneas vacías o cantidad ≤ 0, 401, 409 stock insuficiente. Si se repite el mismo `Idempotency-Key`, devuelve el mismo pedido sin crear otro.

```json
{ "lineas": [ { "producto_id": "665f1a2b3c4d5e6f7a8b9c01", "cantidad": 2 } ], "direccion_despacho": "Av. Ficticia 123, Maipú" }
```

```json
{ "id": "PED-0001", "estado": "PENDIENTE_PAGO", "lineas": [ { "producto_id": "665f1a2b3c4d5e6f7a8b9c01", "nombre": "Bombones surtidos 12 unidades", "cantidad": 2, "precio_unitario": 8990, "subtotal": 17980 } ], "total": 17980 }
```

### S12 `GET /api/v1/pedidos/{id}`

- **Entrada:** `id` en la ruta.
- **Salida:** 200 con el pedido.
- **Errores:** 401, 404 si no existe o es de otro cliente (sin datos).

```json
{ "id": "PED-0001", "estado": "PAGADO", "fecha": "2026-11-05T15:20:00-03:00", "total": 17980, "boleta": { "numero": 1001 } }
```

### S13 `POST /api/v1/pedidos/{id}/anular`

- **Entrada:** motivo (obligatorio, RF3).
- **Salida:** 200 con el pedido en estado ANULADO. El stock se devuelve a inventory. El registro no se borra.
- **Errores:** 400 sin motivo, 401, 404 ajeno o inexistente, 409 el pedido ya no está en PENDIENTE_PAGO.

```json
{ "motivo": "Me equivoqué en la cantidad" }
```

### S14 `GET /api/v1/pedidos?estado=pagado`

- **Entrada:** query `estado`.
- **Salida:** 200 con los pedidos pagados, del más antiguo al más nuevo (RF13).
- **Errores:** 401, 403 si el rol no es DESPACHO ni ADMIN.

```json
{ "pedidos": [ { "id": "PED-0001", "fecha_pago": "2026-11-05T15:22:00-03:00", "direccion_despacho": "Av. Ficticia 123, Maipú", "lineas": [ { "nombre": "Bombones surtidos 12 unidades", "cantidad": 2 } ] } ] }
```

### S15 `PATCH /api/v1/pedidos/{id}/estado`

- **Entrada:** estado nuevo (EN_DESPACHO o ENTREGADO).
- **Salida:** 200 con el pedido actualizado.
- **Errores:** 400 estado desconocido, 401, 403, 404, 409 transición no permitida (por ejemplo, de PENDIENTE_PAGO a ENTREGADO).

```json
{ "estado": "EN_DESPACHO" }
```

### S16 `POST /api/v1/pagos`

- **Entrada:** header `Idempotency-Key` y pedido_id. El monto lo saca payments desde orders.
- **Salida:** 201 con el pago en estado PENDIENTE.
- **Errores:** 400, 401, 404 pedido ajeno o inexistente, 409 el pedido ya está pagado. Si se repite el mismo `Idempotency-Key`, devuelve el mismo pago.
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
- **Errores:** 401 secreto inválido, 404 pago inexistente. Un aviso repetido no cambia nada.

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
{ "data": { "misPedidos": [ { "id": "PED-0001", "estado": "PAGADO", "total": 17980, "lineas": [ { "cantidad": 2, "producto": { "nombre": "Bombones surtidos 12 unidades" } } ] } ] } }
```

### S19 `GET /api/v1/reportes/ventas`

- **Entrada:** query `desde` y `hasta` (fechas).
- **Salida:** 200 con el total vendido y el detalle por producto. Solo cuenta pedidos PAGADO, EN_DESPACHO o ENTREGADO.
- **Errores:** 400 fechas inválidas o `desde` mayor que `hasta`, 401, 403.

```json
{ "desde": "2026-11-01", "hasta": "2026-11-30", "total_ventas": 17980, "cantidad_pedidos": 1, "por_producto": [ { "nombre": "Bombones surtidos 12 unidades", "cantidad": 2, "monto": 17980 } ] }
```

## 5. Requisitos sin servicio propio (pendiente de decisión)

| Requisito | Qué falta | Decisión |
|---|---|---|
| R04 | Venta por el cajero virtual. El rol CAJERO existe, pero no tiene ruta | Pendiente: agregar servicio o declarar brecha |
| R08 | Emitir la boleta digital y enviarla por correo | Pendiente: agregar servicio o declarar brecha |
| R06, R10 | Que el admin registre clientes, y mantenedores de usuarios y clientes | Pendiente: agregar servicio o declarar brecha |
| R05, R11 | Validar el correo con una API de mensajería | Pendiente. Si queda simulado, se declara en el informe |
