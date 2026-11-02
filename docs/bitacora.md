# Bitácora de incrementos — Chocomanía

Una fila por PR. No se borran filas: si algo se revierte, se agrega una fila nueva.

| Incremento | Fecha | Commit / PR | Flujo (F) | Diferencia de contrato | Cambio | Prueba | Estado | Siguiente acción |
|---|---|---|---|---|---|---|---|---|
| INC-00 | 2026-10-15 | PR #17 | — | — | Merge del frontend completo (`Frontend-entrega`) a `main` | Navegación manual: login, carrito, checkout y mis pedidos | Hecho | Reorganizar carpetas |
| INC-01 | 2026-10-15 | (este PR) | — | — | Estructura `frontend/`, `backend/`, `docs/`, `tests/`, `scripts/`, `evidencias/`; código de semanas anteriores a `archivo/`; `.gitignore` ampliado | `frontend/index.html` carga con fuentes e imágenes | Hecho | `docker-compose.yml` y `.env.example` (Etapa 1) |
| INCR-04 | 2026-11-02 | (este PR) | F01 a F09 | Define S01 a S19 (fuente: reparto v2, sección 5) | M1: requisitos R01 a R13, flujos F01 a F09, matriz de servicios y contrato con ejemplo JSON de cada S (`docs/m1-servicios.md`) | Cada S tiene su R, su F y un ejemplo JSON; los R sin servicio quedan listados en la sección 5 | Hecho | Decidir con Flo los R04, R05, R06, R08, R10 y R11 (agregar o declarar brecha) |
