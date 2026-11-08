import os
import secrets
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, FastAPI, Header, Query, Request
from pydantic import BaseModel, Field

from database import productos_collection
from models import Categoria, ProductoModel, ProductoUpdateModel
from observabilidad import ApiError, instalar

SERVICE = "inventory"
POR_PAGINA = 20

INTERNAL_GATEWAY_SECRET = os.getenv("INTERNAL_GATEWAY_SECRET")
if not INTERNAL_GATEWAY_SECRET:
    raise RuntimeError("INTERNAL_GATEWAY_SECRET no esta configurado")

# Secreto propio de la integracion orders -> inventory (distinto al del gateway)
ORDERS_INVENTORY_SECRET = os.getenv("ORDERS_INVENTORY_SECRET")
if not ORDERS_INVENTORY_SECRET:
    raise RuntimeError("ORDERS_INVENTORY_SECRET no esta configurado")

app = FastAPI(title="Chocomania inventory")
instalar(app, SERVICE, confiar_identidad=True)


def verify_gateway(x_gateway_secret: str = Header(default="")):
    if not secrets.compare_digest(x_gateway_secret, INTERNAL_GATEWAY_SECRET):
        raise ApiError(403, "FORBIDDEN", "Solicitud no autorizada: debe pasar por el gateway")


# Secreto propio de la integracion graphql-gateway -> inventory (solo lectura)
GRAPHQL_INVENTORY_SECRET = os.getenv("GRAPHQL_INVENTORY_SECRET")
if not GRAPHQL_INVENTORY_SECRET:
    raise RuntimeError("GRAPHQL_INVENTORY_SECRET no esta configurado")


def verify_graphql(x_service_secret: str = Header(default="")):
    if not secrets.compare_digest(x_service_secret, GRAPHQL_INVENTORY_SECRET):
        raise ApiError(403, "FORBIDDEN", "Solo graphql-gateway puede usar esta operacion")


def verify_orders(x_service_secret: str = Header(default="")):
    if not secrets.compare_digest(x_service_secret, ORDERS_INVENTORY_SECRET):
        raise ApiError(403, "FORBIDDEN", "Solo orders puede usar esta operacion")


def verify_admin(x_authenticated_roles: str = Header(default="")):
    if "ADMIN" not in x_authenticated_roles.split(","):
        raise ApiError(403, "FORBIDDEN", "Se requiere rol ADMIN")


def parse_id(id: str) -> ObjectId:
    try:
        return ObjectId(id)
    except (InvalidId, TypeError):
        raise ApiError(400, "INVALID_ID", "El identificador tiene un formato invalido")


def producto_helper(producto) -> dict:
    stock = int(producto.get("stock", 0))
    return {
        "id": str(producto["_id"]),
        "nombre": producto.get("nombre"),
        "descripcion": producto.get("descripcion", ""),
        "categoria": producto.get("categoria"),
        "precio": producto.get("precio"),
        "stock": stock,
        "disponible": stock > 0,
        "imagen": producto.get("imagen"),
    }


def no_encontrado():
    return ApiError(404, "PRODUCT_NOT_FOUND", "Producto no encontrado")


@app.get("/health")
def health():
    return {"status": "OK", "service": SERVICE}


@app.get("/productos", dependencies=[Depends(verify_gateway)])
async def consultar_productos(
    categoria: Optional[Categoria] = None,
    pagina: int = Query(default=1, ge=1),
):
    filtro = {"categoria": categoria.value} if categoria else {}
    total = await productos_collection.count_documents(filtro)
    cursor = productos_collection.find(filtro).sort("nombre", 1).skip((pagina - 1) * POR_PAGINA).limit(POR_PAGINA)
    productos = [producto_helper(p) async for p in cursor]
    return {"productos": productos, "pagina": pagina, "total": total}


@app.get("/productos/{id}", dependencies=[Depends(verify_gateway)])
async def consultar_producto_por_id(id: str):
    producto = await productos_collection.find_one({"_id": parse_id(id)})
    if producto is None:
        raise no_encontrado()
    return producto_helper(producto)


@app.post("/productos", status_code=201, dependencies=[Depends(verify_gateway), Depends(verify_admin)])
async def insertar_producto(producto: ProductoModel):
    nuevo = await productos_collection.insert_one(producto.model_dump(mode="json"))
    creado = await productos_collection.find_one({"_id": nuevo.inserted_id})
    return producto_helper(creado)


@app.put("/productos/{id}", dependencies=[Depends(verify_gateway), Depends(verify_admin)])
async def actualizar_producto(id: str, producto: ProductoUpdateModel):
    oid = parse_id(id)
    datos = producto.model_dump(mode="json", exclude_none=True)
    if not datos:
        raise ApiError(400, "BAD_REQUEST", "No se enviaron datos para actualizar")
    resultado = await productos_collection.update_one({"_id": oid}, {"$set": datos})
    if resultado.matched_count == 0:
        raise no_encontrado()
    return producto_helper(await productos_collection.find_one({"_id": oid}))


@app.delete("/productos/{id}", dependencies=[Depends(verify_gateway), Depends(verify_admin)])
async def eliminar_producto(id: str):
    resultado = await productos_collection.delete_one({"_id": parse_id(id)})
    if resultado.deleted_count == 0:
        raise no_encontrado()
    return {"mensaje": "Producto eliminado correctamente"}


# ---------------------------------------------------------------------------
# Operaciones internas para orders (no estan en la lista blanca del gateway)
# ---------------------------------------------------------------------------

class ItemStock(BaseModel):
    producto_id: str = Field(min_length=1, max_length=64)
    cantidad: int = Field(ge=1, le=20)


class SolicitudStock(BaseModel):
    items: list[ItemStock] = Field(min_length=1, max_length=20)


async def devolver_items(items: list[tuple[ObjectId, int]]):
    for oid, cantidad in items:
        await productos_collection.update_one({"_id": oid}, {"$inc": {"stock": cantidad}})


@app.post("/interno/reservas", dependencies=[Depends(verify_orders)])
async def reservar_stock(solicitud: SolicitudStock):
    """Descuenta el stock de cada item y devuelve el precio vigente.

    Cada descuento es atomico (solo baja si alcanza). Si un item falla, se
    devuelven los que ya se habian descontado.
    """
    # INC04: se validan todos los ID antes de descontar, para que un ID mal formado
    # no deje descontado el stock de los productos anteriores
    oids = [parse_id(item.producto_id) for item in solicitud.items]
    reservados: list[tuple[ObjectId, int]] = []
    resultado = []
    for item, oid in zip(solicitud.items, oids):
        producto = await productos_collection.find_one_and_update(
            {"_id": oid, "stock": {"$gte": item.cantidad}},
            {"$inc": {"stock": -item.cantidad}},
        )
        if producto is None:
            await devolver_items(reservados)
            existe = await productos_collection.find_one({"_id": oid})
            if existe is None:
                raise ApiError(404, "PRODUCT_NOT_FOUND", "Producto no encontrado")
            raise ApiError(409, "STOCK_INSUFICIENTE",
                           f"No hay stock suficiente de {existe.get('nombre')} (quedan {existe.get('stock', 0)})")
        reservados.append((oid, item.cantidad))
        resultado.append({
            "producto_id": str(oid),
            "nombre": producto["nombre"],
            "precio_unitario": producto["precio"],
            "cantidad": item.cantidad,
        })
    return {"items": resultado}


@app.post("/interno/devoluciones", dependencies=[Depends(verify_orders)])
async def devolver_stock(solicitud: SolicitudStock):
    await devolver_items([(parse_id(i.producto_id), i.cantidad) for i in solicitud.items])
    return {"status": "OK"}


class SolicitudLote(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=50)


@app.post("/interno/productos/lote", dependencies=[Depends(verify_graphql)])
async def productos_por_lote(solicitud: SolicitudLote):
    """Varios productos en una sola llamada (batching del GraphQL Gateway)."""
    oids = [parse_id(i) for i in dict.fromkeys(solicitud.ids)]
    encontrados = {str(p["_id"]): producto_helper(p) async for p in productos_collection.find({"_id": {"$in": oids}})}
    return {"productos": [encontrados.get(i) for i in solicitud.ids]}
