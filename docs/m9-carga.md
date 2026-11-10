# M9. Caracterización de carga

**Tipo de dato:** las cifras de las secciones 1 y 2 son una **proyección**, no una medición. La sección 4 queda para los resultados medidos con k6.

Decisiones relacionadas: `docs/adr-grpc.md` y `docs/adr-analitica.md`.

## 1. Supuestos del negocio

| Supuesto | Valor proyectado | De dónde sale |
|---|---|---|
| Tipo de negocio | Chocolatería pequeña con un local y venta online | Caso 19 adaptado (local pequeño, negocio familiar) |
| Zona de despacho | Radio de 3 km alrededor del local | Caso 19 |
| Pedidos por día (normal) | Hasta 100 | Proyección para un local pequeño |
| Pedidos por día (peak) | Hasta 500 (5 veces lo normal) | Fechas de alta demanda: San Valentín, Día de la Madre, Navidad |
| Visitas al catálogo por pedido | 20 | Por cada compra, muchas visitas solo miran |
| Horario de mayor uso | 12:00 a 14:00 y 19:00 a 22:00 | Proyección |

## 2. Carga proyectada

| Indicador | Normal | Peak |
|---|---|---|
| Consultas al catálogo por día (S01, S02) | 2.000 | 10.000 |
| Pedidos creados por día (S11) | 100 | 500 |
| Pagos por día (S16, S17) | 100 | 500 |
| Usuarios al mismo tiempo | 20 | 100 |
| Solicitudes por segundo en la hora punta | Menos de 5 | Menos de 25 |

**Lectura:** es una carga baja. El sistema es sobre todo de lectura (el catálogo concentra la mayor parte del tráfico) y las operaciones que escriben (pedidos y pagos) son pocas. Esto pesa en las decisiones de gRPC y analítica.

## 3. Umbrales de rendimiento

Se fijan **antes** de medir. Si una medición no los cumple, se registra como incidencia y no se cambian los umbrales para que pase.

| Operación | Indicador | Umbral |
|---|---|---|
| Catálogo (S01) | p95 de duración | Menor a 500 ms |
| Crear pedido (S11) | p95 de duración | Menor a 1.000 ms |
| Todas | Tasa de errores | Menor a 1% |
| Catálogo (S01) | Throughput | Al menos 25 solicitudes por segundo (el peak proyectado) |
| Todos los contenedores | CPU y memoria | Sin contenedores reiniciados durante la prueba |

## 4. Prueba de carga con k6

**Script:** `tests/carga/catalogo.js`. Se ejecuta con el servicio `k6` de `docker-compose.yml`.

**Escenario:**

1. Subir de 0 a 20 usuarios virtuales en 30 segundos (carga normal).
2. Subir a 100 usuarios virtuales en 30 segundos y mantener 1 minuto (peak).
3. Bajar a 0 en 15 segundos.

Cada usuario virtual hace `GET /api/v1/productos` a través del gateway y espera 1 segundo entre solicitudes.

**CPU y memoria:** se midieron en una tercera ejecución, registrando `docker stats` cada segundo y medio mientras corría k6 (81 muestras, `evidencias/u2/k6-docker-stats.csv`).

**Cómo reproducirlo** (todo dentro de Docker, sin instalar k6):

1. `docker compose up -d --build`
2. `docker compose run --rm seed --reset` (estado inicial con el seed)
3. `docker compose run --rm k6` (guarda el resumen en `evidencias/u2/k6-catalogo.json`)

### Resultados

Ficha: `evidencias/u2/ficha-E08.md`. Se ejecutó dos veces: la primera no cumplió los umbrales y se registró como incidencia (INC06); la segunda, con el arreglo, sí. Los umbrales no se cambiaron.

| Indicador | Umbral | Primera ejecución (`739419c`) | Segunda ejecución (`3c8d960`) | ¿Cumple? |
|---|---|---|---|---|
| p95 catálogo | < 500 ms | 3.163 ms | 19,2 ms | Sí (después del arreglo) |
| Throughput catálogo | ≥ 25 req/s | 22,2 req/s | 65,0 req/s | Sí (después del arreglo) |
| Tasa de errores | < 1% | 0 % | 0 % | Sí |
| CPU máxima (gateway / inventory) | Sin reinicios | No medido | No medido | Sí (tercera ejecución: 87 % y 93 % de un núcleo) |
| Memoria máxima (gateway / inventory) | Sin reinicios | No medido | No medido | Sí (tercera ejecución: 57,5 MiB y 92,9 MiB, sin reinicios) |

**Tercera ejecución, con CPU y memoria** (09-11-2026, equipo de Flo, mismo escenario y umbrales): p95 de 59,8 ms, 63,7 solicitudes por segundo y 0 % de errores (8.616 solicitudes). El p95 es más alto que en la segunda ejecución (19 ms) porque fue en otro equipo, pero cumple con holgura. Máximos por contenedor:

| Contenedor | CPU máxima (100 % = un núcleo) | Memoria máxima |
|---|---|---|
| gateway | 87 % | 57,5 MiB |
| inventory | 93 % | 92,9 MiB |
| mongo | 110 % | 370 MiB |

Ningún contenedor se reinició y ninguno se acercó al límite de memoria (2,76 GiB en ese equipo). gateway e inventory quedan cerca de un núcleo completo con 100 usuarios, así que con más carga el siguiente cuello de botella sería la CPU de esos dos servicios (uvicorn corre con un solo proceso). Archivos: `evidencias/u2/k6-catalogo-con-stats.json` y `evidencias/u2/k6-docker-stats.csv`.

**Qué pasó en la primera ejecución:** el gateway creaba un cliente HTTP nuevo (`httpx.AsyncClient`) en cada solicitud, y armar ese cliente cada vez saturaba su CPU. Con 100 usuarios, cada respuesta tardaba unos 2 segundos. Se cambió a un solo cliente compartido para todo el gateway (INC06) y el p95 bajó de 3,2 s a 19 ms.

**Fecha de ejecución:** 08-11-2026, 18:17 y 18:35 (America/Santiago)
**Archivos:** `evidencias/u2/k6-catalogo-antes.json` y `evidencias/u2/k6-catalogo.json`
**Equipo donde se ejecutó:** computador Dell con Windows y Docker Desktop (k6 dentro de Docker, en el mismo equipo que el stack)

## 5. Límites de esta caracterización

- Las cifras de las secciones 1 y 2 son supuestos, no datos reales de un negocio.
- La prueba corre en un computador personal con todos los servicios en Docker, y k6 corre en el mismo equipo. No representa un servidor de producción.
- Orders, payments y graphql-gateway todavía crean un cliente HTTP por solicitud, igual que el gateway antes de INC06. No afecta al catálogo, pero puede pesar si se someten a carga pedidos y pagos.
- Solo se prueba el catálogo. Pedidos y pagos no se someten a carga en la U2.
