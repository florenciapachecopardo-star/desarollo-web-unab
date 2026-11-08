"""Datos de prueba FICTICIOS de Chocomania, con IDs conocidos.

Se ejecuta dentro de la red privada con la imagen de auth (trae pymongo y bcrypt):
    docker compose run --rm seed              -> carga o actualiza (no borra)
    docker compose run --rm seed --reset      -> borra y vuelve a cargar (lo usa scripts/reset.sh)
Ojo: sin --reset, el stock vuelve al valor del seed, aunque haya pedidos creados.

Las claves son las mismas cuentas de prueba del front (frontend/js/datos.js).
Son ficticias y solo valen en el entorno local.
"""

import os
import sys
from datetime import datetime, timezone

import bcrypt
from bson import ObjectId
from pymongo import MongoClient

MONGO_URL = os.environ["MONGO_URL"]

USUARIOS = [
    # _id,        correo,                   clave,          nombre,                   roles
    ("USR-0001", "cliente@correo.cl",      "Cliente2026",  "Valentina Soto",         ["CLIENTE"]),   # cliente1
    ("USR-0002", "diego@correo.cl",        "Diego2026",    "Diego Rojas",            ["CLIENTE"]),   # cliente2
    ("USR-0003", "admin@chocomania.cl",    "Admin2026",    "Administrador",          ["ADMIN"]),
    ("USR-0004", "dueno@chocomania.cl",    "Dueno2026",    "Duena Chocomania",       ["DUENO"]),
    ("USR-0005", "cajero@chocomania.cl",   "Cajero2026",   "Cajero virtual",         ["CAJERO"]),
    ("USR-0006", "despacho@chocomania.cl", "Despacho2026", "Encargado de despacho",  ["DESPACHO"]),
]

PRODUCTOS = [
    # _id (fijo),               nombre,                  categoria,  descripcion,                                                   precio, stock, imagen
    ("650000000000000000000001", "Chocolate Dubai",        "barras",   "Barra de chocolate con leche rellena de crema de pistacho",    8990, 20, "img/chocolate-dubai.jpg"),
    ("650000000000000000000002", "Chocolate blanco",       "barras",   "Barra de chocolate blanco cremoso",                            4990, 15, "img/chocolate-blanco.jpg"),
    ("650000000000000000000003", "Bombones rellenos",      "bombones", "Bombones de chocolate con centro de crema",                    6990, 10, "img/bombones-rellenos.jpg"),
    ("650000000000000000000004", "Bombones de caramelo",   "bombones", "Bombones de chocolate oscuro rellenos de caramelo y nueces",   7490, 2,  "img/bombones-de-caramelo.jpg"),
    ("650000000000000000000005", "Trufas de chocolate",    "trufas",   "Trufas artesanales con cobertura de chocolate",                5490, 0,  "img/trufas-de-chocolate.jpg"),
]


def pedido(_id, cliente_id, estado, items, fecha, direccion):
    """Pedido de ejemplo. Los precios salen de PRODUCTOS, como haria orders."""
    precios = {p[0]: (p[1], p[4]) for p in PRODUCTOS}
    lineas = []
    for producto_id, cantidad in items:
        nombre, precio = precios[producto_id]
        lineas.append({"producto_id": producto_id, "nombre": nombre, "precio_unitario": precio,
                       "cantidad": cantidad, "subtotal": precio * cantidad})
    historial = [{"estado": "PENDIENTE_PAGO", "fecha": fecha, "por": cliente_id}]
    if estado != "PENDIENTE_PAGO":
        historial.append({"estado": estado, "fecha": fecha, "por": "payments"})
    return {
        "_id": _id, "cliente_id": cliente_id, "cajero_id": "USR-0005", "estado": estado,
        "lineas": lineas, "total": sum(l["subtotal"] for l in lineas),
        "despacho": {"direccion": direccion, "comuna": "Providencia", "telefono": "+56900000000"},
        "idempotency_key": f"seed-{_id}", "huella_cuerpo": "seed", "request_id": "seed",
        "creado_en": fecha, "historial": historial, "stock_devuelto": False,
    }


PEDIDOS = [
    # PED-0001 de cliente1, pagado (aparece en la cola de despacho y en el reporte)
    pedido("PED-0001", "USR-0001", "PAGADO",
           [("650000000000000000000001", 1), ("650000000000000000000003", 2)],
           datetime(2026, 11, 2, 15, 0, tzinfo=timezone.utc), "Calle Ficticia 123"),
    # PED-0002 de cliente2, pendiente de pago (es el "pedido ajeno" para cliente1)
    pedido("PED-0002", "USR-0002", "PENDIENTE_PAGO",
           [("650000000000000000000002", 1)],
           datetime(2026, 11, 3, 18, 30, tzinfo=timezone.utc), "Pasaje Inventado 45"),
]


def main():
    reset = "--reset" in sys.argv
    cliente = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    auth_db = cliente["auth"]
    inventory_db = cliente["inventory"]
    orders_db = cliente["orders"]

    if reset:
        auth_db["usuarios"].delete_many({})
        auth_db["sesiones"].delete_many({})
        inventory_db["productos"].delete_many({})
        orders_db["pedidos"].delete_many({})
        orders_db["contadores"].delete_many({})
        print("reset: usuarios, sesiones, productos y pedidos borrados")

    for _id, correo, clave, nombre, roles in USUARIOS:
        auth_db["usuarios"].replace_one(
            {"_id": _id},
            {
                "_id": _id,
                "correo": correo,
                "nombre": nombre,
                "password_hash": bcrypt.hashpw(clave.encode(), bcrypt.gensalt(rounds=12)).decode(),
                "roles": roles,
                "activo": True,
            },
            upsert=True,
        )
    print(f"seed: {len(USUARIOS)} usuarios (claves guardadas solo como hash bcrypt)")

    for _id, nombre, categoria, descripcion, precio, stock, imagen in PRODUCTOS:
        inventory_db["productos"].replace_one(
            {"_id": ObjectId(_id)},
            {
                "nombre": nombre,
                "categoria": categoria,
                "descripcion": descripcion,
                "precio": precio,
                "stock": stock,
                "imagen": imagen,
            },
            upsert=True,
        )
    print(f"seed: {len(PRODUCTOS)} productos (uno agotado: Trufas de chocolate)")

    for p in PEDIDOS:
        orders_db["pedidos"].replace_one({"_id": p["_id"]}, p, upsert=True)
    # El proximo pedido creado por la API sera PED-0003 (si el contador ya esta mas alto, no se baja)
    orders_db["contadores"].update_one({"_id": "pedido"}, {"$max": {"seq": len(PEDIDOS)}}, upsert=True)
    print(f"seed: {len(PEDIDOS)} pedidos (PED-0001 de cliente1 PAGADO, PED-0002 de cliente2 PENDIENTE_PAGO)")


if __name__ == "__main__":
    main()
