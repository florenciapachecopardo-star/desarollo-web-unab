# Chocomanía — Frontend

Sitio web de una chocolatería con delivery, hecho en **HTML, CSS y JavaScript puro**,
sin frameworks ni servidor. Es la aplicación del **Caso 19 "Sistema de Ventas On-line"**
(en el enunciado original es una sushería; aquí se adaptó a una chocolatería artesanal).

La entrega pedida es solo el **frontend**, así que todo lo que en el caso sería trabajo
del servidor (base de datos, envío de correos, cobros reales) está **simulado** y se
indica dónde corresponde.

## Cómo verlo

Abre `index.html` con doble clic. Funciona directo desde la carpeta, sin instalar nada.
Las carpetas `css/`, `js/`, `img/` y `fonts/` tienen que quedar al lado de los `.html`.

La primera vez que se abre, el sitio carga solo unos **datos de ejemplo** (productos,
clientes, un usuario por cada perfil y algunos pedidos). Se guardan en el navegador con
`localStorage` y se conservan al recargar.

## Cuentas de prueba

En la pantalla de ingreso están visibles y se completan con un clic.

| Perfil        | Correo                    | Contraseña   |
|---------------|---------------------------|--------------|
| Cliente       | cliente@correo.cl         | Cliente2026  |
| Administrador | admin@chocomania.cl       | Admin2026    |
| Dueño         | dueno@chocomania.cl       | Dueno2026    |
| Cajero        | cajero@chocomania.cl      | Cajero2026   |
| Despacho      | despacho@chocomania.cl    | Despacho2026 |

## Cómo está armado

Es un sitio **multipágina**: cada `.html` es una página, y comparten los mismos estilos
y los mismos archivos de JavaScript. No hay base de datos: todo se guarda en el
`localStorage` del navegador.

### Páginas

| Archivo            | Qué es                                                        |
|--------------------|--------------------------------------------------------------|
| `index.html`       | Inicio: productos destacados, filtro por categoría, "nosotros" |
| `producto.html`    | Ficha de un producto y sus relacionados                      |
| `carrito.html`     | Carrito con cantidades y total                               |
| `checkout.html`    | Confirmar pedido: entrega y medio de pago (exige sesión)     |
| `pago.html`        | Pago simulado (Webpay o depósito)                            |
| `boleta.html`      | Boleta digital imprimible                                    |
| `mis-pedidos.html` | Pedidos del cliente, con estado y anulación                  |
| `login.html`       | Ingreso de clientes y del personal                           |
| `registro.html`    | Registro de clientes                                         |
| `verificar.html`   | Verificación del correo (simulada)                           |
| `ayuda.html`       | Preguntas frecuentes                                         |
| `ubicacion.html`   | Dirección y horario                                          |
| `contacto.html`    | Formulario de contacto                                       |

### JavaScript

Los archivos se cargan como scripts clásicos (en el orden que indica cada `.html`) y
cada uno se encarga de una cosa:

- `datos.js` — la "base de datos": lee y guarda en `localStorage` y carga los datos de ejemplo la primera vez.
- `cuentas.js` — registro, ingreso, sesión y la validación del RUN (módulo 11).
- `geografia.js` — regiones, provincias, comunas y las comunas con despacho.
- `carrito.js` — el carrito: agregar, quitar, cambiar cantidades y calcular el total.
- `pedidos.js` — pedidos, pagos, boletas y anulación.
- `ui.js` — utilidades compartidas: formato de precios y fechas, y la cuenta de la cabecera.
- `productos.js` — arma las tarjetas de producto.
- El resto (`home.js`, `producto.js`, `carrito-pagina.js`, `login.js`, `registro.js`, `verificar.js`, `checkout.js`, `pago.js`, `boleta.js`, `mis-pedidos.js`, `ayuda.js`, `contacto.js`) es el código propio de cada página.

## Requerimientos del caso

### Hecho en esta entrega (parte del cliente)

| Requerimiento                                             | Dónde                                  |
|----------------------------------------------------------|----------------------------------------|
| Armar un pedido con los productos                        | `carrito.html`                         |
| El pedido se prepara solo con el pago confirmado         | El pedido nace pendiente de pago       |
| Anular una compra indicando el motivo                    | `mis-pedidos.html`                     |
| Comprar solo con sesión de cliente registrado            | `checkout.html` exige sesión           |
| Registro de cliente con los 10 datos y RUN validado      | `registro.html`                        |
| Validar la existencia del correo (simulada)              | `verificar.html`, con código de 6 dígitos |
| Boleta digital por cada venta                            | `boleta.html`, con neto e IVA          |
| Autenticación de clientes y personal                     | `login.html`                           |
| Despacho gratis dentro de 3 km                           | Solo las comunas cubiertas (checkout)  |
| Diseño responsive y mensajes de error claros             | En todas las páginas                   |

### Pendiente para la próxima entrega (panel interno)

Todavía **no** están hechas estas partes, todas del lado del personal:

- Mantenedores de productos (con disponible/agotado), clientes y usuarios.
- Caja del cajero: confirmar los depósitos bancarios.
- Despacho: cola de pedidos por orden de llegada e impresión de órdenes.
- Reporte de ventas por período para el dueño.

## Lo que se simula

Un frontend sin servidor no puede hacer todo lo que pide el caso:

- **Pago externo (Webpay / depósito).** La pantalla de pago es una imitación: al pagar, el sistema responde como si la plataforma hubiera confirmado.
- **Validación del correo.** No se puede comprobar que un correo existe ni enviarlo. El código de verificación se muestra en pantalla, como si hubiera llegado al correo.
- **Radio de 3 km.** Sin un servicio de mapas no se mide la distancia exacta; se aproxima con las comunas cercanas al local (Providencia, Ñuñoa, Santiago, Recoleta, Las Condes e Independencia).

Los requerimientos de base de datos Oracle, .NET/J2EE, procedimientos almacenados y
web services corresponden al backend y no aplican a esta entrega de frontend.
