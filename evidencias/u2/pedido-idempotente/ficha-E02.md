# Ficha de evidencia E02: crear y anular un pedido con el mismo request_id en cuatro servicios

| Campo | Valor |
|---|---|
| ID | E02 |
| Nombre de la prueba | Crear un pedido con `Idempotency-Key`, con precio y total calculados por el servidor, y anularlo con motivo y devolución de stock |
| Módulo | M5 (recorrido autorizado), M7 (idempotencia y datos calculados por el servidor) y M10 (logs con ID de correlación) |
| Requisito relacionado | R01, R03, R04 |
| Servicio y ruta | S11 `POST /api/v1/pedidos` y S13 `POST /api/v1/pedidos/{id}/anular` |
| Rol que ejecuta | CLIENTE (USR-0001, Valentina Soto) |
| Fecha y hora | 06-11-2026, 10:51 (America/Santiago), según los logs (13:51:35 UTC) |
| Ejecutada por | Flo |
| Código | El de `db11e9b` (PR #32, orders), commit de las 10:57 que incluye estos archivos |
| Entorno | Stack de `docker-compose.yml` en el equipo de Flo |
| Estado | **Aprobada** (con los límites de abajo) |

## Precondiciones

- Stack levantado con `docker compose up -d` y base con el seed (`scripts/reset.sh`).
- Sesión iniciada como `cliente@correo.cl`.

## Pasos

Reconstruidos a partir de los archivos de evidencia. El comando exacto lo confirma Flo.

1. Enviar `POST /api/v1/pedidos` con `X-Request-ID: crear-pedido-0001`, `Idempotency-Key: compra-0001` y una línea de 2 "Bombones de caramelo" (`650000000000000000000004`), con despacho en "Calle Ficticia 1", Providencia.
2. Guardar los logs con `scripts/logs.sh crear-pedido-0001` en `logs.txt`.
3. Anular el pedido con `POST /api/v1/pedidos/PED-0003/anular` y el motivo "me equivoque de producto".
4. Consultar el pedido en Mongo con `docker compose run --rm check pedido PED-0003` y guardar la salida en `persistencia.txt`.

## Resultado esperado

- El pedido se crea con 201, en PENDIENTE_PAGO, con el precio que da inventory y `cajero_id` USR-0005.
- El mismo `request_id` aparece en gateway, auth, inventory y orders.
- Al anular, el pedido queda ANULADO, guarda el motivo, no se borra y el stock se devuelve.

## Resultado obtenido

- Logs (`logs.txt`), seis líneas con `request_id: crear-pedido-0001`:
  1. gateway `secret_loaded` (solo nombres de las claves de Vault, sin valores).
  2. auth `POST /introspect` 200.
  3. inventory `POST /interno/reservas` 200 (reserva del stock).
  4. orders `order_created`: PED-0003, USR-0001, total 14980.
  5. orders `POST /pedidos` 201.
  6. gateway `POST /api/v1/pedidos` 201, 800 ms.
- Persistencia (`persistencia.txt`): PED-0003 con `cajero_id` USR-0005, línea con `precio_unitario` 7490 y `subtotal` 14980, `idempotency_key` compra-0001, `request_id` crear-pedido-0001, estado ANULADO, `motivo_anulacion` "me equivoque de producto", historial PENDIENTE_PAGO → ANULADO (los dos por USR-0001) y `stock_devuelto: true`.

## Evidencia

| Archivo | Qué muestra |
|---|---|
| `evidencias/u2/pedido-idempotente/logs.txt` | El mismo `request_id` en gateway, auth, inventory y orders al crear el pedido |
| `evidencias/u2/pedido-idempotente/persistencia.txt` | El pedido guardado en Mongo después de anularlo |

**Vinculación:** el valor `crear-pedido-0001` aparece en las seis líneas de log y en el campo `request_id` del pedido guardado.

## Límites de interpretación

- Los archivos no muestran el reintento con el mismo `Idempotency-Key` (no hay un evento `idempotent_replay` en el log). Lo que sí muestran es que la clave quedó guardada con el pedido.
- Los logs de la anulación no se guardaron: la anulación se demuestra con el documento de Mongo (estado, motivo, historial y `stock_devuelto`).
- No se guardó la respuesta HTTP, solo los logs y la base.
- Una sola ejecución.

## Conclusión

Aprobada. El pedido se crea con precio y total del servidor, queda asociado al cajero virtual (R04), su `request_id` recorre cuatro servicios y queda en la base, y la anulación guarda el motivo y devuelve el stock sin borrar el pedido (R03).
