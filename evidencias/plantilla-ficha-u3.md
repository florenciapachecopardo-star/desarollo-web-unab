# Ficha de ejecución [RUN??]

> Copiar a `evidencias/u3/RUN??/ficha.md` después de correr `sh scripts/u3-run.sh RUN??`.
> La sección "Observación" se llena **antes** de interpretar: primero lo que pasó, después qué significa.

## Contexto

| Campo | Valor |
|---|---|
| RUN | RUN?? |
| Pruebas | P-U3-01 a P-U3-16 (escritorio y móvil) y P-U3-API (pytest) |
| Criterios | CA01 a CA09 (`docs/u3/protocolo-u3.md`, versión __) |
| Versión | Commit/tag de `entorno.txt` |
| Fecha y hora | De `entorno.txt` (America/Santiago) |
| Ejecutora | |
| Entorno | Sistema operativo, Docker y Compose de `entorno.txt` |
| Navegador y viewport | Chromium (Playwright 1.49.1); escritorio 1366×768 y móvil 390×844 **emulado** |

## Preparación

- Datos: seed restaurado con `scripts/reset.sh` al inicio (`reset.txt`).
- Cuentas: cliente1, cliente2, despacho y dueña del seed; un cliente nuevo por viewport en P-U3-16.
- Dependencias: todas reales salvo el proveedor de pagos (doble de prueba). En las fases `caido`, `demora` y `expira` se modificaron inventory y auth a propósito (ver `bitacora-run.txt`).
- ¿Algo distinto a lo planificado? (otra versión, un paso manual, un reintento a mano):

## Observación (antes de interpretar)

Copiar de `resumen-fases.txt` y de los reportes:

| Fase | Pruebas | Aprobadas | Fallidas | Bloqueadas / no ejecutadas | Código de salida |
|---|---|---|---|---|---|
| normal | 22 | | | | |
| caido | 4 | | | | |
| recuperado | 2 | | | | |
| demora | 2 | | | | |
| expira | 2 | | | | |
| pytest | 23 | | | | |

Por cada prueba que **no** pasó (una fila por prueba y viewport):

| Prueba | Viewport | Resultado esperado | Resultado observado (mensaje del reporte) | Captura | `X-Request-ID` |
|---|---|---|---|---|---|
| | | | | | |

## Fuentes

| ID | Archivo | Qué muestra |
|---|---|---|
| E-RUN??-01 | `playwright/normal/reporte-html/index.html` | Cada prueba con sus capturas y su `red.json` |
| E-RUN??-02 | `playwright/*/red.jsonl` | Las llamadas del navegador con su `X-Request-ID` |
| E-RUN??-03 | `logs/*-trazas.log` | Las mismas solicitudes en los logs de los servicios |
| E-RUN??-04 | `persistencia.txt` | Los pedidos creados, leídos directo en Mongo |
| E-RUN??-05 | `pytest/resultado.txt` | Controles de API |
| E-RUN??-06 | `revision-credenciales.txt` | Que la evidencia no tiene cookies ni claves |

## Vinculación (completar con un ejemplo real de esta RUN)

- P-U3-03 escritorio: pedido `PED-____`, boleta `B-______`. `X-Request-ID` del POST /api/v1/pedidos: `__________`. Aparece en `logs/normal-trazas.log` (gateway, auth, orders, inventory) y en `persistencia.txt`.

## Seguimiento

- Incidencias abiertas en esta RUN: INC__
- Límites de interpretación: entorno local, datos sintéticos, móvil emulado, pago simulado, F07–F09 sin pantalla.
- ¿Hay que repetir? (sí/no y por qué):
