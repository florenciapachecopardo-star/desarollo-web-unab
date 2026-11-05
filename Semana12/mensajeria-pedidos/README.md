# Semana 12: mensajería de colas con ActiveMQ (STOMP)

Un **productor** publica pedidos de Chocomanía en la cola `/queue/pedidos` y un **consumidor** los escucha y los muestra según su formato. El broker es **ActiveMQ** y el protocolo es **STOMP**.

| Archivo | Qué hace | Autora |
|---|---|---|
| `productor.py` | Arma un pedido (id, cliente, monto) y lo envía a la cola en formato texto, fijo, xml o json | Karla |
| `consumidor.py` | Escucha la cola, interpreta cada formato y hace ack o nack | Flo |
| `requirements.txt` | Dependencia `stomp.py` | Karla |

## Relación con Chocomanía

La cola `/queue/pedidos` es la base de una cola de despacho automática: cuando un pedido queda pagado, orders podría publicarlo aquí y el encargado de despacho lo recibiría en el orden en que llega (Caso 19, RF13), sin que nadie tenga que refrescar la pantalla.

## 1. Levantar ActiveMQ

1. Descargar ActiveMQ desde https://activemq.apache.org y descomprimirlo.
2. Entrar a la carpeta `bin` y ejecutar:
   - Windows: `activemq start`
   - Linux o Mac: `./activemq start`
3. Revisar la consola web en http://127.0.0.1:8161 (usuario y clave por defecto: `admin` / `admin`).

Puertos que levanta ActiveMQ:

| Protocolo | Puerto | Uso |
|---|---|---|
| OpenWire | 61616 | Protocolo nativo de ActiveMQ |
| AMQP | 5672 | Mensajería estándar |
| **STOMP** | **61613** | **El que usa esta semana** |
| MQTT | 1883 | Muy usado en IoT |

## 2. Instalar la dependencia

```
pip install -r requirements.txt
```

## 3. Credenciales del broker

El productor y el consumidor leen el usuario y la clave desde variables de entorno, para no dejarlas escritas en el código:

- `BROKER_USUARIO` (si no existe, usa `demo`)
- `BROKER_CLAVE` (si no existe, usa `demo123`)

Son valores de laboratorio. En un entorno real se sacarían de Vault, igual que los secretos del gateway.

## 4. Probar

**Terminal 1**, el consumidor:

```
python consumidor.py
```

Salida esperada:

```
Escuchando /queue/pedidos. Presiona Ctrl+C para salir.
```

**Terminal 2**, el productor con cada formato:

| Comando | Lo que muestra el productor |
|---|---|
| `python productor.py --formato texto --mensaje "Hola mundo STOMP"` | `Mensaje enviado a /queue/pedidos (formato texto): Hola mundo STOMP` |
| `python productor.py --formato fijo` | `Mensaje enviado a /queue/pedidos (formato fijo): 000001Valentina Soto      0017980.00` |
| `python productor.py --formato xml` | `Mensaje enviado a /queue/pedidos (formato xml): <pedido><id>1</id><cliente>Valentina Soto</cliente><monto>17980.0</monto></pedido>` |
| `python productor.py --formato json` | `Mensaje enviado a /queue/pedidos (formato json): {"id": 1, "cliente": "Valentina Soto", "monto": 17980.0}` |

En la terminal 1, el consumidor muestra cada uno así (ejemplo con json):

```
[RECIBIDO] formato=json
{
  "id": 1,
  "cliente": "Valentina Soto",
  "monto": 17980.0
}
```

Para otro pedido: `python productor.py --formato json --id 2 --cliente "Tomas Rojas" --monto 6490.00`

## 5. Formato fijo (contrato de 36 caracteres)

| Campo | Posición | Largo | Regla |
|---|---|---|---|
| id | 0 a 6 | 6 | Numérico, relleno con ceros a la izquierda |
| cliente | 6 a 26 | 20 | Letras, números y espacios, relleno con espacios a la derecha |
| monto | 26 a 36 | 10 | Positivo, con 2 decimales, relleno con ceros a la izquierda |

## 6. Errores esperados

| Caso | Qué pasa |
|---|---|
| `python productor.py --monto abc` | El productor no envía nada: `error: Monto no válido: abc` |
| `python productor.py --formato fijo --cliente "Nombre de cliente demasiado largo"` | El productor no envía nada: el cliente no cabe en 20 caracteres |
| Llega un XML cuya raíz no es `<pedido>` | El consumidor muestra `Mensaje inválido: El nodo raíz del XML debe ser <pedido>` y hace nack |
| ActiveMQ no está levantado | El productor y el consumidor fallan al conectarse al puerto 61613 |

## 7. Conceptos

- **persistent:** el broker guarda el mensaje hasta que alguien lo consume, aunque el consumidor no esté conectado.
- **ack:** el consumidor lo procesó bien y el mensaje sale de la cola.
- **nack:** el mensaje viene mal de origen. Se rechaza para no procesarlo como si estuviera bien (ActiveMQ lo manda a su cola de mensajes muertos después de los reintentos).
- **client-individual:** el consumidor decide ack o nack mensaje por mensaje.
- **prefetchSize 1:** el consumidor recibe de a un mensaje, y la pausa de 500 ms le da tiempo para procesarlo.
