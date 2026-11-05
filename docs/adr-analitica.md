# ADR: analítica del reporte de ventas

**Estado:** Aceptada
**Fecha:** 2 de noviembre de 2026
**Módulo:** M9

## Contexto

El Caso 19 pide un reporte de ventas por período para el dueño (R09). La pauta pide decidir si la analítica va en un servicio aparte o no.

Según `docs/m9-carga.md`, el volumen es bajo: hasta 500 pedidos al día en el peak. El reporte lo consulta pocas veces el dueño o el administrador, no los clientes.

Los datos que necesita el reporte (pedidos, estados, montos y líneas) ya están en orders.

## Decisión

**El reporte de ventas es un endpoint dentro de orders**, no un servicio aparte:

- Ruta: `GET /api/v1/reportes/ventas?desde=&hasta=` (S19 en `docs/m1-servicios.md`).
- Acceso: DUENO y ADMIN.
- Se calcula al momento de la consulta, directo desde la colección de pedidos.
- Solo cuenta pedidos en estado PAGADO, EN_DESPACHO o ENTREGADO.

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| Servicio de analítica aparte, con su propia base de datos | Habría que copiar los pedidos a otra base y mantenerla sincronizada. Con este volumen no hay beneficio y aparece el riesgo de que el reporte muestre datos atrasados |
| Reporte calculado en el front | El front no debe ver los pedidos de todos los clientes. Rompe la regla de propiedad |
| Endpoint dentro de orders (elegida) | Usa los datos que ya existen, sin copias, y la consulta es liviana con este volumen |

## Frescura de los datos

Como el reporte se calcula en cada consulta, una venta aparece en el reporte **apenas el pedido pasa a PAGADO**. No hay un intervalo de actualización. Esto se puede probar en la U3: hacer una compra desde el front y ver que el reporte la incluye de inmediato.

## Consecuencias

- **A favor:** un servicio menos que levantar, documentar y probar; datos siempre al día.
- **En contra:** si el volumen creciera mucho, consultas de períodos largos podrían hacer más lento a orders. Por eso se declara como recorte en el informe.

## Cuándo revisar esta decisión

- Si el reporte de un mes completo supera el umbral de 1.000 ms.
- Si se piden reportes más complejos (por ejemplo, comparación entre años o tendencias).
