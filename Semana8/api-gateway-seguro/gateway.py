import os
import httpx
from fastapi import FastAPI, HTTPException, Request, Response, Cookie
from fastapi.responses import JSONResponse

app = FastAPI(
    title="Gateway Seguro de Chocomanía",
    description="API Gateway con Auth Service, Vault y sesiones"
)

VAULT_ADDR = os.getenv("VAULT_ADDR", "http://127.0.0.1:8200")
VAULT_TOKEN = os.getenv("VAULT_TOKEN")
AUTH_URL = os.getenv("AUTH_URL", "http://127.0.0.1:8100")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8001")

if not VAULT_TOKEN:
    raise RuntimeError("VAULT_TOKEN no configurado")


async def get_gateway_secrets():
    url = f"{VAULT_ADDR}/v1/secret/data/gateway"
    headers = {"X-Vault-Token": VAULT_TOKEN}
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(url, headers=headers)
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="No fue posible acceder a Vault")
    vault_response = response.json()
    return vault_response["data"]["data"]


async def get_identity(session_token: str | None):
    if session_token is None:
        raise HTTPException(status_code=401, detail="No existe sesion valida")

    secrets_data = await get_gateway_secrets()
    introspection_secret = secrets_data["auth_introspection_secret"]

    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(
            f"{AUTH_URL}/introspect",
            json={"token": session_token},
            headers={"X-Gateway-Secret": introspection_secret}
        )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="No existe sesion valida")

    data = response.json()
    if not data.get("active"):
        raise HTTPException(status_code=401, detail="Token invalido o expirado")

    return data


@app.get("/health")
def health():
    return {"status": "OK", "service": "Gateway Seguro de Chocomanía"}


@app.post("/auth/login")
async def login(request: Request):
    body = await request.json()
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(f"{AUTH_URL}/login", json=body)

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    data = response.json()
    token = data["access_token"]

    json_response = JSONResponse(content={"status": "OK"})
    json_response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax"
    )
    return json_response


@app.get("/auth/me")
async def me(session_token: str | None = Cookie(default=None)):
    identity = await get_identity(session_token)
    return identity


@app.post("/auth/logout")
async def logout(session_token: str | None = Cookie(default=None)):
    if session_token:
        secrets_data = await get_gateway_secrets()
        introspection_secret = secrets_data["auth_introspection_secret"]
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{AUTH_URL}/logout",
                json={"token": session_token},
                headers={"X-Gateway-Secret": introspection_secret}
            )

    json_response = JSONResponse(content={"status": "OK"})
    json_response.delete_cookie("session_token")
    return json_response


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(path: str, request: Request, session_token: str | None = Cookie(default=None)):
    identity = await get_identity(session_token)

    if request.method == "DELETE" and "admin" not in identity["roles"]:
        raise HTTPException(status_code=403, detail="Se requiere rol admin")

    secrets_data = await get_gateway_secrets()
    backend_secret = secrets_data["backend_shared_secret"]

    target_url = f"{BACKEND_URL}/{path}"
    body = await request.body()

    gateway_headers = {
        "X-Gateway-Secret": backend_secret,
        "X-Authenticated-User": identity["user_id"],
        "X-Authenticated-Username": identity["username"],
        "X-Authenticated-Roles": ",".join(identity["roles"])
    }
    content_type = request.headers.get("content-type")
    if content_type:
        gateway_headers["content-type"] = content_type

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            upstream = await client.request(
                method=request.method,
                url=target_url,
                params=request.query_params,
                content=body,
                headers=gateway_headers
            )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Backend no disponible")

    response_headers = {}
    if "content-type" in upstream.headers:
        response_headers["content-type"] = upstream.headers["content-type"]

    return Response(content=upstream.content, status_code=upstream.status_code, headers=response_headers)
