import hashlib
import json
import os
import secrets
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta, timezone
from enum import Enum
from typing import Optional

import httpx
from fastapi import Depends, FastAPI, Header, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from observabilidad import REQUEST_ID_HEADER, ApiError, instalar, log, request_id_de

SERVICE = "orders"


def requerida(nombre: str) -> str:
    valor = os.getenv(nombre)
    if not valor:
        raise RuntimeError(f"{nombre} no esta configurado")
    return valor


INTERNAL_GATEWAY_SECRET = requerida("INTERNAL_GATEWAY_SECRET")
ORDERS_INVENTORY_SECRET = requerida("ORDERS_INVENTORY_SECRET")
# Secreto propio de la integracion payments -> orders
PAYMENTS_ORDERS_SECRET = requerida("PAYMENTS_ORDERS_SECRET")
# Secreto propio de la integracion graphql-gateway -> orders (solo lectura)
GRAPHQL_ORDERS_SECRET = requerida("GRAPHQL_ORDERS_SECRET")
IVA = 0.19
MONGO_URL = requerida("MONGO_URL")
MONGO_DB = os.getenv("MONGO_DB", "orders")
INVENTORY_URL = os.getenv("INVENTORY_URL", "http://inventory:8000")
UPSTREAM_TIMEOUT = float(os.getenv("UPSTREAM_TIMEOUT_SECONDS", "5"))
# R04: las ventas web se asocian a la caja del cajero virtual
CAJERO_VIRTUAL_ID = os.getenv("CAJERO_VIRTUAL_ID", "USR-0005")

cliente_mongo = AsyncIOMotorClient(MONGO_URL)
db = cliente_mongo[MONGO_DB]
pedidos = db["pedidos"]
contadores = db["contadores"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Un mismo cliente no puede repetir un Idempotency-Key
    await pedidos.create_index([("cliente_id", 1), ("idempotency_key", 1)], unique=True)
    await pedidos.create_index([("estado", 1), ("creado_en", 1)])
    yield


app = FastAPI(title="Chocomania orders", lifespan=lifespan)
instalar(app, SERVICE, confiar_identidad=True)


class Estado(str, Enum):
    PENDIENTE_PAGO = "PENDIENTE_PAGO"
    PAGADO = "PAGADO"
    EN_DESPACHO = "EN_DESPACHO"
    ENTREGADO = "ENTREGADO"
    ANULADO = "ANULADO"


ESTADOS_VENDIDOS = [Estado.PAGADO.value, Estado.EN_DESPACHO.value, Estado.ENTREGADO.value]

# Transiciones que puede hacer DESPACHO o ADMIN (S15). PAGADO lo pone solo payments.
TRANSICIONES_DESPACHO = {
    Estado.EN_DESPACHO.value: Estado.PAGADO.value,
    Estado.ENTREGADO.value: Estado.EN_DESPACHO.value,
}


# ---------------------------------------------------------------------------
# Modelos de entrada. Lo que no esta aqui (precio, total, estado) se ignora.
# ---------------------------------------------------------------------------

class ItemPedido(BaseModel):
    producto_id: str = Field(min_length=1, max_length=64)
    cantidad: int = Field(ge=1, le=20)


class Despacho(BaseModel):
    direccion: str = Field(min_length=3, max_length=120)
    comuna: str = Field(min_length=2, max_length=60)
    telefono: Optional[str] = Field(default=None, max_length=20)


class NuevoPedido(BaseModel):
    lineas: list[ItemPedido] = Field(min_length=1, max_length=20)
    despacho: Despacho


class Anulacion(BaseModel):
    motivo: str = Field(min_length=3, max_length=200)


class CambioEstado(BaseModel):
    estado: Estado


# ---------------------------------------------------------------------------
# Seguridad
# ---------------------------------------------------------------------------

def verify_gateway(x_gateway_secret: str = Header(default="")):
    if not secrets.compare_digest(x_gateway_secret, INTERNAL_GATEWAY_SECRET):
        raise ApiError(403, "FORBIDDEN", "Solicitud no autorizada: debe pasar por el gateway")


def verify_lectura(x_gateway_secret: str = Header(default="")):
    """Lecturas: las acepta el API Gateway o el GraphQL Gateway, cada uno con su propio secreto."""
    if not (secrets.compare_digest(x_gateway_secret, INTERNAL_GATEWAY_SECRET)
            or secrets.compare_digest(x_gateway_secret, GRAPHQL_ORDERS_SECRET)):
        raise ApiError(403, "FORBIDDEN", "Solicitud no autorizada: debe pasar por el gateway")


def verify_payments(x_service_secret: str = Header(default="")):
    if not secrets.compare_digest(x_service_secret, PAYMENTS_ORDERS_SECRET):
        raise ApiError(403, "FORBIDDEN", "Solo payments puede usar esta operacion")


class Identidad(BaseModel):
    user_id: str
    roles: list[str]

    def tiene(self, *roles: str) -> bool:
        return bool(set(roles) & set(self.roles))


def identidad(
    x_authenticated_user: str = Header(default=""),
    x_authenticated_roles: str = Header(default=""),
) -> Identidad:
    if not x_authenticated_user:
        raise ApiError(401, "UNAUTHENTICATED", "Inicia sesion para continuar")
    roles = [r for r in x_authenticated_roles.split(",") if r]
    return Identidad(user_id=x_authenticated_user, roles=roles)


def puede_ver(quien: Identidad, pedido: dict) -> bool:
    """Regla de propiedad (M4): el cliente solo ve sus pedidos. Se revisa aqui, no solo en el gateway."""
    if quien.tiene("ADMIN"):
        return True
    if quien.tiene("DESPACHO") and pedido["estado"] in ESTADOS_VENDIDOS:
        return True
    return pedido["cliente_id"] == quien.user_id


def no_encontrado():
    # Para un pedido ajeno se responde lo mismo que si no existiera
    return ApiError(404, "ORDER_NOT_FOUND", "Pedido no encontrado")


# ---------------------------------------------------------------------------
# Llamadas a inventory
# ---------------------------------------------------------------------------

async def llamar_inventory(request: Request, ruta: str, items: list[dict]) -> dict:
    headers = {"X-Service-Secret": ORDERS_INVENTORY_SECRET, REQUEST_ID_HEADER: request_id_de(request)}
    try:
        async with httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT) as client:
            resp = await client.post(f"{INVENTORY_URL}{ruta}", json={"items": items}, headers=headers)
    except httpx.TimeoutException:
        raise ApiError(504, "UPSTREAM_TIMEOUT", "inventory no respondio a tiempo")
    except httpx.RequestError:
        raise ApiError(502, "UPSTREAM_UNAVAILABLE", "inventory no esta disponible")

    if resp.status_code == 200:
        return resp.json()
    # Errores de negocio de inventory (stock insuficiente, producto inexistente) se pasan tal cual
    if resp.status_code in (400, 404, 409, 422):
        error = resp.json().get("error", {})
        raise ApiError(resp.status_code, error.get("code", "ERROR"), error.get("message", "Error en inventory"))
    raise ApiError(502, "UPSTREAM_UNAVAILABLE", "inventory respondio con un error")


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def ahora() -> datetime:
    return datetime.now(timezone.utc)


def iso(valor: datetime) -> str:
    if valor.tzinfo is None:  # Mongo devuelve fechas sin zona (en UTC)
        valor = valor.replace(tzinfo=timezone.utc)
    return valor.isoformat(timespec="seconds")


async def siguiente_id() -> str:
    contador = await contadores.find_one_and_update(
        {"_id": "pedido"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"PED-{contador['seq']:04d}"


def huella_cuerpo(nuevo: NuevoPedido) -> str:
    return hashlib.sha256(json.dumps(nuevo.model_dump(), sort_keys=True).encode()).hexdigest()


def salida(pedido: dict, quien: Identidad) -> dict:
    datos = {
        "id": pedido["_id"],
        "cliente_id": pedido["cliente_id"],
        "estado": pedido["estado"],
        "cajero_id": pedido.get("cajero_id"),
        "lineas": pedido["lineas"],
        "total": pedido["total"],
        "creado_en": iso(pedido["creado_en"]),
        "historial": [{**h, "fecha": iso(h["fecha"])} for h in pedido.get("historial", [])],
    }
    # La direccion solo la ven el dueno, DESPACHO (pedidos pagados) y ADMIN (M7)
    if pedido["cliente_id"] == quien.user_id or quien.tiene("ADMIN", "DESPACHO"):
        datos["despacho"] = pedido.get("despacho")
    if pedido.get("motivo_anulacion"):
        datos["motivo_anulacion"] = pedido["motivo_anulacion"]
    if pedido.get("boleta"):
        datos["boleta"] = pedido["boleta"]
    return datos


def leer_idempotency_key(idempotency_key: str = Header(default="")) -> str:
    clave = idempotency_key.strip()
    if not (8 <= len(clave) <= 64) or not all(c.isalnum() or c in "-_" for c in clave):
        raise ApiError(400, "IDEMPOTENCY_KEY_REQUIRED",
                       "Falta el header Idempotency-Key (8 a 64 caracteres: letras, numeros, - o _)")
    return clave


# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "OK", "service": SERVICE}


@app.post("/pedidos", status_code=201, dependencies=[Depends(verify_gateway)])
async def crear_pedido(
    nuevo: NuevoPedido,
    request: Request,
    quien: Identidad = Depends(identidad),
    clave: str = Depends(leer_idempotency_key),
):
    """S11. El precio y el total los calcula el servidor con los datos de inventory."""
    if not quien.tiene("CLIENTE"):
        raise ApiError(403, "FORBIDDEN", "Solo un CLIENTE puede crear pedidos")

    ids = [i.producto_id for i in nuevo.lineas]
    if len(ids) != len(set(ids)):
        raise ApiError(400, "BAD_REQUEST", "Cada producto debe aparecer una sola vez")

    huella = huella_cuerpo(nuevo)
    existente = await pedidos.find_one({"cliente_id": quien.user_id, "idempotency_key": clave})
    if existente:
        if existente["huella_cuerpo"] != huella:
            raise ApiError(409, "IDEMPOTENCY_CONFLICT", "Ese Idempotency-Key ya se uso con otro pedido")
        log(SERVICE, level="info", event="idempotent_replay", request_id=request_id_de(request),
            pedido_id=existente["_id"])
        return salida(existente, quien)  # mismo pedido, sin descontar stock otra vez

    items_inventory = [i.model_dump() for i in nuevo.lineas]
    reserva = await llamar_inventory(request, "/interno/reservas", items_inventory)
    lineas = [{**i, "subtotal": i["precio_unitario"] * i["cantidad"]} for i in reserva["items"]]

    momento = ahora()
    pedido = {
        "_id": await siguiente_id(),
        "cliente_id": quien.user_id,
        "cajero_id": CAJERO_VIRTUAL_ID,
        "estado": Estado.PENDIENTE_PAGO.value,
        "lineas": lineas,
        "total": sum(i["subtotal"] for i in lineas),
        "despacho": nuevo.despacho.model_dump(),
        "idempotency_key": clave,
        "huella_cuerpo": huella,
        "request_id": request_id_de(request),  # referencia de operacion (plan 2.1)
        "creado_en": momento,
        "historial": [{"estado": Estado.PENDIENTE_PAGO.value, "fecha": momento, "por": quien.user_id}],
        "stock_devuelto": False,
    }
    try:
        await pedidos.insert_one(pedido)
    except DuplicateKeyError:
        # Dos solicitudes iguales al mismo tiempo (doble clic): gana la primera
        await llamar_inventory(request, "/interno/devoluciones", items_inventory)
        existente = await pedidos.find_one({"cliente_id": quien.user_id, "idempotency_key": clave})
        return salida(existente, quien)

    log(SERVICE, level="info", event="order_created", request_id=request_id_de(request),
        pedido_id=pedido["_id"], user_id=quien.user_id, total=pedido["total"])
    return salida(pedido, quien)


@app.get("/pedidos", dependencies=[Depends(verify_lectura)])
async def listar_pedidos(
    estado: Optional[Estado] = None,
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=20, ge=1, le=50),
    quien: Identidad = Depends(identidad),
):
    """S14 (cola de despacho, DESPACHO/ADMIN). Un CLIENTE solo recibe los suyos."""
    filtro: dict = {}
    if estado:
        filtro["estado"] = estado.value
    if quien.tiene("ADMIN"):
        pass
    elif quien.tiene("DESPACHO"):
        filtro.setdefault("estado", {"$in": ESTADOS_VENDIDOS})
        if isinstance(filtro["estado"], str) and filtro["estado"] not in ESTADOS_VENDIDOS:
            raise ApiError(403, "FORBIDDEN", "DESPACHO solo ve pedidos pagados")
    else:
        filtro["cliente_id"] = quien.user_id

    total = await pedidos.count_documents(filtro)
    cursor = pedidos.find(filtro).sort("creado_en", 1).skip((pagina - 1) * por_pagina).limit(por_pagina)
    return {"pedidos": [salida(p, quien) async for p in cursor], "pagina": pagina, "total": total}


@app.get("/pedidos/{id}", dependencies=[Depends(verify_lectura)])
async def ver_pedido(id: str, quien: Identidad = Depends(identidad)):
    """S12."""
    pedido = await pedidos.find_one({"_id": id})
    if pedido is None or not puede_ver(quien, pedido):
        raise no_encontrado()
    return salida(pedido, quien)


@app.post("/pedidos/{id}/anular", dependencies=[Depends(verify_gateway)])
async def anular_pedido(id: str, datos: Anulacion, request: Request, quien: Identidad = Depends(identidad)):
    """S13. Anular no borra: cambia el estado, guarda el motivo y devuelve el stock."""
    pedido = await pedidos.find_one({"_id": id})
    if pedido is None or not (pedido["cliente_id"] == quien.user_id or quien.tiene("ADMIN")):
        raise no_encontrado()

    momento = ahora()
    # El cambio de estado es atomico: si dos anulaciones llegan juntas, solo una devuelve stock
    actualizado = await pedidos.find_one_and_update(
        {"_id": id, "estado": Estado.PENDIENTE_PAGO.value},
        {
            "$set": {"estado": Estado.ANULADO.value, "motivo_anulacion": datos.motivo},
            "$push": {"historial": {"estado": Estado.ANULADO.value, "fecha": momento, "por": quien.user_id}},
        },
        return_document=ReturnDocument.AFTER,
    )
    if actualizado is None:
        raise ApiError(409, "TRANSICION_INVALIDA",
                       f"Solo se puede anular un pedido PENDIENTE_PAGO (estado actual: {pedido['estado']})")

    items = [{"producto_id": i["producto_id"], "cantidad": i["cantidad"]} for i in actualizado["lineas"]]
    try:
        await llamar_inventory(request, "/interno/devoluciones", items)
        await pedidos.update_one({"_id": id}, {"$set": {"stock_devuelto": True}})
        actualizado["stock_devuelto"] = True
    except ApiError:
        # El pedido queda anulado; el stock se marca como pendiente de devolver
        log(SERVICE, level="error", event="stock_return_failed", request_id=request_id_de(request), pedido_id=id)

    log(SERVICE, level="info", event="order_cancelled", request_id=request_id_de(request),
        pedido_id=id, user_id=quien.user_id)
    return salida(actualizado, quien)


@app.patch("/pedidos/{id}/estado", dependencies=[Depends(verify_gateway)])
async def cambiar_estado(id: str, datos: CambioEstado, request: Request, quien: Identidad = Depends(identidad)):
    """S15. DESPACHO o ADMIN: PAGADO -> EN_DESPACHO -> ENTREGADO."""
    if not quien.tiene("DESPACHO", "ADMIN"):
        raise ApiError(403, "FORBIDDEN", "Solo DESPACHO o ADMIN pueden cambiar el estado")
    nuevo = datos.estado.value
    if nuevo not in TRANSICIONES_DESPACHO:
        raise ApiError(409, "TRANSICION_INVALIDA", f"No se puede pasar a {nuevo} desde el despacho")

    momento = ahora()
    actualizado = await pedidos.find_one_and_update(
        {"_id": id, "estado": TRANSICIONES_DESPACHO[nuevo]},
        {"$set": {"estado": nuevo},
         "$push": {"historial": {"estado": nuevo, "fecha": momento, "por": quien.user_id}}},
        return_document=ReturnDocument.AFTER,
    )
    if actualizado is None:
        pedido = await pedidos.find_one({"_id": id})
        if pedido is None:
            raise no_encontrado()
        raise ApiError(409, "TRANSICION_INVALIDA",
                       f"No se puede pasar de {pedido['estado']} a {nuevo}")
    log(SERVICE, level="info", event="order_status_changed", request_id=request_id_de(request),
        pedido_id=id, estado=nuevo, user_id=quien.user_id)
    return salida(actualizado, quien)


@app.get("/reportes/ventas", dependencies=[Depends(verify_gateway)])
async def reporte_ventas(
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    quien: Identidad = Depends(identidad),
):
    """S19 (ADR analitica). Se calcula al consultar, sin datos personales de clientes."""
    if not quien.tiene("DUENO", "ADMIN"):
        raise ApiError(403, "FORBIDDEN", "Solo DUENO o ADMIN ven el reporte de ventas")

    if desde and hasta and desde > hasta:
        raise ApiError(400, "BAD_REQUEST", "La fecha desde no puede ser mayor que hasta")

    filtro: dict = {"estado": {"$in": ESTADOS_VENDIDOS}}
    rango = {}
    if desde:
        rango["$gte"] = datetime.combine(desde, time.min, tzinfo=timezone.utc)
    if hasta:
        rango["$lt"] = datetime.combine(hasta + timedelta(days=1), time.min, tzinfo=timezone.utc)
    if rango:
        filtro["creado_en"] = rango

    por_producto: dict = {}
    cantidad_pedidos = 0
    total = 0
    async for pedido in pedidos.find(filtro):
        cantidad_pedidos += 1
        total += pedido["total"]
        for linea in pedido["lineas"]:
            fila = por_producto.setdefault(linea["producto_id"],
                                           {"producto_id": linea["producto_id"], "nombre": linea["nombre"],
                                            "cantidad": 0, "monto": 0})
            fila["cantidad"] += linea["cantidad"]
            fila["monto"] += linea["subtotal"]

    return {
        "desde": desde.isoformat() if desde else None,
        "hasta": hasta.isoformat() if hasta else None,
        "cantidad_pedidos": cantidad_pedidos,
        "total_ventas": total,
        "por_producto": sorted(por_producto.values(), key=lambda f: -f["monto"]),
    }


# ---------------------------------------------------------------------------
# Operaciones internas para payments (no estan en la lista blanca del gateway)
# ---------------------------------------------------------------------------

class AvisoPagado(BaseModel):
    pago_id: str = Field(min_length=1, max_length=40)


@app.get("/interno/pedidos/{id}", dependencies=[Depends(verify_payments)])
async def pedido_para_pago(id: str):
    """payments consulta el dueno, el estado y el total. El monto nunca lo manda el navegador."""
    pedido = await pedidos.find_one({"_id": id})
    if pedido is None:
        raise no_encontrado()
    return {"id": pedido["_id"], "cliente_id": pedido["cliente_id"], "estado": pedido["estado"],
            "total": pedido["total"]}


@app.post("/interno/pedidos/{id}/pagado", dependencies=[Depends(verify_payments)])
async def marcar_pagado(id: str, aviso: AvisoPagado, request: Request):
    """Solo payments decide que un pedido esta pagado (M3). Emite la boleta (R08, sin envio por correo)."""
    pedido = await pedidos.find_one({"_id": id})
    if pedido is None:
        raise no_encontrado()
    if pedido["estado"] == Estado.PAGADO.value and pedido.get("pago_id") == aviso.pago_id:
        return salida(pedido, Identidad(user_id="payments", roles=["ADMIN"]))  # aviso repetido

    momento = ahora()
    # Primero el cambio de estado (atomico); la boleta se numera solo si se pago de verdad
    actualizado = await pedidos.find_one_and_update(
        {"_id": id, "estado": Estado.PENDIENTE_PAGO.value},
        {"$set": {"estado": Estado.PAGADO.value, "pago_id": aviso.pago_id},
         "$push": {"historial": {"estado": Estado.PAGADO.value, "fecha": momento, "por": "payments"}}},
        return_document=ReturnDocument.AFTER,
    )
    if actualizado is None:
        raise ApiError(409, "PEDIDO_NO_PAGABLE",
                       f"El pedido no esta pendiente de pago (estado actual: {pedido['estado']})")

    contador = await contadores.find_one_and_update(
        {"_id": "boleta"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    neto = round(actualizado["total"] / (1 + IVA))
    boleta = {
        "numero": f"B-{contador['seq']:06d}",
        "fecha": iso(momento),
        "neto": neto,
        "iva": actualizado["total"] - neto,
        "total": actualizado["total"],
    }
    await pedidos.update_one({"_id": id}, {"$set": {"boleta": boleta}})
    actualizado["boleta"] = boleta
    log(SERVICE, level="info", event="order_paid", request_id=request_id_de(request),
        pedido_id=id, pago_id=aviso.pago_id, boleta=boleta["numero"])
    return salida(actualizado, Identidad(user_id="payments", roles=["ADMIN"]))
