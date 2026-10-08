"""Dependencias reutilizaveis das rotas (equivalente a middlewares no Express)."""
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg import Connection

from app.database import get_connection
from app.errors import nao_autenticado, proibido
from app.security import hash_token

# auto_error=False: quem decide a resposta de erro somos nos (formato padrao).
# Usar HTTPBearer tambem faz aparecer o botao "Authorize" na /docs.
_esquema = HTTPBearer(auto_error=False)


def conta_autenticada(
    credenciais: HTTPAuthorizationCredentials | None = Depends(_esquema),
    conn: Connection = Depends(get_connection),
) -> dict:
    """Token Bearer -> sessao valida -> conta. A conta SEMPRE vem do token, nunca do corpo."""
    if credenciais is None:
        raise nao_autenticado("Envie o token no cabeçalho Authorization: Bearer <token>.")

    linha = conn.execute(
        """SELECT s.id AS sessao_id, s.expira_em,
                  c.id AS conta_id, c.tipo, c.email_acesso, c.estado,
                  COALESCE(c.nome_publico, e.razao_social, c.email_acesso) AS nome
           FROM safradireta.sessao s
           JOIN safradireta.conta c ON c.id = s.conta_id
           LEFT JOIN safradireta.empresa e ON e.conta_id = c.id
           WHERE s.token_hash = %s AND s.revogada_em IS NULL AND s.expira_em > now()""",
        (hash_token(credenciais.credentials),),
    ).fetchone()

    if linha is None:
        raise nao_autenticado()
    if linha["estado"] != "ATIVA":
        raise proibido("Esta conta está suspensa ou encerrada.")
    return linha
