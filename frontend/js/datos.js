// Capa de datos de Chocomanía.
// No hay servidor: todo se guarda en localStorage y se conserva al recargar.
// La primera vez que se abre el sitio se cargan los datos de ejemplo.

const CLAVE_PRODUCTOS = "choco:productos";
const CLAVE_CLIENTES = "choco:clientes";
const CLAVE_USUARIOS = "choco:usuarios";
const CLAVE_PEDIDOS = "choco:pedidos";
const CLAVE_SEMILLA = "choco:semilla";

const CATEGORIAS = [
    { id: "barras", nombre: "Barras" },
    { id: "bombones", nombre: "Bombones" },
    { id: "trufas", nombre: "Trufas" }
];

const PRODUCTOS_INICIALES = [
    { id: 1, nombre: "Chocolate Dubai", categoria: "barras", descripcion: "Barra de chocolate con leche rellena de crema de pistacho", precio: 8990, disponible: true, imagen: "img/chocolate-dubai.jpg" },
    { id: 2, nombre: "Chocolate blanco", categoria: "barras", descripcion: "Barra de chocolate blanco cremoso", precio: 4990, disponible: true, imagen: "img/chocolate-blanco.jpg" },
    { id: 3, nombre: "Bombones rellenos", categoria: "bombones", descripcion: "Bombones de chocolate con centro de crema", precio: 6990, disponible: true, imagen: "img/bombones-rellenos.jpg" },
    { id: 4, nombre: "Bombones de caramelo", categoria: "bombones", descripcion: "Bombones de chocolate oscuro rellenos de caramelo y nueces", precio: 7490, disponible: true, imagen: "img/bombones-de-caramelo.jpg" },
    { id: 5, nombre: "Trufas de chocolate", categoria: "trufas", descripcion: "Trufas artesanales con cobertura de chocolate", precio: 5490, disponible: true, imagen: "img/trufas-de-chocolate.jpg" }
];

// Un usuario por cada perfil del caso (administrador, dueño, cajero, despacho).
const USUARIOS_INICIALES = [
    { id: 1, nombre: "Administrador", correo: "admin@chocomania.cl", clave: "Admin2026", perfil: "ADMIN" },
    { id: 2, nombre: "Dueña Chocomanía", correo: "dueno@chocomania.cl", clave: "Dueno2026", perfil: "DUENO" },
    { id: 3, nombre: "Cajero virtual", correo: "cajero@chocomania.cl", clave: "Cajero2026", perfil: "CAJERO" },
    { id: 4, nombre: "Encargado de despacho", correo: "despacho@chocomania.cl", clave: "Despacho2026", perfil: "DESPACHO" }
];

const CLIENTES_INICIALES = [
    { id: 1, run: "12.345.678-5", nombre: "Florencia Pacheco", direccion: "Av. Providencia 1234", comuna: "Providencia", provincia: "Santiago", region: "Región Metropolitana de Santiago", nacimiento: "1999-04-12", sexo: "F", correo: "cliente@correo.cl", telefono: "+56912345678", clave: "Cliente2026", verificado: true },
    { id: 2, run: "9.876.543-3", nombre: "Diego Rojas", direccion: "Los Leones 55", comuna: "Ñuñoa", provincia: "Santiago", region: "Región Metropolitana de Santiago", nacimiento: "1995-08-30", sexo: "M", correo: "diego@correo.cl", telefono: "+56987654321", clave: "Diego2026", verificado: true }
];

// Pedidos de ejemplo, para que el reporte de ventas no aparezca vacío.
function pedidosIniciales() {
    const hoy = new Date();
    function diasAtras(n) {
        const d = new Date(hoy);
        d.setDate(d.getDate() - n);
        return d.toISOString();
    }
    return [
        { numero: "CH-1001", clienteId: 1, fecha: diasAtras(12), estado: "DESPACHADO", pago: "webpay", entrega: "delivery", comuna: "Providencia", motivoAnulacion: "",
          lineas: [{ id: 1, nombre: "Chocolate Dubai", precio: 8990, cantidad: 2 }, { id: 5, nombre: "Trufas de chocolate", precio: 5490, cantidad: 1 }] },
        { numero: "CH-1002", clienteId: 2, fecha: diasAtras(8), estado: "DESPACHADO", pago: "deposito", entrega: "delivery", comuna: "Ñuñoa", motivoAnulacion: "",
          lineas: [{ id: 3, nombre: "Bombones rellenos", precio: 6990, cantidad: 3 }] },
        { numero: "CH-1003", clienteId: 1, fecha: diasAtras(3), estado: "PAGADO", pago: "webpay", entrega: "retiro", comuna: "", motivoAnulacion: "",
          lineas: [{ id: 4, nombre: "Bombones de caramelo", precio: 7490, cantidad: 1 }, { id: 2, nombre: "Chocolate blanco", precio: 4990, cantidad: 2 }] },
        { numero: "CH-1004", clienteId: 2, fecha: diasAtras(1), estado: "ANULADO", pago: "webpay", entrega: "delivery", comuna: "Las Condes", motivoAnulacion: "El cliente se arrepintió",
          lineas: [{ id: 5, nombre: "Trufas de chocolate", precio: 5490, cantidad: 2 }] }
    ];
}

function leer(clave, respaldo) {
    const texto = localStorage.getItem(clave);
    if (!texto) {
        return respaldo;
    }
    try {
        return JSON.parse(texto);
    } catch (error) {
        return respaldo;
    }
}

function guardar(clave, valor) {
    localStorage.setItem(clave, JSON.stringify(valor));
}

function cargarDatosDeEjemplo() {
    guardar(CLAVE_PRODUCTOS, PRODUCTOS_INICIALES);
    guardar(CLAVE_USUARIOS, USUARIOS_INICIALES);
    guardar(CLAVE_CLIENTES, CLIENTES_INICIALES);
    guardar(CLAVE_PEDIDOS, pedidosIniciales());
    guardar(CLAVE_SEMILLA, "1");
}

function inicializarDatos() {
    if (!localStorage.getItem(CLAVE_SEMILLA)) {
        cargarDatosDeEjemplo();
    }
}

// "Restaurar datos de ejemplo": borra todo y vuelve al estado inicial.
function restaurarDatosDeEjemplo() {
    cargarDatosDeEjemplo();
}

// --- Productos ---
function obtenerProductos() {
    return leer(CLAVE_PRODUCTOS, []);
}

function guardarProductos(productos) {
    guardar(CLAVE_PRODUCTOS, productos);
}

function buscarProducto(id) {
    return obtenerProductos().find((producto) => producto.id === Number(id));
}

function nombreCategoria(id) {
    const categoria = CATEGORIAS.find((cat) => cat.id === id);
    return categoria ? categoria.nombre : id;
}

// --- Clientes ---
function obtenerClientes() {
    return leer(CLAVE_CLIENTES, []);
}

function guardarClientes(clientes) {
    guardar(CLAVE_CLIENTES, clientes);
}

// --- Usuarios (personal) ---
function obtenerUsuarios() {
    return leer(CLAVE_USUARIOS, []);
}

function guardarUsuarios(usuarios) {
    guardar(CLAVE_USUARIOS, usuarios);
}

// --- Pedidos ---
function obtenerPedidos() {
    return leer(CLAVE_PEDIDOS, []);
}

function guardarPedidos(pedidos) {
    guardar(CLAVE_PEDIDOS, pedidos);
}

// Un id nuevo para clientes, usuarios, etc.
function siguienteId(lista) {
    return lista.reduce((mayor, item) => Math.max(mayor, item.id), 0) + 1;
}

inicializarDatos();
