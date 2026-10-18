"""Formatos de entrada dos anuncios (camelCase no JSON, como no resto da API)."""
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, str_strip_whitespace=True
    )


class LoteAnimalEntrada(_Base):
    quantidade_animais: int = Field(gt=0, le=100_000)
    raca: str | None = Field(default=None, max_length=100)
    sexo_lote: str | None = Field(default=None, max_length=50)
    idade_media_meses: Decimal | None = Field(default=None, ge=0, le=600, decimal_places=2)
    observacoes: str | None = Field(default=None, max_length=1000)


class AnuncioEntrada(_Base):
    produto_id: UUID
    titulo: str = Field(min_length=1, max_length=150)
    descricao: str | None = Field(default=None, max_length=2000)
    preco_lote: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    peso_total_kg: Decimal | None = Field(default=None, gt=0, max_digits=15, decimal_places=3)
    lote_animal: LoteAnimalEntrada | None = None
