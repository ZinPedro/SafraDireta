
"""Rotas relacionadas a vendedores."""

from fastapi import APIRouter, Depends
from psycopg import Connection

from app.database import get_connection
from app.deps import conta_autenticada
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from app.errors import conflito, proibido
from pydantic import field_validator
from app.validators import normalizar_cpf, validar_cpf
from psycopg.types.json import Jsonb
from app.errors import conflito, proibido, nao_encontrado

router = APIRouter(
    prefix="/api/vendedor",
    tags=["Vendedores"],
)


@router.get("/habilitacao")
def minha_habilitacao(
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    """Consulta a habilitacao da conta autenticada."""

    linha = conn.execute(
        """
        SELECT estado, possui_transportadora,
               observacao_transporte AS observacao_transportadora
        FROM safradireta.habilitacao_vendedor
        WHERE conta_id = %s
        """,
        (atual["conta_id"],),
    ).fetchone()

    if linha is None:
        raise nao_encontrado("Nenhuma solicitacao de habilitacao encontrada.")

    return {
        "possuiHabilitacao": True,
        "estado": linha["estado"],
        "possuiTransportadora": linha["possui_transportadora"],
        "observacaoTransportadora": linha["observacao_transportadora"],
    }



class DocumentosHabilitacaoEntrada(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    has_cpf_document: bool | None = None
    cpf_front_file_name: str | None = None
    cpf_back_file_name: str | None = None
    has_car_document: bool | None = None
    car_file_name: str | None = None


class SolicitacaoHabilitacao(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    cpf: str
    possui_transportadora: bool | None = None
    has_own_transport: bool | None = None
    observacao_transportadora: str | None = Field(
        default=None,
        max_length=500,
    )
    farm_name: str | None = Field(default=None, max_length=150)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = None
    categories: list[str] | None = None
    documents: DocumentosHabilitacaoEntrada | None = None

    @field_validator("cpf")
    @classmethod
    def validar_cpf_informado(cls, valor: str) -> str:
        cpf = normalizar_cpf(valor)

        if not validar_cpf(cpf):
            raise ValueError("Informe um CPF valido.")

        return cpf

    @field_validator("state")
    @classmethod
    def validar_uf_informada(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from app.validators import normalizar_uf, validar_uf
        v = normalizar_uf(v)
        if not validar_uf(v):
            raise ValueError("Informe uma UF valida.")
        return v

    @field_validator("categories")
    @classmethod
    def validar_categorias_informadas(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        validas = {"cafe", "boi_gordo", "soja", "milho"}
        for cat in v:
            if cat not in validas:
                raise ValueError(f"Categoria invalida: {cat}.")
        return v




@router.post("/habilitacao", status_code=201)
def solicitar_habilitacao(
    dados: SolicitacaoHabilitacao,
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    """Solicita habilitacao de vendedor para uma conta PF."""

    if atual["tipo"] != "PF":
        raise proibido(
            "A solicitacao esta disponivel apenas para pessoa fisica."
        )

    conta_id = atual["conta_id"]
    transporte = (
        dados.possui_transportadora
        if dados.possui_transportadora is not None
        else (dados.has_own_transport if dados.has_own_transport is not None else False)
    )
    docs_dict = dados.documents.model_dump(exclude_unset=True) if dados.documents else {}
    categorias = dados.categories or []

    with conn.transaction():
        perfil = conn.execute(
            """
            SELECT cpf
            FROM safradireta.perfil_pf
            WHERE conta_id = %s
            FOR UPDATE
            """,
            (conta_id,),
        ).fetchone()

        if perfil is None:
            raise conflito("Perfil de pessoa fisica nao encontrado.")

        if perfil["cpf"] is not None and perfil["cpf"] != dados.cpf:
            raise conflito(
                "O CPF cadastrado e diferente do informado."
            )

        existente = conn.execute(
            """
            SELECT conta_id
            FROM safradireta.perfil_pf
            WHERE cpf = %s AND conta_id <> %s
            """,
            (dados.cpf, conta_id),
        ).fetchone()

        if existente is not None:
            raise conflito(
                "Este CPF ja pertence a outra conta.",
                {"cpf": "CPF ja cadastrado."},
            )

        verificacao = conn.execute(
            """
            INSERT INTO safradireta.verificacao
                (conta_id, tipo, estado, dados_submetidos)
            VALUES (
                %s,
                'HABILITACAO_VENDEDOR',
                'APROVADO',
                %s
            )
            RETURNING id
            """,
            (
                conta_id,
                Jsonb({
                    "possui_transportadora": transporte,
                    "observacao_transportadora":
                        dados.observacao_transportadora,
                    "documentos": docs_dict,
                }),
            ),
        ).fetchone()

        habilitacao = conn.execute(
            """
            INSERT INTO safradireta.habilitacao_vendedor
                (
                    conta_id,
                    estado,
                    possui_transportadora,
                    observacao_transporte,
                    nome_propriedade,
                    municipio,
                    uf,
                    categorias,
                    habilitada_em,
                    verificacao_id,
                    dados_complementares
                )
            VALUES (%s, 'HABILITADO', %s, %s, %s, %s, %s, %s, now(), %s, %s)
            ON CONFLICT (conta_id) DO NOTHING
            RETURNING estado
            """,
            (
                conta_id,
                transporte,
                dados.observacao_transportadora,
                dados.farm_name,
                dados.city,
                dados.state,
                categorias,
                verificacao["id"],
                Jsonb(docs_dict),
            ),
        ).fetchone()

        if habilitacao is None:
            raise conflito(
                "Esta conta ja possui uma solicitacao de habilitacao."
            )

        conn.execute(
            """
            UPDATE safradireta.perfil_pf
            SET cpf = %s
            WHERE conta_id = %s
            """,
            (dados.cpf, conta_id),
        )

        conn.execute(
            """
            INSERT INTO safradireta.evento_auditoria
                (
                    conta_ator_id,
                    sessao_id,
                    origem,
                    acao,
                    entidade,
                    entidade_id,
                    resumo
                )
            VALUES (
                %s, %s, 'API',
                'VENDEDOR_HABILITADO',
                'habilitacao_vendedor',
                %s,
                '{}'::jsonb
            )
            """,
            (
                conta_id,
                atual["sessao_id"],
                conta_id,
            ),
        )

    return {
        "ok": True,
        "message": "Perfil de vendedor habilitado com sucesso!",
        "estado": habilitacao["estado"],
        "status": "habilitado",
        "protocol": str(verificacao["id"]),
    }


@router.post("/habilitar", status_code=201)
def habilitar_vendedor_alias(
    dados: SolicitacaoHabilitacao,
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    """Alias para POST /api/vendedor/habilitacao."""
    return solicitar_habilitacao(dados, atual, conn)


