// Página de inicio: pinta los productos destacados desde el catálogo.
// Permite filtrar por categoría con ?categoria=barras.

document.addEventListener("DOMContentLoaded", () => {
    const grilla = document.getElementById("grilla-productos");
    const categoria = new URLSearchParams(window.location.search).get("categoria");

    let productos = obtenerProductos();
    if (categoria) {
        productos = productos.filter((producto) => producto.categoria === categoria);
    }

    if (productos.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "grilla__vacio";
        vacio.textContent = "No hay productos en esta categoría por ahora.";
        grilla.appendChild(vacio);
        return;
    }

    productos.forEach((producto) => grilla.appendChild(crearTarjeta(producto)));

    // Marca el filtro activo en el menú de categorías, si existe.
    const menuCategorias = document.getElementById("menu-categorias");
    if (menuCategorias && categoria) {
        const activo = menuCategorias.querySelector(`[data-categoria="${categoria}"]`);
        if (activo) activo.setAttribute("aria-current", "page");
    }
});
