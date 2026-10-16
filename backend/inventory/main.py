import os
import secrets
from fastapi import FastAPI, HTTPException, Header, Depends
from bson import ObjectId

from database import productos_collection
from models import ProductoModel, ProductoUpdateModel

app = FastAPI(title="Chocomanía API - FastAPI & MongoDB")

INTERNAL_GATEWAY_SECRET = os.getenv("INTERNAL_GATEWAY_SECRET")
if not INTERNAL_GATEWAY_SECRET:
    raise RuntimeError("INTERNAL_GATEWAY_SECRET no esta configurado")


def verify_gateway(x_gateway_secret: str = Header(default="")):
    valid = secrets.compare_digest(x_gateway_secret, INTERNAL_GATEWAY_SECRET)
    if not valid:
        raise HTTPException(status_code=403, detail="Solicitud no autorizada desde Gateway")


def verify_admin(x_authenticated_roles: str = Header(default="")):
    roles = x_authenticated_roles.split(",")
    if "admin" not in roles:
        raise HTTPException(status_code=403, detail="Se requiere rol admin")


def producto_helper(producto) -> dict:
    return {
        "id": str(producto["_id"]),
        "nombre": producto["nombre"],
        "descripcion": producto["descripcion"],
        "precio": producto["precio"],
        "disponible": producto["disponible"]
    }


@app.get("/health")
def health():
    return {"status": "OK"}


@app.get("/productos", dependencies=[Depends(verify_gateway)])
async def consultar_productos():
    productos = []
    async for producto in productos_collection.find():
        productos.append(producto_helper(producto))
    return productos


@app.get("/productos/{id}", dependencies=[Depends(verify_gateway)])
async def consultar_producto_por_id(id: str):
    producto = await productos_collection.find_one({"_id": ObjectId(id)})
    if producto is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto_helper(producto)


@app.post("/productos", status_code=201, dependencies=[Depends(verify_gateway)])
async def insertar_producto(producto: ProductoModel):
    nuevo_producto = await productos_collection.insert_one(producto.dict())
    creado = await productos_collection.find_one({"_id": nuevo_producto.inserted_id})
    return producto_helper(creado)


@app.put("/productos/{id}", dependencies=[Depends(verify_gateway)])
async def actualizar_producto(id: str, producto: ProductoUpdateModel):
    datos = {k: v for k, v in producto.dict().items() if v is not None}
    if len(datos) == 0:
        raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")
    resultado = await productos_collection.update_one({"_id": ObjectId(id)}, {"$set": datos})
    if resultado.matched_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    actualizado = await productos_collection.find_one({"_id": ObjectId(id)})
    return producto_helper(actualizado)


@app.delete("/productos/{id}", dependencies=[Depends(verify_gateway), Depends(verify_admin)])
async def eliminar_producto(id: str):
    resultado = await productos_collection.delete_one({"_id": ObjectId(id)})
    if resultado.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"mensaje": "Producto eliminado correctamente"}
