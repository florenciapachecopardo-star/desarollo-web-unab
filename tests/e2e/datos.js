// Datos fijos del seed (scripts/seed.py). Todos ficticios.
const os = require("os");
const path = require("path");

module.exports = {
    RUTA_SESION_CLIENTE1: path.join(os.tmpdir(), "choco-e2e", "cliente1.json"),
    CUENTAS: {
        cliente1: { correo: "cliente@correo.cl", clave: "Cliente2026", nombre: "Valentina Soto" },
        cliente2: { correo: "diego@correo.cl", clave: "Diego2026", nombre: "Diego Rojas" },
        despacho: { correo: "despacho@chocomania.cl", clave: "Despacho2026" }
    },
    PRODUCTOS: {
        DUBAI: { id: "650000000000000000000001", nombre: "Chocolate Dubai", precio: 8990 },
        BLANCO: { id: "650000000000000000000002", nombre: "Chocolate blanco", precio: 4990, stock: 15 },
        BOMBONES: { id: "650000000000000000000003", nombre: "Bombones rellenos", precio: 6990 },
        TRUFAS: { id: "650000000000000000000005", nombre: "Trufas de chocolate", precio: 5490 }
    },
    PEDIDO_CLIENTE1: "PED-0001", // PAGADO, boleta B-000001
    PEDIDO_CLIENTE2: "PED-0002", // PENDIENTE_PAGO, de Diego: el "pedido ajeno"
    BOLETA_PED_0001: "B-000001"
};
