// F02 Registrarse como cliente (clients + auth). No es uno de los 3 recorridos
// críticos, pero está en el alcance. Ficha: docs/u3/protocolo-u3.md (P-U3-16).
// La verificación del correo es SIMULADA (brecha R11): el código lo genera el
// servidor y la pantalla lo muestra; no prueba que el correo exista.

const { test, expect, iniciarSesionUI, nuevoRequestId } = require("../fixtures");

// RUN chileno ficticio con dígito verificador correcto (módulo 11)
function digitoVerificador(cuerpo) {
    let suma = 0;
    let factor = 2;
    for (const d of String(cuerpo).split("").reverse()) {
        suma += Number(d) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const resto = 11 - (suma % 11);
    return resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
}
function formatearRun(cuerpo, dv) {
    return String(cuerpo).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
}

test.describe("F02 Registro", () => {
    test("P-U3-16 F02 éxito y rechazo: RUN inválido no llega al servidor; la cuenta solo entra después de verificar",
        async ({ page, api, evidencia }, testInfo) => {
            const cuerpo = 30_000_000 + Math.floor(Math.random() * 9_000_000);
            const dv = digitoVerificador(cuerpo);
            const dvMalo = dv === "1" ? "2" : "1";
            const sufijo = Date.now().toString(36) + testInfo.project.name.slice(0, 1);
            const cuenta = { correo: `prueba.${sufijo}@correo.cl`, clave: "Prueba2026" };
            const registros = [];
            page.on("request", (s) => { if (s.method() === "POST" && s.url().endsWith("/api/v1/clientes")) registros.push(s.url()); });

            await page.goto("registro.html");
            await page.locator("#run").fill(formatearRun(cuerpo, dvMalo));
            await page.locator("#nombre").fill("Persona Ficticia");
            await page.locator("#direccion").fill("Calle Ficticia 1000");
            await page.locator("#region").selectOption({ label: "Región Metropolitana de Santiago" });
            await page.locator("#provincia").selectOption({ label: "Santiago" });
            await page.locator("#comuna").selectOption({ label: "Providencia" });
            await page.locator("#nacimiento").fill("1998-05-10");
            await page.locator("#sexo").selectOption("O");
            await page.locator("#correo").fill(cuenta.correo);
            await page.locator("#telefono").fill("+56912345678");
            await page.locator("#clave").fill(cuenta.clave);

            // a) RUN con dígito verificador incorrecto: lo frena el front, sin llamar al servidor
            await page.locator("#form-registro button[type=submit]").click();
            await expect(page.locator('[data-error="run"]')).toHaveText("El RUN no es válido.");
            expect(registros).toHaveLength(0);
            await evidencia.captura(page, "1-run-invalido");

            // b) RUN correcto: clients crea la cuenta (inactiva) y pide el código
            await page.locator("#run").fill(formatearRun(cuerpo, dv));
            await page.locator("#clave").fill(cuenta.clave);
            const [resp] = await Promise.all([
                page.waitForResponse((r) => r.url().endsWith("/api/v1/clientes") && r.request().method() === "POST"),
                page.waitForURL(/verificar\.html\?id=/, { waitUntil: "commit" }),
                page.locator("#form-registro button[type=submit]").click()
            ]);
            expect(resp.status()).toBe(201);
            const idCliente = new URL(page.url()).searchParams.get("id");
            const codigo = (await page.locator("#codigo-mostrado").textContent()).trim();
            expect(codigo).toMatch(/^[0-9]{6}$/);
            await evidencia.captura(page, "2-verificar");

            // c) Antes de verificar, la cuenta no puede iniciar sesión
            const antes = await page.request.post("/api/v1/auth/login", {
                data: cuenta, headers: { "X-Request-ID": nuevoRequestId("p-u3-16-sin-verificar") }
            });
            expect(antes.status()).toBe(401);

            // d) Código equivocado: se rechaza con el código de la solicitud a la vista
            const otroCodigo = codigo === "000000" ? "111111" : "000000";
            await page.locator("#codigo").fill(otroCodigo);
            await page.locator("#form-verificar button[type=submit]").click();
            await expect(page.locator("#error")).toContainText("El código no coincide");
            await expect(page.locator("#error")).toContainText("Código:");
            await evidencia.captura(page, "3-codigo-equivocado");

            // e) Código correcto: vuelve al login con aviso, y la cuenta ya entra
            await page.locator("#codigo").fill(codigo);
            await Promise.all([
                page.waitForURL(/login\.html\?verificado=1/),
                page.locator("#form-verificar button[type=submit]").click()
            ]);
            await expect(page.locator("#error")).toHaveText("¡Correo verificado! Ya puedes ingresar con tu cuenta.");
            await iniciarSesionUI(page, cuenta);

            // Persistencia: el perfil propio (S10) existe, con el RUN enmascarado
            const perfil = await api.pedir("GET", "/api/v1/clientes/me");
            expect(perfil.estado).toBe(200);
            expect(perfil.cuerpo.id).toBe(idCliente);
            expect(perfil.cuerpo.verificado).toBe(true);
            expect(JSON.stringify(perfil.cuerpo)).not.toContain(formatearRun(cuerpo, dv));
            await evidencia.captura(page, "4-sesion-de-la-cuenta-nueva");
            evidencia.operacion("cliente", idCliente);
        });
});
