"""Ayudas comunes para las pruebas de la Entrega 2.

Se ejecutan dentro de Docker (servicio `pruebas` de docker-compose.yml), con la
base recien reseteada: docker compose run --rm seed --reset
"""

import os
import uuid

import httpx
import pytest

BASE_URL = os.getenv("BASE_URL", "http://gateway:8000")

# IDs fijos de scripts/seed.py
DUBAI = "650000000000000000000001"      # stock 20, $8.990
BLANCO = "650000000000000000000002"     # stock 15, $4.990
TRUFAS = "650000000000000000000005"     # stock 0
PEDIDO_CLIENTE1 = "PED-0001"            # de USR-0001, pagado
PEDIDO_CLIENTE2 = "PED-0002"            # de USR-0002, pendiente de pago

CUENTAS = {
    "cliente1": ("cliente@correo.cl", "Cliente2026"),
    "cliente2": ("diego@correo.cl", "Diego2026"),
    "admin": ("admin@chocomania.cl", "Admin2026"),
}

DESPACHO = {"direccion": "Calle Ficticia 1", "comuna": "Providencia", "telefono": None}


def nuevo_id(prefijo: str) -> str:
    """X-Request-ID legible, para buscar la prueba con scripts/logs.sh."""
    return f"{prefijo}-{uuid.uuid4().hex[:8]}"


class Sesion:
    """Cliente HTTP contra el gateway que imprime el X-Request-ID de cada llamada."""

    def __init__(self, nombre: str, token: str | None = None):
        self.nombre = nombre
        self.token = token
        self.http = httpx.Client(base_url=BASE_URL, timeout=10)

    def pedir(self, metodo: str, ruta: str, prueba: str, **kwargs) -> httpx.Response:
        headers = dict(kwargs.pop("headers", {}) or {})
        headers.setdefault("X-Request-ID", nuevo_id(prueba))
        if self.token:
            headers["Cookie"] = f"session_token={self.token}"
        r = self.http.request(metodo, ruta, headers=headers, **kwargs)
        print(f"[{prueba}] {self.nombre} {metodo} {ruta} -> {r.status_code} "
              f"request_id={r.headers.get('x-request-id')}")
        return r

    def graphql(self, query: str, prueba: str, variables: dict | None = None) -> httpx.Response:
        return self.pedir("POST", "/api/v1/graphql", prueba, json={"query": query, "variables": variables or {}})


def iniciar_sesion(nombre: str) -> Sesion:
    correo, clave = CUENTAS[nombre]
    r = httpx.post(f"{BASE_URL}/api/v1/auth/login", json={"correo": correo, "clave": clave}, timeout=10)
    assert r.status_code == 200, f"login de {nombre} fallo: {r.status_code} {r.text}"
    # Se lee el Set-Cookie a mano: el host "gateway" no tiene punto y algunas
    # politicas de cookies lo descartan
    token = None
    for valor in r.headers.get_list("set-cookie"):
        if valor.startswith("session_token="):
            token = valor.split(";", 1)[0].split("=", 1)[1]
    assert token, "el login no devolvio la cookie session_token"
    return Sesion(nombre, token)


@pytest.fixture(scope="session")
def anonimo():
    return Sesion("anonimo")


@pytest.fixture(scope="session")
def cliente1():
    return iniciar_sesion("cliente1")


@pytest.fixture(scope="session")
def cliente2():
    return iniciar_sesion("cliente2")


def stock_de(sesion: Sesion, producto_id: str) -> int:
    r = sesion.pedir("GET", f"/api/v1/productos/{producto_id}", "stock")
    assert r.status_code == 200
    return r.json()["stock"]


def assert_error(r: httpx.Response, status: int, code: str | None = None):
    """Formato unico de error: {error: {code, message, request_id}} y header X-Request-ID."""
    assert r.status_code == status, r.text
    cuerpo = r.json()
    assert set(cuerpo["error"]) >= {"code", "message", "request_id"}
    assert cuerpo["error"]["request_id"] == r.headers["x-request-id"]
    if code:
        assert cuerpo["error"]["code"] == code
