// Recorridos críticos de la Entrega 3 (Playwright).
//
// Se corre por fases, cada una con el sistema en un estado distinto
// (scripts/u3-run.sh las ejecuta en orden):
//   normal      todo arriba                        --grep-invert "@caido|@recuperado|@demora|@expira"
//   caido       inventory detenido                 --grep @caido
//   recuperado  inventory de vuelta                --grep @recuperado
//   demora      inventory con FAULT_DELAY_MS=7000  --grep @demora
//   expira      auth con AUTH_TOKEN_TTL=20         --grep @expira
//
// Cada prueba corre en dos viewports: escritorio (1366x768) y móvil (390x844).
// El móvil es EMULACIÓN en Chromium, no un teléfono físico.
//
// No se guardan trazas ni videos: incluyen la cookie de sesión. La red se
// registra con fixtures.js, que guarda solo método, ruta, estado, X-Request-ID
// y cuerpos sin claves ni tokens.

const { defineConfig } = require("@playwright/test");
const path = require("path");

const FASE = process.env.FASE || "normal";
const SALIDA = process.env.SALIDA || path.join(__dirname, "salida");
const DIR_FASE = path.join(SALIDA, FASE);
// Solo para correrlo fuera de Docker con el Chrome instalado (PW_CHANNEL=chrome)
const CANAL = process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {};

module.exports = defineConfig({
    testDir: path.join(__dirname, "specs"),
    globalSetup: require.resolve("./global-setup.js"),
    // En serie: comparten la base y el límite de 20 logins por minuto del gateway
    workers: 1,
    fullyParallel: false,
    // Sin reintentos automáticos: un resultado intermitente se registra tal cual
    retries: 0,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    outputDir: path.join(DIR_FASE, "artefactos"),
    reporter: [
        ["list"],
        ["json", { outputFile: path.join(DIR_FASE, "resultados.json") }],
        ["junit", { outputFile: path.join(DIR_FASE, "junit.xml") }],
        ["html", { outputFolder: path.join(DIR_FASE, "reporte-html"), open: "never" }]
    ],
    use: {
        baseURL: process.env.BASE_URL || "http://localhost:8080",
        locale: "es-CL",
        timezoneId: "America/Santiago",
        // Las capturas con nombre las toma cada prueba (fixtures.js); la automática solo si falla
        screenshot: "only-on-failure",
        trace: "off",
        video: "off"
    },
    projects: [
        {
            name: "escritorio",
            use: { browserName: "chromium", ...CANAL, viewport: { width: 1366, height: 768 } }
        },
        {
            name: "movil",
            use: {
                browserName: "chromium",
                ...CANAL,
                viewport: { width: 390, height: 844 },
                deviceScaleFactor: 2,
                isMobile: true,
                hasTouch: true,
                userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
            }
        }
    ]
});
