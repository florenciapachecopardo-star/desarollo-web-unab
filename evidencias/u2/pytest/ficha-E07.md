# Ficha de evidencia E07: pruebas automáticas de seguridad (P01 a P06), idempotencia, GraphQL e INC04

| Campo | Valor |
|---|---|
| ID | E07 (pruebas P01 a P06 y casos adicionales) |
| Nombre de la prueba | 16 pruebas automáticas con pytest contra el gateway y, para P05, directo a los servicios de la red privada |
| Módulo | M7 (pruebas de seguridad), M4 (permisos), M8 (límite de profundidad) y M10 |
| Requisito relacionado | R01, R02, R07, R10, R12 |
| Servicio y ruta | S01, S03, S08, S11, S12, S16 y S18, más llamadas directas a inventory, orders y payments |
| Rol que ejecuta | Anónimo, CLIENTE (USR-0001) y llamadas sin sesión desde la red privada |
| Fecha y hora | 08-11-2026, 18:38 (America/Santiago), según `junit.xml` (21:38:03 UTC) |
| Ejecutada por | Karla |
| Código | Rama `pruebas-automaticas`, commit `3c8d960` (incluye el arreglo de INC04 y de INC06) |
| Entorno | Windows con Docker Desktop. Stack de `docker-compose.yml`, servicio `pruebas` (Python 3.12.7, pytest 8.3.3, httpx 0.27.2) |
| Estado | **Aprobada**: 16 de 16 |

## Precondiciones

- Stack levantado con `docker compose up -d --build`, con todos los servicios en `healthy`.
- Base reseteada con `docker compose run --rm seed --reset` justo antes (6 usuarios, 5 productos, PED-0001 de USR-0001 y PED-0002 de USR-0002).

## Pasos

1. `docker compose run --rm seed --reset`
2. `docker compose run --rm pruebas` (guarda `resultado.txt` y `junit.xml` en `evidencias/u2/pytest/`)
3. `docker compose logs --no-color --no-log-prefix gateway auth inventory orders payments graphql-gateway`, filtrado a los `request_id` de esta ejecución en `logs.txt`

## Resultado esperado y obtenido

| Prueba | Caso | Esperado | Obtenido | `request_id` |
|---|---|---|---|---|
| P01 | Catálogo sin sesión (S01) | 200 con 5 productos | 200 | `p01-e2b05666` |
| P02 | Crear pedido sin sesión (S11) | 401 con formato de error único | 401 | `p02-52acc981` |
| P02 | `/me` sin sesión pero con `X-Authenticated-User: USR-0003` y rol ADMIN falsos | 401: el gateway descarta esos headers | 401 | `p02-identidad-5fc1a0c4` |
| P03 | CLIENTE crea un producto (S03) | 403 y el producto no aparece en el catálogo | 403 | `p03-8729a06a` |
| P04 | CLIENTE ve el pedido ajeno PED-0002 (S12) | 404 `ORDER_NOT_FOUND`, sin líneas ni despacho | 404 | `p04-98438604` |
| P04 | Pedido ajeno y pedido inexistente | Misma respuesta | 404 y mismo mensaje en los dos | `p04-ajeno-d6a53214`, `p04-inexistente-cde6ce21` |
| P04 | Pagar el pedido ajeno (S16) | 404 `ORDER_NOT_FOUND` | 404 | `p04-pago-74caeebd` |
| P04 | `pedido(id: "PED-0002")` por GraphQL (S18) | `null` | `null` | `p04-graphql-492ccfc7` |
| P05 | Llamada directa a inventory, orders y payments sin secreto y con identidad falsa | Rechazada | 403 en los tres | `p05-inventory-21619548`, `p05-orders-b4944e4e`, `p05-payments-d927d2ab` |
| P05 | inventory con un secreto inventado | Rechazada | 403 | `p05-falso-06354dd0` |
| P06 | Pedido con `precio_unitario: 1`, `total: 1`, `estado: PAGADO` y `cajero_id: USR-0001` | Precio de inventory (8990), PENDIENTE_PAGO y cajero USR-0005 | Igual al esperado (201) | `p06-58898f29` |
| P06 | Pago con `monto: 1` | Monto tomado de orders (8990) | 8990 (201) | `p06-pago-aad504b7` |
| Idempotencia | Mismo `Idempotency-Key` dos veces en S11 | Mismo pedido y stock descontado una sola vez | Igual; stock de Chocolate blanco baja en 1 | `idem-pedido-1-7410ee28`, `idem-pedido-2-f4b4bf70` |
| Idempotencia | Misma clave con otro cuerpo | 409 `IDEMPOTENCY_CONFLICT` | 409 | `idem-conflicto-0c233c4f` |
| Idempotencia | Mismo `Idempotency-Key` dos veces en S16 | Mismo pago | Mismo pago (201 y 201) | `idem-pago-1-4cd46fa4`, `idem-pago-2-02144115` |
| Idempotencia | Pagar otra vez el pedido ya pagado, con otra clave | 409 `PEDIDO_NO_PAGABLE` | 409 | `idem-pago-3-bccb810c` |
| Idempotencia | S11 sin `Idempotency-Key` | 400 `IDEMPOTENCY_KEY_REQUIRED` | 400 | `idem-sin-clave-5a16998c` |
| Stock | Pedir Trufas (stock 0) | 409 `STOCK_INSUFICIENTE` | 409 | `sin-stock-87c8a4fb` |
| INC04 | Pedido con un producto válido y un ID mal formado | 400 `INVALID_ID` y el stock no cambia | Igual al esperado | `inc04-7853e5b1` |
| GraphQL | Consulta con profundidad 8 | Rechazada sin datos | Error "exceeds maximum operation depth of 6", sin `data` | `gql-profundidad-6499d5e0` |

## Evidencia

| Archivo | Qué muestra |
|---|---|
| `evidencias/u2/pytest/resultado.txt` | Salida de pytest con cada prueba, su resultado y los `request_id` |
| `evidencias/u2/pytest/junit.xml` | El mismo resultado en formato JUnit (16 pruebas, 0 fallas, 0 errores) |
| `evidencias/u2/pytest/logs.txt` | Las 96 líneas de log de esta ejecución, de todos los servicios |
| `tests/api/test_seguridad.py` | El código de cada prueba |

**Vinculación:** cada `request_id` de `resultado.txt` aparece en `logs.txt`. Por ejemplo, `inc04-7853e5b1` muestra a inventory respondiendo 400 en `/interno/reservas`, y luego a orders y al gateway con 400.

## Límites de interpretación

- Las llamadas de P05 no llevan `X-Request-ID` propio en el log del gateway porque no pasan por él: se buscan como `p05-...` en los logs de cada servicio.
- En P05, los logs de inventory, orders y payments muestran `user_id: USR-0001` aunque la llamada fue rechazada: el log registra la identidad que venía en el header falso. No da acceso a nada, pero el log no debería confiar en ese header si la llamada no trae el secreto (queda anotado como mejora).
- Antes de esta ejecución hubo dos corridas iguales (21:15 y 21:34 UTC) con el mismo resultado; la evidencia guardada es la última, después del arreglo de INC06.
- Una sola máquina (Windows con Docker Desktop).

## Conclusión

Aprobada. Las 6 pruebas de seguridad del M7 pasan, junto con la idempotencia de pedidos y pagos, el límite de profundidad de GraphQL y la regresión de INC04.
