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

## Entrega 3 (U3)

| ID | Qué demuestra | Módulo | Ficha | Captura o archivo |
|---|---|---|---|---|
| | | | | |
