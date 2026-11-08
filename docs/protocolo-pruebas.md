# Protocolo de pruebas, Entrega 2

## 1. Objetivo

Definir cómo se ejecutan y registran las pruebas del backend de Chocomanía, para que cualquier integrante pueda repetirlas y obtener el mismo resultado.

## 2. Ambiente de prueba

| Elemento | Valor |
|---|---|
| Cómo se levanta | `docker compose up -d` desde la raíz del repo |
| Reinicio de datos | `scripts/reset.sh`: borra usuarios, sesiones y productos y vuelve a cargar el seed. Necesita el stack arriba |
| Datos iniciales | `scripts/seed.py`: 6 usuarios (uno por rol del front, dos clientes) y 5 productos con ID fijos, todos ficticios. Corre dentro de Docker (`docker compose run --rm seed`); `reset.sh` lo ejecuta con `--reset` |
| Logs de una solicitud | `scripts/logs.sh <request_id>` |
| Verificación en la base | `docker compose run --rm check pedido PED-0001` (también `producto`, `usuario` y `pago`). No muestra hashes de claves ni sesiones |
| Pruebas automáticas | `docker compose run --rm pruebas`: corre `pytest` en `tests/api` dentro de Docker y guarda la salida en `evidencias/u2/pytest/` |
| Prueba de carga | `docker compose run --rm k6`: corre `tests/carga/catalogo.js` y guarda `evidencias/u2/k6-catalogo.json` |
| Crear el `.env` en Windows (sin openssl) | `docker run --rm -v "${PWD}:/repo" -w /repo python:3.12.7-slim-bookworm python scripts/generar-env.py` |

## 3. Reglas

1. Antes de cada ronda de pruebas, con el stack arriba (`docker compose up -d`), se ejecuta `scripts/reset.sh`, que deja la base en el estado inicial y carga el seed.
2. Cada prueba registra el `X-Request-ID` de la respuesta, para poder buscarla en los logs con `scripts/logs.sh`.
3. Cada ejecución tiene una ficha en `evidencias/`, hecha con `evidencias/plantilla-ficha.md`, y se registra en `evidencias/indice.md`.
4. Si el resultado obtenido no coincide con el esperado, se registra en `docs/incidencias.md`.

## 4. Identificadores

Los requisitos (R), servicios (S) y flujos (F) están en `docs/m1-servicios.md`.

| Prefijo | Qué es |
|---|---|
| P | Prueba (lo que se quiere comprobar) |
| C | Prueba de contrato de un servicio del M1 |
| E | Evidencia (ficha y archivos de una ejecución) |
| INC | Incidencia |

## 5. Pruebas de seguridad (M7)

| ID | Qué se prueba | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|
| P01 | Visitante anónimo consulta el catálogo (S01) | 200 con la lista de productos | **Aprobada:** 200 sin sesión | E01, E07 |
| P02 | Operación protegida sin sesión (S11) | 401 | **Aprobada:** 401 con formato de error único. También 401 si el navegador manda una identidad falsa (`X-Authenticated-User`) | E07 |
| P03 | CLIENTE intenta una operación de ADMIN (S03) | 403 | **Aprobada:** 403 y el producto no se crea | E07 |
| P04 | CLIENTE consulta un pedido ajeno (S12) | 404 sin datos del pedido | **Aprobada:** 404 `ORDER_NOT_FOUND` igual que un pedido inexistente; también 404 al pagarlo (S16) y `null` por GraphQL (S18) | E07 |
| P05 | Llamada directa a un servicio interno sin pasar por el gateway | Rechazada | **Aprobada:** inventory, orders y payments responden 403 sin el secreto o con uno inventado | E07 |
| P06 | El front manda un precio o estado alterado (S11) | El servidor lo ignora y usa el precio de inventory | **Aprobada:** precio 8990 de inventory, estado PENDIENTE_PAGO y cajero USR-0005 pese a lo enviado; el pago usa el monto de orders | E07 |

## 6. Pruebas de contrato

| ID | Servicio (M1) | Caso | Código esperado | Código obtenido | Evidencia |
|---|---|---|---|---|---|
| C01 | S11 | Mismo `Idempotency-Key` y mismo cuerpo dos veces | 201 y el mismo pedido, stock descontado una vez | 201 y mismo pedido | E07 |
| C02 | S11 | Misma clave con otro cuerpo | 409 `IDEMPOTENCY_CONFLICT` | 409 | E07 |
| C03 | S11 | Sin `Idempotency-Key` | 400 `IDEMPOTENCY_KEY_REQUIRED` | 400 | E07 |
| C04 | S11 | Producto sin stock | 409 `STOCK_INSUFICIENTE` | 409 | E07 |
| C05 | S11 | Un producto válido y un ID mal formado (INC04) | 400 `INVALID_ID` sin descontar stock | 400 y stock igual | E07 |
| C06 | S16 | Mismo `Idempotency-Key` dos veces | 201 y el mismo pago | 201 y mismo pago | E07 |
| C07 | S16 | Pagar un pedido ya pagado con otra clave | 409 `PEDIDO_NO_PAGABLE` | 409 | E07 |
| C08 | S18 | Consulta con profundidad mayor a 6 | Rechazada, sin datos | Error de profundidad máxima | E07 |
| C09 | S01 | Carga de 100 usuarios (M9) | p95 < 500 ms, ≥ 25 req/s, errores < 1 % | 19,2 ms, 65 req/s, 0 % (después de INC06) | E08 |

## 7. Pruebas manuales (U2)

En la U2 las pruebas de interfaz se registran a mano. Cada una lleva su ficha con pasos, resultado y archivos de evidencia.

| ID | Flujo | Rol | Resultado | Evidencia |
|---|---|---|---|---|
| P07 | F01, F03, F04, F05: compra completa desde el navegador (catálogo, login, checkout, pago, boleta y mis pedidos) | CLIENTE | Hecha por Flo al conectar el front (INCR-17): PED-0003 pagado con boleta B-000002. Falta guardar la captura | Bitácora INCR-17 |
