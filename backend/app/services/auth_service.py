"""Regras de cadastro e sessao."""
from datetime import datetime, timedelta, timezone

from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from app import ratelimit
from app.config import get_settings
from app.errors import ErroApp, conflito, nao_autenticado, proibido, nao_encontrado
from app.schemas.auth import AlterarEmail, EditarPerfil, LoginEntrada, RegistroPF
from app.schemas.pj import RegistroPJ
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
    """Retorna os dados da conta autenticada e a verificacao PJ."""

    verificacao = None

    if atual["tipo"] == "PJ":
        linha = conn.execute(
            """
            SELECT id, tipo, estado
            FROM safradireta.verificacao
            WHERE conta_id = %s
              AND tipo = 'CADASTRO_PJ'
            ORDER BY criada_em DESC, id DESC
            LIMIT 1
            """,
            (atual["conta_id"],),
        ).fetchone()

        if linha is not None:
            verificacao = {
                "protocolo": str(linha["id"]),
                "tipo": linha["tipo"],
                "estado": linha["estado"],
            }

    return {
        "conta": {
            "id": str(atual["conta_id"]),
            "tipo": atual["tipo"],
            "nome": atual["nome"],
            "email": atual["email_acesso"],
        },
        "vendedor": {
            "estado": _estado_vendedor(conn, atual["conta_id"])
        },
        "expira_em": atual["expira_em"].isoformat(),
        "verificacao": verificacao,
    }



def registrar_pj(conn: Connection, dados: RegistroPJ) -> dict:
    termo = _termo_vigente(conn)

    if termo is None:
        raise ErroApp(
            503,
            "TERMO_INDISPONIVEL",
            "Cadastro indisponivel no momento.",
        )

    senha_hash = gerar_hash_senha(dados.access.senha)

    try:
        with conn.transaction():
            conta = conn.execute(
                """
                INSERT INTO safradireta.conta
                    (tipo, email_acesso, senha_hash,
                     telefone_recuperacao, nome_publico)
                VALUES ('PJ', %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    dados.access.email,
                    senha_hash,
                    dados.access.telefone,
                    dados.company.razao_social,
                ),
            ).fetchone()

            conta_id = conta["id"]

            conn.execute(
                """
                INSERT INTO safradireta.empresa
                    (conta_id, cnpj, razao_social,
                     nome_fantasia, natureza_juridica)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    conta_id,
                    dados.company.cnpj,
                    dados.company.razao_social,
                    dados.company.nome_fantasia,
                    dados.company.natureza_juridica,
                ),
            )

            conn.execute(
                """
                INSERT INTO safradireta.endereco
                    (conta_id, rotulo, logradouro, numero,
                     complemento, bairro, municipio, uf,
                     cep, principal)
                VALUES (%s, 'Principal', %s, %s, %s,
                        %s, %s, %s, %s, TRUE)
                """,
                (
                    conta_id,
                    dados.address.logradouro,
                    dados.address.numero,
                    dados.address.complemento,
                    dados.address.bairro,
                    dados.address.cidade,
                    dados.address.uf,
                    dados.address.cep,
                ),
            )

            representante = conn.execute(
                """
                INSERT INTO safradireta.representante_empresa
                    (empresa_id, nome, cpf, vinculo)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (
                    conta_id,
                    dados.representative.nome,
                    dados.representative.cpf,
                    dados.representative.vinculo,
                ),
            ).fetchone()
            conn.execute(
                """
                INSERT INTO safradireta.habilitacao_vendedor
                    (conta_id, estado, dados_complementares)
                VALUES (%s, 'PENDENTE', '{}'::jsonb)
                ON CONFLICT (conta_id) DO NOTHING
                """,
                (conta_id,),
            )

            verificacao = conn.execute(
                """
                INSERT INTO safradireta.verificacao
                    (conta_id, tipo, representante_id,
                     estado, dados_submetidos)
                VALUES (%s, 'CADASTRO_PJ', %s,
                        'RASCUNHO', %s)
                RETURNING id
                """,
                (
                    conta_id,
                    representante["id"],
                    Jsonb({
                        "cnpj": dados.company.cnpj,
                        "arquivos_informados":
                            dados.documents.file_names,
                    }),
                ),
            ).fetchone()

            token, sessao_id, expira_em = _criar_sessao(
                conn, conta_id
            )

            conn.execute(
                """
                INSERT INTO safradireta.aceite_termos
                    (conta_id, termo_id, sessao_id)
                VALUES (%s, %s, %s)
                """,
                (conta_id, termo["id"], sessao_id),
            )

            _auditar(
                conn,
                conta_id,
                sessao_id,
                "CONTA_CRIADA",
                "conta",
                conta_id,
                {"tipo": "PJ"},
            )

    except UniqueViolation as erro:
        constraint = erro.diag.constraint_name or ""

        if "cnpj" in constraint:
            raise conflito(
                "CNPJ ja cadastrado.",
                {"cnpj": "Este CNPJ ja esta cadastrado."},
            ) from erro

        if "email" in constraint:
            raise conflito(
                "Email ja cadastrado.",
                {"email": "Este email ja esta cadastrado."},
            ) from erro

        raise conflito("Dados ja cadastrados.") from erro

    return {
        "status": "registered_pending_validation",
        "protocol": str(verificacao["id"]),
        "message": (
            "Cadastro criado. Aguardando envio "
            "dos documentos para analise."
        ),
        "token": token,
        "expira_em": expira_em.isoformat(),
        "conta": {
            "id": str(conta_id),
            "tipo": "PJ",
            "nome": dados.company.razao_social,
            "email": dados.access.email,
        },
    }


def editar_perfil(
    conn: Connection,
    atual: dict,
    dados: EditarPerfil,
) -> dict:
    """Atualiza nome e telefone da conta autenticada."""

    alteracoes = dados.model_dump(exclude_unset=True)

    if not alteracoes:
        raise ErroApp(
            422,
            "DADOS_INVALIDOS",
            "Informe pelo menos um campo para atualizar.",
        )

    if any(valor is None for valor in alteracoes.values()):
        raise ErroApp(
            422,
            "DADOS_INVALIDOS",
            "Os campos enviados nao podem ser nulos.",
        )

    with conn.transaction():
        if "name" in alteracoes:
            conn.execute(
                """
                UPDATE safradireta.conta
                SET nome_publico = %s,
                    atualizado_em = now()
                WHERE id = %s
                """,
                (alteracoes["name"], atual["conta_id"]),
            )

            if atual["tipo"] == "PF":
                conn.execute(
                    """
                    UPDATE safradireta.perfil_pf
                    SET nome = %s
                    WHERE conta_id = %s
                    """,
                    (alteracoes["name"], atual["conta_id"]),
                )

        if "phone" in alteracoes:
            conn.execute(
                """
                UPDATE safradireta.conta
                SET telefone_recuperacao = %s,
                    atualizado_em = now()
                WHERE id = %s
                """,
                (alteracoes["phone"], atual["conta_id"]),
            )

        _auditar(
            conn,
            atual["conta_id"],
            atual["sessao_id"],
            "PERFIL_ATUALIZADO",
            "conta",
            atual["conta_id"],
            {"campos_alterados": list(alteracoes.keys())},
        )

    return {
        "message": "Perfil atualizado com sucesso.",
        "conta": {
            "id": str(atual["conta_id"]),
            "tipo": atual["tipo"],
            "nome": alteracoes.get("name", atual["nome"]),
            "email": atual["email_acesso"],
        },
    }

def consultar_perfil(conn: Connection, atual: dict) -> dict:
    """Consulta os dados do perfil da conta autenticada."""

    conta = conn.execute(
        """
        SELECT id, tipo, nome_publico, email_acesso,
               telefone_recuperacao, estado
        FROM safradireta.conta
        WHERE id = %s
        """,
        (atual["conta_id"],),
    ).fetchone()

    if conta is None:
        raise nao_encontrado("Conta nao encontrada.")

    perfil = {
        "id": str(conta["id"]),
        "tipo": conta["tipo"],
        "nome": conta["nome_publico"],
        "email": conta["email_acesso"],
        "telefone": conta["telefone_recuperacao"],
        "estado": conta["estado"],
    }

    if conta["tipo"] == "PF":
        pessoa = conn.execute(
            """
            SELECT nome, cpf
            FROM safradireta.perfil_pf
            WHERE conta_id = %s
            """,
            (atual["conta_id"],),
        ).fetchone()

        if pessoa is not None:
            perfil["nome"] = pessoa["nome"]
            perfil["cpf"] = pessoa["cpf"]

    elif conta["tipo"] == "PJ":
        empresa = conn.execute(
            """
            SELECT razao_social, nome_fantasia, cnpj
            FROM safradireta.empresa
            WHERE conta_id = %s
            """,
            (atual["conta_id"],),
        ).fetchone()

        if empresa is not None:
            perfil["razaoSocial"] = empresa["razao_social"]
            perfil["nomeFantasia"] = empresa["nome_fantasia"]
            perfil["cnpj"] = empresa["cnpj"]
    enderecos = conn.execute(
        """
        SELECT rotulo, logradouro, numero, complemento,
               bairro, municipio, uf, cep, pais,
               referencia_acesso, principal
        FROM safradireta.endereco
        WHERE conta_id = %s
          AND ativo = TRUE
        ORDER BY principal DESC, rotulo
        """,
        (atual["conta_id"],),
    ).fetchall()

    perfil["enderecos"] = [
        {
            "rotulo": endereco["rotulo"],
            "logradouro": endereco["logradouro"],
            "numero": endereco["numero"],
            "complemento": endereco["complemento"],
            "bairro": endereco["bairro"],
            "municipio": endereco["municipio"],
            "uf": endereco["uf"],
            "cep": endereco["cep"],
            "pais": endereco["pais"],
            "referenciaAcesso": endereco["referencia_acesso"],
            "principal": endereco["principal"],
        }
        for endereco in enderecos
    ]

    if conta["tipo"] == "PJ":
        representantes = conn.execute(
            """
            SELECT r.id, r.nome, r.cpf, r.vinculo,
                   r.inicio_vigencia, r.fim_vigencia
            FROM safradireta.representante_empresa r
            JOIN safradireta.empresa e
              ON e.id = r.empresa_id
            WHERE e.conta_id = %s
            ORDER BY r.inicio_vigencia DESC
            """,
            (atual["conta_id"],),
        ).fetchall()

        perfil["representantes"] = [
            {
                "id": str(representante["id"]),
                "nome": representante["nome"],
                "cpf": representante["cpf"],
                "vinculo": representante["vinculo"],
                "inicioVigencia": (
                    representante["inicio_vigencia"].isoformat()
                    if representante["inicio_vigencia"] else None
                ),
                "fimVigencia": (
                    representante["fim_vigencia"].isoformat()
                    if representante["fim_vigencia"] else None
                ),
            }
            for representante in representantes
        ]

    return perfil

def alterar_email(conn: Connection, atual: dict, dados: AlterarEmail) -> dict:
    """Altera o email da conta apos confirmar a senha atual."""

    novo_email = str(dados.novo_email).strip().lower()

    with conn.transaction():
        conta = conn.execute(
            """
            SELECT email_acesso, senha_hash
            FROM safradireta.conta
            WHERE id = %s
            FOR UPDATE
            """,
            (atual["conta_id"],),
        ).fetchone()

        if conta is None:
            raise nao_autenticado()

        if not verificar_senha(dados.senha_atual, conta["senha_hash"]):
            raise nao_autenticado("Senha atual incorreta.")

        if novo_email == conta["email_acesso"]:
            return {
                "message": "O email informado ja pertence a esta conta.",
                "email": novo_email,
            }

        existente = conn.execute(
            """
            SELECT id
            FROM safradireta.conta
            WHERE email_acesso = %s AND id <> %s
            """,
            (novo_email, atual["conta_id"]),
        ).fetchone()

        if existente is not None:
            raise conflito("Este email ja esta cadastrado.")

        try:
            with conn.transaction():
                conn.execute(
                    """
                    UPDATE safradireta.conta
                    SET email_acesso = %s
                    WHERE id = %s
                    """,
                    (novo_email, atual["conta_id"]),
                )
        except UniqueViolation:
            raise conflito("Este email ja esta cadastrado.") from None

        _auditar(
            conn,
            atual["conta_id"],
            atual["sessao_id"],
            "EMAIL_ALTERADO",
            "conta",
            atual["conta_id"],
        )

    return {
        "message": "Email atualizado com sucesso.",
        "email": novo_email,
    }