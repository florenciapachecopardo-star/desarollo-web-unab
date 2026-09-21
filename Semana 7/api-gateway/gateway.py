from fastapi import FastAPI
import httpx

app = FastAPI(title="Gateway Chocomanía")

PRODUCTOS_API_URL = "http://localhost:8001"
USUARIOS_GRAPHQL_URL = "http://localhost:4000/graphql"


@app.get("/")
async def inicio():
    return {"mensaje": "Gateway de Chocomanía funcionando"}


@app.get("/api/productos")
async def productos():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{PRODUCTOS_API_URL}/productos")
    return response.json()


@app.get("/api/usuarios")
async def usuarios():
    query = """
    query {
        getUsuarios {
            id
            nombre
        }
    }
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(USUARIOS_GRAPHQL_URL, json={"query": query})
    return response.json()
