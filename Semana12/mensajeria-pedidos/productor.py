"""
Productor STOMP de Chocomanía (Semana 12).

Publica un pedido de Chocomanía en la cola /queue/pedidos de ActiveMQ.
El pedido se puede enviar en 4 formatos: texto, fijo, xml o json.

Ejemplo:
    python productor.py --formato json --id 1 --cliente "Valentina Soto" --monto 17980.00
"""

import argparse
import json
import os
import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation

import stomp

DESTINO = "/queue/pedidos"

# Contrato del formato fijo: 6 + 20 + 10 = 36 caracteres
LARGO_ID = 6
LARGO_CLIENTE = 20
LARGO_MONTO = 10
LARGO_TOTAL = LARGO_ID + LARGO_CLIENTE + LARGO_MONTO


def construir_fijo(pedido: dict) -> str:
    """Arma el pedido como texto de ancho fijo de 36 caracteres."""
    id_txt = str(pedido["id"])
    if not id_txt.isdigit() or len(id_txt) > LARGO_ID:
        raise ValueError(f"El id debe ser numérico y tener máximo {LARGO_ID} dígitos")

    cliente = pedido["cliente"]
    if not cliente.replace(" ", "").isalnum() or len(cliente) > LARGO_CLIENTE:
        raise ValueError(
            f"El cliente debe tener solo letras, números y espacios, con máximo {LARGO_CLIENTE} caracteres"
        )

    monto = Decimal(str(pedido["monto"])).quantize(Decimal("0.01"))
    if monto <= 0:
        raise ValueError("El monto debe ser positivo")
    monto_txt = f"{monto:.2f}".zfill(LARGO_MONTO)
    if len(monto_txt) > LARGO_MONTO:
        raise ValueError(f"El monto no cabe en {LARGO_MONTO} caracteres")

    return id_txt.zfill(LARGO_ID) + cliente.ljust(LARGO_CLIENTE) + monto_txt


def construir_xml(pedido: dict) -> str:
    """Arma el pedido como XML con raíz <pedido> y un subelemento por campo."""
    raiz = ET.Element("pedido")
    for campo, valor in pedido.items():
        ET.SubElement(raiz, campo).text = str(valor)
    return ET.tostring(raiz, encoding="unicode")


def construir_mensaje(formato: str, pedido: dict, mensaje: str) -> tuple[str, str]:
    """Devuelve (cuerpo, tipo MIME) según el formato pedido."""
    if formato == "texto":
        return mensaje, "text/plain; charset=utf-8"
    if formato == "fijo":
        return construir_fijo(pedido), "text/plain; charset=utf-8"
    if formato == "json":
        return json.dumps(pedido, ensure_ascii=False), "application/json"
    if formato == "xml":
        return construir_xml(pedido), "application/xml"
    raise ValueError(f"Formato no soportado: {formato}")


def main():
    parser = argparse.ArgumentParser(description="Productor STOMP de pedidos Chocomanía")
    parser.add_argument("--formato", choices=["texto", "fijo", "xml", "json"], default="texto")
    parser.add_argument("--mensaje", default="Hola desde el productor STOMP de Chocomania")
    parser.add_argument("--id", type=int, default=1)
    parser.add_argument("--cliente", default="Valentina Soto")
    parser.add_argument("--monto", default="17980.00")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=61613)
    # Las credenciales se leen de variables de entorno (no van escritas en el código)
    parser.add_argument("--usuario", default=os.environ.get("BROKER_USUARIO", "demo"))
    parser.add_argument("--clave", default=os.environ.get("BROKER_CLAVE", "demo123"))
    args = parser.parse_args()

    try:
        monto = Decimal(args.monto)
        if not monto.is_finite():
            raise ValueError("El monto debe ser un número finito")
    except (InvalidOperation, ValueError) as error:
        parser.error(f"Monto no válido: {args.monto} ({error})")

    pedido = {"id": args.id, "cliente": args.cliente, "monto": float(monto)}

    try:
        cuerpo, tipo_mime = construir_mensaje(args.formato, pedido, args.mensaje)
    except ValueError as error:
        parser.error(str(error))

    conexion = stomp.Connection12([(args.host, args.port)])
    try:
        conexion.connect(args.usuario, args.clave, wait=True)
        conexion.send(
            destination=DESTINO,
            body=cuerpo,
            content_type=tipo_mime,
            headers={"x-formato": args.formato, "persistent": "true"},
        )
        print(f"Mensaje enviado a {DESTINO} (formato {args.formato}): {cuerpo}")
    finally:
        if conexion.is_connected():
            conexion.disconnect()


if __name__ == "__main__":
    main()
