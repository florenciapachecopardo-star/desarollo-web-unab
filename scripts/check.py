"""Consulta directa a Mongo para verificar persistencia sin depender de la pantalla (plan 2.4).

Uso (el stack tiene que estar levantado):
    docker compose run --rm check pedido PED-0001
    docker compose run --rm check producto 650000000000000000000004
    docker compose run --rm check usuario USR-0001
    docker compose run --rm check pago PAG-0001

Nunca muestra hashes de claves ni sesiones.
"""

import json
import os
import sys

from bson import ObjectId
from pymongo import MongoClient


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("pedido", "producto", "usuario", "pago"):
        print(__doc__)
        sys.exit(2)
    tipo, ident = sys.argv[1], sys.argv[2]
    cliente = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=5000)

    if tipo == "pedido":
        doc = cliente["orders"]["pedidos"].find_one({"_id": ident}, {"huella_cuerpo": 0})
    elif tipo == "producto":
        doc = cliente["inventory"]["productos"].find_one({"_id": ObjectId(ident)})
    elif tipo == "pago":
        doc = cliente["payments"]["pagos"].find_one({"_id": ident})
    else:
        doc = cliente["auth"]["usuarios"].find_one({"_id": ident}, {"password_hash": 0})

    if doc is None:
        print(json.dumps({"encontrado": False, "tipo": tipo, "id": ident}, ensure_ascii=False))
        sys.exit(1)
    print(json.dumps({"encontrado": True, "tipo": tipo, "documento": doc}, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
