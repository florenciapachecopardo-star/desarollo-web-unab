"""Pruebas de seguridad P01 a P06 (M7, protocolo de pruebas) y casos de idempotencia,
GraphQL e INC04. Cada prueba imprime el X-Request-ID de sus llamadas."""

import os

import httpx

from conftest import (BLANCO, DESPACHO, DUBAI, PEDIDO_CLIENTE1, PEDIDO_CLIENTE2, TRUFAS,
                      assert_error, nuevo_id, stock_de)


# ---------- P01: catalogo anonimo ----------

def test_p01_catalogo_anonimo(anonimo):
    r = anonimo.pedir("GET", "/api/v1/productos", "p01")
    assert r.status_code == 200
    assert r.headers["x-request-id"].startswith("p01-")
    assert len(r.json()["productos"]) == 5


# ---------- P02: operacion protegida sin sesion ----------

def test_p02_crear_pedido_sin_sesion(anonimo):
    r = anonimo.pedir("POST", "/api/v1/pedidos", "p02",
                      headers={"Idempotency-Key": nuevo_id("key")},
                      json={"lineas": [{"producto_id": DUBAI, "cantidad": 1}], "despacho": DESPACHO})
    assert_error(r, 401)


def test_p02_identidad_falsa_desde_el_navegador(anonimo):
    # El gateway descarta los X-Authenticated-* que manda el navegador
    r = anonimo.pedir("GET", "/api/v1/auth/me", "p02-identidad",
                      headers={"X-Authenticated-User": "USR-0003", "X-Authenticated-Roles": "ADMIN"})
    assert_error(r, 401)


# ---------- P03: CLIENTE intenta una operacion de ADMIN ----------

def test_p03_cliente_no_crea_productos(cliente1, anonimo):
    r = cliente1.pedir("POST", "/api/v1/productos", "p03",
                       json={"nombre": "Producto falso", "categoria": "barras", "precio": 1, "stock": 1})
    assert_error(r, 403)
    nombres = [p["nombre"] for p in anonimo.pedir("GET", "/api/v1/productos", "p03-verifica").json()["productos"]]
    assert "Producto falso" not in nombres


# ---------- P04: CLIENTE consulta un pedido ajeno ----------

def test_p04_pedido_ajeno_rest(cliente1):
    r = cliente1.pedir("GET", f"/api/v1/pedidos/{PEDIDO_CLIENTE2}", "p04")
    assert_error(r, 404, "ORDER_NOT_FOUND")
    assert "lineas" not in r.text and "despacho" not in r.text


def test_p04_pedido_ajeno_igual_que_inexistente(cliente1):
    ajeno = cliente1.pedir("GET", f"/api/v1/pedidos/{PEDIDO_CLIENTE2}", "p04-ajeno")
    inexistente = cliente1.pedir("GET", "/api/v1/pedidos/PED-9999", "p04-inexistente")
    assert ajeno.status_code == inexistente.status_code == 404
    assert ajeno.json()["error"]["message"] == inexistente.json()["error"]["message"]


def test_p04_pagar_pedido_ajeno(cliente1):
    r = cliente1.pedir("POST", "/api/v1/pagos", "p04-pago",
                       headers={"Idempotency-Key": nuevo_id("key")}, json={"pedido_id": PEDIDO_CLIENTE2})
    assert_error(r, 404, "ORDER_NOT_FOUND")


def test_p04_pedido_ajeno_graphql(cliente1):
    r = cliente1.graphql('query { pedido(id: "%s") { id total } }' % PEDIDO_CLIENTE2, "p04-graphql")
    assert r.status_code == 200
    assert r.json()["data"]["pedido"] is None


# ---------- P05: llamada directa a un servicio interno ----------

def test_p05_servicios_internos_sin_secreto():
    # Desde la red privada, sin el secreto del gateway, cada servicio rechaza la llamada
    for nombre, url in [("inventory", os.getenv("INVENTORY_URL", "http://inventory:8000") + "/productos"),
                        ("orders", os.getenv("ORDERS_URL", "http://orders:8000") + f"/pedidos/{PEDIDO_CLIENTE1}"),
                        ("payments", os.getenv("PAYMENTS_URL", "http://payments:8000") + "/pagos")]:
        headers = {"X-Request-ID": nuevo_id("p05-" + nombre),
                   "X-Authenticated-User": "USR-0001", "X-Authenticated-Roles": "CLIENTE"}
        if nombre == "payments":
            r = httpx.post(url, headers={**headers, "Idempotency-Key": nuevo_id("key")},
                           json={"pedido_id": PEDIDO_CLIENTE1}, timeout=10)
        else:
            r = httpx.get(url, headers=headers, timeout=10)
        print(f"[p05] directo a {nombre} -> {r.status_code}")
        assert r.status_code in (401, 403), f"{nombre} respondio {r.status_code}"
        assert "lineas" not in r.text


def test_p05_secreto_incorrecto():
    url = os.getenv("INVENTORY_URL", "http://inventory:8000") + "/productos"
    r = httpx.get(url, headers={"X-Gateway-Secret": "secreto-inventado", "X-Request-ID": nuevo_id("p05-falso")}, timeout=10)
    print(f"[p05] inventory con secreto falso -> {r.status_code}")
    assert r.status_code in (401, 403)


# ---------- P06: precio o estado alterado desde el front ----------

def test_p06_precio_y_estado_alterados(cliente1):
    r = cliente1.pedir("POST", "/api/v1/pedidos", "p06",
                       headers={"Idempotency-Key": nuevo_id("key")},
                       json={"lineas": [{"producto_id": DUBAI, "cantidad": 1, "precio_unitario": 1, "subtotal": 1}],
                             "despacho": DESPACHO, "total": 1, "estado": "PAGADO", "cajero_id": "USR-0001"})
    assert r.status_code == 201, r.text
    pedido = r.json()
    assert pedido["lineas"][0]["precio_unitario"] == 8990
    assert pedido["total"] == 8990
    assert pedido["estado"] == "PENDIENTE_PAGO"
    assert pedido["cajero_id"] == "USR-0005"

    pago = cliente1.pedir("POST", "/api/v1/pagos", "p06-pago",
                          headers={"Idempotency-Key": nuevo_id("key")},
                          json={"pedido_id": pedido["id"], "monto": 1, "estado": "APROBADO"})
    assert pago.status_code == 201, pago.text
    assert pago.json()["monto"] == 8990


# ---------- Idempotencia (S11 y S16) ----------

def test_idempotencia_pedido_y_pago(cliente1, anonimo):
    clave = nuevo_id("compra")
    cuerpo = {"lineas": [{"producto_id": BLANCO, "cantidad": 1}], "despacho": DESPACHO}
    antes = stock_de(anonimo, BLANCO)

    primero = cliente1.pedir("POST", "/api/v1/pedidos", "idem-pedido-1", headers={"Idempotency-Key": clave}, json=cuerpo)
    segundo = cliente1.pedir("POST", "/api/v1/pedidos", "idem-pedido-2", headers={"Idempotency-Key": clave}, json=cuerpo)
    assert primero.status_code == segundo.status_code == 201
    assert primero.json()["id"] == segundo.json()["id"]
    assert stock_de(anonimo, BLANCO) == antes - 1  # se desconto una sola vez

    otro = cliente1.pedir("POST", "/api/v1/pedidos", "idem-conflicto", headers={"Idempotency-Key": clave},
                          json={"lineas": [{"producto_id": BLANCO, "cantidad": 2}], "despacho": DESPACHO})
    assert_error(otro, 409, "IDEMPOTENCY_CONFLICT")

    pedido_id = primero.json()["id"]
    clave_pago = nuevo_id("pago")
    pago1 = cliente1.pedir("POST", "/api/v1/pagos", "idem-pago-1", headers={"Idempotency-Key": clave_pago}, json={"pedido_id": pedido_id})
    pago2 = cliente1.pedir("POST", "/api/v1/pagos", "idem-pago-2", headers={"Idempotency-Key": clave_pago}, json={"pedido_id": pedido_id})
    assert pago1.status_code == pago2.status_code == 201
    assert pago1.json()["id"] == pago2.json()["id"]

    # Con otra clave, el pedido ya pagado no se puede pagar de nuevo
    pago3 = cliente1.pedir("POST", "/api/v1/pagos", "idem-pago-3", headers={"Idempotency-Key": nuevo_id("pago")}, json={"pedido_id": pedido_id})
    assert_error(pago3, 409, "PEDIDO_NO_PAGABLE")


def test_idempotency_key_obligatorio(cliente1):
    r = cliente1.pedir("POST", "/api/v1/pedidos", "idem-sin-clave",
                       json={"lineas": [{"producto_id": DUBAI, "cantidad": 1}], "despacho": DESPACHO})
    assert_error(r, 400, "IDEMPOTENCY_KEY_REQUIRED")


def test_sin_stock(cliente1):
    r = cliente1.pedir("POST", "/api/v1/pedidos", "sin-stock", headers={"Idempotency-Key": nuevo_id("key")},
                       json={"lineas": [{"producto_id": TRUFAS, "cantidad": 1}], "despacho": DESPACHO})
    assert_error(r, 409, "STOCK_INSUFICIENTE")


# ---------- INC04: ID mal formado no deja stock descontado ----------

def test_inc04_id_mal_formado_no_descuenta_stock(cliente1, anonimo):
    antes = stock_de(anonimo, BLANCO)
    r = cliente1.pedir("POST", "/api/v1/pedidos", "inc04", headers={"Idempotency-Key": nuevo_id("key")},
                       json={"lineas": [{"producto_id": BLANCO, "cantidad": 1}, {"producto_id": "no-es-un-id", "cantidad": 1}],
                             "despacho": DESPACHO})
    assert_error(r, 400, "INVALID_ID")
    assert stock_de(anonimo, BLANCO) == antes


# ---------- GraphQL: profundidad maxima ----------

def test_graphql_rechaza_consulta_muy_profunda(cliente1):
    profunda = "query { misPedidos { items { lineas { pedido { lineas { pedido { lineas { nombre } } } } } } } }"
    r = cliente1.graphql(profunda, "gql-profundidad")
    assert r.status_code in (200, 400)
    cuerpo = r.json()
    assert cuerpo.get("errors"), "la consulta profunda deberia traer errores"
    assert not cuerpo.get("data"), "no deberia devolver datos"
    print(f"[gql-profundidad] error: {cuerpo['errors'][0]['message']}")
