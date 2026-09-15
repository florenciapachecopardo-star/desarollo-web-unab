from fastapi import FastAPI, HTTPException
from bson import ObjectId

from database import sandwiches_collection
from models import SandwichModel, SandwichUpdateModel

app = FastAPI(title="Bocato API - FastAPI & MongoDB")


def sandwich_helper(sandwich) -> dict:
    return {
        "id": str(sandwich["_id"]),
        "nombre": sandwich["nombre"],
        "descripcion": sandwich["descripcion"],
        "precio": sandwich["precio"],
        "disponible": sandwich["disponible"]
    }


@app.get("/sandwiches")
async def consultar_sandwiches():
    sandwiches = []
    async for sandwich in sandwiches_collection.find():
        sandwiches.append(sandwich_helper(sandwich))
    return sandwiches


@app.get("/sandwiches/{id}")
async def consultar_sandwich_por_id(id: str):
    sandwich = await sandwiches_collection.find_one({"_id": ObjectId(id)})
    if sandwich is None:
        raise HTTPException(status_code=404, detail="Sandwich no encontrado")
    return sandwich_helper(sandwich)


@app.post("/sandwiches", status_code=201)
async def insertar_sandwich(sandwich: SandwichModel):
    nuevo_sandwich = await sandwiches_collection.insert_one(sandwich.dict())
    creado = await sandwiches_collection.find_one({"_id": nuevo_sandwich.inserted_id})
    return sandwich_helper(creado)


@app.put("/sandwiches/{id}")
async def actualizar_sandwich(id: str, sandwich: SandwichUpdateModel):
    datos = {k: v for k, v in sandwich.dict().items() if v is not None}
    if len(datos) == 0:
        raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")
    resultado = await sandwiches_collection.update_one({"_id": ObjectId(id)}, {"$set": datos})
    if resultado.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sandwich no encontrado")
    actualizado = await sandwiches_collection.find_one({"_id": ObjectId(id)})
    return sandwich_helper(actualizado)


@app.delete("/sandwiches/{id}")
async def eliminar_sandwich(id: str):
    resultado = await sandwiches_collection.delete_one({"_id": ObjectId(id)})
    if resultado.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sandwich no encontrado")
    return {"mensaje": "Sandwich eliminado correctamente"}
