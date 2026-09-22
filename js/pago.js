// Pantalla de pago. Simula la plataforma externa: si el pedido eligió Webpay,
// se confirma al instante y se emite la boleta; si eligió depósito, muestra los
// datos y el pago queda por confirmar por el cajero.

document.addEventListener("DOMContentLoaded", () => {
    const sesion = exigirCliente();
    if (!sesion) return;

    const numero = new URLSearchParams(window.location.search).get("numero");
    const pedido = buscarPedido(numero);
    const zona = document.getElementById("pago");

    if (!pedido) {
        zona.innerHTML = `<h1>Pedido no encontrado</h1>
            <p class="tarjeta-form__intro">Ese pedido no existe.</p>
            <a class="boton" href="mis-pedidos.html">Ver mis pedidos</a>`;
        return;
    }

    const { total } = calcularBoleta(pedido);

    if (pedido.pago === "webpay") {
        pintarWebpay(zona, pedido, total);
    } else {
        pintarDeposito(zona, pedido, total);
    }
});

function pintarWebpay(zona, pedido, total) {
    zona.innerHTML = `
        <h1>Pago en línea</h1>
        <p class="tarjeta-form__intro">Pedido ${pedido.numero}</p>
        <div class="pasarela">
            <p class="pasarela__aviso">Pantalla simulada de Webpay. No se hace ningún cobro real.</p>
            <p class="pasarela__monto">${formatearPrecio(total)}</p>
        </div>
        <button type="button" class="boton" id="btn-pagar">Pagar ahora</button>`;

    document.getElementById("btn-pagar").addEventListener("click", () => {
        confirmarPagoWebpay(pedido.numero);
        vaciarCarrito();
        window.location.href = "boleta.html?numero=" + pedido.numero;
    });
}

function pintarDeposito(zona, pedido, total) {
    zona.innerHTML = `
        <h1>Depósito bancario</h1>
        <p class="tarjeta-form__intro">Pedido ${pedido.numero}</p>
        <div class="pasarela">
            <p><strong>Banco:</strong> Banco Ejemplo</p>
            <p><strong>Cuenta corriente:</strong> 000-1234-5678</p>
            <p><strong>RUT:</strong> 76.000.000-0</p>
            <p><strong>Correo:</strong> pagos@chocomania.cl</p>
            <p><strong>Monto:</strong> ${formatearPrecio(total)}</p>
        </div>
        <p class="tarjeta-form__intro">Cuando el cajero confirme tu depósito, tu pedido pasa a preparación y recibes la boleta.</p>
        <button type="button" class="boton" id="btn-deposito">Ya hice el depósito</button>`;

    document.getElementById("btn-deposito").addEventListener("click", () => {
        registrarDeposito(pedido.numero);
        vaciarCarrito();
        alert("Registramos tu depósito. Queda a la espera de que el cajero lo confirme.");
        window.location.href = "mis-pedidos.html";
    });
}
