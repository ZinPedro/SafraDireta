
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



class SolicitacaoHabilitacao(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    cpf: str
    possui_transportadora: bool
    observacao_transportadora: str | None = Field(
        default=None,
        max_length=500,
    )

    @field_validator("cpf")
    @classmethod
    def validar_cpf_informado(cls, valor: str) -> str:
        cpf = normalizar_cpf(valor)

        if not validar_cpf(cpf):
            raise ValueError("Informe um CPF valido.")

        return cpf




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

        habilitacao = conn.execute(
            """
            INSERT INTO safradireta.habilitacao_vendedor
                (
                    conta_id,
                    estado,
                    possui_transportadora,
                    observacao_transporte
                )
            VALUES (%s, 'PENDENTE', %s, %s)
            ON CONFLICT (conta_id) DO NOTHING
            RETURNING estado
            """,
            (
                conta_id,
                dados.possui_transportadora,
                dados.observacao_transportadora,
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

        verificacao = conn.execute(
            """
            INSERT INTO safradireta.verificacao
                (conta_id, tipo, estado, dados_submetidos)
            VALUES (
                %s,
                'HABILITACAO_VENDEDOR',
                'RASCUNHO',
                %s
            )
            RETURNING id
            """,
            (
                conta_id,
                Jsonb({
                    "possui_transportadora": dados.possui_transportadora,
                    "observacao_transportadora":
                        dados.observacao_transportadora,
                }),
            ),
        ).fetchone()

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
                'HABILITACAO_SOLICITADA',
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
        "message": "Solicitacao de habilitacao criada com sucesso.",
        "estado": habilitacao["estado"],
        "protocol": str(verificacao["id"]),
    }

