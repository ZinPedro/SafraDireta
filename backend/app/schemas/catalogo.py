from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class FiltroCatalogoSchema(BaseModel):
    # Busca por palavra-chave
    q: Optional[str] = Field(None, max_length=100, description="Termo para busca em título e descrição")

    # Filtro por Categoria
    categoria_id: Optional[str] = Field(None, description="UUID da categoria para filtro")

    # Filtro por Peso e Preço (Limites inclusivos)
    preco_min: Optional[Decimal] = Field(None, ge=0, description="Preço mínimo do lote em BRL")
    preco_max: Optional[Decimal] = Field(None, ge=0, description="Preço máximo do lote em BRL")
    peso_min: Optional[Decimal] = Field(None, ge=0, description="Peso mínimo total em kg")
    peso_max: Optional[Decimal] = Field(None, ge=0, description="Peso máximo total em kg")

    # Ordenação segura
    ordenar_por: Optional[str] = Field(
        "recentes", 
        description="Ordenação: 'recentes', 'menor_preco', 'maior_preco', 'menor_peso', 'maior_peso'"
    )

    # Paginação
    pagina: int = Field(1, ge=1)
    tamanho_pagina: int = Field(12, ge=1, le=50)


class ItemCatalogoSchema(BaseModel):
    id: UUID
    titulo: str
    descricao: Optional[str] = None
    categoria: str
    produto: str
    cidade: Optional[str] = None
    uf: Optional[str] = None
    precoTotal: Optional[float] = None
    pesoTotalKg: Optional[float] = None
    pricingMode: Optional[str] = None
    publicadoEm: Optional[str] = None
    capa: Optional[dict] = None


class RespostaCatalogoSchema(BaseModel):
    itens: List[ItemCatalogoSchema]
    pagina: int
    tamanho: int
    total: int