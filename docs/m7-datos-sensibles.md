# M7. Datos sensibles

**Estado:** versión final, revisada contra el código de `main` (bdd26ff): auth, inventory, orders, payments, graphql-gateway, gateway y `frontend/js`. Las 6 pruebas de seguridad (sección 7) se ejecutaron el 08-11-2026 con pytest y pasaron todas (E07).

**Actualización del 9 de noviembre:** el servicio clients quedó implementado (S09, S09V y S10). RUN, dirección, teléfono, fecha de nacimiento y sexo se guardan en la base `clients`; la clave la recibe auth y guarda solo su hash bcrypt. S10 devuelve solo lo que el front necesita (sin fecha de nacimiento ni sexo). Las filas que digan "clients" deben leerse como implementadas.

## 1. Niveles de clasificación

| Nivel | Qué significa | Ejemplo |
|---|---|---|
| Público | Lo puede ver cualquiera, sin sesión | Catálogo, precios |
| Interno | Solo funcionarios con rol | Cola de despacho, reporte de ventas |
| Personal | Identifica a una persona. Solo la persona y los roles que lo necesitan | Nombre, correo, dirección |
| Restringido | Personal y de mayor riesgo si se filtra. Se muestra enmascarado | RUN, fecha de nacimiento, sexo |
| Secreto | Nadie lo ve en texto plano, ni siquiera el administrador | Contraseñas, tokens de sesión, secretos entre servicios |

## 2. Matriz de datos

| Dato | Finalidad | Clasificación | Custodio | Roles que acceden | Protección | Retención | Estado en la U2 |
|---|---|---|---|---|---|---|---|
| RUN | Identificar al cliente (RF5) y emitir la boleta | Restringido | clients | CLIENTE (el suyo), ADMIN | Enmascarado (`**.***.678-5`), único, validado con dígito verificador, nunca en logs | Mientras la cuenta esté activa | Implementado en clients (S09): único, validado con dígito verificador también en el servidor; S10 lo devuelve enmascarado |
| Nombre | Saludo, despacho y boleta | Personal | auth (usuarios) | El propio usuario | Se devuelve solo en S08 (`/me`) al dueño de la sesión; los logs usan el ID | Mientras la cuenta esté activa | Implementado. La cola de despacho no lo muestra: solo trae `cliente_id` |
| Correo | Inicio de sesión y contacto | Personal | auth | El propio usuario | Único; nunca en logs; la respuesta del login es igual si el correo no existe o la clave es incorrecta | Mientras la cuenta esté activa | Implementado |
| Dirección y comuna de despacho | Entregar el pedido | Personal | orders (copia dentro del pedido) | CLIENTE (la suya), DESPACHO (pedidos pagados), ADMIN | No aparece en logs ni en el reporte de ventas; DESPACHO no ve pedidos sin pagar | Igual que el pedido | Implementado en S11 (`despacho`) |
| Teléfono de despacho | Contacto para la entrega | Personal | orders (copia dentro del pedido, opcional) | CLIENTE (el suyo), DESPACHO (pedidos pagados), ADMIN | No aparece en logs; GraphQL no lo expone (Despacho solo tiene dirección y comuna) | Igual que el pedido | Implementado |
| Fecha de nacimiento y sexo | Los pide el Caso 19 (RF5) | Restringido | clients | CLIENTE (los suyos), ADMIN | No se usan en ninguna pantalla ni servicio | Mientras la cuenta esté activa | Implementado: se guardan en clients y ningún servicio los devuelve |
| Contraseña | Autenticación (RF12) | Secreto | auth | Nadie | Hash bcrypt costo 12; nunca en logs, respuestas ni capturas (`check.py` no muestra el hash) | Se reemplaza al cambiarla | Implementado para el seed y para el registro (S09 la manda a auth, que guarda solo el hash). El front ya no guarda claves |
| Sesión (cookie) | Mantener la sesión | Secreto | auth (guarda solo el hash SHA-256 del token) y gateway (pone la cookie) | El navegador del usuario | Cookie `session_token` `httponly`, `samesite=lax`, TTL de 900 s con índice TTL en Mongo, invalidada en el logout | Hasta que expira o se cierra | Implementado. `secure` queda en `false` por defecto porque el entorno local usa HTTP |
| Pedidos y líneas | Compra, despacho y reporte | Personal | orders | CLIENTE (los suyos), DESPACHO (pagados), ADMIN, DUENO (solo totales en S19) | Propiedad revisada en orders con la identidad del gateway; pedido ajeno = 404 | A confirmar (plazo tributario) | Implementado |
| Boleta (número, neto, IVA, total) | Comprobante de la venta (RF8) | Personal | orders | Quien puede ver el pedido | Igual que el pedido; la numera el servidor | A confirmar (plazo tributario) | Implementada (R08 parcial: sin envío por correo) |
| Pago (monto, estado, referencia) | Confirmar el pago | Personal | payments | CLIENTE (el suyo) | Monto tomado de orders, nunca del navegador; solo payments marca PAGADO; `Idempotency-Key` evita pagos dobles | Igual que el pedido | Implementado con proveedor simulado |
| Secretos entre servicios | Que solo el servicio autorizado llame a cada operación | Secreto | Vault (los del gateway) y `.env` (los demás) | Solo el servicio de cada integración | Uno por integración; nunca en el repo, logs ni capturas; comparación de tiempo constante | Se rotan si se filtran | Implementado. Solo el gateway los lee de Vault (brecha, ver M6) |
| `request_id` | Unir pantalla, respuesta, log y base | Interno | gateway (lo genera o valida) | Todos | Formato acotado (8 a 64 caracteres); no contiene datos personales | Igual que los logs | Implementado |

## 3. ¿Custodiamos secretos del cliente?

**No.** Chocomanía no recibe ni guarda datos de tarjetas ni de cuentas bancarias: S16 solo recibe el `pedido_id`. El pago lo resuelve el proveedor (en la U2, un doble de prueba que respeta el contrato) y payments solo guarda el monto, el estado y la referencia que devuelve el proveedor (`SIM-...`).

El único secreto del cliente que guarda el backend es su contraseña, y solo como hash bcrypt. La excepción es el registro local del front, que no pasa por el backend (ver brechas).

## 4. Minimización

- La fecha de nacimiento y el sexo se piden en el registro porque el Caso 19 los exige (RF5), pero ningún servicio los recibe ni los usa.
- El reporte de ventas (S19) solo trae cantidades y montos por producto: sin nombres, correos ni direcciones.
- La cola de despacho (S14) trae el `cliente_id`, la dirección, la comuna, el teléfono y las líneas del pedido; no trae RUN, correo ni nombre. Sí trae el total y la boleta, porque se devuelve el pedido completo (posible mejora: una vista reducida para DESPACHO).
- GraphQL (S18) no expone el teléfono, y `stock` solo se entrega a ADMIN (`FORBIDDEN_FIELD` para el resto).
- Los logs usan campos fijos: servicio, evento, `request_id`, método, ruta, estado, `user_id` y duración. Nunca correo, dirección, teléfono ni secretos. El gateway registra solo los nombres de las claves que lee de Vault.

## 5. Recorrido de un dato restringido: la dirección de despacho

1. **Captura:** el cliente la escribe en el checkout (`checkout.html`). Viaja al gateway en el mismo origen (`http://localhost:8000`) y de ahí a orders dentro de S11.
2. **Validación:** orders exige dirección de 3 a 120 caracteres y comuna de 2 a 60. Si falla, el 422 dice qué campo falló, sin repetir el valor.
3. **Almacenamiento:** orders la guarda dentro del pedido (`despacho`). Es una copia: si el cliente cambia de dirección, el pedido no cambia.
4. **Consulta:** la ven el dueño (S12 y S18, esta última sin teléfono), DESPACHO cuando el pedido está pagado (S14) y ADMIN.
5. **Lo que no pasa:** no aparece en los logs (E02 y E03 muestran las líneas completas de una compra y un pago), en el reporte de ventas (S19) ni en la respuesta de GraphQL con teléfono.
6. **Fin:** se conserva con el pedido por el plazo tributario de la boleta (a confirmar).

## 6. Verificación del correo

El Caso 19 pide comprobar con una API de mensajería que el correo existe y está activo (RF5, RF11). En la U2 esta verificación es **simulada** en `verificar.html`: se genera un código y se muestra en pantalla, sin enviar un correo real. Se declara como brecha en el informe.

## 7. Pruebas de seguridad

Detalle de cada una en `docs/protocolo-pruebas.md` y código en `tests/api/test_seguridad.py`. Se ejecutan con `docker compose run --rm pruebas` sobre la base reseteada. Resultado: 16 de 16 pruebas aprobadas (las 6 de esta tabla y 10 casos más), ficha en `evidencias/u2/pytest/ficha-E07.md`.

| ID | Caso | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|
| P01 | Visitante anónimo consulta el catálogo (S01) | 200 con la lista de productos | **Aprobada:** 200 sin sesión | E01, E07 |
| P02 | Operación protegida sin sesión (S11) | 401 | **Aprobada:** 401 con formato de error único. También 401 si el navegador manda una identidad falsa (`X-Authenticated-User`) | E07 |
| P03 | CLIENTE intenta una operación de ADMIN (S03) | 403 | **Aprobada:** 403 y el producto no se crea | E07 |
| P04 | CLIENTE consulta un pedido ajeno (S12) | 404 sin datos del pedido | **Aprobada:** 404 `ORDER_NOT_FOUND` igual que un pedido inexistente; también 404 al pagarlo (S16) y `null` por GraphQL (S18) | E07 |
| P05 | Llamada directa a un servicio interno sin pasar por el gateway | Rechazada | **Aprobada:** inventory, orders y payments responden 403 sin el secreto o con uno inventado | E07 |
| P06 | El front manda un precio o estado alterado (S11) | El servidor lo ignora y usa el precio de inventory | **Aprobada:** precio 8990 de inventory, estado PENDIENTE_PAGO y cajero USR-0005 pese a lo enviado; el pago usa el monto de orders | E07 |

## 8. Riesgos y brechas de datos

| Riesgo | Situación | Tratamiento |
|---|---|---|
| ~~Registro local con datos personales y clave en texto plano en localStorage~~ **Resuelto (INC05):** el registro va a clients y auth; el front ya no guarda cuentas y borra las que hubieran quedado de versiones anteriores | — | Brecha declarada; se resuelve con clients (S09 y S10) en la U3 |
| Cuentas de prueba visibles en el login | `login.html` muestra correos y claves de prueba, incluida la de ADMIN | Son ficticias y solo para la demo; se quitan antes de cualquier despliegue real |
| Mongo con el usuario raíz en todos los servicios | Un servicio comprometido podría leer las bases de los demás | Brecha declarada (M6); en la U3, un usuario por base con permisos mínimos |
| Vault en modo dev y solo para el gateway | Los demás servicios reciben sus secretos por variables de entorno | Brecha declarada (M6) |
| Cookie sin `secure` | El entorno local usa HTTP | Se activa con `COOKIE_SECURE=true` al usar HTTPS |
| Cola de despacho con montos | S14 devuelve el pedido completo | Mejora para la U3 (vista reducida) |
| Identidad falsa en los logs de una llamada rechazada | En P05, inventory, orders y payments registran el `user_id` del header falso aunque rechazan la llamada (403) | No da acceso a nada; en la U3, el log no debería tomar ese header si falta el secreto |
