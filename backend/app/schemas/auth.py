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


class LoginEntrada(_Base):
    email: str = Field(min_length=1, max_length=254)
    # No login nao exigimos tamanho minimo: so o cadastro define a regra da senha.
    # O maximo evita enviar textos gigantes para o Argon2.
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return v.strip().lower()


class MeResposta(_Base):
    conta: ContaResumo
    vendedor: VendedorResumo
    expira_em: str


_UFS_VALIDAS = {
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
}


def _validar_cnpj(cnpj: str) -> bool:
    if len(cnpj) != 14:
        return False
    if cnpj == cnpj[0] * 14:
        return False
    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s1 = sum((ord(c) - 48) * w for c, w in zip(cnpj[:12], w1))
    r1 = s1 % 11
    d1 = 0 if r1 < 2 else 11 - r1
    w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s2 = sum((ord(c) - 48) * w for c, w in zip(cnpj[:12] + str(d1), w2))
    r2 = s2 % 11
    d2 = 0 if r2 < 2 else 11 - r2
    return cnpj[12:] == f"{d1}{d2}"


def _validar_cpf(cpf: str) -> bool:
    if len(cpf) != 11 or not cpf.isdigit():
        return False
    if cpf == cpf[0] * 11:
        return False
    s1 = sum(int(c) * (10 - i) for i, c in enumerate(cpf[:9]))
    r1 = (s1 * 10) % 11
    d1 = 0 if r1 >= 10 else r1
    s2 = sum(int(c) * (11 - i) for i, c in enumerate(cpf[:10]))
    r2 = (s2 * 10) % 11
    d2 = 0 if r2 >= 10 else r2
    return cpf[9:] == f"{d1}{d2}"


class EmpresaEntrada(_Base):
    cnpj: str = Field(min_length=14, max_length=14)
    razao_social: str = Field(min_length=2, max_length=200)
    nome_fantasia: str | None = None
    natureza_juridica: str | None = None

    @field_validator("cnpj")
    @classmethod
    def _cnpj(cls, v: str) -> str:
        v = v.strip().upper()
        if not _validar_cnpj(v):
            raise ValueError("Informe um CNPJ válido.")
        return v


class EnderecoEntrada(_Base):
    cep: str = Field(min_length=8, max_length=8)
    logradouro: str = Field(min_length=1, max_length=200)
    numero: str = Field(min_length=1, max_length=20)
    complemento: str | None = None
    bairro: str = Field(min_length=1, max_length=100)
    cidade: str = Field(min_length=1, max_length=100)
    uf: str = Field(min_length=2, max_length=2)

    @field_validator("cep")
    @classmethod
    def _cep(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^\d{8}$", v):
            raise ValueError("Informe um CEP válido com 8 números.")
        return v

    @field_validator("uf")
    @classmethod
    def _uf(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in _UFS_VALIDAS:
            raise ValueError("Informe uma sigla de estado (UF) válida.")
        return v


class RepresentanteEntrada(_Base):
    nome: str = Field(min_length=2, max_length=150)
    cpf: str = Field(min_length=11, max_length=11)
    vinculo: str = Field(min_length=2, max_length=100)

    @field_validator("cpf")
    @classmethod
    def _cpf(cls, v: str) -> str:
        v = v.strip()
        if not _validar_cpf(v):
            raise ValueError("Informe um CPF válido.")
        return v


class DocumentosEntrada(_Base):
    has_company_doc: bool
    has_representative_doc: bool
    file_names: list[str] = []

    @field_validator("has_company_doc")
    @classmethod
    def _has_company(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Anexe o documento de constituição da empresa.")
        return v

    @field_validator("has_representative_doc")
    @classmethod
    def _has_rep(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Anexe o documento do representante.")
        return v


class AcessoEntrada(_Base):
    email: str = Field(max_length=254)
    telefone: str
    senha: str = Field(min_length=8, max_length=128)
    accepted_terms: bool

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("Informe um e-mail válido.")
        return v

    @field_validator("telefone")
    @classmethod
    def _telefone(cls, v: str) -> str:
        if not _TELEFONE.match(v):
            raise ValueError("Informe um telefone brasileiro com DDD.")
        return v

    @field_validator("accepted_terms")
    @classmethod
    def _termos(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Marque a opção de aceite para continuar.")
        return v


class RegistroPJ(_Base):
    company: EmpresaEntrada
    address: EnderecoEntrada
    representative: RepresentanteEntrada
    documents: DocumentosEntrada
    access: AcessoEntrada


class RegistroPJResposta(_Base):
    status: str = "registered_pending_validation"
    protocol: str
    message: str
    token: str
    expira_em: str
    conta: ContaResumo
