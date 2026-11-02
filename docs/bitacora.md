# Bitácora de incrementos — Chocomanía

Una fila por PR. No se borran filas: si algo se revierte, se agrega una fila nueva.

| Incremento | Fecha | Commit / PR | Flujo (F) | Diferencia de contrato | Cambio | Prueba | Estado | Siguiente acción |
|---|---|---|---|---|---|---|---|---|
| INC-00 | 2026-10-15 | PR #17 | — | — | Merge del frontend completo (`Frontend-entrega`) a `main` | Navegación manual: login, carrito, checkout y mis pedidos | Hecho | Reorganizar carpetas |
| INC-01 | 2026-10-15 | (este PR) | — | — | Estructura `frontend/`, `backend/`, `docs/`, `tests/`, `scripts/`, `evidencias/`; código de semanas anteriores a `archivo/`; `.gitignore` ampliado | `frontend/index.html` carga con fuentes e imágenes | Hecho | `docker-compose.yml` y `.env.example` (Etapa 1) |
| INCR-05 | 2026-11-02 | (este PR) | F01, F09 | — | M9: caracterización de carga proyectada con umbrales fijados antes de medir (`docs/m9-carga.md`), ADR gRPC (no aplica) y ADR analítica (reporte dentro de orders) | Los umbrales quedan definidos y el escenario de k6 descrito; la medición queda pendiente | Hecho (medición pendiente) | Escribir `tests/carga/catalogo.js` para que Flo lo ejecute |
