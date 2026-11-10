"""Servicio clients de Chocomania (S09, S09V y S10).

Es la autoridad del PERFIL del cliente (RUN, nombre, direccion, telefono...).
Las credenciales NO viven aqui: la clave se manda a auth, que guarda solo su hash
bcrypt. Asi cada servicio administra solo sus datos (M3, M8).

Rutas internas (solo responden si traen el secreto del gateway):
    POST /clientes                    S09  registro (anonimo en el gateway)
    POST /clientes/{id}/verificar     S09V verificacion del correo (simulada, sin mensajeria)
    GET  /clientes/me                 S10  perfil propio (CLIENTE autenticado)
"""

import hashlib
import os
import re
import secrets
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone

import httpx
from fastapi import Depends, FastAPI, Header, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError

from observabilidad import REQUEST_ID_HEADER, ApiError, instalar, log, request_id_de

SERVICE = "clients"


def requerida(nombre: str) -> str:
    valor = os.getenv(nombre)
    if not valor:
        raise RuntimeError(f"{nombre} no esta configurado")
    return valor


INTERNAL_GATEWAY_SECRET = requerida("INTERNAL_GATEWAY_SECRET")
CLIENTS_AUTH_SECRET = requerida("CLIENTS_AUTH_SECRET")
MONGO_URL = requerida("MONGO_URL")
AUTH_URL = os.getenv("AUTH_URL", "http://auth:8000")
UPSTREAM_TIMEOUT = float(os.getenv("UPSTREAM_TIMEOUT_SECONDS", "3"))

db = AsyncIOMotorClient(MONGO_URL)[os.getenv("MONGO_DB", "clients")]
clientes = db["clientes"]
_http = httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await clientes.create_index("run", unique=True)
    await clientes.create_index("correo", unique=True)
    log(SERVICE, level="info", event="startup")
    yield
    await _http.aclose()


app = FastAPI(title="Servicio clients de Chocomania", lifespan=lifespan)
instalar(app, SERVICE, confiar_identidad=True)


# ---------------------------------------------------------------------------
# Seguridad entre componentes
# ---------------------------------------------------------------------------

def verify_gateway(x_gateway_secret: str = Header(default="")):
    if not secrets.compare_digest(x_gateway_secret, INTERNAL_GATEWAY_SECRET):
        raise ApiError(403, "FORBIDDEN", "Solicitud no autorizada: debe pasar por el gateway")


def cliente_autenticado(
    x_authenticated_user: str = Header(default=""),
    x_authenticated_roles: str = Header(default=""),
) -> str:
    """Identidad verificada por el gateway. Solo el rol CLIENTE tiene perfil."""
    if not x_authenticated_user:
        raise ApiError(401, "UNAUTHENTICATED", "Inicia sesion para continuar")
    if "CLIENTE" not in x_authenticated_roles.upper().split(","):
        raise ApiError(403, "FORBIDDEN", "No tienes permiso para esta operacion")
    return x_authenticated_user


# ---------------------------------------------------------------------------
# Validaciones (el servidor no confia en las del navegador)
# ---------------------------------------------------------------------------

def limpiar_run(run: str) -> str:
    return re.sub(r"[.\-\s]", "", run).upper()


def run_valido(run: str) -> bool:
    limpio = limpiar_run(run)
    if len(limpio) < 2 or not limpio[:-1].isdigit():
        return False
    cuerpo, dv = limpio[:-1], limpio[-1]
    suma, factor = 0, 2
    for digito in reversed(cuerpo):
        suma += int(digito) * factor
        factor = 2 if factor == 7 else factor + 1
    resto = 11 - (suma % 11)
    esperado = "0" if resto == 11 else "K" if resto == 10 else str(resto)
    return dv == esperado


def formatear_run(run: str) -> str:
    limpio = limpiar_run(run)
    cuerpo, dv = limpio[:-1], limpio[-1]
    return f"{int(cuerpo):,}".replace(",", ".") + f"-{dv}"


def huella(codigo: str) -> str:
    return hashlib.sha256(codigo.encode()).hexdigest()


class RegistroRequest(BaseModel):
    run: str = Field(min_length=3, max_length=12)
    nombre: str = Field(min_length=2, max_length=80)
    correo: str = Field(min_length=5, max_length=120)
    telefono: str = Field(min_length=8, max_length=16)
    direccion: str = Field(min_length=3, max_length=120)
    region: str = Field(min_length=2, max_length=60)
    provincia: str = Field(min_length=2, max_length=60)
    comuna: str = Field(min_length=2, max_length=60)
    nacimiento: date
    sexo: str = Field(min_length=1, max_length=20)
    clave: str = Field(min_length=6, max_length=128)

    @field_validator("run")
    @classmethod
    def validar_run(cls, valor: str) -> str:
        if not run_valido(valor):
            raise ValueError("RUN invalido")
        return formatear_run(valor)

    @field_validator("correo")
    @classmethod
    def validar_correo(cls, valor: str) -> str:
        valor = valor.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", valor):
            raise ValueError("correo invalido")
        return valor

    @field_validator("telefono")
    @classmethod
    def validar_telefono(cls, valor: str) -> str:
        valor = re.sub(r"\s", "", valor)
        if not re.fullmatch(r"\+?[0-9]{8,12}", valor):
            raise ValueError("telefono invalido")
        return valor

    @field_validator("nacimiento")
    @classmethod
    def validar_nacimiento(cls, valor: date) -> date:
        if valor > date.today():
            raise ValueError("la fecha no puede ser futura")
        return valor


class VerificarRequest(BaseModel):
    codigo: str = Field(pattern=r"^[0-9]{6}$")


# ---------------------------------------------------------------------------
# Llamadas a auth (dueno de las credenciales)
# ---------------------------------------------------------------------------

async def llamar_auth(request: Request, metodo: str, ruta: str, body: dict | None = None) -> httpx.Response:
    headers = {"X-Service-Secret": CLIENTS_AUTH_SECRET, REQUEST_ID_HEADER: request_id_de(request)}
    try:
        return await _http.request(metodo, f"{AUTH_URL}{ruta}", json=body, headers=headers)
    except httpx.TimeoutException:
        raise ApiError(504, "UPSTREAM_TIMEOUT", "El servicio de autenticacion no respondio a tiempo")
    except httpx.RequestError:
        raise ApiError(502, "UPSTREAM_UNAVAILABLE", "El servicio de autenticacion no esta disponible")


def enmascarar_run(run: str) -> str:
    """12.345.678-5 -> **.***.678-5 (M7): la pantalla no necesita el RUN completo."""
    cuerpo, dv = run.rsplit("-", 1)
    visibles = cuerpo[-3:]
    ocultos = re.sub(r"[0-9]", "*", cuerpo[:-3])
    return f"{ocultos}{visibles}-{dv}"


def perfil_dto(doc: dict) -> dict:
    """Lo minimo que necesita el front. Nunca la clave, el codigo ni datos internos."""
    return {
        "id": doc["_id"],
        "run": enmascarar_run(doc["run"]),
        "nombre": doc["nombre"],
        "correo": doc["correo"],
        "telefono": doc["telefono"],
        "direccion": doc["direccion"],
        "comuna": doc["comuna"],
        "provincia": doc["provincia"],
        "region": doc["region"],
        "verificado": doc.get("verificado", False),
    }


# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "OK", "service": SERVICE}


@app.post("/clientes", status_code=201, dependencies=[Depends(verify_gateway)])
async def registrar(datos: RegistroRequest, request: Request):
    """S09. Crea el perfil aqui y la credencial en auth (inactiva hasta verificar)."""
    if await clientes.find_one({"run": datos.run}, {"_id": 1}):
        raise ApiError(409, "CLIENT_EXISTS", "Ya existe una cuenta con ese RUN o correo")

    resp = await llamar_auth(request, "POST", "/usuarios", {
        "correo": datos.correo, "clave": datos.clave, "nombre": datos.nombre,
    })
    if resp.status_code == 409:
        raise ApiError(409, "CLIENT_EXISTS", "Ya existe una cuenta con ese RUN o correo")
    if resp.status_code != 201:
        log(SERVICE, level="error", event="auth_create_failed", request_id=request_id_de(request),
            auth_status=resp.status_code)
        raise ApiError(502, "UPSTREAM_UNAVAILABLE", "No se pudo crear la cuenta, intenta de nuevo")
    user_id = resp.json()["user_id"]

    # Verificacion simulada: el codigo "llegaria" por correo. Se guarda solo su hash.
    codigo = f"{secrets.randbelow(900000) + 100000}"
    doc = {
        "_id": user_id,
        **datos.model_dump(exclude={"clave", "nacimiento"}),
        "nacimiento": datos.nacimiento.isoformat(),
        "verificado": False,
        "codigo_hash": huella(codigo),
        "creado": datetime.now(timezone.utc),
        "request_id": request_id_de(request),
    }
    try:
        await clientes.insert_one(doc)
    except DuplicateKeyError:
        # Carrera con otro registro igual: se revierte la credencial recien creada
        await llamar_auth(request, "DELETE", f"/usuarios/{user_id}")
        raise ApiError(409, "CLIENT_EXISTS", "Ya existe una cuenta con ese RUN o correo")

    log(SERVICE, level="info", event="client_registered", request_id=request_id_de(request), user_id=user_id)
    # codigo_simulado reemplaza al correo mientras no exista el servicio de mensajeria (brecha R11)
    return {"id": user_id, "verificado": False, "codigo_simulado": codigo}


@app.post("/clientes/{cliente_id}/verificar", dependencies=[Depends(verify_gateway)])
async def verificar(cliente_id: str, datos: VerificarRequest, request: Request):
    """S09V. Si el codigo coincide, marca el perfil y activa la credencial en auth."""
    doc = await clientes.find_one({"_id": cliente_id})
    # Mismo mensaje si no existe o si el codigo no coincide (no revela cuentas)
    if doc is None or doc.get("verificado") or not secrets.compare_digest(
            doc.get("codigo_hash", ""), huella(datos.codigo)):
        raise ApiError(400, "INVALID_CODE", "El codigo no coincide o la cuenta ya fue verificada")

    resp = await llamar_auth(request, "POST", f"/usuarios/{cliente_id}/activar")
    if resp.status_code != 200:
        raise ApiError(502, "UPSTREAM_UNAVAILABLE", "No se pudo activar la cuenta, intenta de nuevo")
    await clientes.update_one({"_id": cliente_id},
                              {"$set": {"verificado": True}, "$unset": {"codigo_hash": ""}})
    return {"id": cliente_id, "verificado": True}


@app.get("/clientes/me", dependencies=[Depends(verify_gateway)])
async def mi_perfil(user_id: str = Depends(cliente_autenticado)):
    """S10. El id sale de la identidad verificada, nunca de la URL: no se puede pedir otro perfil."""
    doc = await clientes.find_one({"_id": user_id})
    if doc is None:
        raise ApiError(404, "CLIENT_NOT_FOUND", "No encontramos tu perfil")
    return perfil_dto(doc)
