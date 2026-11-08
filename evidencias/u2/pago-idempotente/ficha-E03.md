# Ficha de evidencia E03: pago de un pedido con boleta y el mismo request_id en cuatro servicios

| Campo | Valor |
|---|---|
| ID | E03 |
| Nombre de la prueba | Pagar un pedido con `Idempotency-Key`, con monto tomado de orders, pedido marcado PAGADO por payments y boleta numerada |
| Módulo | M3 (payments → orders), M7 (el monto no lo manda el navegador) y M10 (logs con ID de correlación) |
| Requisito relacionado | R02, R08 (parcial) |
| Servicio y ruta | S16 `POST /api/v1/pagos` |
| Rol que ejecuta | CLIENTE (USR-0001) |
| Fecha y hora | 06-11-2026, 11:16 (America/Santiago), según los logs (14:16:31 UTC) |
| Ejecutada por | Flo |
| Código | El de `7537e34` (PR #33, payments), commit de las 11:21 que incluye estos archivos |
| Entorno | Stack de `docker-compose.yml` en el equipo de Flo, proveedor simulado en modo `inmediato` |
| Estado | **Aprobada** (con los límites de abajo) |

## Precondiciones

- Stack levantado y base con el seed.
- Sesión como `cliente@correo.cl` y un pedido propio PED-0003 en PENDIENTE_PAGO: 2 "Chocolate Dubai", total 17980.

## Pasos

Reconstruidos a partir de los archivos de evidencia. El comando exacto lo confirma Flo.

1. Enviar `POST /api/v1/pagos` con `X-Request-ID: pagar-pedido-0001`, `Idempotency-Key: pago-0001` y `{ "pedido_id": "PED-0003" }`.
2. Guardar los logs con `scripts/logs.sh pagar-pedido-0001` en `logs.txt`.
3. Consultar en Mongo el pago (`check pago PAG-0002`) y el pedido (`check pedido PED-0003`) y guardarlos en `persistencia-pago.txt` y `persistencia-pedido.txt`.

## Resultado esperado

- payments toma el monto desde orders, el proveedor aprueba y el pago responde 201.
- El pedido pasa a PAGADO por payments, con boleta numerada, neto e IVA.
- El mismo `request_id` aparece en gateway, auth, payments y orders.

## Resultado obtenido

- Logs (`logs.txt`), ocho líneas con `request_id: pagar-pedido-0001`: auth `/introspect` 200; orders `GET /interno/pedidos/PED-0003` 200 (payments pide el monto); payments `payment_started` PAG-0002 por 17980; orders `order_paid` con boleta B-000002; orders `POST /interno/pedidos/PED-0003/pagado` 200; payments `payment_resolved` APROBADO; payments `POST /pagos` 201; gateway `POST /api/v1/pagos` 201, 290 ms.
- Pago (`persistencia-pago.txt`): PAG-0002, monto 17980, APROBADO, proveedor `simulado`, `idempotency_key` pago-0001, `request_id` pagar-pedido-0001 y boleta B-000002 (neto 15109, IVA 2871, total 17980). No hay datos de tarjeta.
- Pedido (`persistencia-pedido.txt`): PED-0003 en PAGADO, `pago_id` PAG-0002, historial PENDIENTE_PAGO → PAGADO "por: payments" y la misma boleta.

## Evidencia

| Archivo | Qué muestra |
|---|---|
| `evidencias/u2/pago-idempotente/logs.txt` | El mismo `request_id` en gateway, auth, payments y orders |
| `evidencias/u2/pago-idempotente/persistencia-pago.txt` | El pago guardado con su clave de idempotencia y la boleta |
| `evidencias/u2/pago-idempotente/persistencia-pedido.txt` | El pedido pagado por payments con la misma boleta |

**Vinculación:** `pagar-pedido-0001` une los logs con el pago guardado; `PAG-0002` y `B-000002` unen el pago con el pedido.

## Límites de interpretación

- Los archivos no muestran el reintento con la misma clave ni el segundo pago del mismo pedido (409). Eso queda para P02 del protocolo.
- El pedido se creó en otra solicitud (su `request_id` es `e5eff1b673224694944d58c824add4e0`), así que esta traza cubre solo el pago.
- El proveedor es un doble de prueba, no Webpay. La boleta no se envía por correo (R08 parcial).
- Una sola ejecución.

## Conclusión

Aprobada. El pago toma el monto del servidor, solo payments marca el pedido como PAGADO (R02), se emite la boleta con neto e IVA (R08 parcial) y la traza une cuatro servicios.
