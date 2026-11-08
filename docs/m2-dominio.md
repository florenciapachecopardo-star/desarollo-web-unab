# M2. Modelo del dominio

Diagrama: `docs/uml-dominio.drawio` (se abre en app.diagrams.net)

**Estado:** confirmado con el código de `main` (bdd26ff): `scripts/seed.py`, `inventory/models.py`, `orders/main.py` y `payments/main.py`. Las reglas usan el prefijo **D** (dominio) para no confundirlas con los requisitos R del M1.

## 1. Clases

| Clase | Qué representa | Servicio dueño |
|---|---|---|
| Usuario | Cuenta para iniciar sesión, con un rol | auth |
| Rol | CLIENTE, ADMIN, DUENO, CAJERO, DESPACHO | auth |
| Cliente | Persona que compra, identificada por su RUN. **No implementado en la U2** (el servicio clients es una brecha); hoy el comprador es el Usuario con rol CLIENTE | clients |
| Producto | Producto del catálogo (categoría barras, bombones o trufas), con precio y stock. `disponible` se calcula desde el stock | inventory |
| Pedido | Compra de un cliente, con su estado, el cajero virtual asignado, la dirección de despacho y el historial de estados | orders |
| LineaPedido | Un producto dentro de un pedido, con cantidad y precio | orders |
| Boleta | Comprobante de un pedido pagado, con número correlativo, neto e IVA. Va dentro del pedido | orders |
| Pago | Intento de pago de un pedido (PENDIENTE, APROBADO, RECHAZADO o REVERTIDO) | payments |

## 2. Multiplicidades

| Relación | Multiplicidad | Lectura |
|---|---|---|
| Cliente – Usuario | 1 a 0..1 | Un cliente puede tener o no una cuenta. Un cliente registrado por el admin o atendido en caja puede no tenerla |
| Cliente – Pedido | 1 a 0..* | Un cliente puede tener cero o muchos pedidos. Cada pedido es de un solo cliente |
| Pedido – LineaPedido | 1 a 1..* (composición) | Un pedido tiene al menos una línea. Si el pedido no existe, sus líneas tampoco |
| LineaPedido – Producto | 0..* a 1 | Cada línea apunta a un producto. Un producto puede estar en muchas líneas |
| Pedido – Pago | 1 a 0..* | Un pedido puede tener varios intentos de pago (por ejemplo, uno rechazado y otro aprobado) |
| Pedido – Boleta | 1 a 0..1 (composición) | Un pedido tiene boleta solo cuando está pagado |

## 3. Reglas del dominio

| ID | Regla | Dónde se aplica |
|---|---|---|
| D01 | El precio de cada línea se copia desde inventory al crear el pedido. No se acepta el precio que manda el front | orders |
| D02 | El stock nunca queda negativo. Si no alcanza, el pedido se rechaza | inventory |
| D03 | Un `Idempotency-Key` repetido devuelve el mismo pedido o pago, sin crear otro | orders, payments |
| D04 | Un cliente solo puede ver y anular sus propios pedidos (uno ajeno responde 404). DESPACHO ve los pagados y ADMIN todos | orders |
| D05 | Al anular un pedido, el stock de sus líneas se devuelve a inventory | orders, inventory |
| D06 | El total del pedido es la suma de los subtotales de sus líneas | orders |
| D07 | Un pedido tiene como máximo un pago APROBADO. Si llega un segundo aprobado, queda REVERTIDO | payments, orders |
| D08 | La boleta se emite solo cuando el pedido pasa a PAGADO | orders |
| D09 | El correo del usuario es único. El RUN del cliente sería único y validado con dígito verificador (clients no implementado) | auth, clients |
| D10 | La contraseña se guarda solo como hash bcrypt | auth |
| D11 | Solo DESPACHO o ADMIN cambian un pedido a EN_DESPACHO o ENTREGADO | orders |
| D12 | Cada pedido web queda asociado al cajero virtual USR-0005 | orders |
| D13 | El pedido guarda una copia de los nombres, precios y dirección: si cambian después, el pedido no cambia | orders |

## 4. Estados del pedido

| Desde | Hacia | Quién | Cuándo |
|---|---|---|---|
| (nuevo) | PENDIENTE_PAGO | CLIENTE | Al crear el pedido |
| PENDIENTE_PAGO | PAGADO | payments | Llega el aviso de pago aprobado |
| PENDIENTE_PAGO | ANULADO | CLIENTE dueño, ADMIN | Anulación (devuelve stock) |
| PAGADO | EN_DESPACHO | DESPACHO, ADMIN | Sale a reparto |
| EN_DESPACHO | ENTREGADO | DESPACHO, ADMIN | Se entrega |

## 5. Confirmación con el código

Los estados y atributos se confirmaron con orders y payments (PR #32 y #33). Cambios respecto de la primera versión del diagrama:

- Los ID de usuario, pedido y pago son textos con prefijo (`USR-0001`, `PED-0003`, `PAG-0002`); los productos usan ObjectId.
- Usuario tiene `roles` (lista) y `nombre`; Producto usa `categoria` (barras, bombones, trufas) e `imagen`.
- Pedido agrega `cliente_id`, `cajero_id`, `creado_en`, `pagado_en`, `despacho`, `historial` y `motivo_anulacion`.
- Boleta usa número con formato `B-000002`, neto e IVA, y no tiene correo de destino (R08 parcial).
- Pago agrega el estado REVERTIDO, el proveedor y `pedido_sincronizado`.
- Cliente queda marcado como no implementado en la U2.
