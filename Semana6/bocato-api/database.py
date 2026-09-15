from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client["bocato_db"]
sandwiches_collection = db["sandwiches"]
