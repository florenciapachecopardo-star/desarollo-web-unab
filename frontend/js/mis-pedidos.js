// Historial de pedidos del cliente, leído con GraphQL (S18, query misPedidos):
// junta los pedidos (orders) con el estado actual de cada producto (inventory).
// Si inventory no responde, GraphQL devuelve los pedidos igual y avisa en "errors":
// aquí se muestra un aviso en vez de presentar los datos como completos.

const CONSULTA_MIS_PEDIDOS = `
query MisPedidos($pagina: Int!) {
  misPedidos(pagina: $pagina, porPagina: 10) {
    total
    items {
      id estado total creadoEn
      boleta { numero }
      lineas { nombre cantidad producto { disponible } }
    }
  }
}`;

document.addEventListener("DOMContentLoaded", pintar);

async function pintar() {
    const sesion = exigirCliente();
    if (!sesion) return;

    const zona = document.getElementById("lista-pedidos");
    mostrarEstado(zona, "cargando", "Cargando tus pedidos…");

    const resultado = await apiFetch("/api/v1/graphql", {
        method: "POST",
        body: { query: CONSULTA_MIS_PEDIDOS, variables: { pagina: 1 } }
    });

    if (!resultado.ok) {
        if (manejarSesionExpirada(resultado)) return;
        mostrarError(zona, resultado);
        return;
    }

    const respuesta = resultado.data || {};
    const datos = respuesta.data && respuesta.data.misPedidos;
    if (!datos) {
        // Error completo: GraphQL no pudo devolver los pedidos
        const primero = (respuesta.errors || [])[0] || {};
        mostrarEstado(zona, "error", primero.message || "No pudimos cargar tus pedidos.", resultado.requestId);
        return;
    }

    zona.textContent = "";

    // Error parcial: hay pedidos, pero faltó información de algún servicio
    if (respuesta.errors && respuesta.errors.length > 0) {
        const aviso = document.createElement("div");
        zona.appendChild(aviso);
        mostrarEstado(aviso, "aviso",
            "Algunos datos de los productos no están disponibles en este momento. Los pedidos y sus montos sí están al día.",
            resultado.requestId);
    }

    if (datos.items.length === 0) {
        const vacio = document.createElement("p");
        vacio.textContent = "Todavía no tienes pedidos.";
        const enlace = document.createElement("a");
        enlace.className = "boton boton--secundario";
        enlace.href = "index.html#productos";
        enlace.textContent = "Ver productos";
        zona.append(vacio, enlace);
        return;
    }

    // Los más nuevos primero
    datos.items.slice().reverse().forEach((pedido) => zona.appendChild(tarjetaPedido(pedido)));
}

function tarjetaPedido(pedido) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "pedido";

    const productos = pedido.lineas.map((l) => {
        const agotado = l.producto && !l.producto.disponible ? " (hoy agotado)" : "";
        return l.cantidad + " × " + l.nombre + agotado;
    }).join(", ");

    const cabecera = document.createElement("div");
    cabecera.className = "pedido__cabecera";
    cabecera.innerHTML = `
        <span class="pedido__numero">${pedido.id}</span>
        <span class="pedido__estado pedido__estado--${pedido.estado.toLowerCase()}">${ESTADOS[pedido.estado] || pedido.estado}</span>`;

    const cuerpo = document.createElement("div");
    cuerpo.className = "pedido__cuerpo";
    const resumen = document.createElement("p");
    resumen.textContent = formatearFecha(pedido.creadoEn) + " — " + formatearPrecio(pedido.total);
    const detalle = document.createElement("p");
    detalle.className = "pedido__productos";
    detalle.textContent = productos;
    cuerpo.append(resumen, detalle);

    const acciones = document.createElement("div");
    acciones.className = "pedido__acciones";

    if (pedido.boleta) {
        const boleta = document.createElement("a");
        boleta.className = "enlace-boton";
        boleta.href = "boleta.html?numero=" + encodeURIComponent(pedido.id);
        boleta.textContent = "Ver boleta " + pedido.boleta.numero;
        acciones.appendChild(boleta);
    }

    if (pedido.estado === "PENDIENTE_PAGO") {
        const pagar = document.createElement("a");
        pagar.className = "enlace-boton";
        pagar.href = "pago.html?numero=" + encodeURIComponent(pedido.id);
        pagar.textContent = "Pagar";

        // Solo se puede anular mientras está pendiente de pago (regla del servidor)
        const anular = document.createElement("button");
        anular.type = "button";
        anular.className = "enlace-boton enlace-boton--peligro";
        anular.textContent = "Anular";
        anular.addEventListener("click", () => mostrarFormAnular(tarjeta, pedido));
        acciones.append(pagar, anular);
    }

    tarjeta.append(cabecera, cuerpo, acciones);
    return tarjeta;
}

// Formulario en línea para anular: pide el motivo y lo manda al servidor (S13).
function mostrarFormAnular(tarjeta, pedido) {
    if (tarjeta.querySelector(".form-anular")) return;

    const form = document.createElement("form");
    form.className = "form-anular";
    form.innerHTML = `
        <label for="motivo-${pedido.id}">Motivo de la anulación</label>
        <textarea id="motivo-${pedido.id}" rows="2" required maxlength="200"></textarea>
        <p class="form-error" role="alert"></p>
        <div class="form-anular__acciones">
            <button type="submit" class="boton boton--peligro">Confirmar anulación</button>
            <button type="button" class="boton boton--secundario" data-cancelar>Volver</button>
        </div>`;

    const error = form.querySelector(".form-error");
    const textarea = form.querySelector("textarea");
    const boton = form.querySelector("button[type=submit]");

    form.querySelector("[data-cancelar]").addEventListener("click", () => form.remove());

    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        error.textContent = "";
        if (textarea.value.trim().length < 3) {
            error.textContent = "Indica el motivo de la anulación.";
            return;
        }
        boton.disabled = true;
        const resultado = await apiFetch("/api/v1/pedidos/" + encodeURIComponent(pedido.id) + "/anular", {
            method: "POST",
            body: { motivo: textarea.value.trim() }
        });
        boton.disabled = false;
        if (!resultado.ok) {
            if (manejarSesionExpirada(resultado)) return;
            escribirError(error, resultado);
            return;
        }
        pintar();
    });

    tarjeta.appendChild(form);
    textarea.focus();
}
