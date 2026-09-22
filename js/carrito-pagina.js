// Página del carrito: muestra las líneas con cantidades, permite cambiarlas o
// quitarlas, calcula el total y lleva al checkout.

document.addEventListener("DOMContentLoaded", pintar);

function pintar() {
    const zona = document.getElementById("contenido-carrito");
    zona.textContent = "";

    const detalle = detalleCarrito();

    if (detalle.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "carrito-vacio";
        vacio.textContent = "Tu carrito está vacío.";
        const volver = document.createElement("a");
        volver.className = "boton boton--secundario";
        volver.href = "index.html#productos";
        volver.textContent = "Ver productos";
        zona.append(vacio, volver);
        return;
    }

    const tabla = document.createElement("table");
    tabla.className = "tabla-carrito";
    tabla.innerHTML = `
        <thead>
            <tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Subtotal</th><th></th></tr>
        </thead>`;

    const cuerpo = document.createElement("tbody");

    detalle.forEach((item) => {
        const fila = document.createElement("tr");

        const celNombre = document.createElement("td");
        celNombre.setAttribute("data-titulo", "Producto");
        celNombre.textContent = item.nombre;

        const celPrecio = document.createElement("td");
        celPrecio.setAttribute("data-titulo", "Precio");
        celPrecio.textContent = formatearPrecio(item.precio);

        const celCantidad = document.createElement("td");
        celCantidad.setAttribute("data-titulo", "Cantidad");
        const control = document.createElement("div");
        control.className = "cantidad";
        const menos = botonCantidad("−", () => {
            cambiarCantidad(item.id, item.cantidad - 1);
            pintar();
        });
        const num = document.createElement("span");
        num.className = "cantidad__num";
        num.textContent = item.cantidad;
        const mas = botonCantidad("+", () => {
            cambiarCantidad(item.id, item.cantidad + 1);
            pintar();
        });
        control.append(menos, num, mas);
        celCantidad.appendChild(control);

        const celSubtotal = document.createElement("td");
        celSubtotal.setAttribute("data-titulo", "Subtotal");
        celSubtotal.textContent = formatearPrecio(item.subtotal);

        const celQuitar = document.createElement("td");
        const quitar = document.createElement("button");
        quitar.type = "button";
        quitar.className = "enlace-boton";
        quitar.textContent = "Quitar";
        quitar.addEventListener("click", () => {
            quitarDelCarrito(item.id);
            pintar();
        });
        celQuitar.appendChild(quitar);

        fila.append(celNombre, celPrecio, celCantidad, celSubtotal, celQuitar);
        cuerpo.appendChild(fila);
    });

    tabla.appendChild(cuerpo);

    const total = document.createElement("p");
    total.className = "carrito-total";
    total.textContent = "Total: " + formatearPrecio(totalCarrito());

    const acciones = document.createElement("div");
    acciones.className = "carrito-acciones";

    const seguir = document.createElement("a");
    seguir.className = "boton boton--secundario";
    seguir.href = "index.html#productos";
    seguir.textContent = "Seguir comprando";

    const vaciar = document.createElement("button");
    vaciar.type = "button";
    vaciar.className = "boton boton--secundario";
    vaciar.textContent = "Vaciar carrito";
    vaciar.addEventListener("click", () => {
        vaciarCarrito();
        pintar();
    });

    const pagar = document.createElement("a");
    pagar.className = "boton";
    pagar.href = "checkout.html";
    pagar.textContent = "Ir a pagar";

    acciones.append(seguir, vaciar, pagar);
    zona.append(tabla, total, acciones);
}

function botonCantidad(texto, alHacerClic) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "cantidad__boton";
    boton.textContent = texto;
    boton.addEventListener("click", alHacerClic);
    return boton;
}
