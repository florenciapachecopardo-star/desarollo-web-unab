# Registro de incidencias

Cada incidencia usa el prefijo `INC` seguido de un número correlativo. El prefijo `INCR-` es solo para los incrementos de la bitácora.

| ID | Fecha | Detectada en | Descripción | `X-Request-ID` | Estado | Resolución |
|---|---|---|---|---|---|---|
| INC01 | 2026-11-06 | Revisión del PR #33 (payments) | Si orders no respondía al confirmar el pago, el pago quedaba APROBADO y el pedido en PENDIENTE_PAGO para siempre | — (revisión de código) | Resuelta | `a1b1de1`: el pago se guarda con `pedido_sincronizado: false` y payments reintenta cada 15 s. Evidencia E04 |
| INC02 | 2026-11-07 | Revisión de la corrección del PR #33 | Dos avisos de pago simultáneos podían marcar dos veces el mismo pedido como pagado | — (revisión de código) | Resuelta | `a1b1de1`: orders reconoce el aviso repetido por `pago_id` con una actualización atómica; un segundo pago aprobado queda REVERTIDO |
| INC03 | 2026-11-08 | Revisión del PR #38 (front) | El parámetro `volver` del login aceptaba cualquier URL: permitía `javascript:` (XSS) y redirigir a otro sitio | — (revisión de código) | Resuelta | `79588a7`: `login.js` solo acepta páginas propias (`nombre.html` con parámetros simples) |
| INC04 | 2026-11-08 | Revisión del código de inventory para el M1 | En `/interno/reservas`, si un pedido trae un producto válido y luego uno con ID mal formado, se responde 400 sin devolver el stock ya descontado del primero | — (revisión de código) | Resuelta | `cffe475` (INCR-23): inventory valida todos los ID antes de descontar. `test_inc04_id_mal_formado_no_descuenta_stock` pasa (E07, `inc04-7853e5b1`) |
| INC05 | 2026-11-08 | Revisión del front para el M7 | El registro local guarda los datos del cliente y su contraseña en texto plano en localStorage | — | Declarada como brecha | Se resuelve con el servicio clients (S09 y S10) en la U3 |
| INC06 | 2026-11-08 | Prueba de carga del catálogo (k6, M9) | El catálogo no cumplió los umbrales: p95 de 3.163 ms (umbral 500 ms) y 22,2 solicitudes por segundo (umbral 25). Causa: el gateway creaba un `httpx.AsyncClient` nuevo en cada solicitud, lo que saturaba su CPU | — (prueba de carga, 3.019 solicitudes) | Resuelta | `3c8d960`: un solo cliente HTTP para todo el gateway. Nueva medición: p95 de 19,2 ms y 65 solicitudes por segundo, sin cambiar los umbrales (E08) |

**Estados posibles:** Abierta, En revisión, Resuelta, Declarada como brecha.
