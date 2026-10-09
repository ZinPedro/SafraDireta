
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.validators import (
    normalizar_cnpj,
    normalizar_cpf,
    normalizar_cep,
    normalizar_uf,
    validar_cnpj,
    validar_cpf,
    validar_cep,
    validar_uf,
)
from app.schemas.auth import RegistroPF


class BasePJ(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class EmpresaEntrada(BasePJ):
    cnpj: str
    razao_social: str = Field(min_length=2)
    nome_fantasia: str | None = None
    natureza_juridica: str | None = None

    @field_validator("cnpj")
    @classmethod
    def conferir_cnpj(cls, valor: str) -> str:
        valor = normalizar_cnpj(valor)
        if not validar_cnpj(valor):
            raise ValueError("Informe um CNPJ valido.")
        return valor


class EnderecoEntrada(BasePJ):
    cep: str
    logradouro: str = Field(min_length=1)
    numero: str = Field(min_length=1)
    complemento: str | None = None
    bairro: str = Field(min_length=1)
    cidade: str = Field(min_length=1)
    uf: str

    @field_validator("cep")
    @classmethod
    def conferir_cep(cls, valor: str) -> str:
        valor = normalizar_cep(valor)
        if not validar_cep(valor):
            raise ValueError("Informe um CEP valido.")
        return valor

    @field_validator("uf")
    @classmethod
    def conferir_uf(cls, valor: str) -> str:
        valor = normalizar_uf(valor)
        if not validar_uf(valor):
            raise ValueError("Informe uma UF valida.")
        return valor


class RepresentanteEntrada(BasePJ):
    nome: str = Field(min_length=2)
    cpf: str
    vinculo: str = Field(min_length=1)

    @field_validator("cpf")
    @classmethod
    def conferir_cpf(cls, valor: str) -> str:
        valor = normalizar_cpf(valor)
        if not validar_cpf(valor):
            raise ValueError("Informe um CPF valido.")
        return valor


class DocumentosEntrada(BasePJ):
    has_company_doc: bool
    has_representative_doc: bool
    file_names: list[str] = Field(default_factory=list)

    @field_validator("has_company_doc", "has_representative_doc")
    @classmethod
    def conferir_documentos(cls, valor: bool) -> bool:
        if not valor:
            raise ValueError("Documento obrigatorio.")
        return valor


class AcessoPJEntrada(BasePJ):
    email: str = Field(max_length=254)
    telefone: str
    senha: str = Field(min_length=8, max_length=128)
    accepted_terms: bool

    @field_validator("email")
    @classmethod
    def conferir_email(cls, valor: str) -> str:
        import re
        valor = valor.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", valor):
            raise ValueError("Informe um email valido.")
        return valor

    @field_validator("telefone")
    @classmethod
    def conferir_telefone(cls, valor: str) -> str:
        import re
        if not re.fullmatch(r"\+55[1-9][0-9][0-9]{8,9}", valor):
            raise ValueError("Informe um telefone brasileiro com DDD.")
        return valor

    @field_validator("accepted_terms")
    @classmethod
    def conferir_termos(cls, valor: bool) -> bool:
        if not valor:
            raise ValueError("Aceite os termos para continuar.")
        return valor


class RegistroPJ(BasePJ):
    company: EmpresaEntrada
    address: EnderecoEntrada
    representative: RepresentanteEntrada
    documents: DocumentosEntrada
    access: AcessoPJEntrada
