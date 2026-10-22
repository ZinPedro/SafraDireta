"""Formato de entrada dos anuncios: o mesmo formulario que o front monta (campos planos, camelCase).

Aqui ficam so os tipos e limites de cada campo. As regras que dependem de mais de um
campo (laudo por cultura, preco que confere com o total, etc.) ficam em anuncio_regras.py.
"""
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, str_strip_whitespace=True
    )


class _AnuncioBase(_Base):
    titulo: str = Field(min_length=5, max_length=150)
    descricao: str | None = Field(default=None, max_length=2000)
    cidade: str = Field(min_length=1, max_length=100)
    uf: str = Field(min_length=2, max_length=2)
    preco_total: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    # Fotos e video vao pelo envio de midia (US012), nao pelo cadastro. Os campos existem
    # so para a API recusar com uma mensagem clara em vez de perder o arquivo em silencio.
    fotos: list | None = None
    video: dict | None = None


class AnuncioAnimal(_AnuncioBase):
    categoria: Literal["ANIMAL"]
    especie: Literal["BOVINO"]
    raca: str = Field(min_length=1, max_length=60)
    raca_personalizada: str | None = Field(default=None, max_length=30)
    finalidade: Literal["ENGORDA_ABATE", "RECRIA_GARROTES", "CRIA_DESMAMA", "REPRODUCAO_TOUROS"]
    quantidade_cabecas: int = Field(gt=0, le=100_000)
    peso_medio_kg: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    idade_meses: int | None = Field(default=None, ge=0, le=600)
    pricing_mode: Literal["TOTAL", "PER_HEAD"]
    preco_por_cabeca: Decimal | None = Field(default=None, gt=0, max_digits=18, decimal_places=4)


class AnuncioGraos(_AnuncioBase):
    categoria: Literal["GRAOS"]
    cultura: Literal["SOJA", "MILHO", "CAFE", "TRIGO", "OUTRO"]
    cultura_personalizada: str | None = Field(default=None, max_length=30)
    subtipo: str = Field(min_length=1, max_length=60)
    subtipo_personalizado: str | None = Field(default=None, max_length=30)
    safra: str = Field(min_length=1, max_length=20)
    embalagem: Literal["SACARIA", "BIG_BAG", "GRANEL"]
    umidade_percentual: Decimal = Field(ge=1, le=50, max_digits=5, decimal_places=2)
    quantidade_sacas: int = Field(gt=0, le=10_000_000)
    peso_total_toneladas: Decimal | None = Field(default=None, gt=0, max_digits=15, decimal_places=3)
    pricing_mode: Literal["TOTAL", "PER_SACK"]
    preco_por_saca: Decimal | None = Field(default=None, gt=0, max_digits=18, decimal_places=4)
    laudo_tecnico: dict | None = None


# A API escolhe o formulario pelo campo "categoria" ("ANIMAL" ou "GRAOS").
AnuncioEntrada = Annotated[AnuncioAnimal | AnuncioGraos, Field(discriminator="categoria")]
