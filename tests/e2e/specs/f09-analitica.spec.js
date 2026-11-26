// Analítica (componente condicional, ADR docs/adr-analitica.md): el reporte de ventas
// (S19, dentro de orders) se calcula en cada consulta, así que una venta debe
// aparecer apenas el pedido queda PAGADO. Ficha: docs/u3/protocolo-u3.md (P-U3-15).
//
// LÍMITE: el reporte no tiene pantalla (el panel interno no se construyó). La venta
// se hace desde el navegador del cliente, pero el reporte se lee por la API con la
// sesión de la dueña. No demuestra el reporte visto por la dueña en una pantalla.

const { test, expect, opcionesProyecto, totalPedidos, nuevoRequestId } = require("../fixtures");
const { RUTA_SESION_CLIENTE1, PRODUCTOS } = require("../datos");

const DUENA = { correo: "dueno@chocomania.cl", clave: "Dueno2026" };

test.describe("F09 Reporte de ventas", () => {
    test.use({ storageState: RUTA_SESION_CLIENTE1 });

    test("P-U3-15 F09 éxito: una venta pagada desde el navegador aparece de inmediato en el reporte de la dueña",
        async ({ page, browser, red, api, evidencia }, testInfo) => {
            // Sesión de la dueña en otro contexto (login por la API, sin pantalla propia)
            const ctxDuena = await browser.newContext(opcionesProyecto(testInfo));
            red.observar(ctxDuena, "duena");
            const duena = await ctxDuena.newPage();
            const login = await duena.request.post("/api/v1/auth/login", {
                data: DUENA, headers: { "X-Request-ID": nuevoRequestId("p-u3-15-login") }
            });
            expect(login.status()).toBe(200);
            const antes = await api.pedir("GET", "/api/v1/reportes/ventas", {}, duena);
            expect(antes.estado).toBe(200);

            // Venta desde el navegador del cliente: carrito -> checkout -> pago
            const pedidosAntes = await totalPedidos(api);
            await page.goto("index.html");
            await page.evaluate((id) => localStorage.setItem("choco:carrito", JSON.stringify([{ id, cantidad: 1 }])), PRODUCTOS.BOMBONES.id);
            await page.goto("checkout.html");
            await page.locator("#direccion").fill("Calle Ficticia 321");
            await Promise.all([
                page.waitForURL(/pago\.html\?numero=/, { waitUntil: "commit" }),
                page.locator("#form-checkout button[type=submit]").click()
            ]);
            const idPedido = new URL(page.url()).searchParams.get("numero");
            await Promise.all([
                page.waitForURL(/boleta\.html/, { waitUntil: "commit" }),
                page.locator("#btn-pagar").click()
            ]);
            await expect(page.locator("#boleta")).toContainText("Boleta");
            expect(await totalPedidos(api)).toBe(pedidosAntes + 1);
            const pedido = (await api.pedir("GET", `/api/v1/pedidos/${idPedido}`)).cuerpo;
            expect(pedido.estado).toBe("PAGADO");

            // El reporte ya la incluye, sin esperar ningún proceso de actualización
            const despues = await api.pedir("GET", "/api/v1/reportes/ventas", {}, duena);
            expect(despues.cuerpo.cantidad_pedidos).toBe(antes.cuerpo.cantidad_pedidos + 1);
            expect(despues.cuerpo.total_ventas).toBe(antes.cuerpo.total_ventas + pedido.total);
            await evidencia.captura(page, "boleta-de-la-venta");
            await testInfo.attach("reporte-antes-y-despues.json", {
                body: JSON.stringify({ antes: antes.cuerpo, despues: despues.cuerpo, pedido: idPedido }, null, 2),
                contentType: "application/json"
            });
            evidencia.operacion("pedido", idPedido, { reporte: "incluido" });
            await ctxDuena.close();
        });
});
