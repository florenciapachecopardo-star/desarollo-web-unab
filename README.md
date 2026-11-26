# Chocomanía, Sistema de Ventas Online

Tienda online de una chocolatería artesanal, basada en el **Caso 19 "Sistema de Ventas On-line"** y adaptada de sushería a chocolatería.

**Asignatura:** Desarrollo Web y Móvil, UNAB, sección 8750  
**Integrantes:** Florencia Pacheco y Karla Muñoz  
**Versión entregada (Unidad 2):** tag `u2-final`

El informe completo de la entrega está en [`docs/informe.md`](docs/informe.md).

## Qué hay en el repo

| Carpeta | Contenido |
|---|---|
| `frontend/` | Sitio responsivo en HTML, CSS y JavaScript. Llama a la API real por el gateway |
| `backend/` | Un servicio por carpeta: `gateway`, `auth`, `clients`, `inventory`, `orders`, `payments` y `graphql-gateway` (FastAPI) |
| `docker-compose.yml` | Levanta todo el sistema: servicios, MongoDB y Vault |
| `scripts/` | Seed, reset, revisión de la base, logs por solicitud y generación del `.env` |
| `tests/api/` | Pruebas automáticas (pytest) |
| `tests/carga/` | Prueba de carga del catálogo (k6) |
| `docs/` | Informe, módulos M1 a M9, diagramas `.drawio`, bitácora e incidencias |
| `evidencias/` | Evidencias de ejecución (E01 a E09), con su índice en `evidencias/indice.md` |
| `frontend/` + `archivo/` | **Entrega 1** (incluida por indicación del profesor): el front responsivo es la carpeta `frontend/`, que en esta entrega se conectó al backend; en `archivo/` están el diseño inicial (`Chocomania_home.png`, `Chocomania_compra.png`, `paginaResponsiva.HTML`) |
| `archivo/Semana*`, `archivo/segundo pr_dwm`, `Semana12/` | Trabajos semanales del curso, como respaldo |

## Arquitectura en corto

- **Puntos de entrada:** el contenedor `frontend` (nginx, puerto `8080`) sirve el sitio y reenvía todo `/api/` al gateway. El gateway (puerto `8000`) es la única puerta a la API; también sirve el front, para las pruebas automáticas.
- **Red privada:** auth, clients, inventory, orders, payments, graphql-gateway, Vault y Mongo están en una red `internal` de Docker, sin acceso desde fuera.
- **Límite de solicitudes:** el gateway corta con 429 por IP (login 20/min, registro 10/min).
- **Secretos:** un secreto por integración. Se definen en `.env`, que nunca se sube al repo; el gateway los lee desde Vault.
- **Sesión:** cookie `httponly` con un token que expira a los 15 minutos. Las claves se guardan con bcrypt.
- **Correlación:** cada solicitud lleva un `X-Request-ID`, que aparece en la respuesta y en los logs de todos los servicios.

## Requisitos

- Docker Desktop con Docker Compose v2. Se probó con Docker 29.9.2 y Compose v5.6.1.
- Puertos `8000` y `8080` libres.

## Cómo levantarlo

**1. Crear el `.env`**, con un secreto aleatorio en cada variable:

```bash
# Linux, macOS o Git Bash con openssl: copiar el ejemplo y completar cada valor con  openssl rand -hex 32
cp .env.example .env

# Windows sin openssl (PowerShell, desde la raíz del repo):
docker run --rm -v "${PWD}:/repo" -w /repo python:3.12.7-slim-bookworm python scripts/generar-env.py
```

**2. Levantar el sistema** y esperar a que todos los servicios queden `healthy`:

```bash
docker compose up -d --build
docker compose ps
```

**3. Cargar los datos de prueba** (6 usuarios, 2 perfiles de cliente, 5 productos y 2 pedidos, todos ficticios):

```bash
docker compose run --rm seed --reset
```

**4. Abrir** <http://localhost:8080> (contenedor frontend). También funciona <http://localhost:8000>, servido por el gateway.

**Para detenerlo:** `docker compose down`. Para borrar también la base: `docker compose down -v`.

## Cuentas de prueba

Son ficticias y las crea el seed. En la pantalla de ingreso solo aparece la de cliente; también se puede crear una cuenta nueva en "Regístrate".

| Rol | Correo | Clave |
|---|---|---|
| Cliente | `cliente@correo.cl` | `Cliente2026` |
| Cliente 2 | `diego@correo.cl` | `Diego2026` |
| Administrador | `admin@chocomania.cl` | `Admin2026` |
| Dueña | `dueno@chocomania.cl` | `Dueno2026` |
| Cajero virtual | `cajero@chocomania.cl` | `Cajero2026` |
| Despacho | `despacho@chocomania.cl` | `Despacho2026` |

## Pruebas

Antes de cada ronda, deja la base en su estado inicial:

```bash
docker compose run --rm seed --reset      # o: scripts/reset.sh
```

| Qué | Comando | Resultado en |
|---|---|---|
| Pruebas automáticas (P01 a P06, idempotencia, GraphQL, clients y límite de solicitudes). Si se repiten, esperar 1 minuto entre rondas (la última prueba deja el login limitado por un minuto) | `docker compose run --rm pruebas` | `evidencias/u2/pytest/` |
| Carga del catálogo (k6) | `docker compose run --rm k6` | `evidencias/u2/k6-catalogo.json` |
| Revisar un pedido o producto en la base | `docker compose run --rm check pedido PED-0001` | Pantalla |
| Ver la traza de una solicitud en todos los servicios | `sh scripts/logs.sh <X-Request-ID>` (en PowerShell: `.\scripts\logs.ps1 <X-Request-ID>`) | Pantalla |
| Estado de un servicio | `curl http://localhost:8000/health` | Pantalla |

El protocolo completo está en [`docs/protocolo-pruebas.md`](docs/protocolo-pruebas.md), y la relación entre requisitos, pantallas, servicios y pruebas, en [`docs/matriz-requisitos.md`](docs/matriz-requisitos.md).

## Pruebas de la Entrega 3 (integración validada)

Una ejecución completa (RUN) se hace con un solo comando, desde la raíz del repo. En Windows, con **Git Bash**:

```bash
sh scripts/u3-run.sh RUN01 "Tu nombre"
```

Tarda unos 6 a 8 minutos. Levanta el sistema, restaura los datos y corre los recorridos críticos desde el navegador (Playwright, en escritorio y móvil emulado) en cinco fases: todo arriba, inventory caído, inventory de vuelta, inventory lento y sesión expirada. Después corre pytest, junta los logs de cada `X-Request-ID` que vio el navegador y revisa en Mongo los pedidos creados. Todo queda en `evidencias/u3/RUN01/`; abre `playwright/normal/reporte-html/index.html` para ver cada prueba con sus capturas.

- Cada RUN usa un ID nuevo (RUN01, RUN02…). El script no deja sobrescribir una carpeta existente.
- La primera vez descarga la imagen de Playwright (~2 GB).
- Para correr solo una fase a mano: `RUN=RUN99 FASE=normal docker compose run --rm --no-deps e2e --grep-invert "@caido|@recuperado|@demora|@expira"` (el `--no-deps` es obligatorio).

Línea base, inventario de flujos, protocolo y matriz de trazabilidad: [`docs/u3/`](docs/u3/).

## Lo que no está en esta entrega

El panel interno (sus servicios funcionan por API y se probaron en E10, pero no tiene pantallas), el envío de la boleta por correo, la verificación de correo con una API de mensajería real (el código se muestra en pantalla). Las pruebas con Playwright se agregaron en la Entrega 3. El pago usa un proveedor simulado, no Webpay. El detalle y los motivos están en la sección "Brechas declaradas" de [`docs/informe.md`](docs/informe.md).
