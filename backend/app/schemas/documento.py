from typing import Literal

from pydantic import Field

from app.schemas.anuncio import _Base

TipoDocumento = Literal[
    "GTA", "LAUDO_SANITARIO", "REGISTRO_GENEALOGICO", "LAUDO_CLASSIFICACAO",
    "LAUDO_SCA_CAFE", "CERTIFICACAO_SUSTENTAVEL", "NOTA_FISCAL_SEMENTE", "OUTRO",
]


class SolicitacaoDocumento(_Base):
    mensagem: str = Field(min_length=1, max_length=2000)


class DecisaoDocumento(_Base):
    status: Literal["APROVADO", "RECUSADO", "REVOGADO", "CANCELADO"]
    motivo_recusa: str | None = Field(default=None, max_length=500)
