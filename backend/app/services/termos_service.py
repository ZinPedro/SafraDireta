"""Regras dos termos de uso."""
from psycopg import Connection

from app.errors import nao_encontrado


def termo_vigente(conn: Connection) -> dict:
    termo = conn.execute(
        """SELECT versao, referencia_conteudo, vigente_desde
           FROM safradireta.termo_uso
           WHERE vigente_desde <= now() AND (vigente_ate IS NULL OR vigente_ate > now())
           ORDER BY vigente_desde DESC LIMIT 1"""
    ).fetchone()
    if termo is None:
        raise nao_encontrado("Nenhum termo de uso vigente no momento.")
    return termo
