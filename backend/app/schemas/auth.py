"""Formatos de entrada e saida das rotas de autenticacao."""
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

# formatacao de email e telefone
_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$") 
_TELEFONE = re.compile(r"^\+55[1-9][0-9][0-9]{8,9}$")


class _Base(BaseModel):
    # snake_case no Python, camelCase no JSON (o front manda acceptedTerms)
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RegistroPF(_Base):
    name: str = Field(min_length=2, max_length=150)
    email: str = Field(max_length=254)
    phone: str
    password: str = Field(min_length=8, max_length=128)
    accepted_terms: bool
    intent: Literal["buyer", "seller"]

    @field_validator("name")
    @classmethod
    def _nome(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Informe seu nome completo.")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("Informe um email valido.")
        return v

    @field_validator("phone")
    @classmethod
    def _telefone(cls, v: str) -> str:
        if not _TELEFONE.match(v):
            raise ValueError("Informe um telefone brasileiro com DDD.")
        return v

    @field_validator("accepted_terms")
    @classmethod
    def _termos(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Marque a opcao de aceite para continuar.")
        return v


class ContaResumo(_Base):
    id: str
    tipo: str
    nome: str
    email: str


class VendedorResumo(_Base):
    estado: str | None = None


class SessaoResposta(_Base):
    token: str
    expira_em: str
    conta: ContaResumo
    vendedor: VendedorResumo
    proximo_passo: str | None = None