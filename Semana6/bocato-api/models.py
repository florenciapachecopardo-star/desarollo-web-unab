from pydantic import BaseModel
from typing import Optional


class SandwichModel(BaseModel):
    nombre: str
    descripcion: str
    precio: float
    disponible: bool = True


class SandwichUpdateModel(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[float] = None
    disponible: Optional[bool] = None
