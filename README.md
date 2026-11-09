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
| `backend/` | Un servicio por carpeta: `gateway`, `auth`, `inventory`, `orders`, `payments` y `graphql-gateway` (FastAPI) |
| `docker-compose.yml` | Levanta todo el sistema: servicios, MongoDB y Vault |
| `scripts/` | Seed, reset, revisión de la base, logs por solicitud y generación del `.env` |
| `tests/api/` | Pruebas automáticas (pytest) |
| `tests/carga/` | Prueba de carga del catálogo (k6) |
| `docs/` | Informe, módulos M1 a M9, diagramas `.drawio`, bitácora e incidencias |
| `evidencias/` | Evidencias de ejecución (E01 a E09), con su índice en `evidencias/indice.md` |
| `archivo/`, `Semana12/` | Trabajos semanales del curso. No son parte de la entrega |

## Arquitectura en corto

- **Un solo punto de entrada:** solo el gateway publica un puerto (`8000`). También sirve el front, así que front y API están en el mismo origen.
- **Red privada:** auth, inventory, orders, payments, graphql-gateway, Vault y Mongo están en una red `internal` de Docker, sin acceso desde fuera.
- **Secretos:** un secreto por integración. Se definen en `.env`, que nunca se sube al repo; el gateway los lee desde Vault.
- **Sesión:** cookie `httponly` con un token que expira a los 15 minutos. Las claves se guardan con bcrypt.
- **Correlación:** cada solicitud lleva un `X-Request-ID`, que aparece en la respuesta y en los logs de todos los servicios.

## Requisitos

- Docker Desktop con Docker Compose v2. Se probó con Docker 29.9.2 y Compose v5.6.1.
- Puerto `8000` libre.

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

**3. Cargar los datos de prueba** (6 usuarios, 5 productos y 2 pedidos, todos ficticios):

```bash
docker compose run --rm seed --reset
```

**4. Abrir** <http://localhost:8000>.

**Para detenerlo:** `docker compose down`. Para borrar también la base: `docker compose down -v`.

## Cuentas de prueba

Son ficticias y las crea el seed.

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
| Pruebas automáticas (P01 a P06, idempotencia, GraphQL) | `docker compose run --rm pruebas` | `evidencias/u2/pytest/` |
| Carga del catálogo (k6) | `docker compose run --rm k6` | `evidencias/u2/k6-catalogo.json` |
| Revisar un pedido o producto en la base | `docker compose run --rm check pedido PED-0001` | Pantalla |
| Ver la traza de una solicitud en todos los servicios | `scripts/logs.sh <X-Request-ID>` | Pantalla |
| Estado de un servicio | `curl http://localhost:8000/health` | Pantalla |

El protocolo completo está en [`docs/protocolo-pruebas.md`](docs/protocolo-pruebas.md), y la relación entre requisitos, pantallas, servicios y pruebas, en [`docs/matriz-requisitos.md`](docs/matriz-requisitos.md).

## Lo que no está en esta entrega

El servicio clients (el registro y el perfil siguen en el navegador), el panel interno (sus servicios funcionan por API, pero no tiene pantallas), el envío de la boleta por correo, la verificación de correo con una API de mensajería, el límite de solicitudes y las pruebas con Playwright. El pago usa un proveedor simulado, no Webpay. El detalle y los motivos están en la sección "Brechas declaradas" de [`docs/informe.md`](docs/informe.md).
