// Clientes y personal: registro, validación de RUN, ingreso y sesión.
// La sesión vive en localStorage. No hay servidor, así que la "validación del
// correo" y el "cifrado de clave" son simulados (ver README).

const CLAVE_SESION = "choco:sesion";

// --- Validación de RUN (módulo 11) ---
function limpiarRun(run) {
    return run.replace(/[.\-\s]/g, "").toUpperCase();
}

function digitoVerificador(cuerpo) {
    let suma = 0;
    let factor = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += Number(cuerpo[i]) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const resto = 11 - (suma % 11);
    if (resto === 11) return "0";
    if (resto === 10) return "K";
    return String(resto);
}

function runValido(run) {
    const limpio = limpiarRun(run);
    if (limpio.length < 2) return false;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    if (!/^\d+$/.test(cuerpo)) return false;
    return digitoVerificador(cuerpo) === dv;
}

// Formato bonito: 12.345.678-9
function formatearRun(run) {
    const limpio = limpiarRun(run);
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${conPuntos}-${dv}`;
}

// --- Sesión ---
function sesionActual() {
    const texto = localStorage.getItem(CLAVE_SESION);
    if (!texto) return null;
    try {
        return JSON.parse(texto);
    } catch (error) {
        return null;
    }
}

function cerrarSesion() {
    localStorage.removeItem(CLAVE_SESION);
}

// Ingreso: primero busca en clientes, luego en personal.
// Devuelve { ok, mensaje }.
function iniciarSesion(correo, clave) {
    const cliente = obtenerClientes().find((cli) => cli.correo.toLowerCase() === correo.toLowerCase());
    if (cliente && cliente.clave === clave) {
        if (!cliente.verificado) {
            return { ok: false, mensaje: "Tu correo aún no está verificado.", verificarId: cliente.id };
        }
        guardarSesion({ tipo: "CLIENTE", perfil: "CLIENTE", id: cliente.id, nombre: cliente.nombre });
        return { ok: true };
    }

    const usuario = obtenerUsuarios().find((usr) => usr.correo.toLowerCase() === correo.toLowerCase());
    if (usuario && usuario.clave === clave) {
        guardarSesion({ tipo: "PERSONAL", perfil: usuario.perfil, id: usuario.id, nombre: usuario.nombre });
        return { ok: true };
    }

    return { ok: false, mensaje: "Correo o contraseña incorrectos." };
}

function guardarSesion(sesion) {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
}

// --- Registro de clientes ---
// Genera un código de 6 dígitos que simula el que llegaría al correo.
function generarCodigo() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// Registra un cliente nuevo. Recibe los datos ya leídos del formulario.
// Devuelve { ok, mensaje, cliente }.
function registrarCliente(datos) {
    const clientes = obtenerClientes();

    if (clientes.some((cli) => cli.correo.toLowerCase() === datos.correo.toLowerCase())) {
        return { ok: false, mensaje: "Ya hay una cuenta con ese correo." };
    }
    if (clientes.some((cli) => limpiarRun(cli.run) === limpiarRun(datos.run))) {
        return { ok: false, mensaje: "Ya hay una cuenta con ese RUN." };
    }

    const cliente = {
        id: siguienteId(clientes),
        run: formatearRun(datos.run),
        nombre: datos.nombre,
        direccion: datos.direccion,
        comuna: datos.comuna,
        provincia: datos.provincia,
        region: datos.region,
        nacimiento: datos.nacimiento,
        sexo: datos.sexo,
        correo: datos.correo,
        telefono: datos.telefono,
        clave: datos.clave,
        verificado: datos.verificado === true,
        codigo: datos.verificado === true ? "" : generarCodigo()
    };

    clientes.push(cliente);
    guardarClientes(clientes);
    return { ok: true, cliente };
}

// Marca un cliente como verificado si el código coincide.
function verificarCorreo(idCliente, codigo) {
    const clientes = obtenerClientes();
    const cliente = clientes.find((cli) => cli.id === Number(idCliente));
    if (!cliente) return { ok: false, mensaje: "No encontramos la cuenta." };
    if (cliente.codigo !== codigo) return { ok: false, mensaje: "El código no coincide." };

    cliente.verificado = true;
    cliente.codigo = "";
    guardarClientes(clientes);
    return { ok: true, cliente };
}
