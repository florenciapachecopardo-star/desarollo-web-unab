from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Categoria(str, Enum):
    barras = "barras"
    bombones = "bombones"
    trufas = "trufas"


class ProductoModel(BaseModel):
    # "disponible" no se recibe: se calcula a partir del stock
    nombre: str = Field(min_length=1, max_length=80)
    descripcion: str = Field(default="", max_length=300)
    categoria: Categoria
    precio: int = Field(gt=0)
    stock: int = Field(ge=0)
    imagen: Optional[str] = Field(default=None, max_length=200)


class ProductoUpdateModel(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=80)
    descripcion: Optional[str] = Field(default=None, max_length=300)
    categoria: Optional[Categoria] = None
    precio: Optional[int] = Field(default=None, gt=0)
    stock: Optional[int] = Field(default=None, ge=0)
    imagen: Optional[str] = Field(default=None, max_length=200)
