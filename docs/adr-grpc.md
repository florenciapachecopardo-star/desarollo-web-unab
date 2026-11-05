# ADR: uso de gRPC entre servicios

**Estado:** Aceptada
**Fecha:** 2 de noviembre de 2026
**Módulo:** M9

## Contexto

Los servicios de Chocomanía (gateway, auth, inventory, orders, clients, payments y GraphQL Gateway) se comunican hoy por HTTP con JSON. La pauta pide decidir si conviene usar gRPC en alguna de esas comunicaciones.

gRPC sirve sobre todo cuando hay muchas llamadas internas por segundo, mensajes grandes, streaming o la necesidad de latencias muy bajas entre servicios.

Según `docs/m9-carga.md`:

- La carga proyectada es baja: menos de 25 solicitudes por segundo en el peak.
- El tráfico es sobre todo de lectura del catálogo.
- Las llamadas internas por operación son pocas (por ejemplo, orders consulta a inventory para el precio y el stock al crear un pedido).
- Los mensajes son chicos (un pedido tiene pocas líneas).

## Decisión

**No se usa gRPC.** Todas las comunicaciones entre servicios siguen siendo HTTP con JSON.

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| gRPC entre orders e inventory | Es la llamada interna más frecuente, pero con la carga proyectada el ahorro de latencia no se notaría. Agrega archivos `.proto`, generación de código y otra forma de depurar |
| gRPC en todos los servicios internos | El mismo costo multiplicado por cada servicio, sin un problema de rendimiento que lo justifique |
| HTTP con JSON (elegida) | Ya funciona, se depura con el navegador, Postman y los logs, y el `X-Request-ID` se propaga igual en todos los servicios |

## Consecuencias

- **A favor:** un solo estilo de comunicación, más fácil de probar, documentar y defender.
- **En contra:** si la carga creciera mucho, la llamada orders → inventory sería la primera candidata a optimizar.

## Cuándo revisar esta decisión

- Si una medición de k6 muestra que la llamada orders → inventory no cumple los umbrales de `docs/m9-carga.md`.
- Si se agregan funciones que necesiten streaming (por ejemplo, seguimiento del despacho en tiempo real).
