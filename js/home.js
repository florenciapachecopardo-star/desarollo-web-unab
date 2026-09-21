document.addEventListener("DOMContentLoaded", () => {
    const grilla = document.getElementById("grilla-productos");
    PRODUCTOS.forEach((producto) => grilla.appendChild(crearTarjeta(producto)));
    iniciarCarrito();
});
