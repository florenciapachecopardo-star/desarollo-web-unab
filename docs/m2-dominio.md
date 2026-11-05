# M2. Modelo del dominio

Diagrama: `docs/uml-dominio.drawio` (se abre en app.diagrams.net)

## 1. Clases

| Clase | Qué representa | Servicio dueño |
|---|---|---|
| Usuario | Cuenta para iniciar sesión, con un rol | auth |
| Rol | CLIENTE, ADMIN, DUENO, CAJERO, DESPACHO | auth |
| Cliente | Persona que compra, identificada por su RUN | clients |
| Producto | Chocolate, bombón o trufa del catálogo, con precio y stock | inventory |
| Pedido | Compra de un cliente, con su estado | orders |
| LineaPedido | Un producto dentro de un pedido, con cantidad y precio | orders |
| Boleta | Comprobante de un pedido pagado | orders |
| Pago | Intento de pago de un pedido | payments |

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
| R01 | El precio de cada línea se copia desde inventory al crear el pedido. No se acepta el precio que manda el front | orders |
| R02 | El stock nunca queda negativo. Si no alcanza, el pedido se rechaza | inventory |
| R03 | Un `Idempotency-Key` repetido devuelve el mismo pedido o pago, sin crear otro | orders, payments |
| R04 | Un cliente solo puede ver y anular sus propios pedidos. ADMIN puede ver todos | orders |
| R05 | Al anular un pedido, el stock de sus líneas se devuelve a inventory | orders, inventory |
| R06 | El total del pedido es la suma de los subtotales de sus líneas | orders |
| R07 | Un pedido tiene como máximo un pago APROBADO | payments |
| R08 | La boleta se emite solo cuando el pedido pasa a PAGADO | orders |
| R09 | El correo del usuario y el RUN del cliente son únicos. El RUN se valida con su dígito verificador | auth, clients |
| R10 | La contraseña se guarda solo como hash bcrypt | auth |
| R11 | Solo DESPACHO o ADMIN cambian un pedido a EN_DESPACHO o ENTREGADO | orders |

## 4. Estados del pedido

| Desde | Hacia | Quién | Cuándo |
|---|---|---|---|
| (nuevo) | PENDIENTE_PAGO | CLIENTE | Al crear el pedido |
| PENDIENTE_PAGO | PAGADO | payments | Llega el aviso de pago aprobado |
| PENDIENTE_PAGO | ANULADO | CLIENTE dueño, ADMIN | Anulación (devuelve stock) |
| PAGADO | EN_DESPACHO | DESPACHO, ADMIN | Sale a reparto |
| EN_DESPACHO | ENTREGADO | DESPACHO, ADMIN | Se entrega |

## 5. Pendiente de confirmar con el código

Los nombres exactos de los estados y atributos se confirman cuando se mergee el PR D (orders). Si cambian, se actualizan este archivo y el diagrama.
