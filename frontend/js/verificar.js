// Verificación de correo (simulada). Muestra el código que "llegó" y activa la
// cuenta si coincide. Sin verificar, el cliente no puede comprar.

document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(window.location.search).get("id");
    const cliente = obtenerClientes().find((cli) => cli.id === Number(id));
    const error = document.getElementById("error");
    const form = document.getElementById("form-verificar");

    if (!cliente) {
        error.textContent = "No encontramos la cuenta.";
        form.hidden = true;
        return;
    }

    if (cliente.verificado) {
        document.querySelector(".tarjeta-form__intro").textContent = "Esta cuenta ya está verificada.";
        document.querySelector(".correo-simulado").hidden = true;
        form.hidden = true;
        const enlace = document.createElement("a");
        enlace.className = "boton";
        enlace.href = "login.html";
        enlace.textContent = "Ir a ingresar";
        document.querySelector(".tarjeta-form").appendChild(enlace);
        return;
    }

    document.getElementById("codigo-mostrado").textContent = cliente.codigo;

    form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        error.textContent = "";

        const codigo = form.codigo.value.trim();
        if (!codigo) {
            error.textContent = "Escribe el código.";
            return;
        }

        const resultado = verificarCorreo(cliente.id, codigo);
        if (!resultado.ok) {
            error.textContent = resultado.mensaje;
            return;
        }

        alert("¡Correo verificado! Ya puedes ingresar.");
        window.location.href = "login.html";
    });
});
