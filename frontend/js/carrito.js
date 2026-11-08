// Carrito de compras. Antes vivía en la URL; ahora vive en localStorage para
// poder manejar cantidades y conservarse entre páginas.
// Formato: [{ id, cantidad }]. El id es el del producto en el servidor (texto).
// El carrito sí vive en el navegador: es la intención de compra, no un dato del negocio.
// El precio y el total los vuelve a calcular el servidor al crear el pedido.

const CLAVE_CARRITO = "choco:carrito";

function leerCarrito() {
    const texto = localStorage.getItem(CLAVE_CARRITO);
    if (!texto) return [];
    try {
        return JSON.parse(texto);
    } catch (error) {
        return [];
    }
}

function guardarCarrito(carrito) {
    localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
    actualizarContadorCabecera();
}

function agregarAlCarrito(id) {
    const carrito = leerCarrito();
    const linea = carrito.find((item) => String(item.id) === String(id));
    if (linea) {
        linea.cantidad += 1;
    } else {
        carrito.push({ id: String(id), cantidad: 1 });
    }
    guardarCarrito(carrito);
    return contarCarrito();
}

function cambiarCantidad(id, cantidad) {
    const carrito = leerCarrito();
    const linea = carrito.find((item) => String(item.id) === String(id));
    if (!linea) return;
    linea.cantidad = Math.max(1, cantidad);
    guardarCarrito(carrito);
}

function quitarDelCarrito(id) {
    const carrito = leerCarrito().filter((item) => String(item.id) !== String(id));
    guardarCarrito(carrito);
}

function vaciarCarrito() {
    guardarCarrito([]);
}

function contarCarrito() {
    return leerCarrito().reduce((suma, item) => suma + item.cantidad, 0);
}

// Une cada línea del carrito con el producto actual del catálogo.
// Si un producto se eliminó o quedó no disponible, se descarta la línea.
function detalleCarrito() {
    const carrito = leerCarrito();
    const detalle = [];
    let cambio = false;

    carrito.forEach((linea) => {
        const producto = buscarProducto(linea.id);
        if (!producto || !producto.disponible) {
            cambio = true;
            return;
        }
        detalle.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            imagen: producto.imagen,
            cantidad: linea.cantidad,
            subtotal: producto.precio * linea.cantidad
        });
    });

    // Solo se limpian líneas si el catálogo llegó bien del servidor (si no, no se pierde el carrito)
    if (cambio && typeof catalogoCargado !== "undefined" && catalogoCargado) {
        guardarCarrito(detalle.map((item) => ({ id: item.id, cantidad: item.cantidad })));
    }
    return detalle;
}

function totalCarrito() {
    return detalleCarrito().reduce((suma, item) => suma + item.subtotal, 0);
}

// Actualiza el texto "Carrito (n)" de la cabecera en cualquier página.
function actualizarContadorCabecera() {
    const etiqueta = document.getElementById("carrito");
    if (!etiqueta) return;

    const cantidad = contarCarrito();
    etiqueta.textContent = cantidad === 0
        ? "Carrito (0)"
        : "Carrito (" + cantidad + ") " + formatearPrecio(totalCarrito());
}

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof catalogoListo !== "undefined") await catalogoListo;
    actualizarContadorCabecera();
});
