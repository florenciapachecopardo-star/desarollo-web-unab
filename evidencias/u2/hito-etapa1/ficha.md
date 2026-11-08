# Ficha de evidencia E01: hito de la Etapa 1 (correlación de punta a punta)

| Campo | Valor |
|---|---|
| ID | E01 |
| Nombre de la prueba | Catálogo anónimo con el mismo `X-Request-ID` en la respuesta y en los logs del gateway y de inventory |
| Módulo | M5 (recorrido de una solicitud con `request_id`), M6 (secretos desde Vault) y M10 (logs con ID de correlación) |
| Requisito relacionado | R01, R07 |
| Servicio y ruta | S01 `GET /api/v1/productos` |
| Rol que ejecuta | Anónimo (sin cookie de sesión) |
| Fecha y hora | 04-11-2026, 19:41 (America/Santiago), según el header `date` de la respuesta (22:41:26 GMT) y los logs (22:41:27 UTC) |
| Ejecutada por | Flo |
| Código | El de `d8d563d` (PR B). La ejecución se hizo sobre el árbol de trabajo justo antes de ese commit (19:42:08), que es el mismo que incluye estos archivos |
| Entorno | Docker Desktop en Windows, stack de `docker-compose.yml` |
| Estado | **Aprobada** |

## Precondiciones

- Stack levantado con `docker compose up -d`. Estado de los contenedores en `servicios.txt`: gateway, auth, inventory, mongo y vault en `healthy`, y vault-init `Exited (0)`.
- Datos: un solo producto en la base (Chocolate Dubai, stock 10), creado como ADMIN durante las pruebas del PR B. Es anterior al `seed.py` del PR C, por eso el ID del producto no es uno de los ID fijos del seed.
- La solicitud se hace sin cookie de sesión.

## Pasos

Reconstruidos a partir de los archivos de evidencia. El comando exacto de la solicitud lo confirma Flo.

1. Enviar `GET http://localhost:8000/api/v1/productos` sin cookie y con el header `X-Request-ID: hito-etapa1-0002`. Guardar los headers y el cuerpo en `respuesta.txt`.
2. Ejecutar `scripts/logs.sh hito-etapa1-0002` y guardar la salida en `logs.txt`.
3. Ejecutar `docker compose ps` y guardar la salida en `servicios.txt`.

## Resultado esperado

- Código HTTP: 200, sin pedir sesión.
- La respuesta trae el header `X-Request-ID` con el mismo valor.
- El mismo `request_id` aparece en los logs del gateway y de inventory.

## Resultado obtenido

- Código HTTP: 200 OK.
- Header de la respuesta: `x-request-id: hito-etapa1-0002`.
- Cuerpo: `{"productos": [...], "pagina": 1, "total": 1}` con el producto Chocolate Dubai.
- Logs (`logs.txt`), las tres líneas con `request_id: hito-etapa1-0002`:
  1. gateway, `secret_loaded`: el gateway lee sus secretos desde `secret/gateway` en Vault. Solo se registran los nombres de las claves, no sus valores.
  2. inventory, `request`: `GET /productos`, 200, `user_id: null`, 75,3 ms.
  3. gateway, `request`: `GET /api/v1/productos`, 200, `user_id: null`, 264,0 ms.

## Evidencia

| Archivo | Qué muestra |
|---|---|
| `evidencias/u2/hito-etapa1/respuesta.txt` | Headers y cuerpo de la respuesta, con `x-request-id` |
| `evidencias/u2/hito-etapa1/logs.txt` | Salida de `scripts/logs.sh` con el mismo `request_id` en gateway e inventory |
| `evidencias/u2/hito-etapa1/servicios.txt` | Estado de los contenedores al momento de la prueba |

**Vinculación:** el valor `hito-etapa1-0002` une la respuesta con las tres líneas de log.

## Límites de interpretación

- El `X-Request-ID` lo envió el cliente, así que esta evidencia demuestra que el gateway **reutiliza, propaga y devuelve** el ID. No demuestra que lo **genere** cuando el cliente no lo manda: eso necesita otra ejecución sin el header.
- Es una sola ejecución, con datos creados a mano y no con el seed.
- Los logs no muestran el valor de ningún secreto ni datos personales (`user_id: null` porque la solicitud es anónima).

## Conclusión

Aprobada. Se cumple el hito de la Etapa 1: el catálogo responde sin sesión y el mismo `X-Request-ID` aparece en la respuesta y en los logs del gateway y de inventory.
