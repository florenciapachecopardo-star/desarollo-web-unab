import os

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL")
if not MONGO_URL:
    raise RuntimeError("MONGO_URL no esta configurado")

MONGO_DB = os.getenv("MONGO_DB", "inventory")

client = AsyncIOMotorClient(MONGO_URL)
db = client[MONGO_DB]
productos_collection = db["productos"]
