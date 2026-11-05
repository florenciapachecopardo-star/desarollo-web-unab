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

**Script:** `tests/carga/catalogo.js` (lo escribe Karla, lo ejecuta Flo).

**Escenario:**

1. Subir de 0 a 20 usuarios virtuales en 30 segundos (carga normal).
2. Subir a 100 usuarios virtuales en 30 segundos y mantener 1 minuto (peak).
3. Bajar a 0 en 15 segundos.

Cada usuario virtual hace `GET /api/v1/productos` a través del gateway y espera 1 segundo entre solicitudes.

**Cómo se mide CPU y memoria:** mientras corre k6, `docker stats --no-stream` cada 10 segundos, guardado en `evidencias/u2/k6-docker-stats.txt`.

**Cómo reproducirlo:**

1. `docker compose up -d` (levanta el stack)
2. `scripts/reset.sh` (deja la base en el estado inicial y carga el seed; necesita el stack arriba)
3. `k6 run tests/carga/catalogo.js`
4. Guardar la salida en `evidencias/u2/k6-catalogo.txt`

### Resultados

_Pendiente de ejecución. Se completa cuando Flo corra el script._

| Indicador | Umbral | Resultado | ¿Cumple? |
|---|---|---|---|
| p95 catálogo | < 500 ms | | |
| Throughput catálogo | ≥ 25 req/s | | |
| Tasa de errores | < 1% | | |
| CPU máxima (gateway / inventory) | Sin reinicios | | |
| Memoria máxima (gateway / inventory) | Sin reinicios | | |

**Fecha de ejecución:**
**Commit:**
**Equipo donde se ejecutó:** (procesador, RAM, sistema operativo)

## 5. Límites de esta caracterización

- Las cifras de las secciones 1 y 2 son supuestos, no datos reales de un negocio.
- La prueba corre en un computador personal con todos los servicios en Docker. No representa un servidor de producción.
- Solo se prueba el catálogo. Pedidos y pagos no se someten a carga en la U2.
