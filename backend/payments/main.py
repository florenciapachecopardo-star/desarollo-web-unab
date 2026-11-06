import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from enum import Enum

import httpx
from fastapi import Depends, FastAPI, Header, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from observabilidad import REQUEST_ID_HEADER, ApiError, instalar, log, request_id_de

SERVICE = "payments"


def requerida(nombre: str) -> str:
    valor = os.getenv(nombre)
    if not valor:
        raise RuntimeError(f"{nombre} no esta configurado")
    return valor


INTERNAL_GATEWAY_SECRET = requerida("INTERNAL_GATEWAY_SECRET")
PAYMENTS_ORDERS_SECRET = requerida("PAYMENTS_ORDERS_SECRET")
PAYMENT_PROVIDER_SECRET = requerida("PAYMENT_PROVIDER_SECRET")
MONGO_URL = requerida("MONGO_URL")
MONGO_DB = os.getenv("MONGO_DB", "payments")
ORDERS_URL = os.getenv("ORDERS_URL", "http://orders:8000")
UPSTREAM_TIMEOUT = float(os.getenv("UPSTREAM_TIMEOUT_SECONDS", "3"))
# Proveedor simulado (doble de prueba, no es Webpay):
#   inmediato -> responde al iniciar el pago con SIMULADOR_RESULTADO
#   aviso     -> el pago queda PENDIENTE hasta que llega S17 (POST /pagos/aviso)
SIMULADOR_MODO = os.getenv("SIMULADOR_MODO", "inmediato")
SIMULADOR_RESULTADO = os.getenv("SIMULADOR_RESULTADO", "APROBADO")

cliente_mongo = AsyncIOMotorClient(MONGO_URL)
db = cliente_mongo[MONGO_DB]
pagos = db["pagos"]
contadores = db["contadores"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await pagos.create_index([("cliente_id", 1), ("idempotency_key", 1)], unique=True)
    await pagos.create_index("pedido_id")
    log(SERVICE, level="info", event="startup", simulador_modo=SIMULADOR_MODO)
    yield


app = FastAPI(title="Chocomania payments", lifespan=lifespan)
instalar(app, SERVICE, confiar_identidad=True)


class EstadoPago(str, Enum):
    PENDIENTE = "PENDIENTE"
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"
    REVERTIDO = "REVERTIDO"  # aprobado por el proveedor, pero el pedido ya estaba pagado


class Resultado(str, Enum):
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"


class NuevoPago(BaseModel):
    # Solo el pedido. El monto lo saca payments desde orders; datos de tarjeta no se reciben (M7)
    pedido_id: str = Field(min_length=1, max_length=40)


class Aviso(BaseModel):
    pago_id: str = Field(min_length=1, max_length=40)
    resultado: Resultado
    referencia_proveedor: str = Field(min_length=1, max_length=60)


# ---------------------------------------------------------------------------
# Seguridad
# ---------------------------------------------------------------------------

def verify_gateway(x_gateway_secret: str = Header(default="")):
    if not secrets.compare_digest(x_gateway_secret, INTERNAL_GATEWAY_SECRET):
        raise ApiError(403, "FORBIDDEN", "Solicitud no autorizada: debe pasar por el gateway")


def verify_proveedor(x_proveedor_secret: str = Header(default="")):
    if not secrets.compare_digest(x_proveedor_secret, PAYMENT_PROVIDER_SECRET):
        raise ApiError(401, "INVALID_PROVIDER_SIGNATURE", "Aviso rechazado: el secreto del proveedor no es valido")


def leer_idempotency_key(idempotency_key: str = Header(default="")) -> str:
    clave = idempotency_key.strip()
    if not (8 <= len(clave) <= 64) or not all(c.isalnum() or c in "-_" for c in clave):
        raise ApiError(400, "IDEMPOTENCY_KEY_REQUIRED",
                       "Falta el header Idempotency-Key (8 a 64 caracteres: letras, numeros, - o _)")
    return clave


# ---------------------------------------------------------------------------
# Integracion con orders
# ---------------------------------------------------------------------------

async def llamar_orders(request: Request, metodo: str, ruta: str, body: dict | None = None) -> httpx.Response:
    headers = {"X-Service-Secret": PAYMENTS_ORDERS_SECRET, REQUEST_ID_HEADER: request_id_de(request)}
    try:
        async with httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT) as client:
            return await client.request(metodo, f"{ORDERS_URL}{ruta}", json=body, headers=headers)
    except httpx.TimeoutException:
        raise ApiError(504, "UPSTREAM_TIMEOUT", "orders no respondio a tiempo")
    except httpx.RequestError:
        raise ApiError(502, "UPSTREAM_UNAVAILABLE", "orders no esta disponible")


# ---------------------------------------------------------------------------
# Proveedor simulado (adaptador que respeta el contrato del aviso)
# ---------------------------------------------------------------------------

class ProveedorSimulado:
    nombre = "simulado"

    def iniciar(self, pago_id: str) -> dict | None:
        """Devuelve el resultado al tiro (modo inmediato) o None si llegara por aviso."""
        if SIMULADOR_MODO == "aviso":
            return None
        return {"resultado": SIMULADOR_RESULTADO, "referencia_proveedor": f"SIM-{pago_id}"}


proveedor = ProveedorSimulado()


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def ahora() -> datetime:
    return datetime.now(timezone.utc)


def salida(pago: dict) -> dict:
    datos = {
        "id": pago["_id"],
        "pedido_id": pago["pedido_id"],
        "monto": pago["monto"],
        "estado": pago["estado"],
        "proveedor": pago["proveedor"],
        "creado_en": pago["creado_en"].replace(tzinfo=timezone.utc).isoformat(timespec="seconds")
        if pago["creado_en"].tzinfo is None else pago["creado_en"].isoformat(timespec="seconds"),
    }
    if pago.get("boleta"):
        datos["boleta"] = pago["boleta"]
    return datos


async def siguiente_id() -> str:
    contador = await contadores.find_one_and_update(
        {"_id": "pago"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"PAG-{contador['seq']:04d}"


async def aplicar_resultado(request: Request, pago: dict, resultado: str, referencia: str) -> dict:
    """Aplica una sola vez el resultado del proveedor. Un aviso repetido no cambia nada."""
    if pago["estado"] != EstadoPago.PENDIENTE.value:
        log(SERVICE, level="info", event="duplicate_notice_ignored", request_id=request_id_de(request),
            pago_id=pago["_id"], estado=pago["estado"])
        return pago

    nuevo_estado = EstadoPago.APROBADO.value if resultado == Resultado.APROBADO.value else EstadoPago.RECHAZADO.value
    actualizado = await pagos.find_one_and_update(
        {"_id": pago["_id"], "estado": EstadoPago.PENDIENTE.value},
        {"$set": {"estado": nuevo_estado, "referencia_proveedor": referencia, "resuelto_en": ahora()}},
        return_document=ReturnDocument.AFTER,
    )
    if actualizado is None:  # otro aviso lo resolvio al mismo tiempo
        return await pagos.find_one({"_id": pago["_id"]})

    if nuevo_estado == EstadoPago.APROBADO.value:
        resp = await llamar_orders(request, "POST", f"/interno/pedidos/{pago['pedido_id']}/pagado",
                                   {"pago_id": pago["_id"]})
        if resp.status_code == 200:
            boleta = resp.json().get("boleta")
            await pagos.update_one({"_id": pago["_id"]}, {"$set": {"boleta": boleta}})
            actualizado["boleta"] = boleta
        elif resp.status_code == 409:
            # El pedido ya estaba pagado con otro pago: este se revierte (con el simulador no hay cobro real)
            actualizado = await pagos.find_one_and_update(
                {"_id": pago["_id"]}, {"$set": {"estado": EstadoPago.REVERTIDO.value}},
                return_document=ReturnDocument.AFTER)
        else:
            log(SERVICE, level="error", event="order_update_failed", request_id=request_id_de(request),
                pago_id=pago["_id"], orders_status=resp.status_code)

    log(SERVICE, level="info", event="payment_resolved", request_id=request_id_de(request),
        pago_id=pago["_id"], pedido_id=pago["pedido_id"], estado=actualizado["estado"])
    return actualizado


# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "OK", "service": SERVICE}


@app.post("/pagos", status_code=201, dependencies=[Depends(verify_gateway)])
async def iniciar_pago(
    nuevo: NuevoPago,
    request: Request,
    clave: str = Depends(leer_idempotency_key),
    x_authenticated_user: str = Header(default=""),
    x_authenticated_roles: str = Header(default=""),
):
    """S16. Inicia el pago de un pedido propio. El monto sale de orders."""
    if "CLIENTE" not in x_authenticated_roles.split(","):
        raise ApiError(403, "FORBIDDEN", "Solo un CLIENTE puede pagar")

    existente = await pagos.find_one({"cliente_id": x_authenticated_user, "idempotency_key": clave})
    if existente:
        if existente["pedido_id"] != nuevo.pedido_id:
            raise ApiError(409, "IDEMPOTENCY_CONFLICT", "Ese Idempotency-Key ya se uso con otro pedido")
        log(SERVICE, level="info", event="idempotent_replay", request_id=request_id_de(request),
            pago_id=existente["_id"])
        return salida(existente)

    resp = await llamar_orders(request, "GET", f"/interno/pedidos/{nuevo.pedido_id}")
    if resp.status_code == 404:
        raise ApiError(404, "ORDER_NOT_FOUND", "Pedido no encontrado")
    if resp.status_code != 200:
        raise ApiError(502, "UPSTREAM_UNAVAILABLE", "orders respondio con un error")
    pedido = resp.json()
    if pedido["cliente_id"] != x_authenticated_user:
        raise ApiError(404, "ORDER_NOT_FOUND", "Pedido no encontrado")  # ajeno = inexistente
    if pedido["estado"] != "PENDIENTE_PAGO":
        raise ApiError(409, "PEDIDO_NO_PAGABLE",
                       f"El pedido no esta pendiente de pago (estado actual: {pedido['estado']})")

    pago = {
        "_id": await siguiente_id(),
        "pedido_id": pedido["id"],
        "cliente_id": x_authenticated_user,
        "monto": pedido["total"],
        "estado": EstadoPago.PENDIENTE.value,
        "proveedor": proveedor.nombre,
        "idempotency_key": clave,
        "request_id": request_id_de(request),
        "creado_en": ahora(),
    }
    try:
        await pagos.insert_one(pago)
    except DuplicateKeyError:  # doble clic simultaneo: gana el primero
        return salida(await pagos.find_one({"cliente_id": x_authenticated_user, "idempotency_key": clave}))

    log(SERVICE, level="info", event="payment_started", request_id=request_id_de(request),
        pago_id=pago["_id"], pedido_id=pago["pedido_id"], monto=pago["monto"])

    respuesta = proveedor.iniciar(pago["_id"])
    if respuesta:
        pago = await aplicar_resultado(request, pago, respuesta["resultado"], respuesta["referencia_proveedor"])
    return salida(pago)


@app.post("/pagos/aviso", dependencies=[Depends(verify_gateway), Depends(verify_proveedor)])
async def recibir_aviso(aviso: Aviso, request: Request):
    """S17. Aviso del proveedor. Se verifica su secreto y se procesa una sola vez."""
    pago = await pagos.find_one({"_id": aviso.pago_id})
    if pago is None:
        raise ApiError(404, "PAYMENT_NOT_FOUND", "Pago no encontrado")
    pago = await aplicar_resultado(request, pago, aviso.resultado.value, aviso.referencia_proveedor)
    return salida(pago)
