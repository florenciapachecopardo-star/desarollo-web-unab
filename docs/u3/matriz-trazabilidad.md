# Entrega 3 — Matriz de trazabilidad

Requisito → flujo → pantalla → rol → servicio → criterio → prueba → ejecución → evidencia → conclusión.

Las columnas **Ejecuciones**, **Resultado** y **Conclusión** se llenan con los resultados reales de las RUN de la versión `u3-final` (protocolo, sección 5). Mientras no haya RUN, dicen "pendiente".

**Conclusión posible:** Demostrado en el entorno evaluado · Parcialmente demostrado · No demostrado. Un requisito parcialmente probado **no** cuenta como demostrado en el indicador "logro demostrado".

| Req. | Flujo | Pantalla | Rol | Servicio / integración | CA | Pruebas | Ejecuciones | Evidencia | Resultado | Conclusión | Límite de validez |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R01 Armar un pedido con productos disponibles | F01, F04, F05 | `index`, `producto`, `carrito`, `checkout`, `mis-pedidos` | Visitante, CLIENTE | S01, S11, S12, S18 (gateway, inventory, orders, graphql) | CA01, CA04, CA05 | P-U3-01, 02, 03, 04, 05, 06, 09, 10, 11, 12 | pendiente | pendiente | pendiente | pendiente | Local, datos sintéticos, móvil emulado |
| R02 Preparar solo después de pagar | F04, F08 | `pago`, `boleta` | CLIENTE | S16 (payments → orders) | CA04 | P-U3-03, 05; P-U3-API (C07 `PEDIDO_NO_PAGABLE`) | pendiente | pendiente | pendiente | pendiente | Proveedor de pagos simulado: no prueba Webpay |
| R03 Anular con motivo | F06 | `mis-pedidos` | CLIENTE | S13 (orders → inventory) | CA06 | P-U3-08 | pendiente | pendiente | pendiente | pendiente | La anulación por ADMIN no tiene pantalla |
| R04 Venta asociada al cajero virtual | F04 | Ninguna (lo asigna orders) | — | S11 | CA04 | P-U3-03 (`cajero_id` en `persistencia.txt`), P-U3-API (P06) | pendiente | pendiente | pendiente | pendiente | No es visible en la interfaz: solo en los datos |
| R05 Registro con validación del correo | F02 | `registro`, `verificar`, `login` | Visitante | S09, S09V, S10 (clients → auth) | CA02 | P-U3-16; P-U3-API (`test_clientes.py`) | pendiente | pendiente | pendiente | pendiente | Verificación **simulada** (código en pantalla) |
| R06 Registro también por el administrador | — | — | ADMIN | — | — | — | No aplica | — | Brecha | **No demostrado** (no construido) | — |
| R07 Disponibilidad (stock) de cada producto | F01, F07 | `index`, `producto` (lectura) | Visitante; ADMIN por API | S01; S03–S05 | CA01, CA07 | P-U3-01, 02, 04, 08; P-U3-API (P03) | pendiente | pendiente | pendiente | pendiente | La administración del stock no tiene pantalla |
| R08 Boleta digital por cada venta | F04, F05 | `boleta`, `mis-pedidos` | CLIENTE | S12, S16 | CA04, CA05 | P-U3-03, 05, 06 | pendiente | pendiente | pendiente | pendiente | **No** se envía por correo: a lo más "parcialmente demostrado" |
| R09 Reporte de ventas para la dueña | F09 | Ninguna | DUENO | S19 (orders) | CA09 | P-U3-15 | pendiente | pendiente | pendiente | pendiente | Sin pantalla: a lo más "parcialmente demostrado" |
| R10 Mantenedores | F07 | Ninguna | ADMIN | S03–S05 (productos) | CA07 | P-U3-API (P03, solo denegación) | pendiente | pendiente | pendiente | pendiente | Usuarios y clientes no construidos; productos sin pantalla |
| R11 Validar el correo con API de mensajería | F02 | `verificar` | Visitante | — | — | — | No aplica | — | Brecha | **No demostrado** (simulado) | — |
| R12 Autenticación y acceso según perfil | F03, F05 | `login`, todas las protegidas | Todos | S06–S08, gateway, permisos en cada servicio | CA03, CA05 | P-U3-03, 07, 13, 14, 16; P-U3-API (P02–P05) | pendiente | pendiente | pendiente | pendiente | Sesión expirada probada con TTL de 20 s, no con los 15 min reales |
| R13 Despacho en orden de llegada | F08 | Ninguna | DESPACHO | S14, S15 (orders) | CA08 | P-U3-API (`test_inc07_*`) | pendiente | pendiente | pendiente | pendiente | Sin pantalla; el orden de la cola no se vuelve a probar en la U3 (E10 es de la U2) |

## Componentes y controles transversales

| Componente | Qué se comprueba | Pruebas | Resultado |
|---|---|---|---|
| API Gateway | Única entrada; enruta con `X-Request-ID`; corta a los 5 s | Todas; P-U3-12 | pendiente |
| Auth Service | Login, sesión vencida | P-U3-03, 13, 16 | pendiente |
| Administrador de secretos (Vault) | El gateway lee sus secretos de Vault con un token de solo lectura (evento `secret_loaded`, solo nombres de claves); los servicios internos rechazan llamadas sin su secreto. **Límite:** solo el gateway lee de Vault; los servicios internos reciben su lado del secreto por variable de entorno (decisión de la U2, `docs/m6-rutas-secretos.md`) | `logs/normal-servicios.log`; P-U3-API (P05) | pendiente |
| GraphQL Gateway | Agregación orders + inventory, permisos por recurso y campo, error parcial, límite de profundidad | P-U3-06, 07, 10, 11 | pendiente |
| inventory, orders, clients, payments | Funcionan de verdad (no simulados) en los recorridos | P-U3-01, 03, 16 | pendiente |
| Analítica | Frescura del reporte | P-U3-15 | pendiente |
| gRPC | No aplica (`docs/adr-grpc.md`) | — | No aplica |
| Frontend responsivo | Acciones, validaciones y mensajes en escritorio y móvil, contra el mismo backend | Todas, en los dos proyectos | pendiente |
