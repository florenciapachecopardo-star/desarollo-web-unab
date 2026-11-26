# Entrega 3 — Inventario de flujos, riesgo y prioridad

Todos los flujos del Caso 19 que identificamos en la U2 (`docs/m1-servicios.md`). Elegir tres recorridos críticos **no** saca a los demás del alcance: cada flujo tiene su criterio de aceptación (CA) y su prueba, o queda declarado como no comprobado.

**Criticidad:** según lo que pasa si el flujo falla.
- **Alta:** pierde plata, cobra mal, expone datos de otra persona o deja datos inconsistentes.
- **Media:** impide usar una parte del sistema, pero no daña datos.
- **Baja:** molesta, pero hay alternativa.

**Responsable:** quien implementó el flujo. Según el reparto v2 (`docs/reparto-roles-entrega-2-v2.md`), el código es de Florencia y la documentación de Karla. Para reducir el sesgo del observador, **cada ficha de prueba la revisa quien no escribió el código (Karla) antes de ejecutarla**.

---

## 1. Inventario

| ID | Requisitos | Objetivo del usuario | Rol | Pantalla | Servicios y protocolos | Datos afectados | Criticidad y por qué | Estado inicial (`u2-final`) | Responsable | Dependencia externa y tipo | CA |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F01 | R01, R07 | Ver qué productos hay, su precio y si quedan | Visitante (anónimo) | `index.html`, `producto.html`, `carrito.html` | S01 (REST) → gateway → inventory | Lectura de productos | **Alta.** Es la entrada a toda venta; un precio o disponibilidad mal mostrados llevan a comprar algo que no existe o a otro precio | Integrado (E01, E09) | Florencia | Ninguna | CA01 |
| F02 | R05, (R06, R11) | Crear su cuenta y verificar su correo | Visitante | `registro.html`, `verificar.html`, `login.html` | S09, S09V (REST) → clients → auth | Perfil del cliente (RUN, dirección, teléfono), credencial | **Media.** Sin registro no hay clientes nuevos; maneja datos personales (M7) | Integrado (PR #47) | Florencia | Mensajería de correo: **doble de prueba** (código en pantalla) | CA02 |
| F03 | R12 | Entrar y salir; que la sesión venza | Todos | `login.html`, cabecera | S06, S07, S08 (REST) → gateway → auth | Sesiones | **Alta.** Si falla, cualquiera actúa como otro o nadie puede comprar | Integrado (E07, E09) | Florencia | Ninguna | CA03 |
| F04 | R01, R02, R04, R08 | Comprar y pagar, y recibir la boleta | CLIENTE | `carrito.html`, `checkout.html`, `pago.html`, `boleta.html` | S11, S12, S16 (REST) → orders, inventory, payments | Pedido, stock, pago, boleta | **Alta.** Cambia plata y stock: un doble cobro, un pedido duplicado o un total mal calculado afectan al cliente y al negocio | Integrado (E02, E03, E09) | Florencia | Proveedor de pagos: **doble de prueba** (`ProveedorSimulado`) | CA04 |
| F05 | R01, R03, R12 | Ver sus pedidos, su estado y su boleta | CLIENTE | `mis-pedidos.html`, `boleta.html` | S18 (GraphQL: orders + inventory), S12 (REST) | Lectura de pedidos | **Alta.** Si la regla de propiedad falla, un cliente ve pedidos, direcciones y montos de otro | Integrado (E05, E06, E09) | Florencia | Ninguna | CA05 |
| F06 | R03 | Anular un pedido pendiente indicando el motivo | CLIENTE dueño (ADMIN por API) | `mis-pedidos.html` | S13 (REST) → orders → inventory | Estado del pedido, stock | **Media.** Afecta stock y estado, pero solo de pedidos sin pagar | Integrado (E02 por API) | Florencia | Ninguna | CA06 |
| F07 | R07, R10 | Crear, editar y eliminar productos | ADMIN | **Sin pantalla** (panel interno no construido) | S03, S04, S05 (REST) → inventory | Productos | **Media.** Cambia el catálogo de todos, pero lo usa una sola persona | Solo API (E10) | Florencia | Ninguna | CA07 |
| F08 | R02, R13 | Ver la cola de pedidos pagados y moverlos | DESPACHO, ADMIN | **Sin pantalla** | S14, S15 (REST) → orders | Estado del pedido | **Media.** Un pedido sin pagar no debe despacharse; INC07 estaba aquí | Solo API (E10); INC07 abierta | Florencia | Ninguna | CA08 |
| F09 | R09 | Ver las ventas de un período | DUENO, ADMIN | **Sin pantalla** | S19 (REST) → orders (analítica dentro de orders) | Lectura de pedidos | **Baja.** Es informativo; un error no cambia datos | Solo API (E10) | Florencia | Ninguna | CA09 |

---

## 2. Recorridos críticos elegidos para validación profunda

| Recorrido | Flujo(s) | Por qué se eligió | Lo que cubre | Subsistemas |
|---|---|---|---|---|
| **RC1** Consultar catálogo | F01 | Es la lectura que alimenta todas las demás pantallas y la única abierta a cualquiera | **Lectura** | inventory |
| **RC2** Comprar y pagar | F04 | Es el único flujo que mueve plata y stock: el de mayor impacto si falla | **Cambio persistente de estado** | orders, inventory, payments (y auth) |
| **RC3** Ver mis pedidos | F05 (con F06 y F03 asociados) | Es donde un error de permisos expone datos de otra persona, y es la pantalla con agregación GraphQL | **Acceso protegido** y agregación | orders, inventory por GraphQL; clients (perfil) y auth (sesión) |

Entre los tres se usan los cuatro subsistemas que pide la pauta: inventory (RC1, RC2, RC3), orders (RC2, RC3), payments (RC2) y clients (F02, por P-U3-16, y el perfil S10). clients no está dentro de un recorrido crítico porque ninguna pantalla de compra lo usa: el checkout pide la dirección en el formulario (decisión de la U2).

Para cada recorrido crítico hay un escenario **exitoso**, uno de **rechazo o fallo** y uno de **límite o recuperación** (ver `docs/u3/protocolo-u3.md`):

| Recorrido | Exitoso | Rechazo o fallo | Límite o recuperación |
|---|---|---|---|
| RC1 | P-U3-01 | P-U3-09 (inventory caído) | P-U3-02 (agotado), P-U3-11 (vuelve inventory), P-U3-12 (inventory lento) |
| RC2 | P-U3-03 | P-U3-04 (sin dirección, sin stock) | P-U3-05 (respuesta perdida y reintento) |
| RC3 | P-U3-06 | P-U3-07 (ajeno, campo restringido, profundidad, rol), P-U3-14 (sin sesión) | P-U3-10 (error parcial), P-U3-13 (sesión expirada), P-U3-08 (anulación) |

---

## 3. Flujos fuera de los recorridos críticos

| Flujo | Cómo se comprueba en la U3 | Qué se puede concluir |
|---|---|---|
| F02 | P-U3-16 desde el navegador (registro, RUN inválido, cuenta inactiva hasta verificar, código equivocado) | Registro y verificación simulada. **No** que el correo exista (R11) |
| F07 | pytest (P03 en `test_seguridad.py`): un CLIENTE no puede crear productos | Solo la denegación por API. La administración en sí **no** se vuelve a probar en la U3 (E10 es de la versión U2) |
| F08 | pytest (`test_inc07_*`): DESPACHO no ve el estado de un pedido sin pagar; ADMIN sí | Solo la regla de S15 por API, sin pantalla |
| F09 | P-U3-15: una venta hecha desde el navegador aparece de inmediato en el reporte (leído por API con la sesión de la dueña) | Frescura del reporte. **No** el reporte visto en una pantalla |

F07, F08 y F09 no tienen pantalla, así que **no pueden quedar como demostrados de punta a punta**: la pauta pide que la validación final del recorrido incluya el frontend.
