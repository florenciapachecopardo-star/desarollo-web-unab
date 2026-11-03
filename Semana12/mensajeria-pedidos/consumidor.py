"""
Consumidor STOMP de Chocomanía (Semana 12).

Escucha la cola /queue/pedidos de ActiveMQ y muestra cada pedido según su formato
(texto, fijo, xml o json). Si el mensaje se entiende, hace ack y sale de la cola.
Si no se entiende, hace nack para que no se vuelva a procesar como si estuviera bien.

Ejemplo:
    python consumidor.py
"""

import argparse
import json
import os
import time
import xml.etree.ElementTree as ET

import stomp

DESTINO = "/queue/pedidos"

# Contrato del formato fijo: id [0:6], cliente [6:26], monto [26:36]
LARGO_TOTAL = 36


def interpretar_fijo(cuerpo: str) -> dict:
    """Separa el texto de ancho fijo en id, cliente y monto."""
    if len(cuerpo) != LARGO_TOTAL:
        raise ValueError(f"El formato fijo exige {LARGO_TOTAL} caracteres y llegaron {len(cuerpo)}")

    id_txt = cuerpo[0:6]
    cliente = cuerpo[6:26].rstrip()
    monto_txt = cuerpo[26:36]

    if not id_txt.isdigit():
        raise ValueError("El id del formato fijo no es numérico")
    if not (monto_txt[:7].isdigit() and monto_txt[7] == "." and monto_txt[8:].isdigit()):
        raise ValueError("El monto del formato fijo no es válido")

    return {"id": int(id_txt), "cliente": cliente, "monto": float(monto_txt)}


def interpretar_xml(cuerpo: str) -> dict:
    """Lee el XML y exige que la raíz sea <pedido>."""
    raiz = ET.fromstring(cuerpo)
    if raiz.tag != "pedido":
        raise ValueError("El nodo raíz del XML debe ser <pedido>")
    return {hijo.tag: hijo.text for hijo in raiz}


def interpretar(cuerpo: str, headers: dict) -> tuple[str, object]:
    """Devuelve (formato, contenido) usando el header x-formato o, si no viene, el content-type."""
    formato = (headers.get("x-formato") or "").lower()
    tipo_mime = (headers.get("content-type") or "").lower()

    if not formato:
        if "application/json" in tipo_mime:
            formato = "json"
        elif "application/xml" in tipo_mime or "text/xml" in tipo_mime:
            formato = "xml"
        else:
            formato = "texto"

    if formato == "texto":
        return formato, cuerpo
    if formato == "fijo":
        return formato, interpretar_fijo(cuerpo)
    if formato == "json":
        return formato, json.loads(cuerpo)
    if formato == "xml":
        return formato, interpretar_xml(cuerpo)
    raise ValueError(f"Formato no soportado: {formato}")


class Escuchador(stomp.ConnectionListener):
    """Listener que procesa cada mensaje que llega a la cola."""

    def __init__(self, conexion):
        self.conexion = conexion

    def on_error(self, frame):
        print(f"Error del broker: {frame.body}")

    def on_disconnected(self):
        print("Conexión STOMP cerrada")

    def on_message(self, frame):
        ack_id = frame.headers.get("ack")
        try:
            formato, contenido = interpretar(frame.body, frame.headers)
            print(f"[RECIBIDO] formato={formato}")
            if isinstance(contenido, str):
                print(contenido)
            else:
                print(json.dumps(contenido, ensure_ascii=False, indent=2))
            self.conexion.ack(ack_id)
        except Exception as error:
            print(f"Mensaje inválido: {error}")
            self.conexion.nack(ack_id)


def main():
    parser = argparse.ArgumentParser(description="Consumidor STOMP de pedidos Chocomanía")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=61613)
    # Se pueden pasar por variables de entorno; si no, usa las credenciales de prueba
    parser.add_argument("--usuario", default=os.environ.get("BROKER_USUARIO", "demo"))
    parser.add_argument("--clave", default=os.environ.get("BROKER_CLAVE", "demo123"))
    args = parser.parse_args()

    conexion = stomp.Connection12([(args.host, args.port)])
    conexion.set_listener("escuchador", Escuchador(conexion))

    try:
        conexion.connect(args.usuario, args.clave, wait=True)
        conexion.subscribe(
            destination=DESTINO,
            id="lector-pedidos",
            ack="client-individual",
            headers={"activemq.prefetchSize": "1"},
        )
        print(f"Escuchando {DESTINO}. Presiona Ctrl+C para salir.")
        while True:
            # Mantiene el programa vivo mientras el listener recibe mensajes
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("Deteniendo consumidor")
    finally:
        if conexion.is_connected():
            conexion.disconnect()


if __name__ == "__main__":
    main()
