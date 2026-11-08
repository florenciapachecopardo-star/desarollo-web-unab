# Matriz de requisitos: pantalla, servicio, prueba, resultado y evidencia

Une cada requisito del Caso 19 (R01 a R13, detalle en `docs/m1-servicios.md`) con la pantalla donde se usa, el servicio que lo atiende, la prueba que lo comprueba y su evidencia. Revisada contra `main` (bdd26ff) y actualizada con las pruebas del 08-11-2026 (E07 y E08).

**Estados:** Aprobada (hay evidencia), Pendiente (la prueba existe pero no se ha ejecutado), Brecha (no se construyó en la U2).

| Requisito | Pantalla | Servicio | Prueba | Resultado | Evidencia |
|---|---|---|---|---|---|
| R01 El cliente arma un pedido con los productos disponibles | `index.html` (catálogo), `carrito.html`, `checkout.html`, `mis-pedidos.html` | S01, S11, S12, S18 | P01, P04, P06, C01 a C05, C08, C09 | Aprobada | E01, E02, E05, E06, E07, E08 |
| R02 El pedido se prepara solo después de confirmar el pago | `pago.html` | S16, S17 (S14 filtra pagados) | P06, C06, C07 | Aprobada para el pago. La cola de despacho (S14) no tiene evidencia | E03, E04, E07 |
| R03 El cliente puede anular una compra indicando el motivo | `mis-pedidos.html` (botón "Anular") | S13 | E02 | Aprobada | E02 (estado ANULADO, motivo y `stock_devuelto: true`) |
| R04 Las ventas web se asocian a la caja de un cajero virtual | No tiene pantalla (lo asigna orders) | S11 | E02 | Aprobada | E02 (`cajero_id` USR-0005) |
| R05 Registro de clientes con sus datos y validación del correo | `registro.html`, `verificar.html` | S09 (no implementado) | — | Brecha | Registro solo en localStorage |
| R06 El registro lo puede hacer el cliente o el administrador | `registro.html` (solo el cliente, local) | — | — | Brecha | — |
| R07 Administrar la disponibilidad (stock) de cada producto | `index.html`, `producto.html` (lectura); sin pantalla para administrar (panel interno no está en la U2) | S01, S03, S04 | P01, P03 | Aprobada (lectura y bloqueo a quien no es ADMIN). Crear y editar como ADMIN no tiene evidencia guardada | E01, E07 |
| R08 Boleta digital por cada venta, enviada al correo | `boleta.html` | S12, S16 | E03, E04 | Aprobada en parte: boleta numerada con neto e IVA; sin envío por correo | E03, E04 |
| R09 Reporte de ventas por período para el dueño | Sin pantalla (panel interno no está en la U2) | S19 | — | Pendiente (sin evidencia) | — |
| R10 Mantenedores de productos, usuarios y clientes | Sin pantalla (panel interno no está en la U2) | S03, S04, S05 (productos) | P03 | Productos: el permiso está probado (P03), pero no hay evidencia del ADMIN creando o editando. Usuarios y clientes: brecha | E07 |
| R11 Validar el correo con una API de mensajería | `verificar.html` (código simulado) | — | — | Brecha | — |
| R12 Autenticación con acceso según el perfil | `login.html`, menú de todas las páginas | S06, S07, S08 y el gateway | P02, P03, P04, P05 | Aprobada | E07 |
| R13 Órdenes de despacho en el orden en que llegan | Sin pantalla (panel interno no está en la U2) | S14, S15 | — | Pendiente (sin evidencia) | — |

## Pruebas que faltan

Las pruebas P01 a P06, la idempotencia, el rechazo por profundidad en GraphQL y la carga del catálogo ya se ejecutaron (E07 y E08). Quedan sin evidencia:

| Prueba | Qué comprueba | Requisitos |
|---|---|---|
| Sin ID | Cola de despacho (S14) y cambio de estado (S15) | R02, R13 |
| Sin ID | Reporte de ventas (S19) | R09 |
| Sin ID | ADMIN crea, edita y elimina un producto (S03 a S05) | R07, R10 |
| P07 | Captura de la compra completa desde el navegador | R01 |
