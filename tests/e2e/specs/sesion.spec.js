// Sesión expirada. Corre en la fase "expira", con auth reiniciado con
// AUTH_TOKEN_TTL=20 (scripts/u3-run.sh), para no esperar los 15 minutos reales.
// Ficha: docs/u3/protocolo-u3.md (P-U3-13).

const { test, expect, iniciarSesionUI } = require("../fixtures");
const { CUENTAS } = require("../datos");

const TTL = Number(process.env.AUTH_TOKEN_TTL_PRUEBA || 20);

test.describe("Sesión expirada @expira", () => {
    test("P-U3-13 F03/F05 recuperación: con la sesión vencida se vuelve al login y, al entrar de nuevo, a la misma página @expira",
        async ({ page, evidencia }) => {
            test.setTimeout((TTL + 60) * 1000);
            await iniciarSesionUI(page, CUENTAS.cliente1);
            await page.goto("mis-pedidos.html");
            await expect(page.locator("#lista-pedidos .pedido").first()).toBeVisible();
            await evidencia.captura(page, "1-antes-de-expirar");

            // Se espera a que venza el token en el servidor (la sesión local del navegador sigue ahí)
            await page.waitForTimeout((TTL + 3) * 1000);

            // El servidor responde 401 y el front, al ver SESSION_INVALID, manda al login
            // (el código del error queda en red.json y en el log de auth: sesion_expirada)
            const [resp] = await Promise.all([
                page.waitForResponse((r) => r.url().includes("/api/v1/graphql")),
                page.waitForURL(/login\.html\?expirada=1&volver=mis-pedidos\.html/),
                page.reload()
            ]);
            expect(resp.status()).toBe(401);
            await expect(page.locator("#error")).toHaveText("Tu sesión expiró. Ingresa de nuevo para continuar.");
            await evidencia.captura(page, "2-login-sesion-expirada");

            // Ingresa de nuevo y vuelve a Mis pedidos
            await page.locator("#correo").fill(CUENTAS.cliente1.correo);
            await page.locator("#clave").fill(CUENTAS.cliente1.clave);
            await Promise.all([
                page.waitForURL(/mis-pedidos\.html/),
                page.locator("#form-login button[type=submit]").click()
            ]);
            await expect(page.locator("#lista-pedidos .pedido").first()).toBeVisible();
            await evidencia.captura(page, "3-de-vuelta-en-mis-pedidos");
        });
});
