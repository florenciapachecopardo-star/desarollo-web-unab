// Capa de acceso a la API de Chocomanía (PR G).
// El front se sirve desde el mismo origen que el API Gateway (http://localhost:8000),
// así que las rutas son relativas y la cookie de sesión (httponly) viaja sola.
//
// Cada llamada:
//   - manda un X-Request-ID propio, para unir la pantalla con los logs del servidor
//   - tiene un plazo máximo (8 s)
//   - devuelve { ok, status, data, error, requestId } y nunca lanza excepciones

const API_TIMEOUT_MS = 8000;

function nuevoId(prefijo) {
    const aleatorio = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, "")
        : String(Date.now()) + Math.random().toString(16).slice(2);
    return (prefijo ? prefijo + "-" : "") + aleatorio.slice(0, 24);
}

async function apiFetch(ruta, opciones = {}) {
    const requestId = nuevoId("web");
    const headers = { "X-Request-ID": requestId };
    if (opciones.body !== undefined) headers["Content-Type"] = "application/json";
    if (opciones.idempotencyKey) headers["Idempotency-Key"] = opciones.idempotencyKey;

    const control = new AbortController();
    const plazo = setTimeout(() => control.abort(), API_TIMEOUT_MS);

    try {
        const respuesta = await fetch(ruta, {
            method: opciones.method || "GET",
            headers,
            body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
            credentials: "same-origin",
            signal: control.signal
        });
        const idServidor = respuesta.headers.get("X-Request-ID") || requestId;
        let data = null;
        try {
            data = await respuesta.json();
        } catch (error) {
            data = null;
        }
        if (respuesta.ok) {
            return { ok: true, status: respuesta.status, data, error: null, requestId: idServidor };
        }
        const error = (data && data.error) || { code: "ERROR", message: "El servidor respondió con un error." };
        return { ok: false, status: respuesta.status, data, error, requestId: error.request_id || idServidor };
    } catch (error) {
        const porPlazo = error.name === "AbortError";
        return {
            ok: false,
            status: 0,
            data: null,
            error: {
                code: porPlazo ? "TIMEOUT" : "NETWORK",
                message: porPlazo
                    ? "El servidor tardó demasiado en responder. Intenta de nuevo."
                    : "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo."
            },
            requestId
        };
    } finally {
        clearTimeout(plazo);
    }
}

// Mensajes entendibles para los códigos más comunes. Si no hay uno propio, se usa el del servidor.
const MENSAJES_ERROR = {
    UNAUTHENTICATED: "Tu sesión no está activa. Ingresa de nuevo.",
    SESSION_INVALID: "Tu sesión expiró. Ingresa de nuevo.",
    FORBIDDEN: "No tienes permiso para hacer esto.",
    INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
    STOCK_INSUFICIENTE: null, // el mensaje del servidor ya dice qué producto falta
    UPSTREAM_UNAVAILABLE: "Un servicio no está disponible en este momento. Intenta en unos minutos.",
    UPSTREAM_TIMEOUT: "Un servicio tardó demasiado en responder. Intenta en unos minutos.",
    SECRETS_UNAVAILABLE: "El servicio no está disponible en este momento. Intenta en unos minutos."
};

function textoError(resultado) {
    const error = resultado.error || {};
    return MENSAJES_ERROR[error.code] || error.message || "Ocurrió un error inesperado.";
}

// Pinta un mensaje de estado (cargando, error, vacío) con el código de la solicitud en chico.
// Así una captura de pantalla queda unida a sus líneas de log.
function mostrarEstado(zona, tipo, texto, requestId) {
    zona.textContent = "";
    const caja = document.createElement("div");
    caja.className = "estado estado--" + tipo;
    caja.setAttribute("role", tipo === "error" ? "alert" : "status");

    const mensaje = document.createElement("p");
    mensaje.textContent = texto;
    caja.appendChild(mensaje);

    if (requestId) {
        const codigo = document.createElement("p");
        codigo.className = "estado__codigo";
        codigo.textContent = "Código: " + requestId;
        caja.appendChild(codigo);
    }
    zona.appendChild(caja);
    return caja;
}

function mostrarError(zona, resultado) {
    return mostrarEstado(zona, "error", textoError(resultado), resultado.requestId);
}

// Escribe el error en un <p class="form-error"> existente, con el código.
function escribirError(elemento, resultado) {
    elemento.textContent = textoError(resultado) + (resultado.requestId ? " (Código: " + resultado.requestId + ")" : "");
}

// Si el servidor dice que no hay sesión, se borra la local y se va al login,
// recordando a qué página volver.
function manejarSesionExpirada(resultado) {
    if (resultado.status === 401 && resultado.error &&
        ["UNAUTHENTICATED", "SESSION_INVALID"].includes(resultado.error.code)) {
        cerrarSesion();
        const volver = encodeURIComponent(window.location.pathname.replace(/^\//, "") + window.location.search);
        window.location.href = "login.html?expirada=1&volver=" + volver;
        return true;
    }
    return false;
}

// --- Catálogo ---
// Se trae del servidor en cada página. Lo guardado en el navegador es solo una
// caché para que las funciones de carrito sigan siendo síncronas.
let catalogoCargado = false;

function aProductoFront(producto) {
    return {
        id: producto.id,
        nombre: producto.nombre,
        categoria: producto.categoria,
        descripcion: producto.descripcion,
        precio: producto.precio,
        disponible: producto.disponible,
        imagen: producto.imagen || "img/chocolate-dubai.jpg"
    };
}

async function cargarCatalogo() {
    const resultado = await apiFetch("/api/v1/productos");
    if (resultado.ok) {
        localStorage.setItem(CLAVE_CATALOGO, JSON.stringify(resultado.data.productos.map(aProductoFront)));
        catalogoCargado = true;
    }
    return resultado;
}

const catalogoListo = cargarCatalogo();

// --- Sesión con el servidor ---
async function iniciarSesionApi(correo, clave) {
    const login = await apiFetch("/api/v1/auth/login", { method: "POST", body: { correo, clave } });
    if (!login.ok) return login;

    const yo = await apiFetch("/api/v1/auth/me");
    if (!yo.ok) return yo;

    const roles = yo.data.roles || [];
    const perfil = roles.includes("CLIENTE") ? "CLIENTE" : (roles[0] || "CLIENTE");
    guardarSesion({
        tipo: perfil === "CLIENTE" ? "CLIENTE" : "PERSONAL",
        perfil,
        id: yo.data.user_id,
        nombre: yo.data.nombre || correo
    });
    return yo;
}

async function cerrarSesionApi() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
    cerrarSesion();
}

// --- Claves de idempotencia ---
// Se guardan en sessionStorage: si la persona hace doble clic o recarga y reintenta,
// se reutiliza la misma clave y el servidor no duplica el pedido ni el pago.
function claveIdempotencia(nombre) {
    const clave = "choco:idem:" + nombre;
    let valor = sessionStorage.getItem(clave);
    if (!valor) {
        valor = nuevoId(nombre.split(":")[0]);
        sessionStorage.setItem(clave, valor);
    }
    return valor;
}

function olvidarClaveIdempotencia(nombre) {
    sessionStorage.removeItem("choco:idem:" + nombre);
}
