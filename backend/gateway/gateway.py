import os
import re
import time
from dataclasses import dataclass
from urllib.parse import quote

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from observabilidad import REQUEST_ID_HEADER, ApiError, instalar, log, request_id_de

SERVICE = "gateway"

VAULT_ADDR = os.getenv("VAULT_ADDR", "http://vault:8200")
VAULT_TOKEN = os.getenv("VAULT_TOKEN")
AUTH_URL = os.getenv("AUTH_URL", "http://auth:8000")
INVENTORY_URL = os.getenv("INVENTORY_URL", "http://inventory:8000")
ORDERS_URL = os.getenv("ORDERS_URL", "http://orders:8000")
PAYMENTS_URL = os.getenv("PAYMENTS_URL", "http://payments:8000")
GRAPHQL_URL = os.getenv("GRAPHQL_URL", "http://graphql-gateway:8000")
UPSTREAM_TIMEOUT = float(os.getenv("UPSTREAM_TIMEOUT_SECONDS", "5"))
VAULT_CACHE_SECONDS = float(os.getenv("VAULT_CACHE_SECONDS", "60"))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
# Carpeta del front: el gateway lo sirve en el mismo origen que la API (sin CORS)
FRONTEND_DIR = os.getenv("FRONTEND_DIR", "")

if not VAULT_TOKEN:
    raise RuntimeError("VAULT_TOKEN no configurado")

app = FastAPI(title="API Gateway de Chocomania")
instalar(app, SERVICE, confiar_identidad=False)

# INC06: un solo cliente HTTP para todo el gateway, en vez de crear uno por solicitud.
# Crear un AsyncClient arma su configuracion TLS y su pool de conexiones cada vez,
# y eso saturaba la CPU del gateway en la prueba de carga.
_http = httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT)


@app.on_event("shutdown")
async def cerrar_http():
    await _http.aclose()


# ---------------------------------------------------------------------------
# Lista blanca de rutas (M6). Lo que no esta aqui responde 404 o 405.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RouteDefinition:
    id: str              # ID del servicio en el M1
    method: str
    path: str            # ruta externa
    acceso: str          # "anonimo" | "autenticado" | "rol"
    roles: tuple         # roles permitidos si acceso == "rol"
    destino: str         # clave en SERVICIOS
    ruta_interna: str    # ruta en el servicio destino


@dataclass(frozen=True)
class ServiceTarget:
    url: str
    secreto: str         # nombre de la clave en Vault (secret/gateway)


SERVICIOS = {
    "inventory": ServiceTarget(INVENTORY_URL, "backend_shared_secret"),
    "orders": ServiceTarget(ORDERS_URL, "orders_shared_secret"),
    "payments": ServiceTarget(PAYMENTS_URL, "payments_shared_secret"),
    "graphql": ServiceTarget(GRAPHQL_URL, "graphql_shared_secret"),
}

RUTAS = [
    RouteDefinition("S01", "GET", "/api/v1/productos", "anonimo", (), "inventory", "/productos"),
    RouteDefinition("S02", "GET", "/api/v1/productos/{id}", "anonimo", (), "inventory", "/productos/{id}"),
    RouteDefinition("S03", "POST", "/api/v1/productos", "rol", ("ADMIN",), "inventory", "/productos"),
    RouteDefinition("S04", "PUT", "/api/v1/productos/{id}", "rol", ("ADMIN",), "inventory", "/productos/{id}"),
    RouteDefinition("S05", "DELETE", "/api/v1/productos/{id}", "rol", ("ADMIN",), "inventory", "/productos/{id}"),
    # orders: la regla de propiedad (cliente solo ve lo suyo) la revisa orders
    RouteDefinition("S11", "POST", "/api/v1/pedidos", "rol", ("CLIENTE",), "orders", "/pedidos"),
    RouteDefinition("S12", "GET", "/api/v1/pedidos/{id}", "autenticado", (), "orders", "/pedidos/{id}"),
    RouteDefinition("S13", "POST", "/api/v1/pedidos/{id}/anular", "autenticado", (), "orders", "/pedidos/{id}/anular"),
    RouteDefinition("S14", "GET", "/api/v1/pedidos", "rol", ("DESPACHO", "ADMIN"), "orders", "/pedidos"),
    RouteDefinition("S15", "PATCH", "/api/v1/pedidos/{id}/estado", "rol", ("DESPACHO", "ADMIN"), "orders", "/pedidos/{id}/estado"),
    RouteDefinition("S19", "GET", "/api/v1/reportes/ventas", "rol", ("DUENO", "ADMIN"), "orders", "/reportes/ventas"),
    # payments: S17 no lleva sesion; payments verifica el secreto propio del proveedor
    RouteDefinition("S16", "POST", "/api/v1/pagos", "rol", ("CLIENTE",), "payments", "/pagos"),
    RouteDefinition("S17", "POST", "/api/v1/pagos/aviso", "anonimo", (), "payments", "/pagos/aviso"),
    # GraphQL Gateway privado: solo con sesion; la autorizacion por recurso y campo la hace graphql-gateway
    RouteDefinition("S18", "POST", "/api/v1/graphql", "autenticado", (), "graphql", "/graphql"),
]

_PARAM_VALIDO = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


# ---------------------------------------------------------------------------
# Secretos desde Vault, con cache corto (si Vault cae, se sigue hasta que expire)
# ---------------------------------------------------------------------------

_cache_secretos = {"datos": None, "expira": 0.0}


async def secretos(request: Request) -> dict:
    if _cache_secretos["datos"] and time.monotonic() < _cache_secretos["expira"]:
        return _cache_secretos["datos"]

    try:
        resp = await _http.get(
                f"{VAULT_ADDR}/v1/secret/data/gateway",
            headers={"X-Vault-Token": VAULT_TOKEN, REQUEST_ID_HEADER: request_id_de(request)},
        )
    except httpx.RequestError:
        log(SERVICE, level="error", event="vault_unavailable", request_id=request_id_de(request))
        raise ApiError(503, "SECRETS_UNAVAILABLE", "Servicio no disponible por el momento")

    if resp.status_code != 200:
        log(SERVICE, level="error", event="vault_error", request_id=request_id_de(request),
            vault_status=resp.status_code)
        raise ApiError(503, "SECRETS_UNAVAILABLE", "Servicio no disponible por el momento")

    datos = resp.json()["data"]["data"]
    _cache_secretos["datos"] = datos
    _cache_secretos["expira"] = time.monotonic() + VAULT_CACHE_SECONDS
    # Solo los nombres, nunca los valores
    log(SERVICE, level="info", event="secret_loaded", request_id=request_id_de(request),
        vault_path="secret/gateway", keys=sorted(datos))
    return datos


# ---------------------------------------------------------------------------
# Identidad
# ---------------------------------------------------------------------------

async def llamar_auth(request: Request, ruta: str, body: dict, con_secreto: bool) -> httpx.Response:
    headers = {REQUEST_ID_HEADER: request_id_de(request)}
    if con_secreto:
        headers["X-Gateway-Secret"] = (await secretos(request))["auth_introspection_secret"]
    try:
        return await _http.post(f"{AUTH_URL}{ruta}", json=body, headers=headers)
    except httpx.TimeoutException:
        raise ApiError(504, "UPSTREAM_TIMEOUT", "El servicio de autenticacion no respondio a tiempo")
    except httpx.RequestError:
        raise ApiError(502, "UPSTREAM_UNAVAILABLE", "El servicio de autenticacion no esta disponible")


async def obtener_identidad(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        raise ApiError(401, "UNAUTHENTICATED", "Inicia sesion para continuar")

    resp = await llamar_auth(request, "/introspect", {"token": token}, con_secreto=True)
    data = resp.json() if resp.status_code == 200 else {}
    if not data.get("active"):
        raise ApiError(401, "SESSION_INVALID", "Tu sesion expiro o no es valida")

    identidad = {
        "user_id": str(data["user_id"]),
        "roles": [r.upper() for r in data.get("roles", [])],
        "nombre": data.get("nombre", ""),  # solo para /me; no se reenvia a los servicios
    }
    request.state.user_id = identidad["user_id"]
    return identidad


# ---------------------------------------------------------------------------
# Reenvio a servicios internos
# ---------------------------------------------------------------------------

async def reenviar(request: Request, ruta: RouteDefinition, identidad: dict | None) -> Response:
    destino = SERVICIOS[ruta.destino]

    for valor in request.path_params.values():
        if not _PARAM_VALIDO.match(valor):
            raise ApiError(400, "INVALID_ID", "El identificador tiene un formato invalido")
    ruta_interna = ruta.ruta_interna.format(**{k: quote(v, safe="") for k, v in request.path_params.items()})

    # Solo se reenvian los headers que el gateway decide. Los X-Authenticated-*
    # que mande el navegador se descartan.
    headers = {
        "X-Gateway-Secret": (await secretos(request))[destino.secreto],
        REQUEST_ID_HEADER: request_id_de(request),
    }
    if identidad:
        headers["X-Authenticated-User"] = identidad["user_id"]
        headers["X-Authenticated-Roles"] = ",".join(identidad["roles"])
    for nombre in ("content-type", "idempotency-key", "x-proveedor-secret"):
        if request.headers.get(nombre):
            headers[nombre] = request.headers[nombre]

    try:
        upstream = await _http.request(
            ruta.method,
            f"{destino.url}{ruta_interna}",
            params=request.query_params,
            content=await request.body(),
            headers=headers,
        )
    except httpx.TimeoutException:
        raise ApiError(504, "UPSTREAM_TIMEOUT", f"El servicio {ruta.destino} no respondio a tiempo")
    except httpx.RequestError:
        raise ApiError(502, "UPSTREAM_UNAVAILABLE", f"El servicio {ruta.destino} no esta disponible")

    response_headers = {}
    if "content-type" in upstream.headers:
        response_headers["content-type"] = upstream.headers["content-type"]
    return Response(content=upstream.content, status_code=upstream.status_code, headers=response_headers)


def registrar(ruta: RouteDefinition):
    async def handler(request: Request):
        identidad = None
        if ruta.acceso != "anonimo":
            identidad = await obtener_identidad(request)
            if ruta.acceso == "rol" and not set(ruta.roles) & set(identidad["roles"]):
                raise ApiError(403, "FORBIDDEN", "No tienes permiso para esta operacion")
        return await reenviar(request, ruta, identidad)

    app.add_api_route(ruta.path, handler, methods=[ruta.method], name=ruta.id)


for _ruta in RUTAS:
    registrar(_ruta)


# ---------------------------------------------------------------------------
# Rutas propias del gateway (S06, S07, S08)
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "OK", "service": SERVICE}


@app.post("/api/v1/auth/login", name="S06")
async def login(request: Request):
    try:
        body = await request.json()
    except ValueError:
        raise ApiError(400, "BAD_REQUEST", "El cuerpo debe ser JSON")

    resp = await llamar_auth(request, "/login", body, con_secreto=False)
    if resp.status_code == 422:
        raise ApiError(422, "VALIDATION_ERROR", "Debes enviar correo y clave")
    if resp.status_code != 200:
        raise ApiError(401, "INVALID_CREDENTIALS", "Correo o clave incorrectos")

    data = resp.json()
    respuesta = JSONResponse(content={"status": "OK"})
    respuesta.set_cookie(
        key="session_token",
        value=data["access_token"],
        max_age=int(data.get("expires_in", 900)),
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )
    return respuesta


@app.get("/api/v1/auth/me", name="S08")
async def me(request: Request):
    return await obtener_identidad(request)


@app.post("/api/v1/auth/logout", name="S07")
async def logout(request: Request):
    token = request.cookies.get("session_token")
    if token:
        await llamar_auth(request, "/logout", {"token": token}, con_secreto=True)
    respuesta = JSONResponse(content={"status": "OK"})
    respuesta.delete_cookie("session_token")
    return respuesta


# ---------------------------------------------------------------------------
# Front estatico en el mismo origen (http://localhost:8000/). Va al final, para que
# las rutas de la API tengan prioridad. Solo sirve archivos de FRONTEND_DIR.
# ---------------------------------------------------------------------------

if FRONTEND_DIR and os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
