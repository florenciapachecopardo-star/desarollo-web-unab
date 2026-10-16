// Ficha de producto. Lee el id desde ?id= y muestra el producto desde el
// catálogo. Los relacionados son los de la misma categoría.

function obtenerProductoActual() {
    const parametro = new URLSearchParams(window.location.search).get("id");
    const productos = obtenerProductos();
    if (parametro === null) {
        return productos[0];
    }
    return buscarProducto(parametro);
}

function mostrarNoEncontrado() {
    const detalle = document.getElementById("detalle");

    const titulo = document.createElement("h1");
    titulo.textContent = "Producto no encontrado";

    const texto = document.createElement("p");
    texto.textContent = "Ese producto no existe. Vuelve al catálogo para elegir otro.";

    const enlace = document.createElement("a");
    enlace.className = "detalle__volver";
    enlace.href = "index.html#productos";
    enlace.textContent = "Ver productos";

    detalle.replaceChildren(titulo, texto, enlace);
    detalle.classList.add("detalle--vacio");
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
    const relacionados = obtenerProductos().filter(
        (otro) => otro.id !== producto.id && otro.categoria === producto.categoria
    );

    if (relacionados.length === 0) {
        document.getElementById("relacionados").hidden = true;
        return;
    }

    relacionados.forEach((otro) => grilla.appendChild(crearTarjeta(otro)));
}

document.addEventListener("DOMContentLoaded", () => {
    const producto = obtenerProductoActual();

    if (producto) {
        mostrarProducto(producto);
        mostrarRelacionados(producto);
    } else {
        mostrarNoEncontrado();
    }
});
