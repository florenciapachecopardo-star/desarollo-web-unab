"""Limite de solicitudes del gateway (M5). Va en un archivo aparte que pytest corre
al final, porque deja el login bloqueado por un minuto para esta IP.
Si se repite la ronda de pruebas, esperar 1 minuto entre una y otra."""

from test_clientes import login


def test_limite_de_solicitudes_en_login():
    # El gateway corta con 429 al pasar el limite por IP (20 por minuto por defecto)
    codigos = [login("nadie@correo.cl", "incorrecta").status_code for _ in range(25)]
    print(f"[rate-limit] codigos: {codigos}")
    assert 429 in codigos
    assert all(c in (401, 429) for c in codigos)
