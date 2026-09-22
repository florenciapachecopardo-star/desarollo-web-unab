// Historial de pedidos del cliente. Muestra el estado, permite ver la boleta
// (cuando el pago está confirmado) y anular indicando el motivo.

document.addEventListener("DOMContentLoaded", pintar);

function pintar() {
    const sesion = exigirCliente();
    if (!sesion) return;

    const zona = document.getElementById("lista-pedidos");
    zona.textContent = "";

    const pedidos = pedidosDeCliente(sesion.id);

    if (pedidos.length === 0) {
        const vacio = document.createElement("p");
        vacio.textContent = "Todavía no tienes pedidos.";
        const enlace = document.createElement("a");
        enlace.className = "boton boton--secundario";
        enlace.href = "index.html#productos";
        enlace.textContent = "Ver productos";
        zona.append(vacio, enlace);
        return;
    }

    pedidos.forEach((pedido) => zona.appendChild(tarjetaPedido(pedido)));
}

function tarjetaPedido(pedido) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "pedido";

    const total = pedido.lineas.reduce((suma, l) => suma + l.precio * l.cantidad, 0);
    const productos = pedido.lineas.map((l) => l.cantidad + " × " + l.nombre).join(", ");

    const cabecera = document.createElement("div");
    cabecera.className = "pedido__cabecera";
    cabecera.innerHTML = `
        <span class="pedido__numero">${pedido.numero}</span>
        <span class="pedido__estado pedido__estado--${pedido.estado.toLowerCase()}">${ESTADOS[pedido.estado]}</span>`;

    const cuerpo = document.createElement("div");
    cuerpo.className = "pedido__cuerpo";
    cuerpo.innerHTML = `
        <p>${formatearFecha(pedido.fecha)} — ${formatearPrecio(total)}</p>
        <p class="pedido__productos">${productos}</p>`;

    if (pedido.estado === "ANULADO" && pedido.motivoAnulacion) {
        const motivo = document.createElement("p");
        motivo.className = "pedido__motivo";
        motivo.textContent = "Motivo de anulación: " + pedido.motivoAnulacion;
        cuerpo.appendChild(motivo);
    }

    const acciones = document.createElement("div");
    acciones.className = "pedido__acciones";

    // Boleta disponible una vez confirmado el pago.
    if (["PAGADO", "EN_PREPARACION", "DESPACHADO"].includes(pedido.estado)) {
        const boleta = document.createElement("a");
        boleta.className = "enlace-boton";
        boleta.href = "boleta.html?numero=" + pedido.numero;
        boleta.textContent = "Ver boleta";
        acciones.appendChild(boleta);
    }

    // Si el pago quedó pendiente, permite retomarlo.
    if (pedido.estado === "PENDIENTE_PAGO") {
        const pagar = document.createElement("a");
        pagar.className = "enlace-boton";
        pagar.href = "pago.html?numero=" + pedido.numero;
        pagar.textContent = "Pagar";
        acciones.appendChild(pagar);
    }

    // Anulación con motivo, cuando corresponde.
    if (puedeAnular(pedido)) {
        const anular = document.createElement("button");
        anular.type = "button";
        anular.className = "enlace-boton enlace-boton--peligro";
        anular.textContent = "Anular";
        anular.addEventListener("click", () => mostrarFormAnular(tarjeta, pedido));
        acciones.appendChild(anular);
    }

    tarjeta.append(cabecera, cuerpo, acciones);
    return tarjeta;
}

// Formulario en línea para anular: pide el motivo.
function mostrarFormAnular(tarjeta, pedido) {
    if (tarjeta.querySelector(".form-anular")) return;

    const form = document.createElement("form");
    form.className = "form-anular";
    form.innerHTML = `
        <label for="motivo-${pedido.numero}">Motivo de la anulación</label>
        <textarea id="motivo-${pedido.numero}" rows="2" required></textarea>
        <p class="form-error" role="alert"></p>
        <div class="form-anular__acciones">
            <button type="submit" class="boton boton--peligro">Confirmar anulación</button>
            <button type="button" class="boton boton--secundario" data-cancelar>Volver</button>
        </div>`;

    const error = form.querySelector(".form-error");
    const textarea = form.querySelector("textarea");

    form.querySelector("[data-cancelar]").addEventListener("click", () => form.remove());

    form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        const resultado = anularPedido(pedido.numero, textarea.value);
        if (!resultado.ok) {
            error.textContent = resultado.mensaje;
            return;
        }
        pintar();
    });

    tarjeta.appendChild(form);
    textarea.focus();
}
