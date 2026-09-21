const PRODUCTOS = [
    {
        id: 1,
        nombre: "Chocolate Dubai",
        descripcion: "Barra de chocolate con leche rellena de crema de pistacho",
        precio: 8990,
        disponible: true,
        imagen: "img/chocolate-dubai.jpg"
    },
    {
        id: 2,
        nombre: "Chocolate blanco",
        descripcion: "Barra de chocolate blanco cremoso",
        precio: 4990,
        disponible: true,
        imagen: "img/chocolate-blanco.jpg"
    },
    {
        id: 3,
        nombre: "Bombones rellenos",
        descripcion: "Bombones de chocolate con centro de crema",
        precio: 6990,
        disponible: true,
        imagen: "img/bombones-rellenos.jpg"
    },
    {
        id: 4,
        nombre: "Bombones de caramelo",
        descripcion: "Bombones de chocolate oscuro rellenos de caramelo y nueces",
        precio: 7490,
        disponible: true,
        imagen: "img/bombones-de-caramelo.jpg"
    },
    {
        id: 5,
        nombre: "Trufas de chocolate",
        descripcion: "Trufas artesanales con cobertura de chocolate",
        precio: 5490,
        disponible: true,
        imagen: "img/trufas-de-chocolate.jpg"
    }
];

const formatoPrecio = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
});

function formatearPrecio(valor) {
    return formatoPrecio.format(valor);
}

function buscarProducto(id) {
    return PRODUCTOS.find((producto) => producto.id === id);
}

function crearTarjeta(producto) {
    const enlace = document.createElement("a");
    enlace.className = "tarjeta";
    enlace.href = "producto.html?id=" + producto.id;

    const foto = document.createElement("img");
    foto.className = "tarjeta__foto";
    foto.src = producto.imagen;
    foto.alt = "";
    foto.loading = "lazy";

    const nombre = document.createElement("span");
    nombre.className = "tarjeta__nombre";
    nombre.textContent = producto.nombre;

    const precio = document.createElement("span");
    precio.className = "tarjeta__precio";
    precio.textContent = formatearPrecio(producto.precio);

    enlace.append(foto, nombre, precio);
    return enlace;
}
