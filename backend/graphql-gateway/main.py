"""GraphQL Gateway de Chocomania (M8).

Privado: solo lo alcanza el API Gateway (ruta S18), que ya valido la sesion.
Agrega datos de orders (pedidos) e inventory (estado actual de cada producto).
"""

import os
import secrets
from typing import Optional

import httpx
import strawberry
from fastapi import FastAPI, Header, Request
from strawberry.dataloader import DataLoader
from strawberry.extensions import MaxAliasesLimiter, MaxTokensLimiter, QueryDepthLimiter
from strawberry.fastapi import GraphQLRouter
from strawberry.types import Info

from observabilidad import REQUEST_ID_HEADER, ApiError, instalar, log, request_id_de

SERVICE = "graphql-gateway"


def requerida(nombre: str) -> str:
    valor = os.getenv(nombre)
    if not valor:
        raise RuntimeError(f"{nombre} no esta configurado")
    return valor


INTERNAL_GATEWAY_SECRET = requerida("INTERNAL_GATEWAY_SECRET")
GRAPHQL_ORDERS_SECRET = requerida("GRAPHQL_ORDERS_SECRET")
GRAPHQL_INVENTORY_SECRET = requerida("GRAPHQL_INVENTORY_SECRET")
ORDERS_URL = os.getenv("ORDERS_URL", "http://orders:8000")
INVENTORY_URL = os.getenv("INVENTORY_URL", "http://inventory:8000")
UPSTREAM_TIMEOUT = float(os.getenv("UPSTREAM_TIMEOUT_SECONDS", "3"))
MAX_DEPTH = int(os.getenv("GRAPHQL_MAX_DEPTH", "6"))
MAX_ALIASES = int(os.getenv("GRAPHQL_MAX_ALIASES", "10"))
MAX_TOKENS = int(os.getenv("GRAPHQL_MAX_TOKENS", "1000"))
MAX_POR_PAGINA = 20


class ErrorParcial(Exception):
    """Error de un campo: GraphQL devuelve el resto de los datos y lo informa en "errors"."""

    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.extensions = {"code": code}


# ---------------------------------------------------------------------------
# Llamadas a los servicios (con el request_id y la identidad que mando el gateway)
# ---------------------------------------------------------------------------

async def get_orders(contexto: dict, ruta: str, params: dict | None = None) -> httpx.Response:
    headers = {
        "X-Gateway-Secret": GRAPHQL_ORDERS_SECRET,
        REQUEST_ID_HEADER: contexto["request_id"],
        "X-Authenticated-User": contexto["user_id"],
        "X-Authenticated-Roles": ",".join(contexto["roles"]),
    }
    try:
        async with httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT) as client:
            return await client.get(f"{ORDERS_URL}{ruta}", params=params, headers=headers)
    except httpx.TimeoutException:
        raise ErrorParcial("orders no respondio a tiempo", "UPSTREAM_TIMEOUT")
    except httpx.RequestError:
        raise ErrorParcial("orders no esta disponible", "UPSTREAM_UNAVAILABLE")


def cargador_productos(contexto: dict) -> DataLoader:
    """DataLoader: junta todos los productos pedidos en la misma consulta y hace UNA sola llamada."""

    async def cargar(ids: list[str]) -> list:
        headers = {"X-Service-Secret": GRAPHQL_INVENTORY_SECRET, REQUEST_ID_HEADER: contexto["request_id"]}
        try:
            async with httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT) as client:
                resp = await client.post(f"{INVENTORY_URL}/interno/productos/lote", json={"ids": ids}, headers=headers)
        except httpx.TimeoutException:
            error = ErrorParcial("inventory no respondio a tiempo", "UPSTREAM_TIMEOUT")
            return [error] * len(ids)
        except httpx.RequestError:
            error = ErrorParcial("inventory no esta disponible", "UPSTREAM_UNAVAILABLE")
            return [error] * len(ids)
        if resp.status_code != 200:
            error = ErrorParcial("inventory respondio con un error", "UPSTREAM_ERROR")
            return [error] * len(ids)
        log(SERVICE, level="info", event="batch_loaded", request_id=contexto["request_id"],
            servicio="inventory", cantidad=len(ids))
        return resp.json()["productos"]

    return DataLoader(load_fn=cargar)


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

@strawberry.type
class Producto:
    id: strawberry.ID
    nombre: str
    categoria: Optional[str]
    imagen: Optional[str]
    disponible: bool
    _stock: strawberry.Private[int]

    @strawberry.field(description="Solo ADMIN. Para los demas roles devuelve null con error FORBIDDEN_FIELD.")
    def stock(self, info: Info) -> Optional[int]:
        if "ADMIN" not in info.context["roles"]:
            raise ErrorParcial("No tienes permiso para ver el stock", "FORBIDDEN_FIELD")
        return self._stock


@strawberry.type
class Boleta:
    numero: str
    fecha: str
    neto: int
    iva: int
    total: int


@strawberry.type
class Despacho:
    direccion: str
    comuna: str


@strawberry.type
class Linea:
    producto_id: strawberry.ID
    nombre: str = strawberry.field(description="Nombre al momento de la compra")
    cantidad: int
    precio_unitario: int
    subtotal: int
    _pedido: strawberry.Private["Pedido"]

    @strawberry.field(description="Estado ACTUAL del producto en inventory (puede venir null con error parcial)")
    async def producto(self, info: Info) -> Optional[Producto]:
        datos = await info.context["productos"].load(str(self.producto_id))
        if isinstance(datos, Exception):
            raise datos
        if datos is None:
            return None  # el producto ya no existe; el historial conserva nombre y precio
        return Producto(id=datos["id"], nombre=datos["nombre"], categoria=datos.get("categoria"),
                        imagen=datos.get("imagen"), disponible=datos["disponible"], _stock=datos.get("stock", 0))

    @strawberry.field(description="Pedido al que pertenece la linea")
    def pedido(self) -> "Pedido":
        return self._pedido


@strawberry.type
class Pedido:
    id: strawberry.ID
    estado: str
    total: int
    creado_en: str
    boleta: Optional[Boleta]
    despacho: Optional[Despacho]
    _lineas: strawberry.Private[list]

    @strawberry.field
    def lineas(self) -> list[Linea]:
        return [Linea(producto_id=l["producto_id"], nombre=l["nombre"], cantidad=l["cantidad"],
                      precio_unitario=l["precio_unitario"], subtotal=l["subtotal"], _pedido=self)
                for l in self._lineas]


@strawberry.type
class PaginaPedidos:
    items: list[Pedido]
    pagina: int
    por_pagina: int
    total: int


def a_pedido(p: dict) -> Pedido:
    boleta = p.get("boleta")
    despacho = p.get("despacho")
    return Pedido(
        id=p["id"], estado=p["estado"], total=p["total"], creado_en=p["creado_en"],
        boleta=Boleta(**boleta) if boleta else None,
        despacho=Despacho(direccion=despacho["direccion"], comuna=despacho["comuna"]) if despacho else None,
        _lineas=p["lineas"],
    )


def solo_cliente(info: Info):
    if "CLIENTE" not in info.context["roles"]:
        raise ErrorParcial("Solo un CLIENTE tiene pedidos propios", "FORBIDDEN")


@strawberry.type
class Query:
    @strawberry.field(description="Pedidos del cliente que inicio sesion, del mas antiguo al mas nuevo")
    async def mis_pedidos(self, info: Info, pagina: int = 1, por_pagina: int = 10) -> PaginaPedidos:
        solo_cliente(info)
        if pagina < 1 or not 1 <= por_pagina <= MAX_POR_PAGINA:
            raise ErrorParcial(f"pagina >= 1 y por_pagina entre 1 y {MAX_POR_PAGINA}", "BAD_REQUEST")
        # orders aplica la regla de propiedad: a un CLIENTE solo le devuelve sus pedidos
        resp = await get_orders(info.context, "/pedidos", {"pagina": pagina, "por_pagina": por_pagina})
        if resp.status_code != 200:
            raise ErrorParcial("No se pudieron obtener los pedidos", "UPSTREAM_ERROR")
        datos = resp.json()
        return PaginaPedidos(items=[a_pedido(p) for p in datos["pedidos"]], pagina=datos["pagina"],
                             por_pagina=por_pagina, total=datos["total"])

    @strawberry.field(description="Un pedido propio por ID (un pedido ajeno responde null)")
    async def pedido(self, info: Info, id: strawberry.ID) -> Optional[Pedido]:
        solo_cliente(info)
        resp = await get_orders(info.context, f"/pedidos/{id}")
        if resp.status_code == 404:
            return None
        if resp.status_code != 200:
            raise ErrorParcial("No se pudo obtener el pedido", "UPSTREAM_ERROR")
        return a_pedido(resp.json())


class SchemaConLogs(strawberry.Schema):
    def process_errors(self, errors, execution_context=None):
        # En vez del traceback de strawberry, una linea JSON por error (sin datos personales)
        for error in errors:
            original = getattr(error, "original_error", None)
            codigo = getattr(original, "extensions", {}).get("code") if original else None
            ctx = execution_context.context if execution_context and execution_context.context else {}
            log(SERVICE, level="warning", event="graphql_error", request_id=ctx.get("request_id", "-"),
                code=codigo or "VALIDATION", path=[str(p) for p in (error.path or [])])


schema = SchemaConLogs(
    query=Query,
    extensions=[
        QueryDepthLimiter(max_depth=MAX_DEPTH),       # rechaza consultas demasiado anidadas
        MaxAliasesLimiter(max_alias_count=MAX_ALIASES),  # evita repetir el mismo campo con alias
        MaxTokensLimiter(max_token_count=MAX_TOKENS),    # limita el tamano de la consulta
    ],
)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Chocomania GraphQL Gateway")
instalar(app, SERVICE, confiar_identidad=True)


async def contexto(
    request: Request,
    x_gateway_secret: str = Header(default=""),
    x_authenticated_user: str = Header(default=""),
    x_authenticated_roles: str = Header(default=""),
) -> dict:
    if not secrets.compare_digest(x_gateway_secret, INTERNAL_GATEWAY_SECRET):
        raise ApiError(403, "FORBIDDEN", "Solicitud no autorizada: debe pasar por el gateway")
    if not x_authenticated_user:
        raise ApiError(401, "UNAUTHENTICATED", "Inicia sesion para continuar")
    ctx = {
        "request_id": request_id_de(request),
        "user_id": x_authenticated_user,
        "roles": [r for r in x_authenticated_roles.split(",") if r],
    }
    ctx["productos"] = cargador_productos(ctx)
    return ctx


# graphql_ide=None: sin GraphiQL. Solo POST (GET deshabilitado).
app.include_router(
    GraphQLRouter(schema, context_getter=contexto, graphql_ide=None, allow_queries_via_get=False),
    prefix="/graphql",
)


@app.get("/health")
def health():
    return {"status": "OK", "service": SERVICE}
