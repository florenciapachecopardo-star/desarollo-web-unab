# Informe Entrega 3: integración frontend–backend y validación basada en evidencias

**Caso:** 19 "Sistema de Ventas On-line", adaptado a Chocomanía
**Equipo:** Florencia Pacheco y Karla Muñoz
**Versión evaluada:** tag `u3-final` (commit ______)
**Línea base:** tag `u2-final` (commit `566dea1`)

> Esqueleto. Las secciones 1 a 4 ya tienen su documento de respaldo (solo hay que resumirlo aquí). Las secciones 5 a 8 se escriben **con los resultados reales** de las RUN de `u3-final`. No escribir ninguna conclusión antes de tener esos resultados.

---

## 1. Caso y alcance

Resumir `docs/u3/inventario-flujos.md`: los 9 flujos, su criticidad y por qué se eligieron RC1 (catálogo), RC2 (comprar y pagar) y RC3 (mis pedidos). Decir explícitamente que F07, F08 y F09 no tienen pantalla.

## 2. Línea base

Resumir `docs/u3/linea-base.md`: qué estaba integrado en `u2-final`, qué no, INC07 abierta, ninguna prueba desde el navegador automatizada, y la tabla de dependencias (proveedor de pagos y correo = dobles de prueba).

**Componentes condicionales:** analítica dentro de orders (se mantiene el ADR); gRPC no aplica (se mantiene el ADR). Explicar en 2 o 3 líneas por qué la U3 no cambia esas decisiones.

## 3. Criterios y protocolos

Resumir `docs/u3/protocolo-u3.md`: CA01 a CA09, las 16 fichas, el plan de RUN, cómo se clasifican y consolidan los resultados (sección 5 del protocolo) y que no se mide rendimiento. Indicar quién revisó el protocolo y cuándo.

## 4. Estrategia de integración incremental

Resumir la bitácora (`docs/bitacora.md`, INCR-17 en adelante): primero catálogo, después sesión, compra y pago, después GraphQL, clients y el contenedor frontend; en la U3, pruebas desde el navegador y la corrección de INC07. Mencionar las diferencias de contrato que se encontraron y cómo se resolvieron (están en INCR-20).

## 5. Resultados

Con los datos de `evidencias/u3/RUN01/` y `RUN02/` (y siguientes si hubo correcciones):

- Tabla por prueba (P-U3-01 a P-U3-16 y P-U3-API): resultado en RUN01 y RUN02, en escritorio y en móvil.
- Pruebas distintas y repeticiones **por separado**.
- Resultados intermitentes, si hubo, con la regla del protocolo.
- Diferencias entre lo esperado y lo observado, y si afectan a un flujo completo o solo a una condición.

## 6. Incidencias y correcciones

De `docs/incidencias.md`: INC07 (causa, corrección `a6ae451`, RUN que la valida y regresión) y las nuevas de la U3. Si no aparecieron fallos nuevos, explicar la búsqueda: P-U3-04, 07, 09, 10, 12, 13, 14 son rechazos y fallos controlados, y cada RUN es una regresión completa.

## 7. Indicadores

| Indicador | Fórmula | Conteo | Resultado |
|---|---|---|---|
| Cobertura del diseño | Requisitos con criterios y pruebas definidos / requisitos en alcance | 11 / 13 (R06 y R11 sin prueba: no construidos) | 84,6 % |
| Ejecución del plan | Pruebas distintas con resultado aprobado o fallido / pruebas distintas planificadas (17: P-U3-01 a 16 y P-U3-API) | __ / 17 | __ % |
| Aprobación observada | Pruebas distintas aprobadas / pruebas distintas ejecutadas | __ / __ | __ % |
| Logro demostrado | Requisitos que cumplen sus criterios con evidencia suficiente / requisitos en alcance | __ / 13 | __ % |

Informar aparte las bloqueadas y las no ejecutadas. Los porcentajes no son probabilidad de éxito en producción. Recordar que R08, R09, R10 y R13 llegan a lo más a "parcialmente demostrado" (ver la matriz) y no cuentan en "logro demostrado".

## 8. Conclusiones y limitaciones

- Una conclusión por flujo y una global, con su alcance (ejemplo de la pauta: "se verificó en las ejecuciones RUN01 y RUN02 de `u3-final`…; no se probó…").
- Sin "sin errores", "totalmente seguro" ni "listo para producción".
- Amenazas a la validez: entorno local, datos sintéticos y pocos, móvil emulado, pago simulado, F07–F09 sin pantalla, sesión expirada con TTL de 20 s, ejecutoras que conocen el sistema, pruebas no ejecutadas.
- Acciones pendientes, ligadas al riesgo y a la evidencia que falta.

## Anexos

- `docs/u3/matriz-trazabilidad.md`
- `evidencias/indice.md` (sección Entrega 3) y `evidencias/u3/`
- `tests/e2e/`, `tests/api/`, `scripts/u3-run.sh`
- Aportes de cada integrante (commits, PR, revisiones y RUN que ejecutó cada una)
