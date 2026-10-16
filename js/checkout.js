// Checkout: exige sesión de cliente. Muestra el resumen, deja elegir entrega
// (despacho solo si la comuna está en el radio de 3 km) y medio de pago, y
// crea el pedido antes de ir a la pantalla de pago.

document.addEventListener("DOMContentLoaded", () => {
    const sesion = exigirCliente();
    if (!sesion) return;

    // Carrito vacío: no hay nada que pagar.
    if (detalleCarrito().length === 0) {
        window.location.href = "carrito.html";
        return;
    }

    const cliente = obtenerClientes().find((cli) => cli.id === sesion.id);

    // Resumen de productos y total.
    const resumen = document.getElementById("resumen");
    const lista = document.createElement("ul");
    lista.className = "resumen-compra__lista";
    detalleCarrito().forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item.cantidad + " × " + item.nombre;
        const precio = document.createElement("span");
        precio.textContent = formatearPrecio(item.subtotal);
        li.appendChild(precio);
        lista.appendChild(li);
    });
    const total = document.createElement("p");
    total.className = "resumen-compra__total";
    total.textContent = "Total: " + formatearPrecio(totalCarrito());
    resumen.append(lista, total);

    // Opciones de entrega según la cobertura de la comuna del cliente.
    const zonaEntrega = document.getElementById("opciones-entrega");
    const nota = document.getElementById("nota-despacho");
    const cubierta = tieneDespacho(cliente.comuna);

    const delivery = document.createElement("label");
    delivery.className = "opcion";
    delivery.innerHTML = `<input type="radio" name="entrega" value="delivery">
        <span>Despacho a domicilio — ${cliente.comuna}</span>`;
    const inputDelivery = delivery.querySelector("input");

    const retiro = document.createElement("label");
    retiro.className = "opcion";
    retiro.innerHTML = `<input type="radio" name="entrega" value="retiro">
        <span>Retiro en el local</span>`;

    if (cubierta) {
        inputDelivery.checked = true;
        nota.textContent = "El despacho es gratis dentro de 3 km del local.";
    } else {
        inputDelivery.disabled = true;
        retiro.querySelector("input").checked = true;
        nota.textContent = "Tu comuna (" + cliente.comuna + ") está fuera del radio de despacho de 3 km. Solo puedes retirar en el local.";
    }

    zonaEntrega.append(delivery, retiro);

    // Enviar: crea el pedido y va al pago.
    const form = document.getElementById("form-checkout");
    const error = document.getElementById("error");

    form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        error.textContent = "";

        const entrega = form.entrega.value;
        const medioPago = form.pago.value;

        if (!entrega) {
            error.textContent = "Elige cómo quieres recibir el pedido.";
            return;
        }

        const pedido = crearPedido({
            clienteId: cliente.id,
            entrega,
            comuna: cliente.comuna,
            medioPago
        });

        window.location.href = "pago.html?numero=" + pedido.numero;
    });
});
