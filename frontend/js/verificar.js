// Verificación de correo (S09V). El código lo genera el servidor; como no hay
// servicio de mensajería, la pantalla muestra el "correo" que habría llegado.
// Hasta verificar, la cuenta queda inactiva en auth y no puede iniciar sesión.

document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(window.location.search).get("id");
    const error = document.getElementById("error");
    const form = document.getElementById("form-verificar");
    const codigoSimulado = sessionStorage.getItem("choco:codigo-simulado");

    if (!id) {
        error.textContent = "No encontramos la cuenta.";
        form.hidden = true;
        return;
    }

    if (codigoSimulado) {
        document.getElementById("codigo-mostrado").textContent = codigoSimulado;
    } else {
        document.querySelector(".correo-simulado").hidden = true;
    }

    const boton = form.querySelector("button[type=submit]");

    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        error.textContent = "";

        const codigo = form.codigo.value.trim();
        if (!/^[0-9]{6}$/.test(codigo)) {
            error.textContent = "Escribe el código de 6 dígitos.";
            return;
        }

        if (boton) boton.disabled = true;
        const resultado = await verificarCorreoApi(id, codigo);
        if (boton) boton.disabled = false;

        if (!resultado.ok) {
            escribirError(error, resultado);
            return;
        }

        sessionStorage.removeItem("choco:codigo-simulado");
        window.location.href = "login.html?verificado=1";
    });
});
