// Fallo y recuperación controlados. Cada grupo corre en su propia fase, con el
// sistema preparado por scripts/u3-run.sh (no se puede detener un contenedor
// desde el navegador). Fichas: docs/u3/protocolo-u3.md (P-U3-09 a P-U3-12).

const { test, expect } = require("../fixtures");
const { RUTA_SESION_CLIENTE1, PEDIDO_CLIENTE1 } = require("../datos");

const esCatalogo = (r) => r.url().includes("/api/v1/productos") && r.request().method() === "GET";
const esGraphql = (r) => r.url().includes("/api/v1/graphql") && r.request().method() === "POST";

// --- Fase "caido": docker compose stop inventory ---
test.describe("Inventory detenido @caido", () => {
    test("P-U3-09 F01 fallo: con inventory caído el catálogo avisa con su código y no muestra datos viejos @caido",
        async ({ page, evidencia }) => {
            // Se deja un catálogo viejo en el navegador: no debe mostrarse como si estuviera al día
            await page.goto("ayuda.html");
            await page.evaluate(() => localStorage.setItem("choco:catalogo", JSON.stringify([
                { id: "x", nombre: "Producto viejo en caché", precio: 1, disponible: true, imagen: "" }
            ])));
            const [resp] = await Promise.all([page.waitForResponse(esCatalogo), page.goto("index.html")]);
            expect(resp.status()).toBeGreaterThanOrEqual(500);
            const error = await resp.json();
            const alerta = page.locator("#grilla-productos [role=alert]");
            await expect(alerta).toContainText(`Código: ${error.error.request_id}`);
            await expect(page.locator("#grilla-productos .tarjeta")).toHaveCount(0);
            await expect(page.locator("#grilla-productos")).not.toContainText("Producto viejo en caché");
            await evidencia.captura(page, "catalogo-inventory-caido");
        });

    test.describe(() => {
        test.use({ storageState: RUTA_SESION_CLIENTE1 });

        test("P-U3-10 F05 fallo parcial: con inventory caído Mis pedidos muestra los pedidos y avisa que faltan datos @caido",
            async ({ page, evidencia }) => {
                const [resp] = await Promise.all([page.waitForResponse(esGraphql), page.goto("mis-pedidos.html")]);
                const cuerpo = await resp.json();
                // Error parcial: hay pedidos (orders responde) y hay errores (inventory no)
                expect(cuerpo.data.misPedidos.items.length).toBeGreaterThan(0);
                const codigos = cuerpo.errors.map((e) => e.extensions && e.extensions.code);
                expect(codigos).toContain("UPSTREAM_UNAVAILABLE");

                await expect(page.locator("#lista-pedidos [role=status]").first())
                    .toContainText("Algunos datos de los productos no están disponibles");
                await expect(page.locator("#lista-pedidos .pedido").filter({ hasText: PEDIDO_CLIENTE1 })).toBeVisible();
                await evidencia.captura(page, "mis-pedidos-inventory-caido");

                // Sin catálogo no se puede comprar: el checkout no muestra el formulario
                await page.evaluate(() => localStorage.setItem("choco:carrito",
                    JSON.stringify([{ id: "650000000000000000000001", cantidad: 1 }])));
                await page.goto("checkout.html");
                await expect(page.locator("#resumen [role=alert]")).toBeVisible();
                await expect(page.locator("#form-checkout")).toBeHidden();
                await evidencia.captura(page, "checkout-inventory-caido");
            });
    });
});

// --- Fase "recuperado": docker compose start inventory ---
test.describe("Inventory de vuelta @recuperado", () => {
    test.use({ storageState: RUTA_SESION_CLIENTE1 });

    test("P-U3-11 F01/F05 recuperación: al volver inventory, catálogo y Mis pedidos vuelven a estar completos @recuperado",
        async ({ page, evidencia }) => {
            const [cat] = await Promise.all([page.waitForResponse(esCatalogo), page.goto("index.html")]);
            expect(cat.status()).toBe(200);
            await expect(page.locator("#grilla-productos .tarjeta").first()).toBeVisible();
            await evidencia.captura(page, "catalogo-recuperado");

            const [resp] = await Promise.all([page.waitForResponse(esGraphql), page.goto("mis-pedidos.html")]);
            const cuerpo = await resp.json();
            expect(cuerpo.errors).toBeUndefined();
            await expect(page.locator("#lista-pedidos .pedido").first()).toBeVisible();
            await expect(page.locator("#lista-pedidos")).not.toContainText("no están disponibles");
            await evidencia.captura(page, "mis-pedidos-recuperado");
        });
});

// --- Fase "demora": inventory con FAULT_DELAY_MS=7000 (el gateway espera 5 s) ---
test.describe("Inventory demorado @demora", () => {
    test("P-U3-12 F01 límite: si inventory tarda más que el plazo, el catálogo avisa en vez de quedarse cargando @demora",
        async ({ page, evidencia }) => {
            const inicio = Date.now();
            const [resp] = await Promise.all([
                page.waitForResponse(esCatalogo, { timeout: 15_000 }),
                page.goto("index.html")
            ]);
            const segundos = (Date.now() - inicio) / 1000;
            expect(resp.status()).toBe(504);
            const cuerpo = await resp.json();
            expect(cuerpo.error.code).toBe("UPSTREAM_TIMEOUT");
            // El corte lo hace el gateway (5 s), antes del plazo del front (8 s)
            expect(segundos).toBeLessThan(8);
            await expect(page.locator("#grilla-productos [role=alert]"))
                .toContainText("Un servicio tardó demasiado en responder");
            await expect(page.locator("#grilla-productos [role=alert]")).toContainText(`Código: ${cuerpo.error.request_id}`);
            test.info().annotations.push({ type: "segundos hasta el aviso", description: segundos.toFixed(1) });
            await evidencia.captura(page, "catalogo-demorado");
        });
});
