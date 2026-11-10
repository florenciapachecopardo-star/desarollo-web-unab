# Ficha de evidencia E10: servicios del panel interno por API (productos, despacho y reporte)

| Campo | Valor |
|---|---|
| ID | E10 |
| Nombre de la prueba | ADMIN administra un producto, DESPACHO atiende la cola y la dueña ve el reporte de ventas, todo por API (estos servicios no tienen pantalla en la U2) |
| Módulo | M4 (permisos por rol), M10 |
| Requisito relacionado | R02, R07, R09, R10 (productos), R13 |
| Servicio y ruta | S03, S04, S05, S14, S15 y S19 |
| Rol que ejecuta | ADMIN (USR-0003), DESPACHO (USR-0006) y DUENO (USR-0004) |
| Fecha y hora | 09-11-2026, 21:07 (America/Santiago), según los headers de las respuestas (10-11-2026 00:07 UTC) |
| Ejecutada por | Flo |
| Código | Rama `docs/evidencias-panel`, sobre `eda453d` |
| Entorno | Stack de `docker-compose.yml` en el equipo de Flo, base recién reseteada |
| Estado | **Aprobada** (9 de 9 respuestas como se esperaba) |

## Precondiciones

- Stack arriba y `docker compose run --rm seed --reset` justo antes.

## Pasos

`bash scripts/evidencias-panel.sh`. El script inicia sesión con las tres cuentas, hace las 9 llamadas con `curl` y guarda, por cada una, los headers (`*.headers.txt`), el cuerpo (`*.json`) y una línea en `resumen.txt` con el código y el `X-Request-ID`.

## Resultado esperado y obtenido

| Llamada | Rol | Esperado | Obtenido | `X-Request-ID` |
|---|---|---|---|---|
| S03 crear "Trufas de cafe" ($5.990, stock 12) | ADMIN | 201 con `disponible: true` | 201 | `2005ef66b05c4d3c829a318806249b67` |
| S04 editar precio a $6.490 y stock a 10 | ADMIN | 200 con los valores nuevos | 200, precio 6490 y stock 10 | `d6e7f7e21aa04cb3a19590ca55ceecf4` |
| S05 eliminar el producto | ADMIN | 200 | 200, "Producto eliminado correctamente" | `a00453f2811140b4bb3091580a9851ef` |
| S14 cola con `estado=PAGADO` | DESPACHO | 200 con los pedidos pagados | 200, solo PED-0001 (`total: 1`), con dirección y boleta | `598c28e2dfc44293a498deebdc32e669` |
| S15 PED-0001 a EN_DESPACHO | DESPACHO | 200 y entrada nueva en el historial | 200, historial "EN_DESPACHO por USR-0006" | `2713245d01ff496d8ef9e30810293e4c` |
| S15 PED-0001 a ENTREGADO | DESPACHO | 200 | 200, historial "ENTREGADO" | `55b1333620d243eebf5207cad03f382a` |
| S15 PED-0002 (sin pagar) a ENTREGADO | DESPACHO | Rechazado | 409 `TRANSICION_INVALIDA` | `5fe9266d56ba466f8f9f2102e1631604` |
| S19 reporte sin fechas | DUENO | 200 con totales | 200: 1 pedido, $22.970; Bombones rellenos 2 ($13.980) y Chocolate Dubai 1 ($8.990) | `abfde04a40c74afea8d9e5485e22ee27` |
| S19 reporte | DESPACHO | 403 | 403 `FORBIDDEN` | `8e6dfc1549884ce88de8a1ab33727283` |

El reporte cuenta solo PED-0001 (pagado en el seed) y no PED-0002 (pendiente), y no trae datos personales.

## Evidencia

| Archivo | Qué muestra |
|---|---|
| `evidencias/u2/panel-api/resumen.txt` | Las 9 llamadas con su código y su `X-Request-ID` |
| `evidencias/u2/panel-api/*.headers.txt` | Los headers de cada respuesta, con `x-request-id` y la fecha |
| `evidencias/u2/panel-api/*.json` | El cuerpo de cada respuesta |
| `scripts/evidencias-panel.sh` | El script que las genera |

**Vinculación:** el `X-Request-ID` de cada línea de `resumen.txt` coincide con el de su archivo de headers y, en los errores, con el `request_id` del cuerpo.

## Límites de interpretación

- No se guardaron los logs de los servicios para estos `X-Request-ID`.
- Al intentar mover PED-0002, DESPACHO recibe 409 con el mensaje "No se puede pasar de PENDIENTE_PAGO a ENTREGADO". O sea, se entera del estado de un pedido sin pagar, que en S12 no puede ver (ahí responde 404). Es menor, porque no expone datos del cliente ni montos, pero es inconsistente: queda como INC07.
- La cola se probó con un solo pedido pagado, así que no muestra el orden de llegada entre varios pedidos (el código ordena por `creado_en`).
- Una sola ejecución.

## Conclusión

Aprobada. Los servicios sin pantalla funcionan por API con los permisos del M4: solo ADMIN administra productos, DESPACHO mueve pedidos pagados por los estados permitidos y la dueña ve el reporte, que DESPACHO no puede ver.
