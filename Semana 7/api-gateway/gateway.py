from fastapi import FastAPI
import httpx

app = FastAPI()

BOCATO_URL = "http://localhost:8001"
USUARIOS_GRAPHQL_URL = "http://localhost:4000/graphql"


@app.get("/api/sandwiches")
async def sandwiches():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BOCATO_URL}/sandwiches")
    return response.json()
