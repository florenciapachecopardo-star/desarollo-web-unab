# Ficha de evidencia E06: misPedidos con inventory caído (error parcial)

| Campo | Valor |
|---|---|
| ID | E06 |
| Nombre de la prueba | Consulta `misPedidos` con inventory detenido: los pedidos llegan y `producto` viene null con su error |
| Módulo | M8 (errores parciales) y M10 (logs con ID de correlación) |
| Requisito relacionado | R01 |
| Servicio y ruta | S18 `POST /api/v1/graphql` |
| Rol que ejecuta | CLIENTE (USR-0001) |
| Fecha y hora | 08-11-2026, 01:02 (America/Santiago), según los logs (04:02:32 UTC) |
| Ejecutada por | Flo |
| Código | El de `e89d066` (PR #37, GraphQL), commit de las 01:03 que incluye estos archivos |
| Entorno | Stack de `docker-compose.yml` en el equipo de Flo, con inventory detenido |
| Estado | **Aprobada** |

## Precondiciones

- Las mismas de E05 (dos pedidos propios con dos líneas cada uno).
- inventory detenido (`docker compose stop inventory`).

## Pasos

Reconstruidos a partir de los archivos de evidencia. El comando exacto lo confirma Flo.

1. Detener inventory.
2. Enviar `POST /api/v1/graphql` con `X-Request-ID: gql-inventory-caido-0002` y una consulta `misPedidos` que pide `id`, `estado` y en cada línea `nombre` y `producto`.
3. Guardar la respuesta en `respuesta.json` y los logs en `logs.txt`.

## Resultado esperado

- Respuesta 200 con los pedidos y los nombres guardados en cada línea.
- `producto` en null en cada línea, con un error `UPSTREAM_UNAVAILABLE` por cada una, en vez de mostrar los datos como completos.

## Resultado obtenido

- Respuesta (`respuesta.json`): PED-0001 PAGADO y PED-0003 PENDIENTE_PAGO, con los nombres de sus cuatro líneas y `producto: null`. En `errors` vienen cuatro errores "inventory no esta disponible" con `extensions.code: UPSTREAM_UNAVAILABLE`, cada uno con su `path` (por ejemplo `misPedidos.items.0.lineas.0.producto`).
- Logs (`logs.txt`), ocho líneas con `request_id: gql-inventory-caido-0002`: auth `/introspect` 200; orders `GET /pedidos` 200; cuatro `graphql_error` con código `UPSTREAM_UNAVAILABLE` y su ruta; graphql-gateway `POST /graphql` 200; gateway `POST /api/v1/graphql` 200. No hay línea de inventory porque estaba detenido.

## Evidencia

| Archivo | Qué muestra |
|---|---|
| `evidencias/u2/graphql-error-parcial/respuesta.json` | Los pedidos con `producto` null y los cuatro errores |
| `evidencias/u2/graphql-error-parcial/logs.txt` | Los errores registrados por graphql-gateway sin datos personales |

**Vinculación:** `gql-inventory-caido-0002` une las ocho líneas de log; los `path` de los errores coinciden con los `path` de la respuesta.

## Límites de interpretación

- La detención de inventory no aparece en los logs; se deduce de que no hay línea de inventory y de los errores `UPSTREAM_UNAVAILABLE`.
- El aviso que muestra `mis-pedidos.html` en este caso no tiene captura todavía.
- Una sola ejecución.

## Conclusión

Aprobada. Si inventory cae, el cliente igual ve sus pedidos y la respuesta marca qué datos faltan, en vez de fallar entera o mostrarlos como completos.
