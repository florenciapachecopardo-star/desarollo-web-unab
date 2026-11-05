# M7. Datos sensibles (borrador)

**Estado:** borrador. La versión final se completa con los resultados de las 6 pruebas de seguridad (PR H) y se revisa contra el código de auth, clients, orders y payments.

## 1. Niveles de clasificación

| Nivel | Qué significa | Ejemplo |
|---|---|---|
| Público | Lo puede ver cualquiera, sin sesión | Catálogo, precios |
| Interno | Solo funcionarios con rol | Cola de despacho, reporte de ventas |
| Personal | Identifica a una persona. Solo la persona y los roles que lo necesitan | Nombre, correo, dirección |
| Restringido | Personal y de mayor riesgo si se filtra. Se muestra enmascarado | RUN, fecha de nacimiento, sexo |
| Secreto | Nadie lo ve en texto plano, ni siquiera el administrador | Contraseñas, tokens de sesión, secretos entre servicios |

## 2. Matriz de datos

| Dato | Finalidad | Clasificación | Custodio | Roles que acceden | Cómo se ve en el front | Protección | Retención |
|---|---|---|---|---|---|---|---|
| RUN | Identificar al cliente (Caso 19, RF5) y emitir la boleta | Restringido | clients | CLIENTE (el suyo), ADMIN | Enmascarado: `**.***.678-5` | Único en la base, validado con dígito verificador, nunca en logs | Mientras la cuenta esté activa |
| Nombre completo | Despacho y boleta | Personal | clients | CLIENTE (el suyo), ADMIN, DESPACHO (solo en la cola) | Completo solo para su dueño | Nunca en logs | Mientras la cuenta esté activa |
| Correo | Inicio de sesión, contacto y envío de boleta | Personal | auth y clients | CLIENTE (el suyo), ADMIN | Completo solo para su dueño | Único, nunca en logs (los logs usan el ID del usuario) | Mientras la cuenta esté activa |
| Dirección, comuna, provincia, región | Despacho dentro del radio de 3 km | Personal | clients (perfil) y orders (copia en el pedido) | CLIENTE (la suya), DESPACHO (solo pedidos pagados), ADMIN | Completa solo para su dueño y en la cola de despacho | Nunca en logs ni en el reporte de ventas | Perfil: mientras la cuenta esté activa. Pedido: igual que el pedido |
| Teléfono | Contacto para el despacho | Personal | clients | CLIENTE (el suyo), DESPACHO, ADMIN | Completo solo para su dueño y en la cola de despacho | Nunca en logs | Mientras la cuenta esté activa |
| Fecha de nacimiento | La pide el Caso 19 (RF5) | Restringido | clients | CLIENTE (la suya), ADMIN | Solo en el perfil propio | No se usa en ninguna otra pantalla ni servicio | Mientras la cuenta esté activa |
| Sexo | Lo pide el Caso 19 (RF5) | Restringido | clients | CLIENTE (el suyo), ADMIN | Solo en el perfil propio | No se usa en ninguna otra pantalla ni servicio | Mientras la cuenta esté activa |
| Contraseña | Autenticación (RF12) | Secreto | auth | Nadie | Nunca se muestra | Hash bcrypt con sal. Nunca en logs, respuestas ni capturas | Se reemplaza al cambiarla |
| Sesión (cookie) | Mantener la sesión iniciada | Secreto | auth y gateway | El navegador del usuario | No se ve (cookie `httponly`) | `httponly`, expiración (TTL), invalidada al cerrar sesión | Hasta que expira o se cierra la sesión |
| Pedidos y líneas | Compra, despacho y reporte | Personal | orders | CLIENTE (los suyos), DESPACHO (pagados), ADMIN, DUENO (solo totales en el reporte) | Solo para su dueño | Regla de propiedad revisada en orders, no solo en el gateway | Plazo tributario (a confirmar) |
| Boleta | Comprobante de la venta (RF8) | Personal | orders | CLIENTE (las suyas), ADMIN | Solo para su dueño | Igual que el pedido | Plazo tributario (a confirmar) |
| Pago (monto, estado, referencia del proveedor) | Confirmar el pago | Personal | payments | CLIENTE (el suyo), ADMIN | Solo el estado y el monto | Solo payments decide "pagado". El `Idempotency-Key` evita pagos dobles | Igual que el pedido |
| Secretos entre servicios | Que solo el gateway pueda llamar a los servicios internos | Secreto | Vault | Solo los servicios autorizados | Nunca | Guardados en Vault, uno por integración, nunca en el repo, logs ni capturas | Se rotan si se filtran |
| `request_id` | Unir pantalla, respuesta, log y base de datos | Interno | gateway (lo genera) | Todos | Se muestra en chico en los mensajes de error | No contiene datos personales | Igual que los logs |

## 3. ¿Custodiamos secretos del cliente?

**No.** Chocomanía no guarda datos de tarjetas ni de cuentas bancarias. El pago lo procesa un proveedor externo (en la U2, un adaptador de prueba que respeta el contrato). Payments solo guarda el monto, el estado y la referencia que devuelve el proveedor.

El único secreto del cliente que guardamos es su contraseña, y solo como hash bcrypt: ni el sistema ni el administrador pueden recuperarla.

## 4. Minimización

- La fecha de nacimiento y el sexo se piden porque el Caso 19 los exige (RF5), pero no se usan en ningún flujo. Se muestran solo en el perfil propio.
- El reporte de ventas del dueño muestra totales por producto, sin nombres, correos ni direcciones de clientes.
- La cola de despacho muestra solo lo necesario para entregar: nombre, dirección, teléfono y productos. No muestra RUN, correo ni montos.
- Los logs identifican al usuario por su ID interno, nunca por correo ni RUN.

## 5. Recorrido de un dato restringido: la dirección

1. **Captura:** el cliente la escribe en el registro (S09). Viaja por HTTPS al gateway y de ahí a clients.
2. **Almacenamiento:** clients la guarda en su colección. No queda en los logs del gateway ni de clients.
3. **Uso en una compra:** al crear el pedido (S11), orders guarda una copia de la dirección de despacho, para que un cambio posterior en el perfil no altere un pedido ya hecho.
4. **Consulta:** el cliente la ve en su perfil (S10) y en sus pedidos. DESPACHO la ve en la cola (S14) solo cuando el pedido está pagado.
5. **Lo que no pasa:** no aparece en el reporte de ventas (S19), en los logs ni en las capturas de evidencia.
6. **Fin:** si el cliente cierra su cuenta, se borra del perfil. La copia del pedido se conserva por el plazo tributario de la boleta.

## 6. Verificación del correo

El Caso 19 pide comprobar con una API de mensajería que el correo existe y está activo (RF5, RF11). En la U2 esta verificación es **simulada**: se genera un código y se muestra en pantalla, sin enviar un correo real. Se declara como brecha en el informe.

## 7. Pruebas de seguridad

Detalle de cada una en `docs/protocolo-pruebas.md`. Resultados pendientes hasta el PR H.

| ID | Caso | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|
| P01 | Visitante anónimo consulta el catálogo (S01) | 200 con la lista de productos | | |
| P02 | Operación protegida sin sesión (S11) | 401 | | |
| P03 | CLIENTE intenta una operación de ADMIN (S03) | 403 | | |
| P04 | CLIENTE consulta un pedido ajeno (S12) | 404 sin datos del pedido | | |
| P05 | Llamada directa a un servicio interno sin pasar por el gateway | Rechazada | | |
| P06 | El front manda un precio o estado de pago alterado (S11) | El servidor lo ignora y usa el precio de inventory | | |
