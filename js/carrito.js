function leerCarrito() {
    const valor = new URLSearchParams(window.location.search).get("carrito");
    if (!valor) {
        return [];
    }
    return valor.split(",").map(Number).filter((id) => buscarProducto(id) !== undefined);
}

function conCarrito(href, carrito) {
    const [sinHash, hash = ""] = href.split("#");
    const [ruta, consulta = ""] = sinHash.split("?");
    const parametros = new URLSearchParams(consulta);

    if (carrito.length > 0) {
        parametros.set("carrito", carrito.join(","));
    } else {
        parametros.delete("carrito");
    }

    const texto = parametros.toString().replace(/%2C/g, ",");
    return ruta + (texto ? "?" + texto : "") + (hash ? "#" + hash : "");
}

function ubicacionActual() {
    return window.location.pathname.split("/").pop() + window.location.search + window.location.hash;
}

function conservarCarritoEnEnlaces() {
    const carrito = leerCarrito();
    document.querySelectorAll("a[href]").forEach((enlace) => {
        const href = enlace.getAttribute("href");
        if (/^(index|producto)\.html/.test(href)) {
            enlace.setAttribute("href", conCarrito(href, carrito));
        }
    });
}

function mostrarCarrito() {
    const carrito = leerCarrito();
    const total = carrito.reduce((suma, id) => suma + buscarProducto(id).precio, 0);
    const etiqueta = document.getElementById("carrito");

    etiqueta.textContent = carrito.length === 0
        ? "Carrito (0)"
        : "Carrito (" + carrito.length + ") " + formatearPrecio(total);
}

function iniciarCarrito() {
    conservarCarritoEnEnlaces();
    mostrarCarrito();
}

function agregarAlCarrito(id) {
    const carrito = leerCarrito();
    carrito.push(id);
    window.history.replaceState(null, "", conCarrito(ubicacionActual(), carrito));
    iniciarCarrito();
    return carrito.length;
}
