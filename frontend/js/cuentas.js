// Clientes y personal: registro, validación de RUN, ingreso y sesión.
// La sesión real es una cookie httponly del servidor; en localStorage solo queda
// el nombre y el perfil para pintar la interfaz. La verificación del correo es
// simulada (no hay servicio de mensajería, ver README).

const CLAVE_SESION = "choco:sesion";

// --- Validación de RUN (módulo 11) ---
function limpiarRun(run) {
    return run.replace(/[.\-\s]/g, "").toUpperCase();
}

function digitoVerificador(cuerpo) {
    let suma = 0;
    let factor = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += Number(cuerpo[i]) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const resto = 11 - (suma % 11);
    if (resto === 11) return "0";
    if (resto === 10) return "K";
    return String(resto);
}

function runValido(run) {
    const limpio = limpiarRun(run);
    if (limpio.length < 2) return false;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    if (!/^\d+$/.test(cuerpo)) return false;
    return digitoVerificador(cuerpo) === dv;
}

// Formato bonito: 12.345.678-9
function formatearRun(run) {
    const limpio = limpiarRun(run);
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${conPuntos}-${dv}`;
}

// --- Sesión ---
function sesionActual() {
    const texto = localStorage.getItem(CLAVE_SESION);
    if (!texto) return null;
    try {
        return JSON.parse(texto);
    } catch (error) {
        return null;
    }
}

function cerrarSesion() {
    localStorage.removeItem(CLAVE_SESION);
}

function guardarSesion(sesion) {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
}

// --- Registro de clientes ---
// El registro y la verificación van al servicio clients por el gateway (S09 y S09V).
// La clave se manda una sola vez por la API y el servidor guarda solo su hash.
async function registrarClienteApi(datos) {
    return apiFetch("/api/v1/clientes", { method: "POST", body: datos });
}

async function verificarCorreoApi(idCliente, codigo) {
    return apiFetch("/api/v1/clientes/" + encodeURIComponent(idCliente) + "/verificar", {
        method: "POST",
        body: { codigo }
    });
}
