from pydantic import BaseModel
from typing import Optional


class ProductoModel(BaseModel):
    nombre: str
    descripcion: str
    precio: float
    disponible: bool = True


class ProductoUpdateModel(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[float] = None
    disponible: Optional[bool] = None
