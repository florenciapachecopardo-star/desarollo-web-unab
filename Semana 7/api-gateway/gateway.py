from fastapi import FastAPI
import httpx

app = FastAPI(title="Gateway Chocomanía")

BOCATO_URL = "http://localhost:8001"
USUARIOS_GRAPHQL_URL = "http://localhost:4000/graphql"


@app.get("/")
async def inicio():
    return {"mensaje": "Gateway de Chocomanía funcionando"}


@app.get("/api/productos")
async def productos():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BOCATO_URL}/sandwiches")
    return response.json()
