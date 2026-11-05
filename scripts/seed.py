"""Datos de prueba FICTICIOS de Chocomania, con IDs conocidos.

Se ejecuta dentro de la red privada con la imagen de auth (trae pymongo y bcrypt):
    docker compose run --rm seed              -> carga o actualiza (no borra)
    docker compose run --rm seed --reset      -> borra y vuelve a cargar (lo usa scripts/reset.sh)

Las claves son las mismas cuentas de prueba del front (frontend/js/datos.js).
Son ficticias y solo valen en el entorno local.
"""

import os
import sys

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


def main():
    reset = "--reset" in sys.argv
    cliente = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    auth_db = cliente["auth"]
    inventory_db = cliente["inventory"]

    if reset:
        auth_db["usuarios"].delete_many({})
        auth_db["sesiones"].delete_many({})
        inventory_db["productos"].delete_many({})
        print("reset: usuarios, sesiones y productos borrados")

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


if __name__ == "__main__":
    main()
