# Protocolo de pruebas, Entrega 2

## 1. Objetivo

Definir cómo se ejecutan y registran las pruebas del backend de Chocomanía, para que cualquier integrante pueda repetirlas y obtener el mismo resultado.

## 2. Ambiente de prueba

| Elemento | Valor |
|---|---|
| Cómo se levanta | `docker compose up` desde la raíz del repo |
| Datos iniciales | `seed.py` (cuentas de prueba del front) |
| Reinicio de datos | `reset.sh` |
| Verificación rápida | `check.py` |
| Logs | `logs.sh` |
| Pruebas automáticas | `pytest` en `tests/api` |

## 3. Reglas

1. Antes de cada ronda de pruebas se ejecuta `reset.sh` y luego `seed.py`.
2. Cada prueba registra el `X-Request-ID` de la respuesta, para poder buscarla en los logs.
3. Cada prueba tiene una ficha en `evidencias/` hecha con `evidencias/plantilla-ficha.md`.
4. Si el resultado obtenido no coincide con el esperado, se registra en `docs/incidencias.md`.

## 4. Pruebas de seguridad (M7)

| ID | Qué se prueba | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|
| P01 | | | | |
| P02 | | | | |
| P03 | | | | |
| P04 | | | | |
| P05 | | | | |
| P06 | | | | |

## 5. Pruebas de contrato

| ID | Servicio (M1) | Caso | Código esperado | Código obtenido | Evidencia |
|---|---|---|---|---|---|
| C01 | | | | | |

## 6. Pruebas manuales (U2)

En la U2 las pruebas de interfaz se registran a mano. Cada una lleva su ficha con pasos, resultado y captura.

| ID | Flujo | Rol | Resultado | Evidencia |
|---|---|---|---|---|
| E01 | | | | |
