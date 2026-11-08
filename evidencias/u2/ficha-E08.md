# Ficha de evidencia E08: prueba de carga del catálogo con k6 (antes y después de INC06)

| Campo | Valor |
|---|---|
| ID | E08 |
| Nombre de la prueba | Carga del catálogo (S01) con el escenario y los umbrales del M9 |
| Módulo | M9 (caracterización de carga) |
| Requisito relacionado | R01, R07 |
| Servicio y ruta | S01 `GET /api/v1/productos` |
| Rol que ejecuta | Anónimo (100 usuarios virtuales como máximo) |
| Fecha y hora | 08-11-2026. Primera ejecución hacia las 18:17 y segunda a las 18:35 (America/Santiago), según las horas de los archivos |
| Ejecutada por | Karla |
| Código | Primera: rama `pruebas-automaticas` en `739419c`. Segunda: `3c8d960` (gateway con un solo cliente HTTP, INC06) |
| Entorno | Windows con Docker Desktop. Servicio `k6` de `docker-compose.yml` (grafana/k6 0.54.0) dentro de la red de Docker |
| Estado | **Primera: fallida** (2 umbrales no cumplidos). **Segunda: aprobada** |

## Precondiciones

- Stack arriba y base reseteada con `docker compose run --rm seed --reset` antes de cada ejecución.

## Pasos

1. `docker compose run --rm seed --reset`
2. `docker compose run --rm k6` (2 min 15 s: sube a 20 usuarios, luego a 100, se mantiene 1 minuto y baja). Guarda `evidencias/u2/k6-catalogo.json`.
3. La primera salida se renombró a `k6-catalogo-antes.json` antes de repetir.

## Resultado

| Indicador | Umbral (fijado antes de medir) | Primera ejecución | Segunda ejecución |
|---|---|---|---|
| p95 de duración | Menor a 500 ms | 3.163 ms ✗ | 19,2 ms ✓ |
| Mediana de duración | — | 2.175 ms | 8,5 ms |
| Máximo | — | 4.559 ms | 55,9 ms |
| Solicitudes por segundo | Al menos 25 | 22,2 ✗ | 65,0 ✓ |
| Tasa de errores | Menor a 1 % | 0 % ✓ | 0 % ✓ |
| Solicitudes totales | — | 3.019 | 8.799 |
| Checks (200, `X-Request-ID`, lista de productos) | — | 100 % | 100 % |

**Lectura:** en la primera ejecución el gateway no alcanzaba a atender: cada usuario esperaba unos 2 segundos por respuesta, así que hubo menos solicitudes por segundo de las proyectadas. La causa fue que el gateway creaba un cliente HTTP nuevo en cada solicitud (INC06). Con un solo cliente compartido, el p95 bajó de 3,2 s a 19 ms y el throughput se triplicó. Los umbrales no se cambiaron.

## Evidencia

| Archivo | Qué muestra |
|---|---|
| `evidencias/u2/k6-catalogo-antes.json` | Resumen de k6 de la primera ejecución, con los umbrales en `ok: false` |
| `evidencias/u2/k6-catalogo.json` | Resumen de k6 de la segunda ejecución, con todos los umbrales en `ok: true` |
| `tests/carga/catalogo.js` | Escenario y umbrales |
| `docs/incidencias.md` (INC06) | Causa y arreglo |

## Límites de interpretación

- No se midió CPU ni memoria de los contenedores (`docker stats`), así que esos dos indicadores del M9 quedan sin dato.
- k6 corre en el mismo computador que el stack, dentro de Docker: la carga del generador compite con la de los servicios.
- Solo se prueba el catálogo; pedidos y pagos no se sometieron a carga.
- Una ejecución por versión.

## Conclusión

Primera ejecución fallida y registrada como INC06. Después del arreglo, el catálogo cumple los tres umbrales medidos con holgura (p95 26 veces bajo el límite y 2,6 veces el throughput mínimo).
