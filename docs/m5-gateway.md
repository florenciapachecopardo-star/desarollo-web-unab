# M5. API Gateway, fronteras de confianza y recorridos

Diagrama de clases: `docs/uml-gateway.drawio` (se abre en app.diagrams.net).

**Fuente:** `backend/gateway/gateway.py`, `backend/gateway/observabilidad.py`, `backend/graphql-gateway/main.py` y `docker-compose.yml` en `main` (commit `9deda9b`, con clients del PR #47 y el contenedor frontend y los logs del PR #48). El detalle de GraphQL está en `docs/m8-graphql.md`.

## 1. Un solo gateway

Chocomanía usa **un único API Gateway**. Se eligió uno solo porque:

- Hay un solo tipo de cliente (el front web) y un solo punto de entrada público.
- La carga proyectada es baja (menos de 25 solicitudes por segundo en el peak, ver `docs/m9-carga.md`).
- Un solo lugar concentra la lista blanca, la validación de sesión, el `X-Request-ID` y la lectura de secretos, así que es más fácil de revisar y probar.

El GraphQL Gateway no es un segundo punto de entrada: es privado (sin puerto publicado) y solo se llega a él a través del API Gateway, por S18. Desde la U3 el sitio se abre en el contenedor `frontend` (nginx, `http://localhost:8080`), que sirve los archivos estáticos y reenvía todo `/api/` al gateway. El contenedor frontend no valida nada ni tiene secretos: solo pasa la solicitud, así que el gateway sigue siendo el único punto de control de la API. Como el navegador ve el front y la API en el mismo origen, no necesita CORS. El gateway también sigue sirviendo el front en `http://localhost:8000`, para las pruebas automáticas.

## 2. Clases del diagrama

| Clase | Qué representa | Dónde está en el código |
|---|---|---|
| ApiGateway | La aplicación FastAPI del gateway: registra las rutas de la lista blanca, las reenvía y sirve el front estático | `gateway.py` (`app`, `registrar`, `reenviar`, `login`, `logout`, `me` y el montaje de `FRONTEND_DIR`) |
| RouteDefinition | Una ruta permitida: ID del M1, verbo, ruta externa, tipo de acceso, roles, destino y ruta interna | `gateway.py` (`@dataclass RouteDefinition`, lista `RUTAS`) |
| ServiceTarget | Un servicio destino: URL interna y nombre de su secreto en Vault | `gateway.py` (`@dataclass ServiceTarget`, diccionario `SERVICIOS`) |
| AuthenticationPolicy | Valida la cookie `session_token` con auth (`/introspect`) y arma la identidad | `gateway.py` (funciones `obtener_identidad` y `llamar_auth`) |
| AuthorizationPolicy | Decide si la identidad cumple el acceso de la ruta: anónimo, autenticado o rol | `gateway.py` (handler dentro de `registrar`) |
| SecretProvider | Lee los secretos de `secret/gateway` en Vault con un token de solo lectura, con caché de 60 s | `gateway.py` (función `secretos`) |
| Observabilidad | Middleware de `X-Request-ID`, logs JSON y formato único de error | `observabilidad.py` (`instalar`, `log`, `respuesta_error`) |
| GraphQLGateway | Servicio privado que exige su secreto, arma el contexto con la identidad y aplica los límites | `graphql-gateway/main.py` (`app`, `contexto`, `GraphQLRouter`) |
| Schema | Queries `misPedidos` y `pedido`, tipos y límites de profundidad (6), alias (10) y tokens (1000) | `graphql-gateway/main.py` (`Query`, `SchemaConLogs`) |
| Resolver | Resuelve cada campo; `Linea.producto` usa un DataLoader para pedir todos los productos en una sola llamada | `graphql-gateway/main.py` (`mis_pedidos`, `pedido`, `Linea.producto`, `cargador_productos`) |

En el código, AuthenticationPolicy, AuthorizationPolicy y SecretProvider son **funciones**, no clases. En el diagrama se muestran como clases para separar sus responsabilidades.

## 3. Clasificación de rutas

| Tipo | Rutas | Qué exige el gateway |
|---|---|---|
| Anónimas | S01, S02 (catálogo), S06 (login), S07 (logout, con o sin sesión) | Nada. Igual pasan por la lista blanca, la validación de parámetros y el `X-Request-ID` |
| Externa con secreto propio | S17 (aviso del proveedor de pagos) | Nada en el gateway; payments exige `X-Proveedor-Secret` |
| Autenticadas | S08, S12, S13, S18 | Sesión vigente. La propiedad del pedido la revisa orders; en S18, el rol y el campo los revisa graphql-gateway |
| Por rol | S03 a S05 (ADMIN), S11 y S16 (CLIENTE), S14 y S15 (DESPACHO o ADMIN), S19 (DUENO o ADMIN) | Sesión vigente y rol permitido. El servicio vuelve a revisar el rol |
| Front estático | `GET /`, `/*.html`, `/js/*`, `/css/*`, `/img/*` | Nada: son archivos públicos. Solo se sirven archivos de la carpeta `frontend/` |
| Internas (no expuestas) | `/interno/*` de inventory y orders, `/introspect` y `/logout` de auth, `/graphql` de graphql-gateway, `/health` de cada servicio | No están en la lista blanca: desde fuera responden 404 |
| Anónimas con límite estricto | S09, S09V (clients) y S06 (login) | Límite por IP en el gateway (10 y 20 por minuto) contra registros masivos y fuerza bruta; 429 `RATE_LIMITED`. Limitación conocida: entrando por el 8080, el gateway ve todas las solicitudes con la IP del nginx, así que el límite de login y registro queda compartido entre todos los usuarios del front. Con varias réplicas iría en Redis y se usaría `X-Forwarded-For` desde una IP de confianza |

## 4. Fronteras de confianza

```mermaid
flowchart LR
    subgraph EXT["Fuera del sistema (no confiable)"]
        NAV["Navegador"]
        PROV["Proveedor de pagos simulado"]
    end
    subgraph PUB["Red pública"]
        FRONT["frontend (nginx) :8080"]
        GW["API Gateway :8000"]
    end
    subgraph PRIV["Red privada (internal)"]
        AUTH["auth"]
        CLI["clients"]
        INV["inventory"]
        ORD["orders"]
        PAY["payments"]
        GQL["graphql-gateway"]
        VAULT["Vault"]
        MONGO["MongoDB"]
    end
    NAV -- "cookie session_token" --> FRONT
    FRONT -- "/api/ sin cambios" --> GW
    PROV -- "X-Proveedor-Secret" --> GW
    GW -- "auth_introspection_secret" --> AUTH
    GW -- "clients_shared_secret" --> CLI
    CLI -- "CLIENTS_AUTH_SECRET" --> AUTH
    GW -- "backend_shared_secret" --> INV
    GW -- "orders_shared_secret" --> ORD
    GW -- "payments_shared_secret" --> PAY
    GW -- "graphql_shared_secret" --> GQL
    GQL -- "GRAPHQL_ORDERS_SECRET (lectura)" --> ORD
    GQL -- "GRAPHQL_INVENTORY_SECRET (lectura)" --> INV
    GW -- "token de solo lectura" --> VAULT
    ORD -- "ORDERS_INVENTORY_SECRET" --> INV
    PAY -- "PAYMENTS_ORDERS_SECRET" --> ORD
    AUTH --> MONGO
    CLI --> MONGO
    INV --> MONGO
    ORD --> MONGO
    PAY --> MONGO
```

| Frontera | Qué no se confía | Cómo se controla |
|---|---|---|
| 1. Navegador → frontend → gateway | Nada de lo que manda el navegador. El frontend solo reenvía `/api/` y no agrega identidad ni secretos | Lista blanca de rutas y verbos; parámetros validados (`^[A-Za-z0-9_-]{1,64}$`); sesión validada con auth en cada solicitud; los `X-Authenticated-*` del navegador se descartan; `X-Request-ID` se acepta solo si es válido; solo se reenvían `content-type`, `idempotency-key` y `x-proveedor-secret` |
| 2. Proveedor → gateway → payments | El aviso de pago | payments revisa `X-Proveedor-Secret` y procesa cada aviso una sola vez |
| 3. Gateway → servicios internos | Que alguien llame a un servicio sin pasar por el gateway | Red privada sin acceso desde fuera; cada servicio exige su propio `X-Gateway-Secret`; solo con ese secreto confía en `X-Authenticated-User` y `X-Authenticated-Roles` |
| 4. Servicio → servicio | Que un servicio use una operación que no le corresponde | Secretos distintos por integración: orders → inventory, payments → orders y graphql-gateway → orders e inventory. Los de graphql-gateway solo sirven para leer |
| 5. Gateway → Vault | Que el gateway lea más de lo que necesita | Token con política de solo lectura sobre `secret/gateway` |
| 6. Servicios → MongoDB | — | Cada servicio usa su propia base, pero todos con el usuario raíz (brecha declarada en el M6) |

## 5. Recorrido de una solicitud autorizada

**Caso:** un CLIENTE crea un pedido (S11). Es la ejecución real guardada en `evidencias/u2/pedido-idempotente/logs.txt` (rama `feat/orders`), con `request_id` **`crear-pedido-0001`**.

```mermaid
sequenceDiagram
    participant N as Navegador (CLIENTE)
    participant G as API Gateway
    participant V as Vault
    participant A as auth
    participant O as orders
    participant I as inventory
    N->>G: POST /api/v1/pedidos<br/>cookie + Idempotency-Key<br/>X-Request-ID: crear-pedido-0001
    G->>G: Lista blanca: S11, acceso por rol CLIENTE
    G->>V: Lee secret/gateway (si no está en caché)
    G->>A: POST /introspect (auth_introspection_secret)
    A-->>G: 200 active, user_id USR-0001, roles CLIENTE
    G->>G: Rol CLIENTE permitido
    G->>O: POST /pedidos (orders_shared_secret,<br/>X-Authenticated-User, X-Authenticated-Roles)
    O->>I: POST /interno/reservas (ORDERS_INVENTORY_SECRET)
    I-->>O: 200 precio vigente y stock descontado
    O-->>G: 201 PED-0003, total 14980
    G-->>N: 201 + X-Request-ID: crear-pedido-0001
```

Las líneas de log, todas con `request_id: crear-pedido-0001`, en orden:

| Hora (UTC) | Servicio | Evento | Detalle |
|---|---|---|---|
| 13:51:34.548 | gateway | `secret_loaded` | Lee `secret/gateway`; registra solo los nombres de las claves |
| 13:51:34.611 | auth | `request` | `POST /introspect` → 200 |
| 13:51:35.230 | inventory | `request` | `POST /interno/reservas` → 200 |
| 13:51:35.260 | orders | `order_created` | `PED-0003`, `USR-0001`, total 14980 |
| 13:51:35.263 | orders | `request` | `POST /pedidos` → 201 |
| 13:51:35.266 | gateway | `request` | `POST /api/v1/pedidos` → 201, `USR-0001`, 800 ms |

## 6. Recorrido de una solicitud denegada

**Caso:** un CLIENTE intenta crear un producto (S03, solo ADMIN). Recorrido según el código; todavía no hay una ejecución guardada como evidencia (corresponde a la prueba P03 del protocolo).

```mermaid
sequenceDiagram
    participant N as Navegador (CLIENTE)
    participant G as API Gateway
    participant V as Vault
    participant A as auth
    participant I as inventory
    N->>G: POST /api/v1/productos<br/>cookie, X-Request-ID: denegado-0001
    G->>G: Lista blanca: S03, acceso por rol ADMIN
    G->>V: Lee secret/gateway (si no está en caché)
    G->>A: POST /introspect (auth_introspection_secret)
    A-->>G: 200 active, roles CLIENTE
    G->>G: CLIENTE no está en (ADMIN)
    G-->>N: 403 FORBIDDEN + X-Request-ID: denegado-0001
    Note over G,I: La solicitud nunca llega a inventory
```

Lo que se espera ver:

- Respuesta: `403` con `{ "error": { "code": "FORBIDDEN", "message": "No tienes permiso para esta operacion", "request_id": "denegado-0001" } }`.
- Logs con el mismo `request_id`: auth (`/introspect` → 200) y gateway (`POST /api/v1/productos` → 403). **Ninguna línea de inventory.**
- Si el navegador manda además `X-Authenticated-Roles: ADMIN` para engañar al gateway, el resultado es el mismo, porque ese header se descarta.

Otras denegaciones que corta el gateway antes de llegar al servicio: sin cookie (401 `UNAUTHENTICATED`), sesión vencida (401 `SESSION_INVALID`), ruta o verbo fuera de la lista blanca (404 o 405) e ID con formato inválido (400 `INVALID_ID`).

## 7. Logs de trazabilidad (U3)

Desde el PR #48 cada contenedor deja una línea por paso, todas con el mismo `request_id`, para seguir una solicitud de punta a punta en el video. Se ven con `sh scripts/logs.sh <request_id>` (o `.\scripts\logs.ps1 <request_id>` en Windows), que muestra primero la línea del frontend y después el resto ordenado por hora. Ningún log registra tokens, cookies, contraseñas ni valores de secretos: solo nombres de claves.

**Caso:** un CLIENTE crea un pedido (S11) desde `http://localhost:8080`. Eventos en el orden en que ocurren:

| # | Contenedor | Evento | Qué muestra |
|---|---|---|---|
| 1 | frontend | `api_proxied` | Método, ruta, estado, `proxy_to: gateway:8000` y el `request_id` que devolvió el gateway. nginx escribe esta línea al final, cuando termina la respuesta; `logs.sh` la muestra primero a propósito, porque es por donde entra la solicitud |
| 2 | gateway | `auth_validation_requested` | Que pide validar la sesión a auth (`/introspect`) antes de enrutar |
| 3 | gateway | `secret_loaded` | Solo si el secreto no estaba en caché (60 s): lee `secret/gateway` y registra los nombres de las claves |
| 4 | auth | `gateway_secret_ok` | auth aceptó el secreto del gateway |
| 5 | auth | `token_validated` | `active: true`, `user_id` y roles (o `active: false` con el motivo) |
| 6 | gateway | `auth_validation_result` | Lo que contestó auth: estado, `active`, `user_id`, roles |
| 7 | gateway | `authorization_granted` | La ruta (S11), el tipo de acceso y los roles del usuario |
| 8 | gateway | `secret_used` | Qué clave usó para el servicio destino (`orders_shared_secret`) y si salió de Vault o de la caché |
| 9 | orders | `gateway_secret_ok` | orders aceptó la llamada y de quién vino (`origen: api-gateway`) |
| 10 | orders | `order_created` | Pedido, usuario, total, base, colección `pedidos` y operación `insert_one` |
| 11 | gateway | `routed` | Servicio destino, URL interna, estado que respondió y tiempo en ms |

Además, cada servicio escribe al final su línea `request` (método, ruta, estado y ms); inventory aparece solo con esa línea, por la reserva de stock (`POST /interno/reservas`) que pide orders.

Este recorrido se ve completo, del paso 2 al 11, en `evidencias/u2/pytest/logs.txt` (E07) con `request_id` `p06-fb85d8c9`, y el rechazo por rol con `p03-43744f5a`. Esas pruebas llaman al gateway directo en el 8000, así que no tienen la línea del frontend.

Como la caché del secreto dura 60 segundos, `secret_loaded` casi nunca aparece en solicitudes seguidas y `secret_used` sale casi siempre con `origen: cache`. Para que se vea la lectura desde Vault en el video, se reinicia el gateway (`docker compose restart gateway`) justo antes de crear el pedido.

**Rechazos que también quedan en el log:**

- **Rol sin permiso** (por ejemplo, un usuario DESPACHO que intenta crear un pedido, que S11 solo permite a CLIENTE): el gateway escribe `authorization_denied` con los roles requeridos y los del usuario, y responde 403. No hay `routed` ni ninguna línea de orders.
- **Llamada a orders sin el secreto del gateway** (desde dentro de la red privada): orders escribe `gateway_secret_rejected` y responde 403 antes de tocar la base, porque la revisión del secreto corre antes que la operación.

