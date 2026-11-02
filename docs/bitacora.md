# Bitácora de incrementos — Chocomanía

Una fila por PR. No se borran filas: si algo se revierte, se agrega una fila nueva.

| Incremento | Fecha | Commit / PR | Flujo (F) | Diferencia de contrato | Cambio | Prueba | Estado | Siguiente acción |
|---|---|---|---|---|---|---|---|---|
| INC-00 | 2026-10-15 | PR #17 | — | — | Merge del frontend completo (`Frontend-entrega`) a `main` | Navegación manual: login, carrito, checkout y mis pedidos | Hecho | Reorganizar carpetas |
| INC-01 | 2026-10-15 | (este PR) | — | — | Estructura `frontend/`, `backend/`, `docs/`, `tests/`, `scripts/`, `evidencias/`; código de semanas anteriores a `archivo/`; `.gitignore` ampliado | `frontend/index.html` carga con fuentes e imágenes | Hecho | `docker-compose.yml` y `.env.example` (Etapa 1) |
| INCR-03 | 2026-11-02 | (este PR) | — | — | M2: UML del dominio (`docs/uml-dominio.drawio`) y tabla de multiplicidades, reglas y estados (`docs/m2-dominio.md`) | El diagrama abre en app.diagrams.net y las multiplicidades coinciden con la tabla | Hecho | Confirmar estados del pedido con el PR D (orders) |
