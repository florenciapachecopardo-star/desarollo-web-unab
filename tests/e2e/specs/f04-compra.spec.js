// Recorrido crítico 2 — F04 Comprar y pagar (cambio persistente de estado:
// inventory + orders + payments). Fichas: docs/u3/protocolo-u3.md (P-U3-03 a P-U3-05).
// Payments usa el proveedor SIMULADO (doble de prueba): estas pruebas no
// demuestran integración con un proveedor real.

const { test, expect, opcionesProyecto, totalPedidos, iniciarSesionUI, miles } = require("../fixtures");
const { CUENTAS, PRODUCTOS, RUTA_SESION_CLIENTE1 } = require("../datos");

const esCrearPedido = (r) => r.url().includes("/api/v1/pedidos") && r.request().method() === "POST" && !r.url().includes("/anular");
const esPagar = (r) => r.url().includes("/api/v1/pagos") && r.request().method() === "POST";

test.describe("F04 Compra completa (cliente)", () => {
    test("P-U3-03 F04 éxito: compra, pago y boleta coinciden con el servidor y persisten en una sesión nueva",
        async ({ page, browser, red, api, evidencia }, testInfo) => {
            // 1. Login desde la pantalla
            await iniciarSesionUI(page, CUENTAS.cliente1);
            const antes = await totalPedidos(api);

            // 2. Agregar 2 Chocolate Dubai desde el catálogo
            await page.goto("index.html");
            const dubai = page.locator("#grilla-productos .tarjeta").filter({ hasText: PRODUCTOS.DUBAI.nombre });
            await dubai.locator(".tarjeta__agregar").click();
            await dubai.locator(".tarjeta__agregar").click();
            await page.goto("carrito.html");
            await expect(page.locator(".carrito-total")).toContainText(miles(PRODUCTOS.DUBAI.precio * 2));
            await evidencia.captura(page, "1-carrito");

            // 3. Checkout con despacho
            await Promise.all([
                page.waitForURL(/checkout\.html/),
                page.getByRole("link", { name: "Ir a pagar" }).click()
            ]);
            await page.locator("#direccion").fill("Calle Ficticia 123");
            await evidencia.captura(page, "2-checkout");
            // Se espera la respuesta (solo el estado) y la navegación juntas: el cuerpo se
            // corrobora después con una lectura independiente del servidor (S12)
            const [respPedido] = await Promise.all([
                page.waitForResponse(esCrearPedido),
                page.waitForURL(/pago\.html\?numero=/, { waitUntil: "commit" }),
                page.locator("#form-checkout button[type=submit]").click()
            ]);
            expect(respPedido.status()).toBe(201);
            const idPedido = new URL(page.url()).searchParams.get("numero");
            const creado = await api.pedir("GET", `/api/v1/pedidos/${idPedido}`);
            expect(creado.cuerpo.estado).toBe("PENDIENTE_PAGO");
            // El total lo calcula el servidor con el precio de inventory
            expect(creado.cuerpo.total).toBe(PRODUCTOS.DUBAI.precio * 2);
            const pedido = creado.cuerpo;

            // 4. Pago: la pantalla muestra el monto del servidor
            await expect(page.locator(".pasarela__monto")).toContainText(miles(pedido.total));
            await evidencia.captura(page, "3-pago");
            const [respPago] = await Promise.all([
                page.waitForResponse(esPagar),
                page.waitForURL(/boleta\.html/, { waitUntil: "commit" }),
                page.locator("#btn-pagar").click()
            ]);
            expect(respPago.status()).toBe(201);
            await expect(page).toHaveURL(new RegExp(`boleta\\.html\\?numero=${pedido.id}`));

            // 5. Boleta: se compara la pantalla con una lectura posterior del pedido (S12)
            const leido = await api.pedir("GET", `/api/v1/pedidos/${pedido.id}`);
            expect(leido.estado).toBe(200);
            expect(leido.cuerpo.estado).toBe("PAGADO");
            const boleta = leido.cuerpo.boleta;
            expect(boleta.neto + boleta.iva).toBe(boleta.total);
            expect(boleta.total).toBe(pedido.total);
            await expect(page.locator("#boleta")).toContainText(boleta.numero);
            await expect(page.locator(".boleta__total")).toContainText(miles(boleta.total));
            await evidencia.captura(page, "4-boleta");
            evidencia.operacion("pedido", pedido.id, { boleta: boleta.numero });

            // Se creó exactamente un pedido
            expect(await totalPedidos(api)).toBe(antes + 1);

            // 6. Persistencia: sesión nueva (otro contexto del navegador, login de nuevo)
            const otro = await browser.newContext(opcionesProyecto(testInfo));
            red.observar(otro, "sesion-nueva");
            const p2 = await otro.newPage();
            await iniciarSesionUI(p2, CUENTAS.cliente1);
            await p2.goto("mis-pedidos.html");
            const tarjeta = p2.locator(".pedido").filter({ hasText: pedido.id });
            await expect(tarjeta.locator(".pedido__estado")).toHaveText("Pagado");
            await expect(tarjeta.getByRole("link", { name: `Ver boleta ${boleta.numero}` })).toBeVisible();
            await evidencia.captura(p2, "5-mis-pedidos-sesion-nueva");
            await otro.close();
        });
});

test.describe("F04 Rechazos y reintentos (cliente con sesión)", () => {
    test.use({ storageState: RUTA_SESION_CLIENTE1 });

    test("P-U3-04 F04 rechazo: dirección vacía no llama al servidor; cantidad fuera de rango o mayor al stock no crea pedido",
        async ({ page, api, evidencia }) => {
            const antes = await totalPedidos(api);
            const creaciones = [];
            page.on("request", (s) => { if (s.method() === "POST" && s.url().includes("/api/v1/pedidos")) creaciones.push(s.url()); });

            // a) Validación en el front: sin dirección
            await page.goto("index.html");
            await page.evaluate((id) => localStorage.setItem("choco:carrito", JSON.stringify([{ id, cantidad: 1 }])), PRODUCTOS.BOMBONES.id);
            await page.goto("checkout.html");
            await page.locator("#direccion").fill("");
            await page.locator("#form-checkout button[type=submit]").click();
            await expect(page.locator("#error")).toHaveText("Escribe la dirección de despacho.");
            expect(creaciones).toHaveLength(0);
            await evidencia.captura(page, "a-sin-direccion");

            // b) Cantidad fuera del contrato de S11 (1 a 20 por línea): 422 VALIDATION_ERROR
            //    (versión 1.0 esperaba 409 con 999 unidades: ver INC08 y protocolo §8)
            await page.evaluate((id) => localStorage.setItem("choco:carrito", JSON.stringify([{ id, cantidad: 999 }])), PRODUCTOS.BLANCO.id);
            await page.goto("checkout.html");
            await page.locator("#direccion").fill("Calle Ficticia 123");
            const [resp422] = await Promise.all([
                page.waitForResponse(esCrearPedido),
                page.locator("#form-checkout button[type=submit]").click()
            ]);
            expect(resp422.status()).toBe(422);
            const cuerpo422 = await resp422.json();
            expect(cuerpo422.error.code).toBe("VALIDATION_ERROR");
            await expect(page.locator("#error")).toContainText(`Código: ${cuerpo422.error.request_id}`);
            await expect(page).toHaveURL(/checkout\.html/);
            await evidencia.captura(page, "b-cantidad-fuera-de-rango");

            // c) Regla de stock: 16 unidades (dentro del contrato) de un producto con stock 15
            await page.evaluate((id) => localStorage.setItem("choco:carrito", JSON.stringify([{ id, cantidad: 16 }])), PRODUCTOS.BLANCO.id);
            await page.goto("checkout.html");
            await page.locator("#direccion").fill("Calle Ficticia 123");
            const [resp] = await Promise.all([
                page.waitForResponse(esCrearPedido),
                page.locator("#form-checkout button[type=submit]").click()
            ]);
            expect(resp.status()).toBe(409);
            const cuerpo = await resp.json();
            expect(cuerpo.error.code).toBe("STOCK_INSUFICIENTE");
            // El mensaje queda en pantalla con el código de la solicitud, y no se avanza al pago
            await expect(page.locator("#error")).toContainText(`Código: ${cuerpo.error.request_id}`);
            await expect(page).toHaveURL(/checkout\.html/);
            await evidencia.captura(page, "c-sin-stock");

            // No quedó ningún pedido creado y el stock no cambió
            expect(await totalPedidos(api)).toBe(antes);
            const stock = await api.pedir("GET", `/api/v1/productos/${PRODUCTOS.BLANCO.id}`);
            expect(stock.cuerpo.stock).toBe(PRODUCTOS.BLANCO.stock);
        });

    test("P-U3-05 F04 recuperación: si se pierde la respuesta y la persona reintenta, no se duplica el pedido ni el pago",
        async ({ page, api, evidencia }) => {
            const antes = await totalPedidos(api);
            // Claves de idempotencia que manda el navegador en cada intento
            const claves = { pedidos: [], pagos: [] };
            page.on("request", (s) => {
                if (s.method() !== "POST") return;
                if (s.url().endsWith("/api/v1/pedidos")) claves.pedidos.push(s.headers()["idempotency-key"]);
                if (s.url().endsWith("/api/v1/pagos")) claves.pagos.push(s.headers()["idempotency-key"]);
            });

            await page.goto("index.html");
            await page.evaluate((id) => localStorage.setItem("choco:carrito", JSON.stringify([{ id, cantidad: 1 }])), PRODUCTOS.DUBAI.id);
            await page.goto("checkout.html");
            await page.locator("#direccion").fill("Calle Ficticia 456");

            // 1er intento: la solicitud SÍ llega al servidor y crea el pedido, pero la respuesta
            // se corta antes de llegar al navegador (como una caída de la red móvil)
            let pedidoPerdido = null;
            await page.route("**/api/v1/pedidos", async (route) => {
                const respuesta = await route.fetch();
                pedidoPerdido = await respuesta.json();
                await route.abort("connectionreset");
            }, { times: 1 });
            await page.locator("#form-checkout button[type=submit]").click();
            await expect(page.locator("#error")).toContainText("No pudimos conectar con el servidor");
            expect(pedidoPerdido && pedidoPerdido.id).toBeTruthy();
            await evidencia.captura(page, "1-pedido-respuesta-perdida");

            // 2º intento: misma Idempotency-Key -> el servidor devuelve el mismo pedido
            const [resp] = await Promise.all([
                page.waitForResponse(esCrearPedido),
                page.waitForURL(/pago\.html\?numero=/, { waitUntil: "commit" }),
                page.locator("#form-checkout button[type=submit]").click()
            ]);
            expect(resp.status()).toBe(201);
            const idPedido = new URL(page.url()).searchParams.get("numero");
            expect(idPedido).toBe(pedidoPerdido.id);
            expect(claves.pedidos).toHaveLength(2);
            expect(claves.pedidos[1]).toBe(claves.pedidos[0]);
            expect(await totalPedidos(api)).toBe(antes + 1);

            // Lo mismo con el pago
            await page.route("**/api/v1/pagos", async (route) => {
                await route.fetch();
                await route.abort("connectionreset");
            }, { times: 1 });
            await expect(page.locator("#btn-pagar")).toBeVisible();
            await page.locator("#btn-pagar").click();
            await expect(page.locator("#error-pago")).toContainText("No pudimos conectar con el servidor");
            await evidencia.captura(page, "2-pago-respuesta-perdida");

            const [respPago] = await Promise.all([
                page.waitForResponse(esPagar),
                page.waitForURL(/boleta\.html/, { waitUntil: "commit" }),
                page.locator("#btn-pagar").click()
            ]);
            expect(respPago.status()).toBe(201);
            expect(claves.pagos).toHaveLength(2);
            expect(claves.pagos[1]).toBe(claves.pagos[0]);
            await expect(page.locator("#boleta")).toContainText("Boleta");
            await evidencia.captura(page, "3-boleta-tras-reintento");

            // El pedido quedó pagado una sola vez, con una sola boleta
            const leido = await api.pedir("GET", `/api/v1/pedidos/${idPedido}`);
            expect(leido.cuerpo.estado).toBe("PAGADO");
            expect(leido.cuerpo.historial.filter((h) => h.estado === "PAGADO")).toHaveLength(1);
            expect(leido.cuerpo.boleta).toBeTruthy();
            evidencia.operacion("pedido", idPedido, { boleta: leido.cuerpo.boleta.numero, reintento: true });
        });
});
