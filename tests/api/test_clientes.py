"""Pruebas del servicio clients (S09, S09V, S10) y del limite de solicitudes.
Cada prueba imprime el X-Request-ID de sus llamadas."""

import os
import random
import uuid

import httpx

from conftest import BASE_URL, Sesion, assert_error, nuevo_id

CLIENTS_URL = os.getenv("CLIENTS_URL", "http://clients:8000")
AUTH_URL = os.getenv("AUTH_URL", "http://auth:8000")


def run_ficticio() -> str:
    """RUN aleatorio con digito verificador valido (modulo 11)."""
    cuerpo = str(random.randint(30_000_000, 39_999_999))
    suma, factor = 0, 2
    for d in reversed(cuerpo):
        suma += int(d) * factor
        factor = 2 if factor == 7 else factor + 1
    resto = 11 - suma % 11
    return cuerpo + "-" + ("0" if resto == 11 else "K" if resto == 10 else str(resto))


def datos_registro(**cambios) -> dict:
    datos = {
        "run": run_ficticio(),
        "nombre": "Cliente de prueba",
        "correo": f"prueba-{uuid.uuid4().hex[:8]}@correo.cl",
        "telefono": "+56933333333",
        "direccion": "Calle Inventada 123",
        "region": "Region Metropolitana de Santiago",
        "provincia": "Santiago",
        "comuna": "Santiago",
        "nacimiento": "2000-01-15",
        "sexo": "Femenino",
        "clave": "ClaveSegura1",
    }
    datos.update(cambios)
    return datos


def login(correo: str, clave: str) -> httpx.Response:
    return httpx.post(f"{BASE_URL}/api/v1/auth/login", json={"correo": correo, "clave": clave},
                      headers={"X-Request-ID": nuevo_id("cli-login")}, timeout=10)


def token_de(r: httpx.Response) -> str:
    for valor in r.headers.get_list("set-cookie"):
        if valor.startswith("session_token="):
            return valor.split(";", 1)[0].split("=", 1)[1]
    raise AssertionError("sin cookie de sesion")


def test_registro_verificacion_login_y_perfil(anonimo):
    datos = datos_registro()

    # S09: registro anonimo. La respuesta no trae la clave ni su hash
    r = anonimo.pedir("POST", "/api/v1/clientes", "cli-registro", json=datos)
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert "clave" not in r.text and "password" not in r.text and "hash" not in r.text
    assert cuerpo["verificado"] is False

    # Sin verificar, la cuenta esta inactiva en auth: no puede iniciar sesion
    assert login(datos["correo"], datos["clave"]).status_code == 401

    # Codigo incorrecto
    malo = "000000" if cuerpo["codigo_simulado"] != "000000" else "111111"
    r = anonimo.pedir("POST", f"/api/v1/clientes/{cuerpo['id']}/verificar", "cli-codigo-malo", json={"codigo": malo})
    assert_error(r, 400, "INVALID_CODE")

    # S09V: verificacion correcta
    r = anonimo.pedir("POST", f"/api/v1/clientes/{cuerpo['id']}/verificar", "cli-verificar",
                      json={"codigo": cuerpo["codigo_simulado"]})
    assert r.status_code == 200, r.text

    # Ahora si puede iniciar sesion (credencial con bcrypt en auth)
    r = login(datos["correo"], datos["clave"])
    assert r.status_code == 200, r.text
    sesion = Sesion("cliente-nuevo", token_de(r))

    # S10: perfil propio, con los datos minimos y sin clave
    r = sesion.pedir("GET", "/api/v1/clientes/me", "cli-perfil")
    assert r.status_code == 200, r.text
    perfil = r.json()
    assert perfil["id"] == cuerpo["id"] and perfil["correo"] == datos["correo"]
    assert "clave" not in perfil and "codigo_hash" not in perfil and "nacimiento" not in perfil


def test_registro_duplicado(anonimo):
    datos = datos_registro()
    assert anonimo.pedir("POST", "/api/v1/clientes", "cli-dup-1", json=datos).status_code == 201
    # Mismo RUN con otro correo, y mismo correo con otro RUN: ambos 409
    r = anonimo.pedir("POST", "/api/v1/clientes", "cli-dup-run", json={**datos, "correo": "otro-" + datos["correo"]})
    assert_error(r, 409, "CLIENT_EXISTS")
    r = anonimo.pedir("POST", "/api/v1/clientes", "cli-dup-correo", json={**datos, "run": run_ficticio()})
    assert_error(r, 409, "CLIENT_EXISTS")


def test_registro_valida_en_servidor(anonimo):
    # El navegador podria saltarse sus validaciones: el servidor rechaza RUN invalido
    r = anonimo.pedir("POST", "/api/v1/clientes", "cli-run-malo", json=datos_registro(run="12.345.678-0"))
    assert_error(r, 422)


def test_perfil_requiere_sesion_de_cliente(anonimo, cliente1):
    assert_error(anonimo.pedir("GET", "/api/v1/clientes/me", "cli-perfil-anon"), 401)
    # Cliente del seed: ve solo su propio perfil (el id sale de la sesion, no de la URL)
    r = cliente1.pedir("GET", "/api/v1/clientes/me", "cli-perfil-seed")
    assert r.status_code == 200 and r.json()["id"] == "USR-0001"


def test_clients_y_auth_rechazan_llamadas_directas():
    # P05 para clients: sin el secreto del gateway responde 403
    r = httpx.get(f"{CLIENTS_URL}/clientes/me", timeout=10,
                  headers={"X-Authenticated-User": "USR-0001", "X-Authenticated-Roles": "CLIENTE",
                           "X-Request-ID": nuevo_id("p05-clients")})
    assert r.status_code == 403
    # Nadie sin el secreto de clients puede crear credenciales en auth
    r = httpx.post(f"{AUTH_URL}/usuarios", timeout=10, json={"correo": "x@x.cl", "clave": "123456", "nombre": "X"},
                   headers={"X-Request-ID": nuevo_id("p05-auth-usuarios")})
    assert r.status_code == 403
