// Recorrido crítico 3 — F05 Ver mis pedidos (y F06 Anular) (acceso protegido, propiedad del recurso,
// agregación GraphQL de orders + inventory). Fichas: docs/u3/protocolo-u3.md (P-U3-06 a P-U3-08).

const { test, expect, opcionesProyecto, iniciarSesionUI, nuevoRequestId } = require("../fixtures");
const { CUENTAS, PRODUCTOS, RUTA_SESION_CLIENTE1, PEDIDO_CLIENTE1, PEDIDO_CLIENTE2, BOLETA_PED_0001 } = require("../datos");

const esGraphql = (r) => r.url().includes("/api/v1/graphql") && r.request().method() === "POST";

test.describe("F05 Mis pedidos (cliente con sesión)", () => {
    test.use({ storageState: RUTA_SESION_CLIENTE1 });

    test("P-U3-06 F05 éxito: la pantalla muestra los pedidos propios que devuelve GraphQL, sin los ajenos",
        async ({ page, api, evidencia }) => {
            const [resp] = await Promise.all([page.waitForResponse(esGraphql), page.goto("mis-pedidos.html")]);
            expect(resp.status()).toBe(200);
            const cuerpo = await resp.json();
            expect(cuerpo.errors).toBeUndefined();
            const { items } = cuerpo.data.misPedidos;

            const tarjetas = page.locator("#lista-pedidos .pedido");
            await expect(tarjetas).toHaveCount(items.length);
            // Agregación: cada línea trae datos de orders (nombre, cantidad) y de inventory (disponible)
            for (const pedido of items) {
                for (const linea of pedido.lineas) expect(linea.producto).not.toBeNull();
            }

            const ped1 = tarjetas.filter({ hasText: PEDIDO_CLIENTE1 });
            await expect(ped1.locator(".pedido__estado")).toHaveText("Pagado");
            await expect(ped1.getByRole("link", { name: `Ver boleta ${BOLETA_PED_0001}` })).toBeVisible();
            await expect(page.locator("#lista-pedidos")).not.toContainText(PEDIDO_CLIENTE2);
            await expect(page.locator("#lista-pedidos")).not.toContainText(CUENTAS.cliente2.nombre);
            await evidencia.captura(page, "mis-pedidos");

            // Corroboración independiente de la pantalla: S12 dice lo mismo
            const s12 = await api.pedir("GET", `/api/v1/pedidos/${PEDIDO_CLIENTE1}`);
            expect(s12.estado).toBe(200);
            expect(s12.cuerpo.estado).toBe("PAGADO");
            expect(s12.cuerpo.boleta.numero).toBe(BOLETA_PED_0001);
        });

    test("P-U3-07 F05 rechazo: pedido ajeno, campo restringido, consulta demasiado profunda y rol sin permiso",
        async ({ page, browser, red, api, evidencia }, testInfo) => {
            // a) Boleta y pago de un pedido ajeno desde la pantalla: igual que si no existiera
            const [s12] = await Promise.all([
                page.waitForResponse((r) => r.url().includes(`/api/v1/pedidos/${PEDIDO_CLIENTE2}`)),
                page.goto(`boleta.html?numero=${PEDIDO_CLIENTE2}`)
            ]);
            expect(s12.status()).toBe(404);
            expect((await s12.json()).error.code).toBe("ORDER_NOT_FOUND");
            await expect(page.locator("#boleta")).toContainText("Boleta no encontrada");
            await expect(page.locator("body")).not.toContainText(CUENTAS.cliente2.nombre);
            await evidencia.captura(page, "a-boleta-ajena");

            await page.goto(`pago.html?numero=${PEDIDO_CLIENTE2}`);
            await expect(page.locator("#pago")).toContainText("Pedido no encontrado");
            await expect(page.locator("#btn-pagar")).toHaveCount(0);
            await evidencia.captura(page, "a-pago-ajeno");

            // b) GraphQL con la misma sesión del navegador: pedido ajeno -> null; stock -> FORBIDDEN_FIELD
            const ajeno = await api.graphql(`query { pedido(id: "${PEDIDO_CLIENTE2}") { id estado } }`);
            expect(ajeno.cuerpo.data.pedido).toBeNull();
            const campo = await api.graphql("query { misPedidos { items { lineas { producto { stock } } } } }");
            const codigos = (campo.cuerpo.errors || []).map((e) => e.extensions && e.extensions.code);
            expect(codigos).toContain("FORBIDDEN_FIELD");

            // c) Consulta que excede la profundidad configurada (6): se rechaza sin datos
            const profunda = await api.graphql(
                "query { misPedidos { items { lineas { pedido { lineas { pedido { lineas { nombre } } } } } } } }");
            expect(profunda.cuerpo.errors && profunda.cuerpo.errors.length).toBeGreaterThan(0);
            expect(profunda.cuerpo.data).toBeFalsy();

            // d) Rol sin permiso: DESPACHO entra, pero no puede usar las pantallas del cliente
            //    ni crear productos (S03)
            const otro = await browser.newContext(opcionesProyecto(testInfo));
            red.observar(otro, "despacho");
            const p2 = await otro.newPage();
            await iniciarSesionUI(p2, CUENTAS.despacho);
            await p2.goto("mis-pedidos.html");
            await p2.waitForURL(/login\.html\?volver=mis-pedidos\.html/);
            await evidencia.captura(p2, "d-despacho-en-mis-pedidos");
            const crear = await api.pedir("POST", "/api/v1/productos", {
                data: { nombre: "Producto de prueba", categoria: "barras", descripcion: "x", precio: 1000, stock: 1 }
            }, p2);
            expect(crear.estado).toBe(403);
            await otro.close();
        });

    test("P-U3-08 F06 límite: anular un pedido propio exige motivo, devuelve el stock y no se puede repetir",
        async ({ page, api, evidencia }) => {
            const stockAntes = (await api.pedir("GET", `/api/v1/productos/${PRODUCTOS.BOMBONES.id}`)).cuerpo.stock;
            // Pedido pendiente creado por la API con la sesión del navegador (preparación de la prueba)
            const creado = await api.pedir("POST", "/api/v1/pedidos", {
                headers: { "Idempotency-Key": nuevoRequestId("p-u3-08") },
                data: {
                    lineas: [{ producto_id: PRODUCTOS.BOMBONES.id, cantidad: 2 }],
                    despacho: { direccion: "Calle Ficticia 789", comuna: "Providencia", telefono: null }
                }
            });
            expect(creado.estado).toBe(201);
            const id = creado.cuerpo.id;
            expect((await api.pedir("GET", `/api/v1/productos/${PRODUCTOS.BOMBONES.id}`)).cuerpo.stock).toBe(stockAntes - 2);

            await page.goto("mis-pedidos.html");
            const tarjeta = page.locator(".pedido").filter({ hasText: id });
            await expect(tarjeta.locator(".pedido__estado")).toHaveText("Pendiente de pago");
            await tarjeta.getByRole("button", { name: "Anular" }).click();

            // Motivo demasiado corto: lo frena el front
            await tarjeta.locator("textarea").fill("x");
            await tarjeta.getByRole("button", { name: "Confirmar anulación" }).click();
            await expect(tarjeta.locator(".form-error")).toHaveText("Indica el motivo de la anulación.");
            await evidencia.captura(page, "1-motivo-corto");

            await tarjeta.locator("textarea").fill("Me equivoqué de producto");
            const [resp] = await Promise.all([
                page.waitForResponse((r) => r.url().includes(`/api/v1/pedidos/${id}/anular`)),
                tarjeta.getByRole("button", { name: "Confirmar anulación" }).click()
            ]);
            expect(resp.status()).toBe(200);
            await expect(page.locator(".pedido").filter({ hasText: id }).locator(".pedido__estado")).toHaveText("Anulado");
            await evidencia.captura(page, "2-anulado");

            // Persistencia y regla: el pedido queda ANULADO con su motivo (no se borra) y el stock vuelve
            const leido = await api.pedir("GET", `/api/v1/pedidos/${id}`);
            expect(leido.cuerpo.estado).toBe("ANULADO");
            expect(leido.cuerpo.motivo_anulacion).toBe("Me equivoqué de producto");
            expect((await api.pedir("GET", `/api/v1/productos/${PRODUCTOS.BOMBONES.id}`)).cuerpo.stock).toBe(stockAntes);
            // Una segunda anulación se rechaza
            const otra = await api.pedir("POST", `/api/v1/pedidos/${id}/anular`, { data: { motivo: "otra vez" } });
            expect(otra.estado).toBe(409);
            evidencia.operacion("pedido", id, { anulado: true });
        });
});

test.describe("F05 Sin sesión", () => {
    test("P-U3-14 F05 rechazo: sin sesión, Mis pedidos manda al login y no consulta pedidos", async ({ page, evidencia }) => {
        const consultas = [];
        page.on("request", (s) => { if (s.url().includes("/api/v1/graphql")) consultas.push(s.url()); });
        await page.goto("mis-pedidos.html");
        await page.waitForURL(/login\.html\?volver=mis-pedidos\.html/);
        expect(consultas).toHaveLength(0);
        await evidencia.captura(page, "sin-sesion");

        // Y la API tampoco entrega pedidos sin cookie de sesión
        const r = await page.request.post("/api/v1/graphql", {
            data: { query: "query { misPedidos { total } }" },
            headers: { "X-Request-ID": "e2e-p-u3-14-sin-sesion" }
        });
        expect(r.status()).toBe(401);
    });
});
