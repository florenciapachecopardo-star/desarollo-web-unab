# Reparto de roles, Entrega 2 (Chocomanía), versión 2

**Fecha:** 28 de octubre de 2026
**Reemplaza a:** `reparto-roles-entrega-2.md` (v1). La sección 4 y el reparto por persona de la sección 5 del `PLAN-ENTREGA-2.md` siguen reemplazados. Lo demás del plan se mantiene, salvo los recortes de la sección 4 de este documento.
**Entrega:** lunes 9 de noviembre de 2026

## 1. Por qué cambia el reparto

- Hoy, 28 de octubre, la Etapa 1 no se ha empezado (ni código ni documentos) y quedan 12 días.
- Karla no ejecuta código. Si escribe servicios o front sin poder correrlos, los errores aparecen cuando Flo los levanta, y los depura Flo en código ajeno. Eso no es 50-50.
- La pauta pone tanto peso en documentación (matrices, UML, ADR, protocolo, informe) como en código.

**Decisión:** el código lo hace Flo y la documentación la hace Karla. Así el reparto es parejo y cada una trabaja sin bloquear a la otra.

## 2. Reglas

1. **Flo: todo lo que se ejecuta.** Servicios, docker-compose, front conectado, scripts, pruebas y capturas de evidencia.
2. **Karla: todo lo que se documenta.** Matrices, UML `.drawio`, ADR, protocolo de pruebas, fichas y armado del informe.
3. **Nadie documenta a ciegas.** Cada PR de Flo trae en la descripción una sección **"Notas para el informe"**: qué se hizo, qué decisiones se tomaron y por qué, rutas, roles y errores. Karla escribe a partir de esas notas, y Flo revisa los PR de documentación de Karla para confirmar que reflejan el código.
4. **Revisión en menos de 24 horas.** Cada PR lo revisa la otra (Reviewers) y se mergea con "Create a merge commit". Si un PR lleva más de 24 horas sin revisión, se avisa por WhatsApp.
5. **Cada PR agrega una fila en `docs/bitacora.md`.** Los incrementos usan el prefijo `INCR-` (el prefijo `INC` queda para incidencias, como dice el plan).
6. **Defensa:** cada una tiene que poder explicar todo. Karla lee el código de cada PR que revisa, y Flo lee cada documento que revisa.
7. **Si algo se atrasa más de un día**, se avisa el mismo día y se decide juntas qué se recorta. Lo que haga cada una queda registrado en la bitácora (la U3 pide "aportes de cada una").

## 3. Reparto por módulo

| Módulo / tarea | Flo (código) | Karla (documentación) |
|---|---|---|
| docker-compose, Vault, redes, `.env.example` | ✅ | |
| Gateway: lista blanca, `X-Request-ID`, logs, errores, rate limit | ✅ | |
| Auth: Mongo, bcrypt, roles, TTL | ✅ | |
| inventory: stock, `MONGO_URL`, arreglos | ✅ | |
| orders (incluye boletas, despacho y reporte de ventas) | ✅ | |
| payments (adaptador de prueba) | ✅ | |
| clients | ✅ | |
| GraphQL Gateway | ✅ | |
| Front conectado + estados de UI | ✅ | |
| Panel interno (una pantalla) | ✅ | |
| `seed.py`, `reset.sh`, `check.py`, `logs.sh` | ✅ | |
| pytest (6 pruebas de seguridad + contratos) | ✅ | |
| Capturas y evidencias de la U2 | ✅ | |
| README de arranque | ✅ | |
| **M1** Matriz de servicios y contratos (R, S, F) | revisa | ✅ |
| **M2** UML del dominio + tabla de multiplicidades | revisa | ✅ |
| **M3** Matriz de sistemas, mapa de componentes, secuencia de compra | revisa | ✅ |
| **M4** Stakeholders + matriz de permisos | revisa | ✅ |
| **M5** UML del gateway, fronteras de confianza, recorridos | revisa | ✅ |
| **M6** Matriz de rutas + inventario de secretos | revisa | ✅ |
| **M7** Datos sensibles | revisa | ✅ |
| **M8** Documentación de GraphQL (schema explicado, límites, mapa de clasificación) | revisa | ✅ |
| **M9** Caracterización de carga + ADR gRPC + ADR analítica | revisa | ✅ |
| Protocolo de pruebas, incidencias, índice y plantilla de ficha | revisa | ✅ |
| Matriz requisito / pantalla / servicio / prueba / resultado | revisa | ✅ |
| Estructura y armado del informe final | revisa | ✅ |

## 4. Recortes acordados

| Tarea | Decisión | Dónde se declara |
|---|---|---|
| Rate limit | Pasa a la Etapa 4 | — |
| Sesiones persistentes en Auth | Quedan en memoria | Línea base U3: pendiente |
| Analítica | Endpoint de reporte dentro de orders, no un servicio aparte | ADR analítica (M9) |
| Boletas y despacho | Estados y campos de orders, sin servicio propio | M3 |
| Payments | Adaptador falso que respeta el contrato (doble de prueba, no Webpay) | M3, columna "tipo de dependencia" |
| Panel interno | Una pantalla con datos reales (cola de despacho). Las demás se declaran | Informe M10 |
| Verificación de correo | Código simulado, mostrado en pantalla, sin envío real | M7 e informe |
| Playwright | Pasa a la U3. En la U2, evidencia manual con formato RUN/E | Informe |
| k6 | Si queda tiempo, un script contra el catálogo (Karla lo escribe, Flo lo corre). Si no, solo caracterización como proyección | M9 |

**No se recorta:** ID de correlación, lista blanca, bcrypt, orders con idempotencia, GraphQL `misPedidos`, las 6 pruebas de seguridad del M7, seed/reset y front conectado al menos en login, catálogo, checkout/pago y mis pedidos.

## 5. Lista de servicios (propuesta para el M1)

Sirve para que Karla empiece el M1, el M4 y el M6 sin esperar el código. Se confirma al mergear el PR B (gateway). Si cambia algo, Flo lo avisa en las "Notas para el informe".

| ID | Verbo y ruta | Acceso | Destino |
|---|---|---|---|
| S01 | `GET /api/v1/productos` | Anónimo | inventory |
| S02 | `GET /api/v1/productos/{id}` | Anónimo | inventory |
| S03 | `POST /api/v1/productos` | ADMIN | inventory |
| S04 | `PUT /api/v1/productos/{id}` | ADMIN | inventory |
| S05 | `DELETE /api/v1/productos/{id}` | ADMIN | inventory |
| S06 | `POST /api/v1/auth/login` | Anónimo | auth |
| S07 | `POST /api/v1/auth/logout` | Autenticado | auth |
| S08 | `GET /api/v1/auth/me` | Autenticado | auth |
| S09 | `POST /api/v1/clientes` (registro) | Anónimo | clients |
| S10 | `GET /api/v1/clientes/me` | CLIENTE | clients |
| S11 | `POST /api/v1/pedidos` (con `Idempotency-Key`) | CLIENTE | orders |
| S12 | `GET /api/v1/pedidos/{id}` | CLIENTE dueño del pedido, ADMIN | orders |
| S13 | `POST /api/v1/pedidos/{id}/anular` | CLIENTE dueño del pedido, ADMIN | orders |
| S14 | `GET /api/v1/pedidos?estado=pagado` (cola de despacho) | DESPACHO, ADMIN | orders |
| S15 | `PATCH /api/v1/pedidos/{id}/estado` | DESPACHO, ADMIN | orders |
| S16 | `POST /api/v1/pagos` (con `Idempotency-Key`) | CLIENTE | payments |
| S17 | `POST /api/v1/pagos/aviso` (aviso del proveedor) | Proveedor (secreto propio) | payments |
| S18 | `POST /api/v1/graphql` (`misPedidos`) | Autenticado | graphql-gateway |
| S19 | `GET /api/v1/reportes/ventas` | DUENO, ADMIN | orders |

**Roles** (iguales a los del front): `CLIENTE`, `ADMIN`, `DUENO`, `CAJERO`, `DESPACHO`. El visitante es "anónimo", no un rol.
**Formato de error:** `{ "error": { "code", "message", "request_id" } }`
**Header de correlación:** `X-Request-ID`. El gateway lo genera o reutiliza el que manda el front, y lo devuelve en la respuesta.

## 6. Calendario

### Flo (código)

| Día | Tarea | Listo cuando |
|---|---|---|
| Mié 28 oct | **PR A** `feat/docker-compose`: Dockerfiles y compose base | Los contenedores se construyen |
| Jue 29 oct | PR A: carga de secretos en Vault, `.env.example`, versiones fijas, `MONGO_URL`, prefijo de la bitácora → **abrir PR** | `docker compose up` y los 5 `/health` responden |
| Vie 30 oct | **PR B** `feat/gateway-correlacion`: `X-Request-ID`, logs JSON, formato de error, lista blanca, catálogo anónimo; en inventory: logs, admin en POST/PUT, ID inválido → 400, `stock` | El catálogo se ve sin login y devuelve `X-Request-ID` |
| Sáb 31 oct | PR B: probar y cerrar → **abrir PR**. Empezar **PR C** `feat/auth-bcrypt` | **Hito de la Etapa 1:** el mismo ID aparece en la respuesta y en los logs del gateway y de inventory |
| Dom 1 nov | PR C: usuarios en Mongo con correo, bcrypt, roles, TTL, `seed.py`, `reset.sh` → **abrir PR**. Evidencia del hito en `evidencias/u2/` | Login con las cuentas de prueba del front contra Mongo |
| Lun 2 nov | **PR D** `feat/orders`: crear pedido con precio desde inventory, `Idempotency-Key`, propiedad | Se crea un pedido por API y `check.py` lo confirma |
| Mar 3 nov | PR D: estados, anulación con devolución de stock, cola de despacho, reporte de ventas → **abrir PR** | Compra hasta "pendiente de pago" por API |
| Mié 4 nov | **PR E** `feat/payments-clients`: adaptador de pago con idempotencia y aviso; clients mínimo (registro con RUN, perfil) | Compra completa por API |
| Jue 5 nov | **PR F** `feat/graphql`: `misPedidos` (orders + inventory), límite de profundidad, paginación, error parcial | Query por el gateway con y sin inventory |
| Vie 6 nov | **PR G** `feat/front-api`: `api.js`, login, catálogo, checkout/pago, mis pedidos, estados de UI | Flujo completo desde el navegador |
| Sáb 7 nov | PR G: panel (cola de despacho). **PR H** `test/seguridad`: pytest con las 6 pruebas del M7, rate limit | pytest pasa; evidencias en `evidencias/u2/` |
| Dom 8 nov | README, prueba desde cero (clonar → up → seed), revisión de secretos, **tag `u2-final`** | Funciona en un clon limpio |

Si algo se atrasa, se cae en este orden: panel interno → clients (se declara) → estados de UI secundarios. GraphQL y el front de mis pedidos no se recortan.

### Karla (documentación)

Cada entrega va en su propio PR a `docs/`, con Flo como revisora.

| Fecha límite | Entregable | Archivo | Depende de |
|---|---|---|---|
| Jue 29 oct | Estructura del informe (portada + 10 módulos en orden, con títulos vacíos) y plantillas de evidencia | `docs/informe.md`, `docs/protocolo-pruebas.md`, `docs/incidencias.md`, `evidencias/indice.md`, `evidencias/plantilla-ficha.md` | Nada |
| Vie 30 oct | **M2** UML del dominio con multiplicidades + tabla de reglas | `docs/uml-dominio.drawio`, `docs/m2-dominio.md` | Nada |
| Sáb 31 oct | **M1** Matriz de servicios (R, S, F) con un JSON de ejemplo por contrato | `docs/m1-servicios.md` | Sección 5 de este documento + pantallas del front |
| Dom 1 nov | **M7** Datos sensibles (borrador) + registro de stakeholders (M4, parte 1) | `docs/m7-datos-sensibles.md`, `docs/m4-stakeholders.md` | Nada |
| Lun 2 nov | **M9** Caracterización de carga + ADR gRPC + ADR analítica | `docs/m9-carga.md`, `docs/adr-grpc.md`, `docs/adr-analitica.md` | Nada |
| Mar 3 nov | **M4** Matriz de permisos + **M6** rutas y secretos | `docs/m4-permisos.md`, `docs/m6-rutas-secretos.md` | PR B y PR C mergeados |
| Mié 4 nov | **M5** UML del gateway + fronteras de confianza + recorrido autorizado y denegado (con `request_id`) | `docs/uml-gateway.drawio`, `docs/m5-gateway.md` | PR B mergeado |
| Jue 5 nov | **M3** Matriz de sistemas + mapa de componentes + secuencia de una compra | `docs/m3-sistemas.md`, `docs/componentes.drawio` | PR D y PR E (notas) |
| Vie 6 nov | **M8** Documentación de GraphQL + fichas P de las 6 pruebas de seguridad | `docs/m8-graphql.md`, `docs/protocolo-pruebas.md` | PR F (notas) |
| Sáb 7 nov | Matriz requisito / pantalla / servicio / prueba / resultado + M7 final | `docs/matriz-requisitos.md` | PR G y PR H |
| Dom 8 nov | Informe armado con todos los módulos y capturas | `docs/informe.md` (y PDF si lo piden) | Todo lo anterior |

Además, durante toda la entrega, Karla:
- Revisa los PR de Flo en menos de 24 horas y lee el código de lo que revisa.
- Si queda tiempo, escribe el script k6 del catálogo para que Flo lo corra.

## 7. Puntos de control

| Fecha | Qué se revisa |
|---|---|
| **Dom 1 nov** (llamada de 30 min) | Hito de la Etapa 1 cumplido; M1 y M2 mergeados; la lista de servicios de la sección 5 queda confirmada o ajustada |
| **Mié 4 nov** (llamada de 30 min) | Compra completa por API; M4, M6 y M5 en revisión; ¿hay que recortar algo más? |
| **Dom 8 nov** (juntas) | Prueba desde cero, revisión de secretos, informe completo, tag `u2-final` |

## 8. Datos de prueba

- Las cuentas de prueba son las del front (`frontend/js/datos.js`), con claves marcadas como ficticias en el README.
- El cliente de ejemplo usa un **nombre inventado**, no el de una integrante del equipo. El RUN de prueba `12.345.678-5` se puede mantener.
- Los secretos que quedaron en el historial de git (`gateway-api-secret-456`, `gateway-auth-secret-789`, `dev-only-token`) se dan por quemados y no se reutilizan.
