# Ficha de evidencia E05: misPedidos por GraphQL con una sola llamada a inventory

| Campo | Valor |
|---|---|
| ID | E05 |
| Nombre de la prueba | Consulta `misPedidos` que junta orders e inventory usando DataLoader (una llamada por consulta) |
| Módulo | M8 (GraphQL Gateway, batching) y M10 (logs con ID de correlación) |
| Requisito relacionado | R01 |
| Servicio y ruta | S18 `POST /api/v1/graphql` |
| Rol que ejecuta | CLIENTE (USR-0001) |
| Fecha y hora | 08-11-2026, 01:02 (America/Santiago), según los logs (04:02:28 UTC) |
| Ejecutada por | Flo |
| Código | El de `e89d066` (PR #37, GraphQL), commit de las 01:03 que incluye estos archivos |
| Entorno | Stack de `docker-compose.yml` en el equipo de Flo |
| Estado | **Aprobada** |

## Precondiciones

- Stack levantado y base con el seed.
- Sesión como `cliente@correo.cl`, con dos pedidos propios: PED-0001 (del seed, PAGADO) y PED-0003 (PENDIENTE_PAGO), cada uno con dos líneas.

## Pasos

Reconstruidos a partir de los archivos de evidencia. El comando exacto lo confirma Flo.

1. Enviar `POST /api/v1/graphql` con `X-Request-ID: gql-mispedidos-0002` y una consulta `misPedidos` que pide el `total` de pedidos y, de cada pedido, `id`, `estado`, `total`, `boleta { numero }` y en cada línea `nombre`, `cantidad` y `producto { disponible imagen }`.
2. Guardar la respuesta en `respuesta.json` y los logs con `scripts/logs.sh gql-mispedidos-0002` en `logs.txt`.

## Resultado esperado

- Respuesta 200 con los dos pedidos y los datos actuales de cada producto.
- Una sola llamada de graphql-gateway a inventory para las cuatro líneas.
- El mismo `request_id` en gateway, auth, graphql-gateway, orders e inventory.

## Resultado obtenido

- Respuesta (`respuesta.json`): `total: 2`; PED-0001 PAGADO, total 22970, boleta B-000001; PED-0003 PENDIENTE_PAGO, total 15980, sin boleta. Las cuatro líneas traen `producto` con `disponible: true` y su imagen. No hay `errors`.
- Logs (`logs.txt`), siete líneas con `request_id: gql-mispedidos-0002`: gateway `secret_loaded`; auth `/introspect` 200; orders `GET /pedidos` 200 (USR-0001); inventory `POST /interno/productos/lote` 200, **una sola vez**; graphql-gateway `batch_loaded` con `cantidad: 2` (dos productos distintos para cuatro líneas); graphql-gateway `POST /graphql` 200; gateway `POST /api/v1/graphql` 200, 581 ms.

## Evidencia

| Archivo | Qué muestra |
|---|---|
| `evidencias/u2/graphql-agregacion/respuesta.json` | La respuesta con datos de orders y de inventory juntos |
| `evidencias/u2/graphql-agregacion/logs.txt` | Una sola llamada a inventory y el mismo `request_id` en cinco servicios |

**Vinculación:** `gql-mispedidos-0002` une las siete líneas de log; los pedidos de la respuesta son los que devuelve orders para USR-0001.

## Límites de interpretación

- No se guardaron los headers de la respuesta HTTP.
- No prueba los límites de profundidad, alias ni tokens: la evidencia del rechazo por profundidad está pendiente.
- Una sola ejecución.

## Conclusión

Aprobada. GraphQL junta orders e inventory en una sola respuesta y el DataLoader evita una llamada a inventory por cada línea (sin N+1).
