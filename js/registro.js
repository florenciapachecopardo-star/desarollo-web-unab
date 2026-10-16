// Registro de clientes. Encadena región → provincia → comuna, valida cada
// campo y, si todo está bien, crea el cliente y lleva a verificar el correo.

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form-registro");
    const region = document.getElementById("region");
    const provincia = document.getElementById("provincia");
    const comuna = document.getElementById("comuna");
    const errorGeneral = document.getElementById("error-general");

    // Llena el select de regiones.
    REGIONES.forEach((reg) => {
        const opcion = document.createElement("option");
        opcion.value = reg.nombre;
        opcion.textContent = reg.nombre;
        region.appendChild(opcion);
    });

    // Rellena un select con una lista de textos.
    function llenarSelect(select, valores, textoInicial) {
        select.innerHTML = "";
        const inicial = document.createElement("option");
        inicial.value = "";
        inicial.textContent = textoInicial;
        select.appendChild(inicial);
        valores.forEach((valor) => {
            const opcion = document.createElement("option");
            opcion.value = valor;
            opcion.textContent = valor;
            select.appendChild(opcion);
        });
    }

    region.addEventListener("change", () => {
        const provincias = provinciasDe(region.value).map((prov) => prov.nombre);
        llenarSelect(provincia, provincias, "Elige una provincia");
        provincia.disabled = provincias.length === 0;
        llenarSelect(comuna, [], "Elige una comuna");
        comuna.disabled = true;
    });

    provincia.addEventListener("change", () => {
        const comunas = comunasDe(region.value, provincia.value);
        llenarSelect(comuna, comunas, "Elige una comuna");
        comuna.disabled = comunas.length === 0;
    });

    // Muestra un error bajo el campo indicado.
    function marcarError(campo, mensaje) {
        const span = form.querySelector(`[data-error="${campo}"]`);
        if (span) span.textContent = mensaje;
        return false;
    }

    function limpiarErrores() {
        form.querySelectorAll(".campo__error").forEach((span) => (span.textContent = ""));
        errorGeneral.textContent = "";
    }

    function validar(datos) {
        let valido = true;

        if (!datos.run.trim()) valido = marcarError("run", "Ingresa tu RUN.") && valido;
        else if (!runValido(datos.run)) valido = marcarError("run", "El RUN no es válido.") && valido;

        if (!datos.nombre.trim()) valido = marcarError("nombre", "Ingresa tu nombre.") && valido;
        if (!datos.direccion.trim()) valido = marcarError("direccion", "Ingresa tu dirección.") && valido;
        if (!datos.region) valido = marcarError("region", "Elige una región.") && valido;
        if (!datos.provincia) valido = marcarError("provincia", "Elige una provincia.") && valido;
        if (!datos.comuna) valido = marcarError("comuna", "Elige una comuna.") && valido;

        if (!datos.nacimiento) {
            valido = marcarError("nacimiento", "Ingresa tu fecha de nacimiento.") && valido;
        } else if (new Date(datos.nacimiento) > new Date()) {
            valido = marcarError("nacimiento", "La fecha no puede ser futura.") && valido;
        }

        if (!datos.sexo) valido = marcarError("sexo", "Elige una opción.") && valido;

        if (!datos.correo.trim()) valido = marcarError("correo", "Ingresa tu correo.") && valido;
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) valido = marcarError("correo", "El correo no es válido.") && valido;

        if (!datos.telefono.trim()) valido = marcarError("telefono", "Ingresa tu teléfono.") && valido;
        else if (!/^\+?[0-9]{8,12}$/.test(datos.telefono.replace(/\s/g, ""))) valido = marcarError("telefono", "El teléfono no es válido.") && valido;

        if (!datos.clave) valido = marcarError("clave", "Ingresa una contraseña.") && valido;
        else if (datos.clave.length < 6) valido = marcarError("clave", "Al menos 6 caracteres.") && valido;

        return valido;
    }

    form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        limpiarErrores();

        const datos = {
            run: form.run.value,
            nombre: form.nombre.value,
            direccion: form.direccion.value,
            region: form.region.value,
            provincia: form.provincia.value,
            comuna: form.comuna.value,
            nacimiento: form.nacimiento.value,
            sexo: form.sexo.value,
            correo: form.correo.value,
            telefono: form.telefono.value,
            clave: form.clave.value,
            verificado: false
        };

        if (!validar(datos)) {
            errorGeneral.textContent = "Revisa los campos marcados.";
            return;
        }

        const resultado = registrarCliente(datos);
        if (!resultado.ok) {
            errorGeneral.textContent = resultado.mensaje;
            return;
        }

        window.location.href = "verificar.html?id=" + resultado.cliente.id;
    });
});
