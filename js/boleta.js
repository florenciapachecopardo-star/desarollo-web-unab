// Boleta digital. La ve el cliente dueño del pedido y también el personal.
// Muestra el detalle con neto e IVA y se puede imprimir o guardar como PDF.

document.addEventListener("DOMContentLoaded", () => {
    const sesion = sesionActual();
    if (!sesion) {
        window.location.href = "login.html";
        return;
    }

    const numero = new URLSearchParams(window.location.search).get("numero");
    const pedido = buscarPedido(numero);
    const zona = document.getElementById("boleta");

    if (!pedido) {
        zona.innerHTML = "<h1>Boleta no encontrada</h1><p>Ese pedido no existe.</p>";
        return;
    }

    const cliente = obtenerClientes().find((cli) => cli.id === pedido.clienteId);
    const { neto, iva, total } = calcularBoleta(pedido);

    const filas = pedido.lineas.map((linea) => `
        <tr>
            <td data-titulo="Producto">${linea.nombre}</td>
            <td data-titulo="Cantidad">${linea.cantidad}</td>
            <td data-titulo="Precio">${formatearPrecio(linea.precio)}</td>
            <td data-titulo="Subtotal">${formatearPrecio(linea.precio * linea.cantidad)}</td>
        </tr>`).join("");

    const entrega = pedido.entrega === "delivery"
        ? "Despacho a domicilio — " + pedido.comuna
        : "Retiro en el local";

    zona.innerHTML = `
        <div class="boleta__cabecera">
            <div>
                <p class="boleta__marca">Chocomanía</p>
                <p>Boleta electrónica (simulada)</p>
            </div>
            <div class="boleta__numero">
                <p><strong>${pedido.numero}</strong></p>
                <p>${formatearFecha(pedido.fecha)}</p>
            </div>
        </div>

        <div class="boleta__cliente">
            <p><strong>Cliente:</strong> ${cliente ? cliente.nombre : "—"}</p>
            <p><strong>RUN:</strong> ${cliente ? cliente.run : "—"}</p>
            <p><strong>Entrega:</strong> ${entrega}</p>
            <p><strong>Estado:</strong> ${ESTADOS[pedido.estado]}</p>
        </div>

        <table class="tabla-boleta">
            <thead>
                <tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>

        <div class="boleta__totales">
            <p><span>Neto</span> <span>${formatearPrecio(neto)}</span></p>
            <p><span>IVA (19%)</span> <span>${formatearPrecio(iva)}</span></p>
            <p class="boleta__total"><span>Total</span> <span>${formatearPrecio(total)}</span></p>
        </div>`;

    document.getElementById("btn-imprimir").addEventListener("click", () => window.print());
});
