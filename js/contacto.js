// Formulario de contacto. Sin servidor, así que solo valida y muestra una
// confirmación (en un sistema real, el mensaje se enviaría por correo).

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form-contacto");
    const error = document.getElementById("error");
    const exito = document.getElementById("exito");

    form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        error.textContent = "";
        exito.textContent = "";

        if (!form.nombre.value.trim() || !form.correo.value.trim() || !form.mensaje.value.trim()) {
            error.textContent = "Completa todos los campos.";
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.value)) {
            error.textContent = "El correo no es válido.";
            return;
        }

        form.reset();
        exito.textContent = "¡Gracias! Recibimos tu mensaje y te responderemos pronto.";
    });
});
