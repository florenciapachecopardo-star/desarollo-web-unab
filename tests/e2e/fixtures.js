// Ayudas comunes de las pruebas de la Entrega 3.
//
// Lo más importante es la fixture "red": registra cada llamada a /api/ que hace
// el navegador (método, ruta, estado, X-Request-ID e Idempotency-Key) y la guarda
//   - adjunta a la prueba, como red.json (se ve en el reporte HTML), y
//   - en <salida>/<fase>/red.jsonl, que scripts/u3-run.sh usa para sacar los
//     logs de los servicios con el mismo X-Request-ID.
// Así cada captura de pantalla queda unida a sus solicitudes y a sus logs.
//
// Nunca se guardan cookies, tokens ni contraseñas.

const base = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FASE = process.env.FASE || "normal";
const SALIDA = process.env.SALIDA || path.join(__dirname, "salida");
const DIR_FASE = path.join(SALIDA, FASE);

const CLAVES_PROHIBIDAS = /^(clave|password|token|access_token|session_token|cookie|secret)$/i;

function limpiar(valor) {
    if (Array.isArray(valor)) return valor.map(limpiar);
    if (valor && typeof valor === "object") {
        const salida = {};
        for (const [clave, contenido] of Object.entries(valor)) {
            salida[clave] = CLAVES_PROHIBIDAS.test(clave) ? "[omitido]" : limpiar(contenido);
        }
        return salida;
    }
    return valor;
}

function agregarLinea(archivo, objeto) {
    fs.mkdirSync(DIR_FASE, { recursive: true });
    fs.appendFileSync(path.join(DIR_FASE, archivo), JSON.stringify(objeto) + "\n");
}

function nuevoRequestId(prueba) {
    return `e2e-${prueba}-${crypto.randomBytes(4).toString("hex")}`.slice(0, 64);
}

// Opciones del viewport del proyecto (escritorio o móvil), para contextos nuevos
function opcionesProyecto(testInfo, extra = {}) {
    const use = testInfo.project.use;
    const claves = ["baseURL", "viewport", "deviceScaleFactor", "isMobile", "hasTouch", "userAgent", "locale", "timezoneId"];
    const opciones = {};
    for (const clave of claves) if (use[clave] !== undefined) opciones[clave] = use[clave];
    return { ...opciones, ...extra };
}

const test = base.test.extend({
    // Registro de red de la prueba (automático para la página principal)
    red: [async ({ context }, use, testInfo) => {
        const entradas = [];
        const pendientes = [];

        function observar(ctx, etiqueta) {
            ctx.on("response", (respuesta) => {
                const url = new URL(respuesta.url());
                if (!url.pathname.startsWith("/api/")) return;
                const solicitud = respuesta.request();
                const tarea = (async () => {
                    const entrada = {
                        hora: new Date().toISOString(),
                        contexto: etiqueta,
                        metodo: solicitud.method(),
                        ruta: url.pathname + url.search,
                        estado: respuesta.status(),
                        request_id: respuesta.headers()["x-request-id"] || null,
                        idempotency_key: solicitud.headers()["idempotency-key"] || null
                    };
                    if (!url.pathname.startsWith("/api/v1/auth/login")) {
                        try {
                            const cuerpo = solicitud.postDataJSON();
                            if (cuerpo) entrada.cuerpo_enviado = limpiar(cuerpo);
                        } catch (error) { /* sin cuerpo JSON */ }
                    }
                    try {
                        entrada.cuerpo_recibido = limpiar(await respuesta.json());
                    } catch (error) { /* sin cuerpo JSON */ }
                    entradas.push(entrada);
                })();
                pendientes.push(tarea);
            });
            ctx.on("requestfailed", (solicitud) => {
                const url = new URL(solicitud.url());
                if (!url.pathname.startsWith("/api/")) return;
                entradas.push({
                    hora: new Date().toISOString(),
                    contexto: etiqueta,
                    metodo: solicitud.method(),
                    ruta: url.pathname,
                    estado: "SIN_RESPUESTA",
                    error: (solicitud.failure() || {}).errorText || null,
                    request_id_enviado: solicitud.headers()["x-request-id"] || null,
                    idempotency_key: solicitud.headers()["idempotency-key"] || null
                });
            });
        }

        // Llamadas que la prueba hace directo a la API (como el navegador, con su cookie)
        function anotar(entrada) {
            entradas.push({ hora: new Date().toISOString(), contexto: "api-directa", ...entrada });
        }

        observar(context, "principal");
        await use({ observar, anotar, entradas });

        // Una respuesta cuyo cuerpo ya no existe (la página navegó) no debe colgar la prueba
        await Promise.race([Promise.allSettled(pendientes), new Promise((r) => setTimeout(r, 5000))]);
        entradas.sort((a, b) => a.hora.localeCompare(b.hora));
        await testInfo.attach("red.json", { body: JSON.stringify(entradas, null, 2), contentType: "application/json" });
        for (const entrada of entradas) {
            agregarLinea("red.jsonl", {
                prueba: testInfo.title,
                proyecto: testInfo.project.name,
                ...entrada,
                cuerpo_enviado: undefined,
                cuerpo_recibido: undefined
            });
        }
    }, { auto: true }],

    // Capturas con nombre y registro de operaciones (pedido creado, pago, etc.)
    evidencia: async ({}, use, testInfo) => {
        await use({
            async captura(pagina, nombre) {
                // JPEG para que el paquete de evidencias no pese cientos de MB en el repo
                const archivo = testInfo.outputPath(`${nombre}.jpg`);
                await pagina.screenshot({ path: archivo, fullPage: true, type: "jpeg", quality: 70 });
                await testInfo.attach(nombre, { path: archivo, contentType: "image/jpeg" });
            },
            operacion(tipo, id, detalle = {}) {
                agregarLinea("operaciones.jsonl", {
                    prueba: testInfo.title, proyecto: testInfo.project.name, tipo, id, ...detalle
                });
                testInfo.annotations.push({ type: tipo, description: id });
            }
        });
    },

    // Llamadas directas a la API con la sesión de la página (para corroborar lo
    // que muestra la pantalla). Cada una lleva su propio X-Request-ID.
    api: async ({ page, red }, use, testInfo) => {
        const prefijo = testInfo.title.match(/^(P-U3-\d+)/)?.[1]?.toLowerCase() || "e2e";
        async function pedir(metodo, ruta, opciones = {}, pagina = page) {
            const requestId = nuevoRequestId(prefijo);
            const headers = { "X-Request-ID": requestId, ...(opciones.headers || {}) };
            const respuesta = await pagina.request.fetch(ruta, { method: metodo, headers, data: opciones.data });
            let cuerpo = null;
            try { cuerpo = await respuesta.json(); } catch (error) { cuerpo = null; }
            red.anotar({
                metodo, ruta, estado: respuesta.status(),
                request_id: respuesta.headers()["x-request-id"] || requestId,
                cuerpo_recibido: limpiar(cuerpo)
            });
            return { estado: respuesta.status(), cuerpo, requestId: respuesta.headers()["x-request-id"] || requestId };
        }
        async function graphql(query, variables = {}, pagina = page) {
            return pedir("POST", "/api/v1/graphql", { data: { query, variables } }, pagina);
        }
        await use({ pedir, graphql });
    }
});

// Cuenta los pedidos del cliente con sesión (S18)
async function totalPedidos(api) {
    const r = await api.graphql("query { misPedidos(pagina: 1, porPagina: 1) { total } }");
    base.expect(r.estado).toBe(200);
    return r.cuerpo.data.misPedidos.total;
}

// Inicia sesión desde la pantalla de login en la página dada
async function iniciarSesionUI(pagina, cuenta, destino = /index\.html/) {
    await pagina.goto("login.html");
    await pagina.locator("#correo").fill(cuenta.correo);
    await pagina.locator("#clave").fill(cuenta.clave);
    await Promise.all([
        pagina.waitForURL(destino),
        pagina.locator("#form-login button[type=submit]").click()
    ]);
}

// "8990" -> "8.990" (así lo escribe el front en es-CL)
function miles(valor) {
    return String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

module.exports = { test, expect: base.expect, opcionesProyecto, totalPedidos, iniciarSesionUI, miles, nuevoRequestId };
