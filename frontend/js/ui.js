// Utilidades compartidas por todas las páginas: formato de precios y fechas,
// y la parte de "cuenta" de la cabecera (Ingresar / nombre + Salir).

const formatoPrecio = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
});

function formatearPrecio(valor) {
    return formatoPrecio.format(valor);
}

function formatearFecha(iso) {
    const fecha = new Date(iso);
    return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Nombre legible de cada perfil del personal.
const NOMBRE_PERFIL = {
    CLIENTE: "Cliente",
    ADMIN: "Administrador",
    DUENO: "Dueño",
    CAJERO: "Cajero virtual",
    DESPACHO: "Encargado de despacho"
};

// Página de inicio según el perfil. El panel interno no está en la U2 (recorte declarado),
// así que el personal vuelve al inicio.
function inicioSegunPerfil(perfil) {
    return "index.html";
}

// Dibuja el enlace de cuenta en la cabecera de cualquier página.
function pintarCuentaCabecera() {
    const zona = document.getElementById("cuenta-cabecera");
    if (!zona) {
        return;
    }
    zona.textContent = "";

    const sesion = sesionActual();

    if (!sesion) {
        const ingresar = document.createElement("a");
        ingresar.href = "login.html";
        ingresar.textContent = "Ingresar";
        zona.appendChild(ingresar);
        return;
    }

    const enlace = document.createElement(sesion.tipo === "CLIENTE" ? "a" : "span");
    if (sesion.tipo === "CLIENTE") {
        enlace.href = "mis-pedidos.html";
        enlace.textContent = sesion.nombre.split(" ")[0];
    } else {
        enlace.textContent = (NOMBRE_PERFIL[sesion.perfil] || sesion.perfil);
    }

    const salir = document.createElement("button");
    salir.type = "button";
    salir.className = "cuenta__salir";
    salir.textContent = "Salir";
    salir.addEventListener("click", async () => {
        if (typeof cerrarSesionApi === "function") {
            await cerrarSesionApi();
        } else {
            cerrarSesion();
        }
        window.location.href = "index.html";
    });

    zona.append(enlace, salir);
}

// Protege una página del panel: si no hay sesión con un perfil permitido,
// redirige. Se llama al inicio de cada página interna.
function exigirPerfil(perfilesPermitidos) {
    const sesion = sesionActual();
    if (!sesion) {
        window.location.href = "login.html";
        return null;
    }
    if (!perfilesPermitidos.includes(sesion.perfil)) {
        window.location.href = "sin-permiso.html";
        return null;
    }
    return sesion;
}

// Protege una página que exige sesión de cliente.
function exigirCliente() {
    const sesion = sesionActual();
    if (!sesion || sesion.tipo !== "CLIENTE") {
        const volver = encodeURIComponent(window.location.pathname.replace(/^\//, "") + window.location.search);
        window.location.href = "login.html?volver=" + volver;
        return null;
    }
    return sesion;
}

document.addEventListener("DOMContentLoaded", pintarCuentaCabecera);
