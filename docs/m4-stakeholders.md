# M4. Registro de stakeholders (parte 1)

La parte 2 (matriz de permisos por rol, servicio y ruta) va en `docs/m4-permisos.md` y depende del PR B y el PR C.

## 1. Registro

| ID | Stakeholder | Tipo | Interés en el sistema | Rol en el sistema | ¿Permisos operativos? | Cómo recibe la información |
|---|---|---|---|---|---|---|
| SH01 | Visitante | Persona externa | Ver productos y precios antes de registrarse | Anónimo (sin cuenta) | Solo lectura del catálogo | Catálogo público (S01, S02) |
| SH02 | Cliente | Persona externa | Comprar online, pagar, seguir y anular sus pedidos | CLIENTE | Sí, solo sobre sus propios datos y pedidos | Pantallas del cliente y boleta por correo |
| SH03 | Administrador | Funcionario | Mantener productos, usuarios y clientes, y apoyar en ventas y anulaciones | ADMIN | Sí, el más amplio | Panel interno |
| SH04 | Dueño | Funcionario | Saber cuánto se vende por período | DUENO | Solo consulta del reporte de ventas | Reporte de ventas (S19) |
| SH05 | Cajero virtual | Funcionario | Asociar las ventas web a una caja y emitir la boleta (RF4, RF8) | CAJERO | Sí (servicio pendiente de decisión, ver sección 5 del M1) | Panel interno |
| SH06 | Encargado de despacho | Funcionario | Ver los pedidos pagados en orden de llegada y marcar su avance | DESPACHO | Sí, solo sobre el estado de despacho | Cola de despacho (S14, S15) |
| SH07 | Cocina | Funcionarios | Preparar los pedidos en el orden en que llegan | Ninguno | **No** | Orden de despacho impresa que le entrega DESPACHO (RF13) |
| SH08 | Choferes | Funcionarios | Entregar los pedidos dentro del radio de 3 km | Ninguno | **No** | Orden de despacho impresa con dirección y teléfono |
| SH09 | Proveedor de pagos | Sistema externo | Cobrar y avisar el resultado del pago | Proveedor (secreto propio) | Solo puede enviar avisos de pago (S17) | Llamada al servicio S17 |
| SH10 | API de mensajería | Sistema externo | Validar correos y enviar boletas (RF8, RF11) | Ninguno | **No** | Simulada en la U2 (brecha declarada) |
| SH11 | Servicios internos | Sistemas propios | Cumplir cada uno su parte (inventory, orders, clients, payments, auth, GraphQL) | Servicio, con secreto propio en Vault | Solo sobre sus propios datos | Llamadas internas a través de la red privada |

## 2. Stakeholders sin permisos operativos

| ID | Stakeholder | Por qué no tiene permisos | Qué información recibe y cómo |
|---|---|---|---|
| SH07 | Cocina | No necesita usar el sistema para preparar | La orden de despacho impresa, con los productos y cantidades, en orden de llegada |
| SH08 | Choferes | Solo entregan. Darles una cuenta los expondría a datos de otros clientes | La orden de despacho impresa con nombre, dirección, teléfono y productos. Sin RUN, correo ni montos |
| SH10 | API de mensajería | Es un sistema externo que solo recibe solicitudes | El correo a validar o la boleta a enviar. Simulada en la U2 |

## 3. Reglas que salen de este registro

1. Un CLIENTE solo ve y modifica sus propios datos y pedidos. Lo revisa orders, no solo el gateway.
2. Anular un pedido no lo borra: cambia su estado a ANULADO y conserva el motivo.
3. DUENO ve totales, no datos personales de clientes.
4. DESPACHO ve datos de contacto solo de pedidos pagados.
5. El visitante no es un rol: es una solicitud sin sesión.
