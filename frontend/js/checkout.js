// Checkout: exige sesión de cliente. Muestra el resumen, pide la entrega y crea
// el pedido en el servidor (S11). El precio y el total los calcula el servidor.

document.addEventListener("DOMContentLoaded", async () => {
    const sesion = exigirCliente();
    if (!sesion) return;

    const resumen = document.getElementById("resumen");
    mostrarEstado(resumen, "cargando", "Cargando tu pedido…");
    const catalogo = await catalogoListo;
    if (!catalogo.ok) {
        mostrarError(resumen, catalogo);
        document.getElementById("form-checkout").hidden = true;
        return;
    }
    resumen.textContent = "";

    // Carrito vacío: no hay nada que pagar.
    const detalle = detalleCarrito();
    if (detalle.length === 0) {
        window.location.href = "carrito.html";
        return;
    }

    // Resumen de productos y total estimado (el definitivo lo devuelve el servidor).
    const lista = document.createElement("ul");
    lista.className = "resumen-compra__lista";
    detalle.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item.cantidad + " × " + item.nombre;
        const precio = document.createElement("span");
        precio.textContent = formatearPrecio(item.subtotal);
        li.appendChild(precio);
        lista.appendChild(li);
    });
    const total = document.createElement("p");
    total.className = "resumen-compra__total";
    total.textContent = "Total estimado: " + formatearPrecio(totalCarrito());
    resumen.append(lista, total);

    // Entrega: despacho (con dirección y comuna) o retiro en el local.
    // El perfil del cliente no está conectado en la U2, por eso la dirección se pide aquí.
    const zonaEntrega = document.getElementById("opciones-entrega");
    const nota = document.getElementById("nota-despacho");
    zonaEntrega.innerHTML = `
        <label class="opcion"><input type="radio" name="entrega" value="delivery" checked>
            <span>Despacho a domicilio</span></label>
        <div id="datos-despacho" class="grupo__campos">
            <label for="direccion">Dirección</label>
            <input id="direccion" type="text" maxlength="120" autocomplete="street-address">
            <label for="comuna">Comuna</label>
            <select id="comuna"></select>
        </div>
        <label class="opcion"><input type="radio" name="entrega" value="retiro">
            <span>Retiro en el local</span></label>`;
    nota.textContent = "El despacho es gratis dentro de 3 km del local (" + COMUNAS_CON_DESPACHO.join(", ") + ").";

    const selectComuna = document.getElementById("comuna");
    COMUNAS_CON_DESPACHO.forEach((comuna) => {
        const opcion = document.createElement("option");
        opcion.value = comuna;
        opcion.textContent = comuna;
        selectComuna.appendChild(opcion);
    });
    const datosDespacho = document.getElementById("datos-despacho");
    zonaEntrega.querySelectorAll("input[name=entrega]").forEach((radio) => {
        radio.addEventListener("change", () => {
            datosDespacho.hidden = radio.value === "retiro" && radio.checked;
        });
    });

    // El depósito necesita el panel del cajero, que no está en la U2.
    const deposito = document.querySelector("input[name=pago][value=deposito]");
    if (deposito) {
        deposito.disabled = true;
        deposito.closest("label").title = "No disponible en esta versión";
    }

    const form = document.getElementById("form-checkout");
    const error = document.getElementById("error");
    const boton = form.querySelector("button[type=submit]");

    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        error.textContent = "";

        const entrega = form.entrega.value;
        let despacho;
        if (entrega === "delivery") {
            const direccion = document.getElementById("direccion").value.trim();
            if (direccion.length < 3) {
                error.textContent = "Escribe la dirección de despacho.";
                return;
            }
            despacho = { direccion, comuna: selectComuna.value };
        } else {
            despacho = { direccion: "Retiro en el local", comuna: "Providencia" };
        }

        const cuerpo = {
            lineas: detalleCarrito().map((item) => ({ producto_id: String(item.id), cantidad: item.cantidad })),
            despacho
        };

        // La misma clave mientras no se cree el pedido: un doble clic o un reintento no duplica.
        const nombreClave = "pedido:" + JSON.stringify(cuerpo);

        boton.disabled = true;
        boton.textContent = "Creando pedido…";
        const resultado = await apiFetch("/api/v1/pedidos", {
            method: "POST", body: cuerpo, idempotencyKey: claveIdempotencia(nombreClave)
        });
        boton.disabled = false;
        boton.textContent = "Continuar al pago";

        if (!resultado.ok) {
            if (manejarSesionExpirada(resultado)) return;
            escribirError(error, resultado);
            return;
        }

        olvidarClaveIdempotencia(nombreClave);
        window.location.href = "pago.html?numero=" + encodeURIComponent(resultado.data.id);
    });
});
