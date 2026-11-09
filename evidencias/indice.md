# Índice de evidencias

Cada evidencia tiene su ficha, hecha con `evidencias/plantilla-ficha.md`. Las de la Entrega 2 van en `evidencias/u2/` y las de la Entrega 3 en `evidencias/u3/`.

## Entrega 2 (U2)

| ID | Qué demuestra | Módulo | Ficha | Captura o archivo |
|---|---|---|---|---|
| E01 | Hito Etapa 1: catálogo anónimo (S01) con el mismo `X-Request-ID` en la respuesta y en los logs del gateway y de inventory. Aprobada | M5, M6, M10 | `u2/hito-etapa1/ficha.md` | `u2/hito-etapa1/respuesta.txt`, `u2/hito-etapa1/logs.txt`, `u2/hito-etapa1/servicios.txt` |
| E02 | Crear un pedido (S11) con `Idempotency-Key`, precio del servidor y `cajero_id`, con el mismo `request_id` en gateway, auth, inventory y orders, y anularlo (S13) con motivo y devolución de stock. Aprobada | M5, M7, M10 | `u2/pedido-idempotente/ficha-E02.md` | `u2/pedido-idempotente/logs.txt`, `u2/pedido-idempotente/persistencia.txt` |
| E03 | Pagar un pedido (S16): monto desde orders, pedido PAGADO por payments y boleta B-000002, con el mismo `request_id` en cuatro servicios. Aprobada | M3, M7, M10 | `u2/pago-idempotente/ficha-E03.md` | `u2/pago-idempotente/logs.txt`, `u2/pago-idempotente/persistencia-pago.txt`, `u2/pago-idempotente/persistencia-pedido.txt` |
| E04 | Aviso de pago (S17) con orders caído: el pago no se pierde y el pedido queda PAGADO al volver orders (reconciliación). También muestra un `X-Request-ID` generado por el gateway. Aprobada | M3, M10 | `u2/pago-orders-caido/ficha-E04.md` | `u2/pago-orders-caido/logs.txt`, `u2/pago-orders-caido/persistencia-pago.txt`, `u2/pago-orders-caido/persistencia-pedido.txt` |
| E05 | `misPedidos` por GraphQL (S18) junta orders e inventory con una sola llamada a inventory (DataLoader). Aprobada | M8, M10 | `u2/graphql-agregacion/ficha-E05.md` | `u2/graphql-agregacion/respuesta.json`, `u2/graphql-agregacion/logs.txt` |
| E06 | `misPedidos` con inventory caído: pedidos visibles y `producto` null con `UPSTREAM_UNAVAILABLE` (error parcial). Aprobada | M8, M10 | `u2/graphql-error-parcial/ficha-E06.md` | `u2/graphql-error-parcial/respuesta.json`, `u2/graphql-error-parcial/logs.txt` |
| E07 | 16 pruebas automáticas con pytest: P01 a P06, idempotencia de S11 y S16, Idempotency-Key obligatorio, sin stock, INC04 y rechazo por profundidad en GraphQL. Aprobada (16 de 16) | M4, M7, M8, M10 | `u2/pytest/ficha-E07.md` | `u2/pytest/resultado.txt`, `u2/pytest/junit.xml`, `u2/pytest/logs.txt` |
| E08 | Carga del catálogo con k6: primera ejecución fallida (p95 3,2 s, INC06) y segunda aprobada después del arreglo (p95 19 ms, 65 req/s, 0 % de errores) | M9 | `u2/ficha-E08.md` | `u2/k6-catalogo-antes.json`, `u2/k6-catalogo.json` |
| E09 | Compra completa desde el navegador (PED-0004, boleta B-000003), vista de celular y aviso de Mis pedidos con inventory caído (P07). Aprobada | M8, M10 | `u2/front/ficha-E09.md` | `u2/front/01-catalogo.png` a `u2/front/10-mis-pedidos-inventory-recuperado.png` |

## Entrega 3 (U3)

| ID | Qué demuestra | Módulo | Ficha | Captura o archivo |
|---|---|---|---|---|
| | | | | |
