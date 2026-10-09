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
    avatar_url: str | None = None


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
class EnderecoPerfilEntrada(_Base):
    cep: str | None = None
    logradouro: str | None = Field(default=None, min_length=1, max_length=150)
    numero: str | None = Field(default=None, min_length=1, max_length=10)
    complemento: str | None = Field(default=None, max_length=60)
    bairro: str | None = Field(default=None, min_length=1, max_length=80)
    cidade: str | None = Field(default=None, min_length=1, max_length=80)
    uf: str | None = None

    @field_validator("cep")
    @classmethod
    def validar_cep(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from app.validators import normalizar_cep, validar_cep
        v = normalizar_cep(v)
        if not validar_cep(v):
            raise ValueError("Informe um CEP valido.")
        return v

    @field_validator("uf")
    @classmethod
    def validar_uf(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from app.validators import normalizar_uf, validar_uf
        v = normalizar_uf(v)
        if not validar_uf(v):
            raise ValueError("Informe uma UF valida.")
        return v


class VitrineVendedorEntrada(_Base):
    farm_name: str | None = Field(default=None, min_length=2, max_length=150)
    bio: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    state: str | None = None
    public_phone: str | None = None
    categories: list[str] | None = None
    has_own_transport: bool | None = None

    @field_validator("state")
    @classmethod
    def validar_uf(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from app.validators import normalizar_uf, validar_uf
        v = normalizar_uf(v)
        if not validar_uf(v):
            raise ValueError("Informe uma UF valida.")
        return v

    @field_validator("public_phone")
    @classmethod
    def validar_telefone(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        if not _TELEFONE.fullmatch(v):
            raise ValueError("Informe um telefone brasileiro com DDD.")
        return v

    @field_validator("categories")
    @classmethod
    def validar_categorias(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        validas = {"cafe", "boi_gordo", "soja", "milho"}
        for cat in v:
            if cat not in validas:
                raise ValueError(f"Categoria invalida: {cat}.")
        return v


class ContaPerfilEntrada(_Base):
    nome: str | None = Field(default=None, min_length=2, max_length=150)
    telefone: str | None = None
    cpf_cnpj: str | None = None
    avatar_url: str | None = Field(default=None, max_length=500)

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Informe um nome valido.")
        return v

    @field_validator("telefone")
    @classmethod
    def validar_telefone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not _TELEFONE.fullmatch(v):
            raise ValueError("Informe um telefone brasileiro com DDD.")
        return v

    @field_validator("cpf_cnpj")
    @classmethod
    def validar_cpf_informado(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        from app.validators import normalizar_cpf, validar_cpf
        v = normalizar_cpf(v)
        if not validar_cpf(v):
            raise ValueError("Informe um CPF valido.")
        return v


class EditarPerfil(_Base):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = None
    cpf: str | None = None
    avatar_url: str | None = Field(default=None, max_length=500)
    account: ContaPerfilEntrada | None = None
    address: EnderecoPerfilEntrada | None = None
    seller: VitrineVendedorEntrada | None = None

    @field_validator("name")
    @classmethod
    def validar_nome(cls, v: str | None) -> str | None:
        if v is None:
            return v

        v = " ".join(v.split())

        if len(v) < 2:
            raise ValueError("Informe um nome valido.")

        return v

    @field_validator("phone")
    @classmethod
    def validar_telefone(cls, v: str | None) -> str | None:
        if v is None:
            return v

        if not _TELEFONE.fullmatch(v):
            raise ValueError(
                "Informe um telefone brasileiro com DDD."
            )

        return v

    @field_validator("cpf")
    @classmethod
    def validar_cpf_informado(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        from app.validators import normalizar_cpf, validar_cpf
        v = normalizar_cpf(v)
        if not validar_cpf(v):
            raise ValueError("Informe um CPF valido.")
        return v

class VerificacaoResumo(_Base):
    protocol: str | None = None
    estado: str | None = None
    tipo: str | None = None

class MeResposta(_Base):
    conta: ContaResumo
    vendedor: VendedorResumo
    expira_em: str
    verificacao: VerificacaoResumo | None = None

class AlterarEmail(_Base):
    novo_email: str = Field(max_length=254)
    senha_atual: str

    @field_validator("novo_email")
    @classmethod
    def _novo_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("Informe um email valido.")
        return v
