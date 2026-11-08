// Página de inicio: pinta el catálogo que viene del servidor (S01).
// Permite filtrar por categoría con ?categoria=barras.

document.addEventListener("DOMContentLoaded", async () => {
    const grilla = document.getElementById("grilla-productos");
    const categoria = new URLSearchParams(window.location.search).get("categoria");

    mostrarEstado(grilla, "cargando", "Cargando productos…");
    const resultado = await catalogoListo;

    if (!resultado.ok) {
        // Si el servidor falla, no se muestra el catálogo guardado como si estuviera al día
        mostrarError(grilla, resultado);
        return;
    }
    grilla.textContent = "";

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
