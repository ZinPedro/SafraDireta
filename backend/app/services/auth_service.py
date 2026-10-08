"""Regras de cadastro e sessao."""
from datetime import datetime, timedelta, timezone

from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from app.config import get_settings
from app.errors import ErroApp, conflito
from app.schemas.auth import RegistroPF
from app.security import gerar_hash_senha, gerar_token, hash_token


def _termo_vigente(conn: Connection):
    return conn.execute(
        """SELECT id FROM safradireta.termo_uso
           WHERE vigente_desde <= now() AND (vigente_ate IS NULL OR vigente_ate > now())
           ORDER BY vigente_desde DESC LIMIT 1"""
    ).fetchone()


def registrar_pf(conn: Connection, dados: RegistroPF) -> dict:
    termo = _termo_vigente(conn)
    if termo is None:
        raise ErroApp(503, "TERMO_INDISPONIVEL", "Cadastro indisponivel no momento.")

    senha_hash = gerar_hash_senha(dados.password)  # lento de proposito, fora da transacao
    token = gerar_token()
    expira_em = datetime.now(timezone.utc) + timedelta(hours=get_settings().sessao_horas)

    try:
        with conn.transaction():
            conta = conn.execute(
                """INSERT INTO safradireta.conta
                   (tipo, email_acesso, senha_hash, telefone_recuperacao, nome_publico)
                   VALUES ('PF', %s, %s, %s, %s) RETURNING id""",
                (dados.email, senha_hash, dados.phone, dados.name),
            ).fetchone()
            conta_id = conta["id"]

            conn.execute(
                "INSERT INTO safradireta.perfil_pf (conta_id, nome) VALUES (%s, %s)",
                (conta_id, dados.name),
            )
            sessao = conn.execute(
                """INSERT INTO safradireta.sessao (conta_id, token_hash, expira_em)
                   VALUES (%s, %s, %s) RETURNING id""",
                (conta_id, hash_token(token), expira_em),
            ).fetchone()
            conn.execute(
                """INSERT INTO safradireta.aceite_termos (conta_id, termo_id, sessao_id)
                   VALUES (%s, %s, %s)""",
                (conta_id, termo["id"], sessao["id"]),
            )
            conn.execute(
                """INSERT INTO safradireta.evento_auditoria
                   (conta_ator_id, sessao_id, origem, acao, entidade, entidade_id, resumo)
                   VALUES (%s, %s, 'API', 'CONTA_CRIADA', 'conta', %s, %s)""",
                (conta_id, sessao["id"], conta_id,
                 Jsonb({"tipo": "PF", "intencao": dados.intent})),
            )
    except UniqueViolation:
        raise conflito(
            "Ja existe uma conta com este email.",
            {"email": "Este email ja esta cadastrado."},
        )

    return {
        "token": token,
        "expira_em": expira_em.isoformat(),
        "conta": {"id": str(conta_id), "tipo": "PF", "nome": dados.name, "email": dados.email},
        "vendedor": {"estado": None},
        "proximo_passo": "SOLICITAR_HABILITACAO_VENDEDOR" if dados.intent == "seller" else None,
    }