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

// Página de inicio del panel según el perfil (a cada rol lo dejo donde trabaja).
function inicioSegunPerfil(perfil) {
    if (perfil === "CAJERO") return "admin-caja.html";
    if (perfil === "DESPACHO") return "admin-despacho.html";
    if (perfil === "DUENO") return "admin-reportes.html";
    return "admin.html";
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

    const enlace = document.createElement("a");
    if (sesion.tipo === "CLIENTE") {
        enlace.href = "mis-pedidos.html";
        enlace.textContent = sesion.nombre.split(" ")[0];
    } else {
        enlace.href = inicioSegunPerfil(sesion.perfil);
        enlace.textContent = "Panel";
    }

    const salir = document.createElement("button");
    salir.type = "button";
    salir.className = "cuenta__salir";
    salir.textContent = "Salir";
    salir.addEventListener("click", () => {
        cerrarSesion();
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
        window.location.href = "login.html";
        return null;
    }
    return sesion;
}

document.addEventListener("DOMContentLoaded", pintarCuentaCabecera);
