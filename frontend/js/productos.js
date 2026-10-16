// Construye las tarjetas de producto que se ven en el inicio y en la ficha.
// Lee el catálogo desde la capa de datos (datos.js), no desde un arreglo fijo.

function crearTarjeta(producto) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta";
    if (!producto.disponible) {
        tarjeta.classList.add("tarjeta--agotado");
    }

    const enlace = document.createElement("a");
    enlace.className = "tarjeta__enlace";
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
    tarjeta.appendChild(enlace);

    if (producto.disponible) {
        const boton = document.createElement("button");
        boton.className = "tarjeta__agregar";
        boton.type = "button";
        boton.textContent = "Agregar";
        boton.addEventListener("click", () => {
            agregarAlCarrito(producto.id);
            boton.textContent = "Agregado";
            setTimeout(() => {
                boton.textContent = "Agregar";
            }, 1200);
        });
        tarjeta.appendChild(boton);
    } else {
        const agotado = document.createElement("span");
        agotado.className = "tarjeta__estado";
        agotado.textContent = "Agotado";
        tarjeta.appendChild(agotado);
    }

    return tarjeta;
}
