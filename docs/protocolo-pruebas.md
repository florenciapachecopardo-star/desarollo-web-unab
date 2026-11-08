# Protocolo de pruebas, Entrega 2

## 1. Objetivo

Definir cómo se ejecutan y registran las pruebas del backend de Chocomanía, para que cualquier integrante pueda repetirlas y obtener el mismo resultado.

## 2. Ambiente de prueba

| Elemento | Valor |
|---|---|
| Cómo se levanta | `docker compose up -d` desde la raíz del repo |
| Reinicio de datos | `scripts/reset.sh`: borra usuarios, sesiones y productos y vuelve a cargar el seed. Necesita el stack arriba |
| Datos iniciales | `scripts/seed.py`: 6 usuarios (uno por rol del front, dos clientes) y 5 productos con ID fijos, todos ficticios. Corre dentro de Docker (`docker compose run --rm seed`); `reset.sh` lo ejecuta con `--reset` |
| Logs de una solicitud | `scripts/logs.sh <request_id>` |
| Verificación en la base | `scripts/check.py` (pendiente, llega con el PR D) |
| Pruebas automáticas | `pytest` en `tests/api` (pendiente, llega con el PR H) |

## 3. Reglas

1. Antes de cada ronda de pruebas, con el stack arriba (`docker compose up -d`), se ejecuta `scripts/reset.sh`, que deja la base en el estado inicial y carga el seed.
2. Cada prueba registra el `X-Request-ID` de la respuesta, para poder buscarla en los logs con `scripts/logs.sh`.
3. Cada ejecución tiene una ficha en `evidencias/`, hecha con `evidencias/plantilla-ficha.md`, y se registra en `evidencias/indice.md`.
4. Si el resultado obtenido no coincide con el esperado, se registra en `docs/incidencias.md`.

## 4. Identificadores

Los requisitos (R), servicios (S) y flujos (F) están en `docs/m1-servicios.md`.

| Prefijo | Qué es |
|---|---|
| P | Prueba (lo que se quiere comprobar) |
| C | Prueba de contrato de un servicio del M1 |
| E | Evidencia (ficha y archivos de una ejecución) |
| INC | Incidencia |

## 5. Pruebas de seguridad (M7)

| ID | Qué se prueba | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|
| P01 | Visitante anónimo consulta el catálogo (S01) | 200 con la lista de productos | | |
| P02 | Operación protegida sin sesión (S11) | 401 | | |
| P03 | CLIENTE intenta una operación de ADMIN (S03) | 403 | | |
| P04 | CLIENTE consulta un pedido ajeno (S12) | 404 sin datos del pedido | | |
| P05 | Llamada directa a un servicio interno sin pasar por el gateway | Rechazada | | |
| P06 | El front manda un precio o estado de pago alterado (S11) | El servidor lo ignora y usa el precio de inventory | | |

## 6. Pruebas de contrato

| ID | Servicio (M1) | Caso | Código esperado | Código obtenido | Evidencia |
|---|---|---|---|---|---|
| C01 | | | | | |

## 7. Pruebas manuales (U2)

En la U2 las pruebas de interfaz se registran a mano. Cada una lleva su ficha con pasos, resultado y archivos de evidencia.

| ID | Flujo | Rol | Resultado | Evidencia |
|---|---|---|---|---|
| P07 | | | | |
