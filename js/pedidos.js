// Pedidos, pagos, boletas y anulación.
// Un pedido nace pendiente de pago. Al confirmarse el pago pasa a PAGADO y
// entra a la cola de despacho. El depósito queda por confirmar hasta que el
// cajero lo revise (eso vive en el panel de caja).

// Estados posibles de un pedido.
const ESTADOS = {
    PENDIENTE_PAGO: "Pendiente de pago",
    POR_CONFIRMAR: "Pago por confirmar",
    PAGADO: "Pagado",
    EN_PREPARACION: "En preparación",
    DESPACHADO: "Despachado",
    ANULADO: "Anulado"
};

const IVA = 0.19;

// Número correlativo, continuando desde los pedidos que ya existen.
function generarNumero() {
    const numeros = obtenerPedidos()
        .map((pedido) => Number(pedido.numero.replace("CH-", "")))
        .filter((n) => !isNaN(n));
    const mayor = numeros.length ? Math.max(...numeros) : 1000;
    return "CH-" + (mayor + 1);
}

function buscarPedido(numero) {
    return obtenerPedidos().find((pedido) => pedido.numero === numero);
}

function pedidosDeCliente(clienteId) {
    return obtenerPedidos()
        .filter((pedido) => pedido.clienteId === Number(clienteId))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

// Crea el pedido a partir del carrito. Guarda una copia de cada línea (nombre y
// precio del momento), para que la boleta no cambie si después se edita el catálogo.
function crearPedido({ clienteId, entrega, comuna, medioPago }) {
    const lineas = detalleCarrito().map((item) => ({
        id: item.id,
        nombre: item.nombre,
        precio: item.precio,
        cantidad: item.cantidad
    }));

    const pedido = {
        numero: generarNumero(),
        clienteId: Number(clienteId),
        fecha: new Date().toISOString(),
        estado: "PENDIENTE_PAGO",
        pago: medioPago,
        entrega,
        comuna: entrega === "delivery" ? comuna : "",
        motivoAnulacion: "",
        lineas
    };

    const pedidos = obtenerPedidos();
    pedidos.push(pedido);
    guardarPedidos(pedidos);
    return pedido;
}

function actualizarPedido(pedido) {
    const pedidos = obtenerPedidos().map((p) => (p.numero === pedido.numero ? pedido : p));
    guardarPedidos(pedidos);
}

// Pago con pasarela (Webpay/Servipag simulado): confirma al instante.
function confirmarPagoWebpay(numero) {
    const pedido = buscarPedido(numero);
    if (!pedido) return null;
    pedido.estado = "PAGADO";
    actualizarPedido(pedido);
    return pedido;
}

// Depósito bancario: queda a la espera de que el cajero lo confirme.
function registrarDeposito(numero) {
    const pedido = buscarPedido(numero);
    if (!pedido) return null;
    pedido.estado = "POR_CONFIRMAR";
    actualizarPedido(pedido);
    return pedido;
}

// Se puede anular mientras no haya entrado a preparación.
function puedeAnular(pedido) {
    return ["PENDIENTE_PAGO", "POR_CONFIRMAR", "PAGADO"].includes(pedido.estado);
}

function anularPedido(numero, motivo) {
    const pedido = buscarPedido(numero);
    if (!pedido) return { ok: false, mensaje: "No encontramos el pedido." };
    if (!puedeAnular(pedido)) return { ok: false, mensaje: "Este pedido ya no se puede anular." };
    if (!motivo.trim()) return { ok: false, mensaje: "Indica el motivo de la anulación." };

    pedido.estado = "ANULADO";
    pedido.motivoAnulacion = motivo.trim();
    actualizarPedido(pedido);
    return { ok: true, pedido };
}

function totalPedido(pedido) {
    return pedido.lineas.reduce((suma, linea) => suma + linea.precio * linea.cantidad, 0);
}

// Boleta: el total incluye IVA; se separa el neto y el IVA para mostrarlos.
function calcularBoleta(pedido) {
    const total = totalPedido(pedido);
    const neto = Math.round(total / (1 + IVA));
    const iva = total - neto;
    return { neto, iva, total };
}
