// Pantalla de ingreso. Inicia sesión contra el servidor (S06 y S08) y redirige
// según el perfil. Muestra las cuentas de prueba y permite completarlas con un clic.

const CUENTAS_PRUEBA = [
    { etiqueta: "Cliente", correo: "cliente@correo.cl", clave: "Cliente2026" },
    { etiqueta: "Administrador", correo: "admin@chocomania.cl", clave: "Admin2026" },
    { etiqueta: "Dueño", correo: "dueno@chocomania.cl", clave: "Dueno2026" },
    { etiqueta: "Cajero virtual", correo: "cajero@chocomania.cl", clave: "Cajero2026" },
    { etiqueta: "Encargado de despacho", correo: "despacho@chocomania.cl", clave: "Despacho2026" }
];

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form-login");
    const correo = document.getElementById("correo");
    const clave = document.getElementById("clave");
    const error = document.getElementById("error");

    // Lista de cuentas de prueba.
    const lista = document.getElementById("lista-cuentas");
    CUENTAS_PRUEBA.forEach((cuenta) => {
        const item = document.createElement("li");
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "enlace-boton";
        boton.textContent = cuenta.etiqueta + " — " + cuenta.correo;
        boton.addEventListener("click", () => {
            correo.value = cuenta.correo;
            clave.value = cuenta.clave;
            error.textContent = "";
        });
        item.appendChild(boton);
        lista.appendChild(item);
    });

    // Si llegó porque la sesión expiró, se avisa.
    if (new URLSearchParams(window.location.search).get("expirada")) {
        error.textContent = "Tu sesión expiró. Ingresa de nuevo para continuar.";
    }

    const boton = form.querySelector("button[type=submit]");

    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        error.textContent = "";

        if (!correo.value.trim() || !clave.value) {
            error.textContent = "Completa el correo y la contraseña.";
            return;
        }

        boton.disabled = true;
        boton.textContent = "Ingresando…";
        const resultado = await iniciarSesionApi(correo.value.trim(), clave.value);
        boton.disabled = false;
        boton.textContent = "Ingresar";

        if (!resultado.ok) {
            escribirError(error, resultado);
            return;
        }

        const sesion = sesionActual();
        if (sesion.tipo === "CLIENTE") {
            // Si venía redirigido desde una página protegida, vuelve allí.
            const volver = new URLSearchParams(window.location.search).get("volver");
            window.location.href = volver && !volver.includes("//") ? volver : "index.html";
        } else {
            window.location.href = inicioSegunPerfil(sesion.perfil);
        }
    });
});
