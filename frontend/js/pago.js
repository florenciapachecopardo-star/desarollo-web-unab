// Pantalla de pago. Lee el pedido del servidor (S12) y paga con el proveedor
// simulado a través de payments (S16). El éxito solo se muestra cuando el
// servidor lo confirma.

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = exigirCliente();
    if (!sesion) return;

    const numero = new URLSearchParams(window.location.search).get("numero");
    const zona = document.getElementById("pago");
    mostrarEstado(zona, "cargando", "Cargando el pedido…");

    const resultado = await apiFetch("/api/v1/pedidos/" + encodeURIComponent(numero || ""));
    if (!resultado.ok) {
        if (manejarSesionExpirada(resultado)) return;
        if (resultado.status === 404) {
            zona.innerHTML = `<h1>Pedido no encontrado</h1>
                <p class="tarjeta-form__intro">Ese pedido no existe.</p>
                <a class="boton" href="mis-pedidos.html">Ver mis pedidos</a>`;
            return;
        }
        mostrarError(zona, resultado);
        return;
    }

    const pedido = resultado.data;
    if (pedido.estado !== "PENDIENTE_PAGO") {
        zona.innerHTML = `<h1>Este pedido ya no está pendiente de pago</h1>
            <p class="tarjeta-form__intro">Estado actual: ${ESTADOS[pedido.estado] || pedido.estado}</p>
            <a class="boton" href="mis-pedidos.html">Ver mis pedidos</a>`;
        return;
    }
    pintarPasarela(zona, pedido);
});

function pintarPasarela(zona, pedido) {
    zona.innerHTML = `
        <h1>Pago en línea</h1>
        <p class="tarjeta-form__intro">Pedido ${pedido.id}</p>
        <div class="pasarela">
            <p class="pasarela__aviso">Proveedor de pagos simulado. No se hace ningún cobro real y no se piden datos de tarjeta.</p>
            <p class="pasarela__monto">${formatearPrecio(pedido.total)}</p>
        </div>
        <p class="form-error" id="error-pago" role="alert"></p>
        <button type="button" class="boton" id="btn-pagar">Pagar ahora</button>`;

    const boton = document.getElementById("btn-pagar");
    const error = document.getElementById("error-pago");

    boton.addEventListener("click", async () => {
        error.textContent = "";
        boton.disabled = true;
        boton.textContent = "Procesando pago…";

        // Misma clave para este pedido hasta que el pago termine: doble clic = un solo pago
        const nombreClave = "pago:" + pedido.id;
        const resultado = await apiFetch("/api/v1/pagos", {
            method: "POST",
            body: { pedido_id: pedido.id },
            idempotencyKey: claveIdempotencia(nombreClave)
        });

        boton.disabled = false;
        boton.textContent = "Pagar ahora";

        if (!resultado.ok) {
            if (manejarSesionExpirada(resultado)) return;
            escribirError(error, resultado);
            return;
        }

        const pago = resultado.data;
        if (pago.estado === "RECHAZADO") {
            olvidarClaveIdempotencia(nombreClave); // el próximo intento es un pago nuevo
            escribirError(error, { error: { message: "El pago fue rechazado. Puedes intentar de nuevo." }, requestId: resultado.requestId });
            return;
        }
        if (pago.estado === "PENDIENTE") {
            mostrarEstado(zona, "info", "Tu pago está en proceso. Cuando el proveedor lo confirme, lo verás en Mis pedidos.", resultado.requestId);
            return;
        }

        olvidarClaveIdempotencia(nombreClave);
        vaciarCarrito();
        if (pago.estado === "APROBADO" && pago.pedido_sincronizado === false) {
            // El pago se aprobó, pero orders todavía no lo registra (payments reintenta solo)
            mostrarEstado(zona, "info", "Tu pago fue aprobado. Estamos confirmando tu pedido; en unos segundos lo verás como Pagado en Mis pedidos.", resultado.requestId);
            return;
        }
        window.location.href = "boleta.html?numero=" + encodeURIComponent(pedido.id);
    });
}
