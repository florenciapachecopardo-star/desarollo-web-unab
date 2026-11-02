# Bitácora de incrementos — Chocomanía

Una fila por PR. No se borran filas: si algo se revierte, se agrega una fila nueva.

| Incremento | Fecha | Commit / PR | Flujo (F) | Diferencia de contrato | Cambio | Prueba | Estado | Siguiente acción |
|---|---|---|---|---|---|---|---|---|
| INC-00 | 2026-10-15 | PR #17 | — | — | Merge del frontend completo (`Frontend-entrega`) a `main` | Navegación manual: login, carrito, checkout y mis pedidos | Hecho | Reorganizar carpetas |
| INC-01 | 2026-10-15 | (este PR) | — | — | Estructura `frontend/`, `backend/`, `docs/`, `tests/`, `scripts/`, `evidencias/`; código de semanas anteriores a `archivo/`; `.gitignore` ampliado | `frontend/index.html` carga con fuentes e imágenes | Hecho | `docker-compose.yml` y `.env.example` (Etapa 1) |
| INCR-06 | 2026-11-02 | (este PR) | F02, F04, F05, F08 | — | M7 borrador: clasificación y matriz de datos sensibles, decisión de no custodiar secretos del cliente, recorrido de la dirección y tabla de las 6 pruebas (`docs/m7-datos-sensibles.md`). M4 parte 1: registro de 11 stakeholders (`docs/m4-stakeholders.md`) | Cada dato del registro del Caso 19 tiene clasificación, custodio y protección; las pruebas P01 a P06 quedan definidas | Borrador | Completar resultados de P01 a P06 con el PR H y hacer M4 permisos y M6 con los PR B y C |
