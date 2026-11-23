# Ficha de evidencia E07: pruebas automáticas de seguridad (P01 a P06), clients, idempotencia, GraphQL, INC04 y límite de solicitudes

| Campo | Valor |
|---|---|
| ID | E07 (pruebas P01 a P06 y casos adicionales) |
| Nombre de la prueba | 22 pruebas automáticas con pytest contra el gateway y, para P05, directo a los servicios de la red privada |
| Módulo | M7 (pruebas de seguridad), M4 (permisos), M5 (límite de solicitudes y logs), M8 (límite de profundidad) y M10 |
| Requisito relacionado | R01, R02, R06, R07, R10, R12 |
| Servicio y ruta | S01, S03, S06, S08, S09, S09V, S10, S11, S12, S16 y S18, más llamadas directas a inventory, orders, payments, clients y auth |
| Rol que ejecuta | Anónimo, CLIENTE (USR-0001 y un cliente nuevo registrado en la prueba) y llamadas sin sesión desde la red privada |
| Fecha y hora | 23-11-2026, 01:57 (America/Santiago), según `junit.xml` (04:57:22 UTC) |
| Ejecutada por | Flo |
| Código | `main` en `1a033a2` (después del merge del PR #49; incluye clients del PR #47 y los logs de la U3 del PR #48) |
| Entorno | Stack de `docker-compose.yml` en el equipo de Flo, servicio `pruebas` (Python 3.12.7, pytest 8.3.3) |
| Estado | **Aprobada**: 22 de 22 |

## Precondiciones

- Stack levantado con `docker compose up -d --build`, con todos los servicios en `healthy`.
- Base reseteada con `docker compose run --rm seed --reset` justo antes (6 usuarios, 5 productos, PED-0001 de USR-0001 y PED-0002 de USR-0002).

## Pasos

1. `docker compose run --rm seed --reset`
2. `docker compose run --rm pruebas` (guarda `resultado.txt` y `junit.xml` en `evidencias/u2/pytest/`)
3. `docker compose logs --no-color --no-log-prefix` de los servicios, filtrado a los `request_id` que imprime `resultado.txt`, en `logs.txt`

## Resultado esperado y obtenido

| Prueba | Caso | Esperado | Obtenido | `request_id` |
|---|---|---|---|---|
| P01 | Catálogo sin sesión (S01) | 200 con 5 productos | 200 | `p01-200bd4cd` |
| P02 | Crear pedido sin sesión (S11) | 401 con formato de error único | 401 | `p02-360d2983` |
| P02 | `/me` sin sesión pero con `X-Authenticated-User: USR-0003` y rol ADMIN falsos | 401: el gateway descarta esos headers | 401 | `p02-identidad-1bb85637` |
| P03 | CLIENTE crea un producto (S03) | 403 y el producto no aparece en el catálogo | 403; en el log, `authorization_denied` (requiere ADMIN, tiene CLIENTE) y ninguna línea de inventory | `p03-43744f5a`, `p03-verifica-6c7f75a3` |
| P04 | CLIENTE ve el pedido ajeno PED-0002 (S12) | 404 `ORDER_NOT_FOUND`, sin líneas ni despacho | 404 | `p04-ff449aea` |
| P04 | Pedido ajeno y pedido inexistente | Misma respuesta | 404 y mismo mensaje en los dos | `p04-ajeno-4b8207cc`, `p04-inexistente-5ddfca6d` |
| P04 | Pagar el pedido ajeno (S16) | 404 `ORDER_NOT_FOUND` | 404 | `p04-pago-6cea59fa` |
| P04 | `pedido(id: "PED-0002")` por GraphQL (S18) | `null` | `null`; orders responde 404 a graphql-gateway (`origen: graphql-gateway`) | `p04-graphql-5d1beefc` |
| P05 | Llamada directa a inventory, orders y payments sin secreto y con identidad falsa | Rechazada | 403 en los tres | No se imprime (ver límites) |
| P05 | inventory con un secreto inventado | Rechazada | 403 | No se imprime (ver límites) |
| P05 | Llamada directa a clients (`/clientes/me`) y a auth (`/usuarios`) sin secreto | Rechazada | 403 en las dos | No se imprime (ver límites) |
| P06 | Pedido con `precio_unitario: 1`, `total: 1`, `estado: PAGADO` y `cajero_id: USR-0001` | Precio de inventory (8990), PENDIENTE_PAGO y cajero USR-0005 | Igual al esperado (201); en el log, `order_created` PED-0003 con total 8990 | `p06-fb85d8c9` |
| P06 | Pago con `monto: 1` | Monto tomado de orders (8990) | 8990 (201); en el log, `payment_started` con monto 8990 | `p06-pago-0bc6f81d` |
| Clients | Registro, código malo, verificación y perfil propio (S09, S09V, S10) | 201 sin clave ni hash en la respuesta; login rechazado antes de verificar; 400 con código malo; 200 al verificar y en el perfil | Igual al esperado | `cli-registro-e611596d`, `cli-codigo-malo-4c25a71a`, `cli-verificar-ef1c5df1`, `cli-perfil-66b2d772` |
| Clients | Registro con RUN o correo ya usados | 409 `CLIENT_EXISTS` | 201 el primero, 409 los dos repetidos | `cli-dup-1-c5a494bc`, `cli-dup-run-f4859fec`, `cli-dup-correo-f039c120` |
| Clients | RUN inválido | 422 (validado en el servidor) | 422 | `cli-run-malo-3edf2ee7` |
| Clients | Perfil sin sesión y con el cliente del seed | 401 y 200 (USR-0001) | 401 y 200 | `cli-perfil-anon-87959c7a`, `cli-perfil-seed-3271f02c` |
| Idempotencia | Mismo `Idempotency-Key` dos veces en S11 | Mismo pedido y stock descontado una sola vez | Igual; stock de Chocolate blanco baja en 1. La segunda llamada deja `idempotent_replay` en orders | `idem-pedido-1-ca6f8f5b`, `idem-pedido-2-ebb5fb13`, `stock-ca301ec3`, `stock-823e10d4` |
| Idempotencia | Misma clave con otro cuerpo | 409 `IDEMPOTENCY_CONFLICT` | 409 | `idem-conflicto-21ddfcae` |
| Idempotencia | Mismo `Idempotency-Key` dos veces en S16 | Mismo pago | Mismo pago (201 y 201) | `idem-pago-1-7a74bd21`, `idem-pago-2-f7da68fd` |
| Idempotencia | Pagar otra vez el pedido ya pagado, con otra clave | 409 `PEDIDO_NO_PAGABLE` | 409 | `idem-pago-3-6aa24514` |
| Idempotencia | S11 sin `Idempotency-Key` | 400 `IDEMPOTENCY_KEY_REQUIRED` | 400 | `idem-sin-clave-d1e71bdd` |
| Stock | Pedir Trufas (stock 0) | 409 `STOCK_INSUFICIENTE` | 409 | `sin-stock-eaaabb79` |
| INC04 | Pedido con un producto válido y un ID mal formado | 400 `INVALID_ID` y el stock no cambia | Igual al esperado; inventory responde 400 en `/interno/reservas` | `inc04-b3261352`, `stock-738a39c5`, `stock-79224710` |
| GraphQL | Consulta con profundidad 8 | Rechazada sin datos | Error "exceeds maximum operation depth of 6", sin `data`; `graphql_error` con código `VALIDATION` | `gql-profundidad-9f5c02fb` |
| Límite | 25 logins seguidos con clave incorrecta (S06) | Solo 401 y 429, con al menos un 429 | 17 veces 401 y después 8 veces 429 | No se imprime (ver límites) |

## Evidencia

| Archivo | Qué muestra |
|---|---|
| `evidencias/u2/pytest/resultado.txt` | Salida de pytest con cada prueba, su resultado y los `request_id` |
| `evidencias/u2/pytest/junit.xml` | El mismo resultado en formato JUnit (22 pruebas, 0 fallas, 0 errores) |
| `evidencias/u2/pytest/logs.txt` | Las 296 líneas de log de esta ejecución (04:57:23 a 04:57:26 UTC), de los 36 `request_id` de `resultado.txt`, con los eventos de la U3 |
| `tests/api/test_seguridad.py`, `tests/api/test_clientes.py`, `tests/api/test_zz_limite.py` | El código de cada prueba |

**Vinculación:** los 36 `request_id` de `resultado.txt` aparecen en `logs.txt`, y `logs.txt` no tiene ningún otro. Por ejemplo, `p06-fb85d8c9` muestra el recorrido completo de un pedido: el gateway pide validar la sesión a auth, auth la valida (`token_validated`, USR-0001, CLIENTE), el gateway autoriza S11 (`authorization_granted`) y usa `orders_shared_secret` (`secret_used`), orders acepta el secreto (`gateway_secret_ok`), inventory reserva el stock y orders crea PED-0003 (`order_created`, colección `pedidos`, `insert_one`). La única lectura de Vault de la corrida (`secret_loaded`) está en la primera solicitud, `cli-registro-e611596d`; las demás usan la caché.

## Límites de interpretación

- P05 y el límite de solicitudes no imprimen `request_id` en `resultado.txt` (P05 llama directo a los servicios sin pasar por el gateway y el login del límite no lleva uno propio), así que sus líneas no están en `logs.txt`. Su evidencia son los códigos de `resultado.txt` y `junit.xml`.
- Las pruebas llaman al gateway en el puerto 8000, no por el contenedor frontend: en `logs.txt` no hay líneas `api_proxied`. El paso por el frontend se muestra en el video de la U3.
- `test_zz_limite` deja el login bloqueado un minuto: si se repite la ronda, hay que esperar entre una y otra.
- Esta corrida reemplaza la del 08-11-2026 (16 de 16, 96 líneas de log), que ya no calzaba con las pruebas de clients agregadas en el PR #47.
- Una sola máquina.

## Conclusión

Aprobada. Pasan las 6 pruebas de seguridad del M7, las de clients (registro, verificación, duplicados, validación en el servidor, perfil propio y acceso directo), la idempotencia de pedidos y pagos, el límite de profundidad de GraphQL, la regresión de INC04 y el límite de solicitudes del login. Los logs muestran, con el mismo `request_id`, la validación de la sesión con auth, la autorización por rol, el uso de secretos sin exponer su valor y la escritura en la base.
