# Ficha de evidencia E04: pago aprobado con orders caído y reconciliación

| Campo | Valor |
|---|---|
| ID | E04 |
| Nombre de la prueba | Aviso de pago aprobado mientras orders está detenido; el pedido queda PAGADO cuando orders vuelve |
| Módulo | M3 (falla entre payments y orders) y M10 (logs con ID de correlación) |
| Requisito relacionado | R02, R08 (parcial) |
| Servicio y ruta | S16 `POST /api/v1/pagos` y S17 `POST /api/v1/pagos/aviso` |
| Rol que ejecuta | CLIENTE (USR-0001) y proveedor simulado (S17 con `X-Proveedor-Secret`) |
| Fecha y hora | 07-11-2026, 23:58 (America/Santiago), según los logs (08-11-2026 02:58 UTC) |
| Ejecutada por | Flo |
| Código | El de `a1b1de1` (corrección del PR #33 con la reconciliación), commit de las 00:00 del 08-11 que incluye estos archivos |
| Entorno | Stack de `docker-compose.yml` en el equipo de Flo, proveedor simulado en modo `aviso` |
| Estado | **Aprobada** (con los límites de abajo) |

## Precondiciones

- Stack levantado, base con el seed y `SIMULADOR_MODO=aviso`.
- Sesión como `cliente@correo.cl` y pedido PED-0003 en PENDIENTE_PAGO (1 "Chocolate Dubai", total 8990).

## Pasos

Reconstruidos a partir de los archivos de evidencia. El comando exacto lo confirma Flo.

1. Pagar con `POST /api/v1/pagos` (`Idempotency-Key: pago-0001`, sin `X-Request-ID`). El pago queda PENDIENTE.
2. Detener orders (`docker compose stop orders`).
3. Enviar el aviso del proveedor `POST /api/v1/pagos/aviso` con `X-Request-ID: aviso-orders-caido-1`, el secreto del proveedor y resultado APROBADO.
4. Levantar orders de nuevo y esperar la reconciliación.
5. Guardar los logs en `logs.txt` y consultar el pago y el pedido en Mongo (`persistencia-pago.txt` y `persistencia-pedido.txt`).

## Resultado esperado

- Con orders caído, payments guarda el pago APROBADO con `pedido_sincronizado: false` y responde el aviso sin perderlo.
- Cuando orders vuelve, la reconciliación marca el pedido como PAGADO y deja el pago sincronizado.

## Resultado obtenido

- Logs (`logs.txt`):
  1. 02:58:27, payments `payment_started` PAG-0002 por 8990, con `request_id` `022deb2e…` (generado por el gateway porque no se envió el header).
  2. 02:58:30, payments `payment_resolved` APROBADO (`aviso-orders-caido-1`).
  3. 02:58:30, payments `order_sync_pending` con motivo `UPSTREAM_UNAVAILABLE`: orders no responde.
  4. 02:58:30, payments `POST /pagos/aviso` 200: el aviso se acepta igual.
  5. 02:58:36, orders `order_paid` PED-0003 con boleta B-000002, con el `request_id` original del pago (`022deb2e…`), que es el que usa la reconciliación.
  6. 02:58:36, payments `order_synced` APROBADO.
- Pago (`persistencia-pago.txt`): PAG-0002 APROBADO, `pedido_sincronizado: true`, `referencia_proveedor` SIM-1 y boleta B-000002 (neto 7555, IVA 1435, total 8990).
- Pedido (`persistencia-pedido.txt`): PED-0003 PAGADO, `pago_id` PAG-0002, historial PENDIENTE_PAGO → PAGADO "por: payments" a las 02:58:36 y la misma boleta.

## Evidencia

| Archivo | Qué muestra |
|---|---|
| `evidencias/u2/pago-orders-caido/logs.txt` | El aviso aceptado con orders caído y la sincronización posterior |
| `evidencias/u2/pago-orders-caido/persistencia-pago.txt` | El pago aprobado y sincronizado |
| `evidencias/u2/pago-orders-caido/persistencia-pedido.txt` | El pedido pagado después de que orders volvió |

**Vinculación:** `PAG-0002` aparece en las seis líneas; el `request_id` `022deb2e…` une el inicio del pago con la sincronización final.

## Límites de interpretación

- Los logs no muestran la detención ni el reinicio de orders; se deducen del `order_sync_pending` y del `order_paid` seis segundos después.
- El estado intermedio con `pedido_sincronizado: false` no se guardó en un archivo; se deduce del log.
- Como el pago empezó sin `X-Request-ID`, esta evidencia también muestra que el gateway genera el ID cuando el cliente no lo manda (el límite que quedó abierto en E01).
- Una sola ejecución.

## Conclusión

Aprobada. Un pago aprobado no se pierde si orders está caído: payments lo guarda y lo reintenta, y el pedido queda PAGADO con su boleta cuando orders vuelve.
