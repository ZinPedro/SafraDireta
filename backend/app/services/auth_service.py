"""Regras de cadastro e sessao."""
from datetime import datetime, timedelta, timezone

from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from app import ratelimit
from app.config import get_settings
from app.errors import ErroApp, conflito, nao_autenticado, proibido
from app.schemas.auth import LoginEntrada, RegistroPF, RegistroPJ
from app.security import (
    gastar_tempo_de_verificacao,
    gerar_hash_senha,
    gerar_token,
    hash_token,
    senha_precisa_novo_hash,
    verificar_senha,
)


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


# ---------------------------------------------------------------- login, logout, me

_MENSAGEM_LOGIN = "Email ou senha incorretos."


def _auditar(conn: Connection, conta_id, sessao_id, acao: str, entidade: str, entidade_id, resumo=None) -> None:
    conn.execute(
        """INSERT INTO safradireta.evento_auditoria
           (conta_ator_id, sessao_id, origem, acao, entidade, entidade_id, resumo)
           VALUES (%s, %s, 'API', %s, %s, %s, %s)""",
        (conta_id, sessao_id, acao, entidade, entidade_id, Jsonb(resumo or {})),
    )


def _criar_sessao(conn: Connection, conta_id):
    """Cria a sessao e devolve (token, sessao_id, expira_em). So o hash do token vai ao banco."""
    token = gerar_token()
    expira_em = datetime.now(timezone.utc) + timedelta(hours=get_settings().sessao_horas)
    sessao = conn.execute(
        """INSERT INTO safradireta.sessao (conta_id, token_hash, expira_em)
           VALUES (%s, %s, %s) RETURNING id""",
        (conta_id, hash_token(token), expira_em),
    ).fetchone()
    return token, sessao["id"], expira_em


def _estado_vendedor(conn: Connection, conta_id):
    linha = conn.execute(
        "SELECT estado FROM safradireta.habilitacao_vendedor WHERE conta_id = %s",
        (conta_id,),
    ).fetchone()
    return linha["estado"] if linha else None


def autenticar(conn: Connection, dados: LoginEntrada, ip: str) -> dict:
    # 1. Barra quem ja errou demais, ANTES de gastar tempo com Argon2.
    ratelimit.verificar(dados.email, ip)

    conta = conn.execute(
        """SELECT c.id, c.tipo, c.email_acesso, c.senha_hash, c.estado,
                  COALESCE(c.nome_publico, e.razao_social, c.email_acesso) AS nome
           FROM safradireta.conta c
           LEFT JOIN safradireta.empresa e ON e.conta_id = c.id
           WHERE c.email_acesso = %s""",
        (dados.email,),
    ).fetchone()

    # 2. Email inexistente e senha errada dao a MESMA resposta (e o mesmo tempo),
    #    para ninguem descobrir quais emails estao cadastrados.
    if conta is None:
        gastar_tempo_de_verificacao(dados.password)
        ratelimit.registrar_falha(dados.email, ip)
        raise nao_autenticado(_MENSAGEM_LOGIN)
    if not verificar_senha(dados.password, conta["senha_hash"]):
        ratelimit.registrar_falha(dados.email, ip)
        raise nao_autenticado(_MENSAGEM_LOGIN)

    # 3. So revela que a conta esta bloqueada para quem provou saber a senha.
    if conta["estado"] != "ATIVA":
        raise proibido("Esta conta está suspensa ou encerrada. Fale com o suporte.")

    ratelimit.limpar_email(dados.email)

    with conn.transaction():
        if senha_precisa_novo_hash(conta["senha_hash"]):
            conn.execute(
                "UPDATE safradireta.conta SET senha_hash = %s, atualizado_em = now() WHERE id = %s",
                (gerar_hash_senha(dados.password), conta["id"]),
            )
        token, sessao_id, expira_em = _criar_sessao(conn, conta["id"])
        _auditar(conn, conta["id"], sessao_id, "LOGIN", "sessao", sessao_id)

    return {
        "token": token,
        "expira_em": expira_em.isoformat(),
        "conta": {
            "id": str(conta["id"]),
            "tipo": conta["tipo"],
            "nome": conta["nome"],
            "email": conta["email_acesso"],
        },
        "vendedor": {"estado": _estado_vendedor(conn, conta["id"])},
        "proximo_passo": None,
    }


def encerrar_sessao(conn: Connection, atual: dict) -> None:
    """Logout: revoga a sessao do token usado na requisicao (as outras continuam)."""
    with conn.transaction():
        conn.execute(
            "UPDATE safradireta.sessao SET revogada_em = now() WHERE id = %s AND revogada_em IS NULL",
            (atual["sessao_id"],),
        )
        _auditar(conn, atual["conta_id"], atual["sessao_id"], "LOGOUT", "sessao", atual["sessao_id"])


def dados_da_conta(conn: Connection, atual: dict) -> dict:
    return {
        "conta": {
            "id": str(atual["conta_id"]),
            "tipo": atual["tipo"],
            "nome": atual["nome"],
            "email": atual["email_acesso"],
        },
        "vendedor": {"estado": _estado_vendedor(conn, atual["conta_id"])},
        "expira_em": atual["expira_em"].isoformat(),
    }


def registrar_pj(conn: Connection, dados: RegistroPJ) -> dict:
    termo = _termo_vigente(conn)
    if termo is None:
        raise ErroApp(503, "TERMO_INDISPONIVEL", "Cadastro indisponível no momento.")

    senha_hash = gerar_hash_senha(dados.access.senha)
    token = gerar_token()
    expira_em = datetime.now(timezone.utc) + timedelta(hours=get_settings().sessao_horas)

    try:
        with conn.transaction():
            conta = conn.execute(
                """INSERT INTO safradireta.conta
                   (tipo, email_acesso, senha_hash, telefone_recuperacao, nome_publico)
                   VALUES ('PJ', %s, %s, %s, %s) RETURNING id""",
                (dados.access.email, senha_hash, dados.access.telefone, dados.company.razao_social),
            ).fetchone()
            conta_id = conta["id"]

            conn.execute(
                """INSERT INTO safradireta.empresa
                   (conta_id, cnpj, razao_social, nome_fantasia, natureza_juridica)
                   VALUES (%s, %s, %s, %s, %s)""",
                (conta_id, dados.company.cnpj, dados.company.razao_social,
                 dados.company.nome_fantasia, dados.company.natureza_juridica),
            )

            rep = conn.execute(
                """INSERT INTO safradireta.representante_empresa
                   (empresa_id, nome, cpf, vinculo)
                   VALUES (%s, %s, %s, %s) RETURNING id""",
                (conta_id, dados.representative.nome, dados.representative.cpf, dados.representative.vinculo),
            ).fetchone()
            rep_id = rep["id"]

            conn.execute(
                """INSERT INTO safradireta.endereco
                   (conta_id, cep, logradouro, numero, complemento, bairro, municipio, uf, principal, ativo)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true, true)""",
                (conta_id, dados.address.cep, dados.address.logradouro, dados.address.numero,
                 dados.address.complemento, dados.address.bairro, dados.address.cidade, dados.address.uf),
            )

            verif = conn.execute(
                """INSERT INTO safradireta.verificacao
                   (conta_id, tipo, representante_id, estado, dados_submetidos, enviada_em)
                   VALUES (%s, 'EMPRESARIAL', %s, 'EM_ANALISE', %s, now()) RETURNING id""",
                (conta_id, rep_id, Jsonb({
                    "documentos": dados.documents.file_names,
                    "hasCompanyDoc": dados.documents.has_company_doc,
                    "hasRepresentativeDoc": dados.documents.has_representative_doc,
                })),
            ).fetchone()
            protocolo = f"VER-{str(verif['id'])[:8].upper()}"

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
                   VALUES (%s, %s, 'API', 'CONTA_PJ_CRIADA', 'conta', %s, %s)""",
                (conta_id, sessao["id"], conta_id,
                 Jsonb({"tipo": "PJ", "cnpj": dados.company.cnpj, "protocolo": protocolo})),
            )
    except UniqueViolation as e:
        err_msg = str(e).lower()
        if "cnpj" in err_msg:
            raise conflito("Já existe uma empresa cadastrada com este CNPJ.", {"cnpj": "Este CNPJ já está cadastrado."})
        raise conflito("Já existe uma conta com este e-mail.", {"email": "Este e-mail já está cadastrado."})

    return {
        "status": "registered_pending_validation",
        "protocol": protocolo,
        "message": "Cadastro recebido. Seus documentos serão analisados pela equipe.",
        "token": token,
        "expira_em": expira_em.isoformat(),
        "conta": {"id": str(conta_id), "tipo": "PJ", "nome": dados.company.razao_social, "email": dados.access.email},
    }
