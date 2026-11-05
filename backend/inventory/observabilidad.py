"""Correlacion, logs JSON y formato de error unico.

Este archivo es identico en todos los servicios (gateway, auth, inventory...).
Si se cambia en uno, se copia a los demas.
"""

import json
import re
import sys
import time
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

REQUEST_ID_HEADER = "X-Request-ID"
_REQUEST_ID_VALIDO = re.compile(r"^[A-Za-z0-9_-]{8,64}$")

CODIGOS = {
    400: "BAD_REQUEST",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_ERROR",
    502: "UPSTREAM_UNAVAILABLE",
    503: "SERVICE_UNAVAILABLE",
    504: "UPSTREAM_TIMEOUT",
}

MENSAJES = {
    404: "Recurso no encontrado",
    405: "Metodo no permitido para esta ruta",
    500: "Error interno",
}


class ApiError(Exception):
    """Error de negocio con codigo propio. Se responde con el formato unico."""

    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message


def log(service: str, **campos):
    """Escribe una linea JSON en stdout. Nunca pasar claves, tokens ni datos personales."""
    entrada = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        "service": service,
        **campos,
    }
    print(json.dumps(entrada, ensure_ascii=False), file=sys.stdout, flush=True)


def request_id_de(request: Request) -> str:
    return getattr(request.state, "request_id", "-")


def respuesta_error(request: Request, status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "request_id": request_id_de(request)}},
    )


def instalar(app: FastAPI, service: str, confiar_identidad: bool):
    """Agrega el middleware de correlacion y los manejadores de error.

    confiar_identidad: True solo en servicios internos, que reciben
    X-Authenticated-User desde el gateway. El gateway nunca lo lee del navegador.
    """

    @app.middleware("http")
    async def correlacion(request: Request, call_next):
        recibido = request.headers.get(REQUEST_ID_HEADER, "")
        request_id = recibido if _REQUEST_ID_VALIDO.match(recibido) else uuid.uuid4().hex
        request.state.request_id = request_id
        request.state.user_id = request.headers.get("X-Authenticated-User") if confiar_identidad else None

        inicio = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as error:  # error no controlado: se registra el tipo, no el detalle
            log(service, level="error", event="unhandled_exception", request_id=request_id,
                error_type=type(error).__name__)
            response = respuesta_error(request, 500, CODIGOS[500], MENSAJES[500])

        response.headers[REQUEST_ID_HEADER] = request_id
        if request.url.path != "/health":
            log(
                service,
                level="info",
                event="request",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                user_id=getattr(request.state, "user_id", None),
                duration_ms=round((time.perf_counter() - inicio) * 1000, 1),
            )
        return response

    @app.exception_handler(ApiError)
    async def manejar_api_error(request: Request, error: ApiError):
        return respuesta_error(request, error.status, error.code, error.message)

    @app.exception_handler(StarletteHTTPException)
    async def manejar_http(request: Request, error: StarletteHTTPException):
        code = CODIGOS.get(error.status_code, "ERROR")
        message = MENSAJES.get(error.status_code) or str(error.detail)
        return respuesta_error(request, error.status_code, code, message)

    @app.exception_handler(RequestValidationError)
    async def manejar_validacion(request: Request, error: RequestValidationError):
        # Solo se informa que campos fallaron, nunca los valores recibidos
        campos = sorted({".".join(str(p) for p in e["loc"] if p != "body") for e in error.errors()})
        return respuesta_error(request, 422, CODIGOS[422], "Datos invalidos: " + ", ".join(campos))
