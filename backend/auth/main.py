import hashlib
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, FastAPI, Header
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from observabilidad import ApiError, instalar, log

SERVICE = "auth"


def requerida(nombre: str) -> str:
    valor = os.getenv(nombre)
    if not valor:
        raise RuntimeError(f"{nombre} no esta configurado")
    return valor


AUTH_INTROSPECTION_SECRET = requerida("AUTH_INTROSPECTION_SECRET")
# Secreto propio de clients: solo puede crear, activar o revertir credenciales de CLIENTE
CLIENTS_AUTH_SECRET = requerida("CLIENTS_AUTH_SECRET")
MONGO_URL = requerida("MONGO_URL")
MONGO_DB = os.getenv("MONGO_DB", "auth")
AUTH_TOKEN_TTL = int(os.getenv("AUTH_TOKEN_TTL", "900"))  # segundos

cliente_mongo = AsyncIOMotorClient(MONGO_URL)
db = cliente_mongo[MONGO_DB]
usuarios = db["usuarios"]
sesiones = db["sesiones"]

# Hash de relleno: si el correo no existe, igual se compara una clave,
# para que la respuesta tarde lo mismo y no revele que correos estan registrados.
_HASH_RELLENO = bcrypt.hashpw(b"relleno", bcrypt.gensalt(rounds=12))


@asynccontextmanager
async def lifespan(app: FastAPI):
    await usuarios.create_index("correo", unique=True)
    # Mongo borra solo las sesiones vencidas (indice TTL)
    await sesiones.create_index("expires_at", expireAfterSeconds=0)
    log(SERVICE, level="info", event="startup", token_ttl_seconds=AUTH_TOKEN_TTL)
    yield


app = FastAPI(title="Auth Service de Chocomania", lifespan=lifespan)
instalar(app, SERVICE, confiar_identidad=False)


class LoginRequest(BaseModel):
    correo: str = Field(min_length=3, max_length=120)
    clave: str = Field(min_length=1, max_length=128)


class TokenRequest(BaseModel):
    token: str = Field(min_length=1, max_length=200)


def huella(token: str) -> str:
    """En la base se guarda el SHA-256 del token, nunca el token."""
    return hashlib.sha256(token.encode()).hexdigest()


def verify_gateway(x_gateway_secret: str = Header(default="")):
    if not secrets.compare_digest(x_gateway_secret, AUTH_INTROSPECTION_SECRET):
        raise ApiError(403, "FORBIDDEN", "Solicitud no autorizada: debe pasar por el gateway")


def verify_clients(x_service_secret: str = Header(default="")):
    if not secrets.compare_digest(x_service_secret, CLIENTS_AUTH_SECRET):
        raise ApiError(403, "FORBIDDEN", "Solicitud no autorizada")


class NuevoUsuarioRequest(BaseModel):
    correo: str = Field(min_length=5, max_length=120)
    clave: str = Field(min_length=6, max_length=128)
    nombre: str = Field(min_length=2, max_length=80)


@app.get("/health")
def health():
    return {"status": "OK", "service": SERVICE}


@app.post("/login")
async def login(datos: LoginRequest):
    usuario = await usuarios.find_one({"correo": datos.correo.strip().lower(), "activo": True})
    hash_guardado = usuario["password_hash"].encode() if usuario else _HASH_RELLENO
    clave_ok = bcrypt.checkpw(datos.clave.encode(), hash_guardado)

    if usuario is None or not clave_ok:
        raise ApiError(401, "INVALID_CREDENTIALS", "Correo o clave incorrectos")

    token = secrets.token_urlsafe(32)
    await sesiones.insert_one({
        "_id": huella(token),
        "user_id": usuario["_id"],
        "roles": usuario["roles"],
        "nombre": usuario.get("nombre", ""),
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=AUTH_TOKEN_TTL),
    })
    return {"access_token": token, "token_type": "bearer", "expires_in": AUTH_TOKEN_TTL}


@app.post("/introspect", dependencies=[Depends(verify_gateway)])
async def introspect(datos: TokenRequest):
    sesion = await sesiones.find_one({"_id": huella(datos.token)})
    if sesion is None:
        return {"active": False}

    expira = sesion["expires_at"]
    if expira.tzinfo is None:  # Mongo devuelve fechas sin zona (en UTC)
        expira = expira.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) >= expira:
        await sesiones.delete_one({"_id": sesion["_id"]})
        return {"active": False}

    return {
        "active": True,
        "user_id": sesion["user_id"],
        "roles": sesion["roles"],
        "nombre": sesion.get("nombre", ""),
    }


@app.post("/logout", dependencies=[Depends(verify_gateway)])
async def logout(datos: TokenRequest):
    await sesiones.delete_one({"_id": huella(datos.token)})
    return {"status": "OK"}


# ---------------------------------------------------------------------------
# Rutas internas para clients (S09). No estan en la lista blanca del gateway.
# El rol siempre es CLIENTE: clients no puede crear personal ni administradores.
# ---------------------------------------------------------------------------

@app.post("/usuarios", status_code=201, dependencies=[Depends(verify_clients)])
async def crear_usuario(datos: NuevoUsuarioRequest):
    user_id = f"USR-{secrets.token_hex(4).upper()}"
    try:
        await usuarios.insert_one({
            "_id": user_id,
            "correo": datos.correo.strip().lower(),
            "nombre": datos.nombre,
            "password_hash": bcrypt.hashpw(datos.clave.encode(), bcrypt.gensalt(rounds=12)).decode(),
            "roles": ["CLIENTE"],
            "activo": False,  # se activa al verificar el correo
        })
    except DuplicateKeyError:
        raise ApiError(409, "USER_EXISTS", "El correo ya esta registrado")
    return {"user_id": user_id}


@app.post("/usuarios/{user_id}/activar", dependencies=[Depends(verify_clients)])
async def activar_usuario(user_id: str):
    r = await usuarios.update_one({"_id": user_id, "roles": ["CLIENTE"]}, {"$set": {"activo": True}})
    if r.matched_count == 0:
        raise ApiError(404, "USER_NOT_FOUND", "Usuario no encontrado")
    return {"status": "OK"}


@app.delete("/usuarios/{user_id}", dependencies=[Depends(verify_clients)])
async def revertir_usuario(user_id: str):
    """Solo borra credenciales de CLIENTE aun inactivas (reversion de un registro fallido)."""
    await usuarios.delete_one({"_id": user_id, "roles": ["CLIENTE"], "activo": False})
    return {"status": "OK"}
