"""Formato de saida das rotas de termos de uso."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class TermoVigente(BaseModel):
    # snake_case no Python, camelCase no JSON (versao, referenciaConteudo, vigenteDesde)
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    versao: str
    referencia_conteudo: str
    vigente_desde: datetime
