function obtenerProducto() {
    const parametro = new URLSearchParams(window.location.search).get("id");
    const id = parametro === null ? PRODUCTOS[0].id : Number(parametro);
    return buscarProducto(id);
}

function mostrarNoEncontrado() {
    const titulo = document.createElement("h1");
    titulo.textContent = "Producto no encontrado";

    const texto = document.createElement("p");
    texto.textContent = "Ese producto no existe. Vuelve al catálogo para elegir otro.";

    const enlace = document.createElement("a");
    enlace.className = "detalle__volver";
    enlace.href = "index.html#productos";
    enlace.textContent = "Ver productos";

    document.getElementById("detalle").replaceChildren(titulo, texto, enlace);
    document.getElementById("detalle").classList.add("detalle--vacio");
    document.getElementById("relacionados").hidden = true;
}

function mostrarProducto(producto) {
    document.title = producto.nombre + " | Chocomanía";

    const foto = document.getElementById("detalle-foto");
    foto.src = producto.imagen;
    foto.alt = producto.nombre;

    document.getElementById("detalle-nombre").textContent = producto.nombre;
    document.getElementById("detalle-descripcion").textContent = producto.descripcion;
    document.getElementById("detalle-precio").textContent = formatearPrecio(producto.precio);

    const boton = document.getElementById("detalle-agregar");
    const aviso = document.getElementById("detalle-aviso");
    let restaurar;

    if (!producto.disponible) {
        boton.disabled = true;
        boton.textContent = "No disponible";
        return;
    }

    boton.addEventListener("click", () => {
        const cantidad = agregarAlCarrito(producto.id);
        aviso.textContent = producto.nombre + " agregado. Llevas " + cantidad +
            (cantidad === 1 ? " producto." : " productos.");
        boton.textContent = "Agregado al carrito";
        clearTimeout(restaurar);
        restaurar = setTimeout(() => {
            boton.textContent = "Agregar al carrito";
        }, 1500);
    });
}

function mostrarRelacionados(producto) {
    const grilla = document.getElementById("grilla-relacionados");
    PRODUCTOS
        .filter((otro) => otro.id !== producto.id)
        .forEach((otro) => grilla.appendChild(crearTarjeta(otro)));
}

document.addEventListener("DOMContentLoaded", () => {
    const producto = obtenerProducto();

    if (producto) {
        mostrarProducto(producto);
        mostrarRelacionados(producto);
    } else {
        mostrarNoEncontrado();
    }

    iniciarCarrito();
});
