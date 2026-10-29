# Gateway de Chocomanía

Este gateway centraliza el acceso a dos proyectos ya construidos: la API de Productos (FastAPI + MongoDB) y la API de Usuarios (GraphQL con Apollo).

Para probarlo hay que levantar 3 servicios en 3 terminales distintas (con MongoDB corriendo local).

**Terminal 1**, desde `Semana5/graphql-usuarios` (queda en el puerto 4000):
npm install
node server.js

**Terminal 2**, desde `Semana6/bocato-api`:
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001

**Terminal 3**, desde `Semana 7/api-gateway`:
pip install -r requirements.txt
uvicorn gateway:app --host 0.0.0.0 --port 8000

Luego probar:

- http://localhost:8000/api/productos
- http://localhost:8000/api/usuarios
