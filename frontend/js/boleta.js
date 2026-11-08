// Boleta digital. La emite orders cuando payments confirma el pago (R08 parcial,
// sin envío por correo). Se lee del servidor (S12): el cliente solo ve las suyas.

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = exigirCliente();
    if (!sesion) return;

    const numero = new URLSearchParams(window.location.search).get("numero");
    const zona = document.getElementById("boleta");
    mostrarEstado(zona, "cargando", "Cargando la boleta…");

    const resultado = await apiFetch("/api/v1/pedidos/" + encodeURIComponent(numero || ""));
    if (!resultado.ok) {
        if (manejarSesionExpirada(resultado)) return;
        if (resultado.status === 404) {
            zona.innerHTML = "<h1>Boleta no encontrada</h1><p>Ese pedido no existe.</p>";
            return;
        }
        mostrarError(zona, resultado);
        return;
    }

    const pedido = resultado.data;
    if (!pedido.boleta) {
        mostrarEstado(zona, "info", "Este pedido todavía no tiene boleta: se emite cuando el pago queda confirmado.", resultado.requestId);
        return;
    }
    const boleta = pedido.boleta;

    const filas = pedido.lineas.map((linea) => `
        <tr>
            <td data-titulo="Producto">${linea.nombre}</td>
            <td data-titulo="Cantidad">${linea.cantidad}</td>
            <td data-titulo="Precio">${formatearPrecio(linea.precio_unitario)}</td>
            <td data-titulo="Subtotal">${formatearPrecio(linea.subtotal)}</td>
        </tr>`).join("");

    const despacho = pedido.despacho || {};
    const entrega = despacho.direccion === "Retiro en el local"
        ? "Retiro en el local"
        : "Despacho a domicilio — " + (despacho.comuna || "");

    zona.innerHTML = `
        <div class="boleta__cabecera">
            <div>
                <p class="boleta__marca">Chocomanía</p>
                <p>Boleta electrónica (simulada)</p>
            </div>
            <div class="boleta__numero">
                <p><strong>${boleta.numero}</strong></p>
                <p>${formatearFecha(boleta.fecha)}</p>
            </div>
        </div>

        <div class="boleta__cliente">
            <p><strong>Cliente:</strong> ${sesion.nombre}</p>
            <p><strong>Pedido:</strong> ${pedido.id}</p>
            <p><strong>Entrega:</strong> ${entrega}</p>
            <p><strong>Estado:</strong> ${ESTADOS[pedido.estado] || pedido.estado}</p>
        </div>

        <table class="tabla-boleta">
            <thead>
                <tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>

        <div class="boleta__totales">
            <p><span>Neto</span> <span>${formatearPrecio(boleta.neto)}</span></p>
            <p><span>IVA (19%)</span> <span>${formatearPrecio(boleta.iva)}</span></p>
            <p class="boleta__total"><span>Total</span> <span>${formatearPrecio(boleta.total)}</span></p>
        </div>`;

    document.getElementById("btn-imprimir").addEventListener("click", () => window.print());
});
