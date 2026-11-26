// Inicia sesión una vez como cliente1 (desde la pantalla de login) y guarda el
// estado del navegador para las pruebas que necesitan sesión. Así no se gastan
// logins: el gateway permite 20 por minuto por IP.
// El archivo queda en la carpeta temporal del contenedor, nunca en evidencias/
// (contiene la cookie de sesión).

const { chromium } = require("@playwright/test");
const fs = require("fs");
const { RUTA_SESION_CLIENTE1, CUENTAS } = require("./datos");

module.exports = async (config) => {
    const { baseURL } = config.projects[0].use;
    const navegador = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
    const pagina = await navegador.newPage({ baseURL });
    await pagina.goto("login.html");
    await pagina.locator("#correo").fill(CUENTAS.cliente1.correo);
    await pagina.locator("#clave").fill(CUENTAS.cliente1.clave);
    await Promise.all([
        pagina.waitForURL(/index\.html/),
        pagina.locator("#form-login button[type=submit]").click()
    ]);
    fs.mkdirSync(require("path").dirname(RUTA_SESION_CLIENTE1), { recursive: true });
    await pagina.context().storageState({ path: RUTA_SESION_CLIENTE1 });
    await navegador.close();
};
