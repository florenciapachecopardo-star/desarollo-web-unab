"""Crea el archivo .env con secretos aleatorios, a partir de .env.example.

Sirve en Windows, donde no hay openssl. Desde la raiz del repo (PowerShell):
    docker run --rm -v "${PWD}:/repo" -w /repo python:3.12.7-slim-bookworm python scripts/generar-env.py
No sobrescribe un .env que ya exista.
"""

import os
import secrets
import sys

if os.path.exists(".env"):
    print("Ya existe un .env; no se modifica. Borralo si quieres generar otro.")
    sys.exit(1)

lineas = []
with open(".env.example", encoding="utf-8") as ejemplo:
    for linea in ejemplo:
        linea = linea.rstrip("\n")
        if linea and not linea.startswith("#") and linea.endswith("="):
            linea += secrets.token_hex(32)
        lineas.append(linea)

with open(".env", "w", encoding="utf-8", newline="\n") as salida:
    salida.write("\n".join(lineas) + "\n")
print(".env creado con secretos nuevos (no lo subas al repo).")
