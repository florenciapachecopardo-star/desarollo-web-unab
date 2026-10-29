// Regiones, provincias y comunas para el registro de clientes.
// Cargo la Región Metropolitana completa (es donde reparte Chocomanía) y dejo
// un par de regiones más para que el select tenga sentido. El caso pide guardar
// región, provincia y comuna del cliente.

const REGIONES = [
    {
        nombre: "Región Metropolitana de Santiago",
        provincias: [
            { nombre: "Santiago", comunas: ["Santiago", "Providencia", "Ñuñoa", "Las Condes", "Vitacura", "La Reina", "Macul", "Peñalolén", "La Florida", "Recoleta", "Independencia", "Estación Central", "Maipú", "Quinta Normal", "San Miguel"] },
            { nombre: "Cordillera", comunas: ["Puente Alto", "Pirque", "San José de Maipo"] },
            { nombre: "Maipo", comunas: ["San Bernardo", "Buin", "Paine", "Calera de Tango"] }
        ]
    },
    {
        nombre: "Región de Valparaíso",
        provincias: [
            { nombre: "Valparaíso", comunas: ["Valparaíso", "Viña del Mar", "Concón", "Quilpué", "Villa Alemana"] },
            { nombre: "Marga Marga", comunas: ["Quilpué", "Villa Alemana", "Limache", "Olmué"] }
        ]
    },
    {
        nombre: "Región del Biobío",
        provincias: [
            { nombre: "Concepción", comunas: ["Concepción", "Talcahuano", "Hualpén", "San Pedro de la Paz", "Chiguayante"] }
        ]
    }
];

// Comunas dentro del radio de despacho (3 km desde el local, en Providencia).
// Sin un servicio de mapas no se mide la distancia exacta: se aproxima por comuna.
const COMUNAS_CON_DESPACHO = ["Providencia", "Ñuñoa", "Santiago", "Recoleta", "Las Condes", "Independencia"];

function tieneDespacho(comuna) {
    return COMUNAS_CON_DESPACHO.includes(comuna);
}

function provinciasDe(nombreRegion) {
    const region = REGIONES.find((reg) => reg.nombre === nombreRegion);
    return region ? region.provincias : [];
}

function comunasDe(nombreRegion, nombreProvincia) {
    const provincia = provinciasDe(nombreRegion).find((prov) => prov.nombre === nombreProvincia);
    return provincia ? provincia.comunas : [];
}
