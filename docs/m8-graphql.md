# M8. GraphQL Gateway

**Fuente:** `backend/graphql-gateway/main.py`, los cambios del PR #37 en orders, inventory, gateway y `docker-compose.yml`, `frontend/js/mis-pedidos.js` (PR #38) y las evidencias `evidencias/u2/graphql-agregacion/` y `evidencias/u2/graphql-error-parcial/`. Código en `main` (commit `21c7b64`).

## 1. Qué es y dónde está

| Característica | Cómo está implementado |
|---|---|
| Servicio | `graphql-gateway`, con Strawberry sobre FastAPI |
| Privado | Solo está en la red privada (sin puerto publicado). El único que lo llama es el API Gateway, por la ruta S18 `POST /api/v1/graphql` |
| Quién puede llamar | El API Gateway valida la sesión (S18 es "autenticado") y reenvía la identidad. graphql-gateway exige su propio secreto (`graphql_shared_secret`); sin él responde 403, y sin identidad, 401 |
| Agregación real | Junta **orders** (pedidos del cliente) con **inventory** (estado actual de cada producto) |
| Solo POST | GET deshabilitado y sin GraphiQL (`graphql_ide=None`, `allow_queries_via_get=False`) |
| Pantalla real | `frontend/mis-pedidos.html` usa la query `misPedidos` |

## 2. Schema

Strawberry convierte los nombres de Python a camelCase (`mis_pedidos` → `misPedidos`).

```graphql
type Query {
  "Pedidos del cliente que inició sesión, del más antiguo al más nuevo"
  misPedidos(pagina: Int! = 1, porPagina: Int! = 10): PaginaPedidos!
  "Un pedido propio por ID (un pedido ajeno responde null)"
  pedido(id: ID!): Pedido
}

type PaginaPedidos {
  items: [Pedido!]!
  pagina: Int!
  porPagina: Int!
  total: Int!
}

type Pedido {
  id: ID!
  estado: String!
  total: Int!
  creadoEn: String!
  boleta: Boleta
  despacho: Despacho
  lineas: [Linea!]!
}

type Linea {
  productoId: ID!
  "Nombre al momento de la compra"
  nombre: String!
  cantidad: Int!
  precioUnitario: Int!
  subtotal: Int!
  "Estado ACTUAL del producto en inventory (puede venir null con error parcial)"
  producto: Producto
  "Pedido al que pertenece la línea"
  pedido: Pedido!
}

type Producto {
  id: ID!
  nombre: String!
  categoria: String
  imagen: String
  disponible: Boolean!
  "Solo ADMIN. Para los demás roles devuelve null con error FORBIDDEN_FIELD"
  stock: Int
}

type Boleta {
  numero: String!
  fecha: String!
  neto: Int!
  iva: Int!
  total: Int!
}

type Despacho {
  direccion: String!
  comuna: String!
}
```

No hay mutations: GraphQL solo se usa para leer. Las escrituras (crear pedido, pagar, anular) siguen por REST (S11, S13, S16).

**Minimización:** el tipo `Despacho` no incluye el teléfono, y `Pedido` no expone `cliente_id`, el historial ni el `request_id` de orders.

## 3. Resolvers

| Campo | Qué hace | Servicio que llama | Secreto |
|---|---|---|---|
| `Query.misPedidos` | Revisa que el rol sea CLIENTE y la paginación (`pagina ≥ 1`, `porPagina` entre 1 y 20). Pide `GET /pedidos` a orders, que devuelve solo los pedidos de ese cliente | orders | `GRAPHQL_ORDERS_SECRET` |
| `Query.pedido` | Revisa que el rol sea CLIENTE y pide `GET /pedidos/{id}`. Si orders responde 404 (ajeno o inexistente), devuelve `null` | orders | `GRAPHQL_ORDERS_SECRET` |
| `Pedido.lineas` | Arma las líneas con los datos que ya trajo orders (sin llamadas nuevas) | — | — |
| `Linea.producto` | Pide el producto al DataLoader. Si el producto ya no existe, devuelve `null`; el nombre y el precio de la compra siguen en la línea | inventory (por lote) | `GRAPHQL_INVENTORY_SECRET` |
| `Linea.pedido` | Devuelve el pedido al que pertenece la línea (sin llamadas nuevas) | — | — |
| `Producto.stock` | Solo para ADMIN; a cualquier otro rol le responde con el error `FORBIDDEN_FIELD` | — | — |

**Secretos de solo lectura:** orders acepta `GRAPHQL_ORDERS_SECRET` solo en `GET /pedidos` y `GET /pedidos/{id}` (función `verify_lectura`); con ese secreto no se puede crear, anular ni cambiar el estado de un pedido. inventory acepta `GRAPHQL_INVENTORY_SECRET` solo en `POST /interno/productos/lote`.

## 4. Batching (sin llamadas repetidas por ítem)

`Linea.producto` no llama a inventory por cada línea: usa un **DataLoader**, creado de nuevo en cada solicitud. Junta todos los ID de productos de la consulta y hace **una sola** llamada a `POST /interno/productos/lote` (máximo 50 ID).

**Evidencia** (`evidencias/u2/graphql-agregacion/`, `request_id` `gql-mispedidos-0002`): dos pedidos con cuatro líneas en total generan **una** llamada a inventory (`batch_loaded`, `cantidad: 2` productos distintos).

| Hora (UTC) | Servicio | Evento |
|---|---|---|
| 04:02:28.405 | auth | `POST /introspect` → 200 |
| 04:02:28.629 | orders | `GET /pedidos` → 200 |
| 04:02:28.808 | inventory | `POST /interno/productos/lote` → 200 |
| 04:02:28.810 | graphql-gateway | `batch_loaded`, 2 productos |
| 04:02:28.813 | graphql-gateway | `POST /graphql` → 200 |
| 04:02:28.814 | gateway | `POST /api/v1/graphql` → 200 |

## 5. Límites

| Límite | Valor | Para qué |
|---|---|---|
| Profundidad máxima | 6 (`GRAPHQL_MAX_DEPTH`) | El schema tiene un ciclo (`Linea.pedido` → `Pedido.lineas` → …); sin límite se podría pedir una consulta infinitamente anidada |
| Alias máximos | 10 (`GRAPHQL_MAX_ALIASES`) | Evita pedir el mismo campo muchas veces con nombres distintos |
| Tokens máximos | 1.000 (`GRAPHQL_MAX_TOKENS`) | Limita el tamaño de la consulta |
| Paginación | `porPagina` máximo 20 | Evita traer todos los pedidos de una vez |
| Plazo | 3 s hacia orders e inventory (`UPSTREAM_TIMEOUT_SECONDS`) | El gateway espera 5 s, así que el error dice qué servicio falló |

Ejemplo de consulta que se rechaza por profundidad (8 niveles):

```graphql
query {
  misPedidos {
    items { lineas { pedido { lineas { pedido { lineas { nombre } } } } } }
  }
}
```

La consulta se rechaza antes de llamar a orders o a inventory, y el error queda en el log como `graphql_error` con código `VALIDATION`.

## 6. Autorización

| Nivel | Regla | Dónde se revisa |
|---|---|---|
| Sesión | S18 exige sesión vigente | API Gateway |
| Servicio | graphql-gateway exige su secreto propio | graphql-gateway |
| Rol | `misPedidos` y `pedido` son solo para CLIENTE; otro rol recibe el error `FORBIDDEN` | graphql-gateway |
| Recurso | Un cliente solo ve sus pedidos: orders filtra por `cliente_id` y responde 404 al pedido ajeno, que GraphQL devuelve como `null` | orders |
| Campo | `Producto.stock` solo para ADMIN; los demás reciben `null` con `FORBIDDEN_FIELD` | graphql-gateway |

## 7. Errores parciales

Si un servicio falla, GraphQL devuelve lo que sí pudo obtener y explica lo que falta en `errors`, con un código en `extensions.code`. Nunca muestra datos incompletos como si estuvieran completos.

| Situación | Respuesta |
|---|---|
| inventory caído | Pedidos completos y `producto: null` en cada línea, con un error `UPSTREAM_UNAVAILABLE` por línea en `errors` |
| inventory lento (> 3 s) | Igual, con `UPSTREAM_TIMEOUT` |
| inventory responde con error | Igual, con `UPSTREAM_ERROR` |
| orders caído o lento | Sin datos (`misPedidos` no puede responder) y el error `UPSTREAM_UNAVAILABLE` o `UPSTREAM_TIMEOUT` |
| Paginación inválida | Error `BAD_REQUEST` |
| Rol que no es CLIENTE | Error `FORBIDDEN` |
| Campo `stock` sin ser ADMIN | `stock: null` y error `FORBIDDEN_FIELD` |
| Consulta demasiado profunda, con muchos alias o muy grande | Rechazada antes de ejecutarse |

**Evidencia** (`evidencias/u2/graphql-error-parcial/`, `request_id` `gql-inventory-caido-0002`): con inventory apagado, los dos pedidos se ven con su estado y sus líneas, `producto` viene en `null` y hay 4 errores `UPSTREAM_UNAVAILABLE` (uno por línea), cada uno con su `path`.

**En el front:** `mis-pedidos.js` revisa `errors`. Si hay datos y errores, muestra los pedidos con el aviso "Algunos datos de los productos no están disponibles en este momento" y el código de la solicitud. Si no hay datos, muestra el error.

## 8. Uso desde una pantalla real

`frontend/mis-pedidos.html` envía esta consulta al cargar:

```graphql
query MisPedidos($pagina: Int!) {
  misPedidos(pagina: $pagina, porPagina: 10) {
    total
    items {
      id estado total creadoEn
      boleta { numero }
      lineas { nombre cantidad producto { disponible } }
    }
  }
}
```

Con el campo `disponible`, la pantalla marca "(hoy agotado)" en los productos que ya no tienen stock.

## 9. Mapa de clasificación de servicios

| Clasificación | Servicios (M1) | Por qué |
|---|---|---|
| Consulta | S01, S02, S08, S10, S12, S14 | Leen datos de un solo servicio |
| Transaccional | S03, S04, S05, S06, S07, S09, S11, S13, S15, S16 | Cambian el estado de un servicio |
| Integración | S17 | La llama un sistema externo (el proveedor de pagos) |
| **Agregación** | **S18** | **Junta datos de orders e inventory en una sola respuesta (este módulo)** |
| Analítica | S19 | Calcula el reporte de ventas a partir de los pedidos (ver `docs/adr-analitica.md`) |

## 10. Límites conocidos

1. **`stock` solo se puede mostrar denegado.** Las queries son solo para CLIENTE, así que un ADMIN no llega a ese campo: la autorización por campo se demuestra con el caso `FORBIDDEN_FIELD`, no con el permitido.
2. **Introspección activa.** Strawberry permite consultar el schema (`__schema`). El riesgo es bajo, porque solo se llega con sesión y a través del gateway.
3. **Más de 50 productos distintos en una página.** La operación por lote de inventory acepta máximo 50 ID. Si una página de pedidos tuviera más productos distintos, todos los `producto` vendrían en `null` con `UPSTREAM_ERROR`. Con el catálogo actual (5 productos) no puede pasar.
