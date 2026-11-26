# Entrega 3 — Etapa 2: criterios de aceptación y protocolo de pruebas

| Versión | Fecha | Autora | Cambio |
|---|---|---|---|
| 1.0 | 25-11-2026 | Florencia (borrador) | Primera versión, escrita **antes** de la primera ejecución sobre el sistema real. Las pruebas automáticas se revisaron contra un servidor simulado solo para comprobar que los pasos y selectores funcionan; esas corridas **no son evidencia** y no se entregan |
| 1.0 revisada | __-11-2026 | Karla | Revisión de las fichas por quien no implementó los flujos (completar: fecha, observaciones y si pidió cambios) |

Cualquier cambio posterior a la primera ejecución se anota en la sección 8, con su motivo y las pruebas que hay que repetir. **Un criterio no se cambia para convertir un fallo en aprobación.**

---

## 1. Cadena de trazabilidad

Requisito (R) → flujo (F) → criterio de aceptación (CA) → prueba (P-U3-xx) → ejecución (RUNxx) → evidencia (archivos de `evidencias/u3/RUNxx/`) → conclusión (`docs/u3/matriz-trazabilidad.md`).

Los R, S y F son los de la U2. Las pruebas de la U3 llevan el prefijo `P-U3-` para no confundirlas con P01 a P07 de la U2.

---

## 2. Criterios de aceptación

Cada criterio dice qué se ve en la pantalla, qué contrato se espera y qué efecto puede tener sobre los datos. Se comprueba con fuentes distintas a la pantalla que hizo la acción.

| CA | Flujo | Criterio (todo debe cumplirse) |
|---|---|---|
| CA01 | F01 | **Interfaz:** el catálogo muestra exactamente los productos que responde S01, con su nombre y precio, y los agotados sin botón "Agregar". **Contrato:** S01 responde 200 sin sesión, con `X-Request-ID`. **Datos:** solo lectura; dos lecturas seguidas devuelven lo mismo. **Fallo:** si inventory no responde o tarda más que el plazo, la pantalla muestra un aviso con el código de la solicitud y **no** muestra un catálogo guardado como si estuviera al día; al volver inventory, el catálogo vuelve sin intervención |
| CA02 | F02 | **Interfaz:** un RUN con dígito verificador incorrecto se marca en el formulario sin llamar al servidor; con datos válidos se llega a la verificación. **Contrato:** S09 responde 201; S09V rechaza un código equivocado (400 `INVALID_CODE`) y acepta el correcto. **Datos:** la cuenta no puede iniciar sesión hasta verificar; después sí, y su perfil (S10) existe con el RUN enmascarado |
| CA03 | F03 | **Interfaz:** con credenciales válidas se entra; sin sesión, una página protegida manda al login; con la sesión vencida, manda al login con el aviso "Tu sesión expiró" y, al entrar de nuevo, vuelve a la página donde estaba. **Contrato:** sin cookie o con la sesión vencida, la API responde 401 (`UNAUTHENTICATED` o `SESSION_INVALID`). Un rol del personal no puede usar las pantallas del cliente |
| CA04 | F04 | **Interfaz:** el carrito, el pago y la boleta muestran los montos que calcula el servidor; los errores muestran un mensaje entendible con su código. **Contrato:** S11 responde 201 con el total calculado por el servidor; S16 responde 201 `APROBADO`. **Datos:** queda **un** pedido nuevo en PAGADO con su boleta (neto + IVA = total); si se pierde una respuesta y la persona reintenta, se reutiliza la misma `Idempotency-Key` y no se duplican ni el pedido ni el pago. Una cantidad mayor al stock se rechaza (409 `STOCK_INSUFICIENTE`) **sin** crear pedido ni mover stock. Sin dirección, el front no llama al servidor. El pedido sigue visible en una sesión nueva |
| CA05 | F05 | **Interfaz:** Mis pedidos muestra los pedidos propios que devuelve S18, con su estado y boleta, y ningún dato de otro cliente; la boleta o el pago de un pedido ajeno muestran "no encontrado". **Contrato:** S18 agrega orders e inventory; un pedido ajeno es `null` en GraphQL y 404 `ORDER_NOT_FOUND` en S12; el campo `stock` da `FORBIDDEN_FIELD`; una consulta más profunda que el límite se rechaza sin datos. **Fallo:** si inventory no responde, se ven los pedidos con un aviso de datos incompletos (error parcial), no como información completa |
| CA06 | F06 | **Interfaz:** anular pide un motivo (mínimo 3 caracteres) y luego muestra el pedido como "Anulado". **Contrato:** S13 responde 200; una segunda anulación, 409. **Datos:** el pedido queda ANULADO con su motivo (no se borra) y el stock vuelve a su valor anterior |
| CA07 | F07 | **Contrato:** un CLIENTE que intenta crear un producto (S03) recibe 403 y el producto no se crea. *(Sin pantalla: solo se comprueba la denegación)* |
| CA08 | F08 | **Contrato:** DESPACHO que intenta mover un pedido que no puede ver (S12 le responde 404) recibe también 404 en S15, sin el estado del pedido (corrección de INC07); ADMIN recibe 409 con el estado y el pedido no cambia. *(Sin pantalla)* |
| CA09 | F09 | **Contrato:** después de pagar un pedido desde el navegador, el reporte de ventas (S19, leído con la sesión de la dueña) cuenta un pedido más y suma su total, sin esperar ninguna actualización. *(Sin pantalla del reporte)* |

---

## 3. Fichas de prueba

**Precondiciones comunes a todas (PC):** versión declarada en `evidencias/u3/<RUN>/entorno.txt`; stack levantado con `docker compose up -d --build --wait`; base restaurada con `scripts/reset.sh` al inicio de la RUN; dependencias reales salvo el proveedor de pagos (doble de prueba); navegador Chromium de la imagen de Playwright 1.49.1, en escritorio (1366×768) y móvil emulado (390×844). Todas las pruebas se ejecutan con `sh scripts/u3-run.sh <RUN>`.

**Restauración común (RC):** `scripts/reset.sh` al inicio de la siguiente RUN deja usuarios, productos, pedidos y pagos como en el seed. Las pruebas no dependen de valores absolutos que cambien entre pruebas: cuentan pedidos antes y después.

**Verificación común (VC):** cada llamada que hace el navegador queda en `red.json` (adjunto de la prueba) y en `playwright/<fase>/red.jsonl` con método, ruta, estado, `X-Request-ID` e `Idempotency-Key`. `scripts/u3-run.sh` saca de los logs de los servicios las líneas con esos mismos `X-Request-ID` (`logs/<fase>-trazas.log`) y consulta en Mongo los pedidos creados (`persistencia.txt`). Las capturas llevan el nombre del paso.

### P-U3-01 — F01 éxito: el catálogo muestra lo que responde inventory
| Campo | Contenido |
|---|---|
| Identificación | RC1 · F01 · R01, R07 · CA01 · `specs/f01-catalogo.spec.js` |
| Precondiciones | PC. Visitante sin sesión (contexto nuevo del navegador) |
| Procedimiento | 1. Abrir `index.html`. 2. Comparar cada tarjeta con la respuesta de S01. 3. Recargar y volver a pedir el catálogo |
| Resultado esperado | S01 200 con `X-Request-ID`; tantas tarjetas como productos; nombre y precio iguales; "Trufas de chocolate" (stock 0) con "Agotado" y sin "Agregar"; la segunda lectura devuelve los mismos productos, precios y disponibilidad |
| Verificación | VC. Captura `catalogo` |
| Restauración | No cambia datos |

### P-U3-02 — F01 límite: un producto agotado no se puede agregar
| Campo | Contenido |
|---|---|
| Identificación | RC1 · F01 · R07 · CA01 · `specs/f01-catalogo.spec.js` |
| Precondiciones | PC. Visitante. Trufas con stock 0 (seed) |
| Procedimiento | 1. Ver la tarjeta de Trufas. 2. Abrir `producto.html?id=650000000000000000000005`. 3. Poner a mano Trufas en el carrito del navegador y abrir `carrito.html` |
| Resultado esperado | Tarjeta marcada como agotada y sin "Agregar"; en la ficha, botón deshabilitado "No disponible"; el carrito descarta la línea ("Tu carrito está vacío") |
| Verificación | VC. Capturas `ficha-agotado`, `carrito-sin-agotado` |
| Restauración | No cambia datos del servidor |

### P-U3-03 — F04 éxito: compra, pago y boleta coinciden con el servidor y persisten
| Campo | Contenido |
|---|---|
| Identificación | RC2 · F04 (y F03 por el login, F05 por la sesión nueva) · R01, R02, R04, R08, R12 · CA04, CA03 · `specs/f04-compra.spec.js` |
| Precondiciones | PC. cliente1 (`cliente@correo.cl`) sin sesión. Chocolate Dubai con stock ≥ 2 |
| Procedimiento | 1. Login desde `login.html`. 2. Agregar 2 Chocolate Dubai desde el catálogo. 3. Carrito → "Ir a pagar". 4. Escribir dirección y "Continuar al pago". 5. "Pagar ahora". 6. En otro contexto del navegador (sesión nueva), login y abrir Mis pedidos |
| Resultado esperado | Carrito con total $17.980; S11 201; el pedido leído después por S12 está PENDIENTE_PAGO con total 17.980 calculado por el servidor; la pasarela muestra ese monto; S16 201; S12 posterior: PAGADO, boleta con neto + IVA = total = 17.980; la boleta en pantalla muestra ese número y total; hay exactamente un pedido más; en la sesión nueva el pedido aparece "Pagado" con su boleta |
| Verificación | VC. Capturas `1-carrito` a `5-mis-pedidos-sesion-nueva`. El ID del pedido queda en `operaciones.jsonl` y se revisa en Mongo |
| Restauración | RC (deja un pedido pagado y descuenta 2 unidades) |

### P-U3-04 — F04 rechazo: sin dirección y cantidad mayor al stock
| Campo | Contenido |
|---|---|
| Identificación | RC2 · F04 · R01 · CA04 · `specs/f04-compra.spec.js` |
| Precondiciones | PC. cliente1 con sesión. Chocolate blanco con stock 15 (seed) |
| Procedimiento | a) Carrito con 1 Bombones; checkout con la dirección vacía; "Continuar al pago". b) Carrito con 999 Chocolate blanco; checkout con dirección; "Continuar al pago" |
| Resultado esperado | a) Mensaje "Escribe la dirección de despacho." y **ninguna** llamada a S11. b) S11 409 `STOCK_INSUFICIENTE`; el mensaje en pantalla incluye "Código: <request_id>"; se queda en checkout; la cantidad de pedidos no cambia; el stock de Chocolate blanco sigue en 15 |
| Verificación | VC. Capturas `a-sin-direccion`, `b-sin-stock` |
| Restauración | No cambia datos |

### P-U3-05 — F04 recuperación: respuesta perdida y reintento sin duplicar
| Campo | Contenido |
|---|---|
| Identificación | RC2 · F04 · R01, R02 · CA04 · `specs/f04-compra.spec.js` |
| Precondiciones | PC. cliente1 con sesión. Carrito con 1 Chocolate Dubai |
| Procedimiento | 1. "Continuar al pago": la solicitud llega al servidor, pero la prueba corta la respuesta antes del navegador (simula una caída de la red). 2. Volver a pulsar "Continuar al pago". 3. Igual con "Pagar ahora": se corta la primera respuesta y se reintenta |
| Resultado esperado | Tras cada corte, el mensaje "No pudimos conectar con el servidor". Los dos intentos de S11 llevan la misma `Idempotency-Key` y el segundo lleva al **mismo** pedido; hay un solo pedido más. Los dos intentos de S16 llevan la misma clave; el pedido queda PAGADO **una vez** (un solo PAGADO en su historial) y con una boleta |
| Verificación | VC (en `red.json` se ven los dos intentos: el primero `SIN_RESPUESTA` para el navegador). En los logs, orders y payments registran `idempotent_replay` con el `request_id` del segundo intento. Capturas `1-pedido-respuesta-perdida` a `3-boleta-tras-reintento` |
| Restauración | RC |

### P-U3-06 — F05 éxito: Mis pedidos muestra lo propio, sin lo ajeno
| Campo | Contenido |
|---|---|
| Identificación | RC3 · F05 · R01, R12 · CA05 · `specs/f05-mis-pedidos.spec.js` |
| Precondiciones | PC. cliente1 con sesión. PED-0001 (de cliente1, PAGADO, B-000001) y PED-0002 (de cliente2) del seed |
| Procedimiento | 1. Abrir `mis-pedidos.html`. 2. Comparar con la respuesta de S18. 3. Leer PED-0001 por S12 |
| Resultado esperado | S18 200 sin `errors`; una tarjeta por pedido devuelto; cada línea trae el producto (agregación con inventory); PED-0001 "Pagado" con "Ver boleta B-000001"; no aparecen PED-0002 ni "Diego Rojas"; S12 confirma PAGADO y B-000001 |
| Verificación | VC. Captura `mis-pedidos` |
| Restauración | No cambia datos |

### P-U3-07 — F05 rechazo: pedido ajeno, campo restringido, profundidad y rol sin permiso
| Campo | Contenido |
|---|---|
| Identificación | RC3 · F05, F03, F07 · R12, R07 · CA05, CA03, CA07 · `specs/f05-mis-pedidos.spec.js` |
| Precondiciones | PC. cliente1 con sesión; cuenta DESPACHO del seed |
| Procedimiento | a) Abrir `boleta.html?numero=PED-0002` y `pago.html?numero=PED-0002`. b) Con la misma sesión, GraphQL `pedido(id:"PED-0002")` y `misPedidos` pidiendo `producto { stock }`. c) GraphQL con profundidad 9. d) En otro contexto, login como DESPACHO, abrir Mis pedidos e intentar crear un producto (S03) |
| Resultado esperado | a) S12 404 `ORDER_NOT_FOUND`; "Boleta no encontrada" / "Pedido no encontrado", sin botón de pago y sin el nombre de cliente2. b) `pedido` null; error `FORBIDDEN_FIELD`. c) `errors` y sin `data`. d) DESPACHO es enviado al login; S03 responde 403 |
| Verificación | VC. Capturas `a-boleta-ajena`, `a-pago-ajeno`, `d-despacho-en-mis-pedidos` |
| Restauración | No cambia datos |

### P-U3-08 — F06 límite: anular exige motivo, devuelve el stock y no se repite
| Campo | Contenido |
|---|---|
| Identificación | RC3 · F06 · R03 · CA06 · `specs/f05-mis-pedidos.spec.js` |
| Precondiciones | PC. cliente1 con sesión. Preparación: la prueba crea por la API (con la sesión del navegador) un pedido de 2 Bombones rellenos en PENDIENTE_PAGO |
| Procedimiento | 1. En Mis pedidos, "Anular" ese pedido con motivo "x". 2. Con motivo "Me equivoqué de producto". 3. Leer el pedido por S12 y el stock. 4. Intentar anularlo otra vez por la API |
| Resultado esperado | Al crear el pedido, el stock baja en 2. 1: "Indica el motivo de la anulación." sin llamar al servidor. 2: S13 200 y la tarjeta muestra "Anulado". 3: ANULADO, `motivo_anulacion` guardado, stock igual al de antes de crear el pedido. 4: 409 |
| Verificación | VC. Capturas `1-motivo-corto`, `2-anulado` |
| Restauración | RC (el pedido anulado queda; el stock ya volvió) |

### P-U3-09 — F01 fallo: inventory caído
| Campo | Contenido |
|---|---|
| Identificación | RC1 · F01 · R01 · CA01 · `specs/fallos.spec.js` (fase `caido`) |
| Precondiciones | PC. **`docker compose stop inventory`** (lo hace `u3-run.sh`). En el navegador queda guardado un catálogo viejo ("Producto viejo en caché") |
| Procedimiento | Abrir `index.html` |
| Resultado esperado | S01 responde 5xx; aviso con "Código: <request_id>"; ninguna tarjeta; no aparece el producto guardado en el navegador |
| Verificación | VC; en `logs/caido-trazas.log` el gateway registra la solicitud (evento `request`) con estado 502 y el mismo `request_id`. Captura `catalogo-inventory-caido` |
| Restauración | `docker compose start inventory` (lo hace `u3-run.sh` antes de P-U3-11) |

### P-U3-10 — F05 fallo parcial: inventory caído en Mis pedidos y checkout
| Campo | Contenido |
|---|---|
| Identificación | RC3 · F05, F04 · R01 · CA05, CA04 · `specs/fallos.spec.js` (fase `caido`) |
| Precondiciones | Como P-U3-09; cliente1 con sesión |
| Procedimiento | 1. Abrir Mis pedidos. 2. Con 1 Chocolate Dubai en el carrito, abrir el checkout |
| Resultado esperado | 1. S18 trae pedidos **y** `errors` con `UPSTREAM_UNAVAILABLE`; la pantalla muestra PED-0001 y el aviso "Algunos datos de los productos no están disponibles…". 2. Aviso de error y el formulario de compra oculto (sin catálogo no hay precios vigentes) |
| Verificación | VC. Capturas `mis-pedidos-inventory-caido`, `checkout-inventory-caido` |
| Restauración | Como P-U3-09 |

### P-U3-11 — F01/F05 recuperación: vuelve inventory
| Campo | Contenido |
|---|---|
| Identificación | RC1, RC3 · F01, F05 · CA01, CA05 · `specs/fallos.spec.js` (fase `recuperado`) |
| Precondiciones | Inventory levantado de nuevo y sano (`u3-run.sh` reinicia también los servicios que lo llaman) |
| Procedimiento | Abrir el catálogo y Mis pedidos |
| Resultado esperado | S01 200 con tarjetas; S18 sin `errors`; sin el aviso de datos incompletos. Nadie tuvo que limpiar nada en el navegador |
| Verificación | VC. Capturas `catalogo-recuperado`, `mis-pedidos-recuperado` |
| Restauración | No cambia datos |

### P-U3-12 — F01 límite: inventory lento
| Campo | Contenido |
|---|---|
| Identificación | RC1 · F01 · CA01 · `specs/fallos.spec.js` (fase `demora`) |
| Precondiciones | Inventory con `INVENTORY_FAULT_DELAY_MS=7000`. Plazo del gateway: 5 s (`UPSTREAM_TIMEOUT_SECONDS`). Plazo del front: 8 s |
| Procedimiento | Abrir `index.html` |
| Resultado esperado | S01 504 `UPSTREAM_TIMEOUT` antes de 8 s; aviso "Un servicio tardó demasiado en responder" con su código; la página no queda cargando para siempre |
| Verificación | VC; la prueba anota los segundos hasta el aviso. Captura `catalogo-demorado` |
| Restauración | `u3-run.sh` vuelve a poner la demora en 0 |

### P-U3-13 — F03/F05 recuperación: sesión expirada
| Campo | Contenido |
|---|---|
| Identificación | RC3 · F03, F05 · R12 · CA03 · `specs/sesion.spec.js` (fase `expira`) |
| Precondiciones | auth reiniciado con `AUTH_TOKEN_TTL=20` (sesiones de 20 s en vez de 15 min, para no esperar). cliente1 sin sesión |
| Procedimiento | 1. Login y abrir Mis pedidos. 2. Esperar 23 s. 3. Recargar. 4. Ingresar de nuevo |
| Resultado esperado | 3: S18 401; la pantalla va a `login.html?expirada=1&volver=mis-pedidos.html` con "Tu sesión expiró. Ingresa de nuevo para continuar." 4: vuelve a Mis pedidos con los pedidos |
| Verificación | VC; en `logs/expira-trazas.log`, auth registra `token_validated` con `active: false` y `motivo: sesion_expirada`. Capturas `1-antes-de-expirar` a `3-de-vuelta-en-mis-pedidos` |
| Restauración | `u3-run.sh` vuelve a levantar auth con el TTL normal |

### P-U3-14 — F05 rechazo: sin sesión
| Campo | Contenido |
|---|---|
| Identificación | RC3 · F05, F03 · R12 · CA03, CA05 · `specs/f05-mis-pedidos.spec.js` |
| Precondiciones | PC. Navegador sin sesión |
| Procedimiento | 1. Abrir `mis-pedidos.html`. 2. Llamar a S18 sin cookie |
| Resultado esperado | 1. Va a `login.html?volver=mis-pedidos.html` **sin** consultar S18. 2. 401 |
| Verificación | VC. Captura `sin-sesion` |
| Restauración | No cambia datos |

### P-U3-15 — F09 analítica: la venta aparece de inmediato en el reporte
| Campo | Contenido |
|---|---|
| Identificación | F09 (componente condicional: analítica) · R09 · CA09 · `specs/f09-analitica.spec.js` |
| Precondiciones | PC. cliente1 con sesión; cuenta DUENO del seed (login por la API: el reporte no tiene pantalla) |
| Procedimiento | 1. La dueña lee el reporte (S19). 2. cliente1 compra y paga 1 Bombones rellenos desde el navegador. 3. La dueña vuelve a leer el reporte |
| Resultado esperado | `cantidad_pedidos` +1 y `total_ventas` + total del pedido nuevo, sin esperar |
| Verificación | VC; adjunto `reporte-antes-y-despues.json`; captura `boleta-de-la-venta` |
| Restauración | RC |

### P-U3-16 — F02 registro y verificación
| Campo | Contenido |
|---|---|
| Identificación | F02 · R05 (R11 simulado) · CA02 · `specs/f02-registro.spec.js` |
| Precondiciones | PC. Visitante. RUN y correo ficticios generados en la prueba (únicos en cada ejecución y viewport) |
| Procedimiento | 1. Completar el registro con un RUN de dígito verificador incorrecto. 2. Corregir el RUN y crear la cuenta. 3. Intentar entrar antes de verificar. 4. Verificar con un código equivocado. 5. Verificar con el código mostrado. 6. Entrar y leer el perfil (S10) |
| Resultado esperado | 1. "El RUN no es válido." y ninguna llamada a S09. 2. S09 201 y paso a `verificar.html` con un código de 6 dígitos. 3. Login 401. 4. Error con "El código no coincide" y su código. 5. Login con "¡Correo verificado!". 6. Login correcto; S10 200 con el mismo ID, `verificado: true` y sin el RUN completo |
| Verificación | VC. Capturas `1-run-invalido` a `4-sesion-de-la-cuenta-nueva` |
| Restauración | RC (el reset borra los clientes creados) |

### P-U3-API — controles de API con pytest (`tests/api`)
| Campo | Contenido |
|---|---|
| Identificación | CA03, CA04, CA05, CA07, CA08 · 23 pruebas de `tests/api` (las 22 de la U2 más `test_inc07_despacho_no_ve_estado_de_pedido_sin_pagar`) |
| Precondiciones | Al final de la RUN, después de las fases del navegador, con 60 s de espera (el gateway limita los logins a 20 por minuto) |
| Procedimiento | `PYTEST_SALIDA=u3/<RUN>/pytest docker compose run --rm pruebas` (lo hace `u3-run.sh`) |
| Resultado esperado | Todas aprobadas. En particular: P05 (servicios internos sin el secreto → 403), P06 (precio alterado ignorado), INC07 (404 para DESPACHO, 409 para ADMIN) |
| Verificación | `pytest/resultado.txt` y `pytest/junit.xml` con el `X-Request-ID` de cada llamada; `logs/pytest-servicios.log` |
| Restauración | RC. La última prueba deja el login limitado por 1 minuto |

**Qué no cubre pytest:** no pasa por el navegador. Sirve como control y como diagnóstico, no como validación del recorrido (la pauta lo pide así).

---

## 4. Plan de ejecución

| Ejecución | Versión | Quién | Cuándo | Qué |
|---|---|---|---|---|
| RUN01 | La rama de la U3 con todo el código final (commit en `entorno.txt`) | Florencia | 26-11 | `sh scripts/u3-run.sh RUN01 "Florencia"` |
| RUN02 | El **mismo** commit que RUN01 | Karla | 26-11 o 27-11 | `sh scripts/u3-run.sh RUN02 "Karla"`, en su computador. Ejecución independiente desde el estado inicial |
| RUN03… | Solo si hubo correcciones | Quien corresponda | Después de cada corrección | Repetir la prueba que falló **y** la RUN completa (regresión). Nunca se borran RUN01 ni RUN02 |

Cada RUN cubre las 16 pruebas en escritorio y móvil (32 ejecuciones de Playwright) más pytest.

**Versión final:** al terminar las correcciones se crea el tag `u3-final` en el commit de las dos últimas RUN aprobadas. Si se cambia código después de RUN01/RUN02, esas RUN quedan como historia y hay que hacer dos RUN nuevas sobre `u3-final`.

---

## 5. Cómo se clasifican y se consolidan los resultados (definido antes de ejecutar)

- **Aprobada:** se cumplió todo el resultado esperado. Los rechazos previstos (P-U3-04, 07, 14, etc.) cuentan como aprobados cuando el sistema rechaza bien.
- **Fallida:** se ejecutó y algo del resultado esperado no se cumplió. Se abre una incidencia.
- **Bloqueada:** no se pudo ejecutar por una condición externa a la prueba (por ejemplo, el sistema no levantó). Se anota el motivo.
- **No ejecutada:** estaba en el plan y no se corrió. Se anota el motivo.

**Consolidación de repeticiones:** una prueba distinta (P-U3-xx) cuenta como **aprobada** en la versión final solo si pasó en **las dos** RUN **y** en **los dos** viewports. Si falló al menos una vez y pasó otras, se informa como **intermitente** y se cuenta como **fallida** en la "aprobación observada" (con nota). Las repeticiones se informan por separado y nunca se suman como pruebas distintas.

---

## 6. Rendimiento

**No se mide rendimiento en la U3.** La prueba de carga de la U2 (E08) es de otra versión y de otro objetivo; no se reinterpreta como resultado de la U3 y **no se sacan conclusiones de rendimiento** sobre `u3-final`. Los tiempos que anota P-U3-12 solo sirven para comprobar que el aviso aparece antes del plazo del front, no son una medición de rendimiento.

---

## 7. Fuentes de evidencia por RUN

```
evidencias/u3/RUN01/
  entorno.txt              versión, fecha con zona, ejecutora, Docker, viewports
  bitacora-run.txt         hora de cada paso (reset, cada fase, pytest)
  levantar.txt, reset.txt  salida del arranque y la restauración
  servicios-inicio.txt     estado de los contenedores al empezar
  consola-<fase>.txt       salida de Playwright de cada fase
  playwright/<fase>/
    reporte-html/          reporte navegable: cada prueba con sus capturas y red.json
    resultados.json, junit.xml
    red.jsonl              cada llamada del navegador (sin cookies ni claves)
    operaciones.jsonl      pedidos y clientes creados por las pruebas
    artefactos/            capturas originales
  logs/
    <fase>-servicios.log   logs de todos los servicios durante la fase
    <fase>-trazas.log      solo las líneas con los X-Request-ID del navegador
    request-ids.txt
  pytest/                  resultado.txt, junit.xml
  persistencia.txt         lectura directa en Mongo de los pedidos creados y del stock
  revision-credenciales.txt
  resumen-fases.txt        código de salida y conteos de cada fase
  ficha.md                 la completa el equipo (plantilla: evidencias/plantilla-ficha-u3.md)
```

**Vinculación:** el `X-Request-ID` une la llamada del navegador (`red.jsonl`) con los logs (`*-trazas.log`); el ID del pedido une la pantalla (captura), `operaciones.jsonl` y `persistencia.txt`.

---

## 8. Cambios al protocolo

| Fecha | Versión | Cambio | Motivo | Pruebas a repetir |
|---|---|---|---|---|
| 25-11-2026 | 1.0 | C12 de la U2 ("salto inválido de PENDIENTE_PAGO a ENTREGADO" con DESPACHO → 409) pasa a esperar **404** para DESPACHO y 409 para ADMIN (CA08) | Corrección de INC07: S15 no debe revelar el estado de un pedido que el rol no puede ver. Ya estaba decidido en la U2 (`docs/incidencias.md`, INC07). No convierte un fallo en aprobado: cambia la regla de seguridad y se prueba con una prueba nueva | `test_inc07_*` en todas las RUN de la U3. `scripts/evidencias-panel.sh` (U2) daría ahora 404 en `s15-salto-invalido`: esa evidencia E10 queda como resultado de la versión U2 |
