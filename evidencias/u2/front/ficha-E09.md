# Ficha de evidencia E09: compra completa desde el navegador (escritorio y celular) y error parcial en mis pedidos

| Campo | Valor |
|---|---|
| ID | E09 (prueba manual P07) |
| Nombre de la prueba | Compra completa desde el front conectado al backend, vista de celular y aviso de mis pedidos con inventory caído |
| Módulo | M8 (error parcial visto por el usuario) y M10 (integración front y backend) |
| Requisito relacionado | R01, R02, R08 (parcial) |
| Servicio y ruta | S01, S06, S11, S12, S16 y S18, desde `http://localhost:8000` |
| Rol que ejecuta | CLIENTE (`cliente@correo.cl`, Valentina Soto) |
| Fecha y hora | Escritorio: 08-11-2026, entre 19:05 y 19:13. Celular y error parcial: 09-11-2026, entre 11:03 y 11:07 (America/Santiago) |
| Ejecutada por | Karla |
| Código | `main` en `49190b4` (merge de pruebas automáticas, INC04 e INC06) |
| Entorno | Windows con Docker Desktop y navegador Opera (Chromium); vista de celular con las herramientas de desarrollo, perfil iPhone 16 Pro Max (440 × 956) |
| Estado | **Aprobada** |

## Precondiciones

- Stack arriba y base reseteada con `docker compose run --rm seed --reset` antes de la compra.
- Sesión iniciada como `cliente@correo.cl`.

## Pasos

1. Abrir el catálogo, agregar 1 "Bombones rellenos" al carrito e ir a pagar.
2. En el checkout, elegir "Retiro en el local" y pago en línea, y continuar.
3. Pagar con el proveedor simulado y ver la boleta.
4. Abrir Mis pedidos.
5. Repetir catálogo y Mis pedidos en vista de celular.
6. Detener inventory (`docker compose stop inventory`), recargar Mis pedidos y tomar la captura. Volver a levantarlo (`docker compose start inventory`) y recargar.

## Resultado esperado

- El pedido se crea y se paga desde el navegador, y la boleta muestra neto e IVA calculados por el servidor.
- Mis pedidos (GraphQL) muestra los pedidos propios con su estado y su boleta.
- Las pantallas se adaptan al ancho del celular.
- Con inventory caído, Mis pedidos sigue mostrando los pedidos y avisa que faltan datos de productos, en vez de fallar entera.

## Resultado obtenido

| Captura | Qué muestra |
|---|---|
| `01-catalogo.png` | Catálogo con filtros por categoría y precios desde inventory |
| `02-carrito.png` | Carrito con 1 "Bombones rellenos" ($6.990) y el aviso de que el servidor confirma el total |
| `03-checkout.png` | Confirmación con retiro en el local y pago en línea simulado |
| `04-pago.png` | Pago del pedido PED-0004 por $6.990, con el aviso de proveedor simulado sin datos de tarjeta |
| `05-boleta.png` | Boleta B-000003 de PED-0004: estado Pagado, neto $5.874, IVA $1.116 y total $6.990 |
| `06-mis-pedidos.png` | PED-0004, PED-0003 y PED-0001 pagados, cada uno con su boleta |
| `07-catalogo-movil.png` | Catálogo en vista de celular: menú y filtros se reacomodan y los productos quedan en dos columnas |
| `08-mis-pedidos-movil.png` | Mis pedidos en vista de celular |
| `09-mis-pedidos-inventory-caido.png` | Con inventory detenido: los tres pedidos siguen visibles y arriba aparece "Algunos datos de los productos no están disponibles en este momento. Los pedidos y sus montos sí están al día", con un código de referencia |
| `10-mis-pedidos-inventory-recuperado.png` | Con inventory de vuelta, el aviso desaparece |

La boleta cuadra: 6.990 / 1,19 = 5.874 de neto y 1.116 de IVA.

## Límites de interpretación

- PED-0003 (Bombones de caramelo, B-000002) es una compra anterior del mismo día, hecha al probar el flujo; no tiene captura propia.
- Las capturas no muestran el `X-Request-ID` de cada pantalla. El código `web-...` del aviso de error parcial sí es el `X-Request-ID` de esa consulta: lo genera el front y el gateway lo reutiliza, así que sirve para buscarla en los logs (no se guardaron).
- La vista de celular es la emulación del navegador, no un teléfono real.
- No se probó el despacho a domicilio desde el navegador (sí por API en E02, E03 y E07).

## Conclusión

Aprobada. El front hace la compra completa contra el backend real, la boleta usa los montos del servidor, las pantallas funcionan en ancho de celular y Mis pedidos degrada bien cuando inventory no responde.
