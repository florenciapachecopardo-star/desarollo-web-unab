// Recorrido crítico 1 — F01 Consultar catálogo (lectura, visitante anónimo, inventory).
// Fichas: docs/u3/protocolo-u3.md (P-U3-01 y P-U3-02).

const { test, expect, miles } = require("../fixtures");
const { PRODUCTOS } = require("../datos");

test.describe("F01 Catálogo (visitante)", () => {
    test("P-U3-01 F01 éxito: el catálogo muestra lo mismo que responde inventory", async ({ page, evidencia }) => {
        const [respuesta] = await Promise.all([
            page.waitForResponse((r) => r.url().includes("/api/v1/productos") && r.request().method() === "GET"),
            page.goto("index.html")
        ]);
        expect(respuesta.status()).toBe(200);
        expect(respuesta.headers()["x-request-id"]).toBeTruthy();
        const { productos } = await respuesta.json();
        expect(productos.length).toBeGreaterThan(0);

        const tarjetas = page.locator("#grilla-productos .tarjeta");
        await expect(tarjetas).toHaveCount(productos.length);

        // Cada producto del servidor aparece con su nombre, su precio y su disponibilidad
        for (const producto of productos) {
            const tarjeta = tarjetas.filter({ hasText: producto.nombre });
            await expect(tarjeta).toHaveCount(1);
            await expect(tarjeta.locator(".tarjeta__precio")).toContainText(miles(producto.precio));
            if (producto.disponible) {
                await expect(tarjeta.getByRole("button", { name: "Agregar" })).toBeVisible();
            } else {
                await expect(tarjeta.locator(".tarjeta__estado")).toHaveText("Agotado");
                await expect(tarjeta.getByRole("button", { name: "Agregar" })).toHaveCount(0);
            }
        }
        await evidencia.captura(page, "catalogo");

        // Persistencia de la lectura: al recargar, el servidor vuelve a responder lo mismo
        const [segunda] = await Promise.all([
            page.waitForResponse((r) => r.url().includes("/api/v1/productos")),
            page.reload()
        ]);
        const repetida = await segunda.json();
        expect(repetida.productos.map((p) => [p.id, p.precio, p.disponible]))
            .toEqual(productos.map((p) => [p.id, p.precio, p.disponible]));
    });

    test("P-U3-02 F01 límite: un producto agotado no se puede agregar (catálogo y ficha)", async ({ page, evidencia }) => {
        await page.goto("index.html");
        const trufas = page.locator("#grilla-productos .tarjeta").filter({ hasText: PRODUCTOS.TRUFAS.nombre });
        await expect(trufas).toHaveClass(/tarjeta--agotado/);
        await expect(trufas.getByRole("button", { name: "Agregar" })).toHaveCount(0);

        await page.goto(`producto.html?id=${PRODUCTOS.TRUFAS.id}`);
        await expect(page.locator("#detalle-nombre")).toHaveText(PRODUCTOS.TRUFAS.nombre);
        await expect(page.locator("#detalle-agregar")).toBeDisabled();
        await expect(page.locator("#detalle-agregar")).toHaveText("No disponible");
        await evidencia.captura(page, "ficha-agotado");

        // Aunque alguien lo meta al carrito a mano, el carrito lo descarta con el catálogo del servidor
        await page.evaluate((id) => localStorage.setItem("choco:carrito", JSON.stringify([{ id, cantidad: 1 }])), PRODUCTOS.TRUFAS.id);
        await page.goto("carrito.html");
        await expect(page.locator("#contenido-carrito")).toContainText("Tu carrito está vacío");
        await evidencia.captura(page, "carrito-sin-agotado");
    });
});
