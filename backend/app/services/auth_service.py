"""Regras de cadastro e sessao."""
from datetime import datetime, timedelta, timezone

from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from app import ratelimit
from app.config import get_settings
from app.errors import ErroApp, conflito, invalido, nao_autenticado, proibido, nao_encontrado
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
        "conta": {"id": str(conta_id), "tipo": "PF", "nome": dados.name, "email": dados.email, "avatar_url": None},
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
                  COALESCE(c.nome_publico, e.razao_social, c.email_acesso) AS nome,
                  COALESCE(p.avatar_url, e.logo_url) AS avatar_url
           FROM safradireta.conta c
           LEFT JOIN safradireta.empresa e ON e.conta_id = c.id
           LEFT JOIN safradireta.perfil_pf p ON p.conta_id = c.id
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
            "avatar_url": conta["avatar_url"],
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
                "protocol": str(linha["id"]),
                "tipo": linha["tipo"],
                "estado": linha["estado"],
            }

    return {
        "conta": {
            "id": str(atual["conta_id"]),
            "tipo": atual["tipo"],
            "nome": atual["nome"],
            "email": atual["email_acesso"],
            "avatar_url": atual.get("avatar_url"),
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
        "expiraEm": expira_em.isoformat(),
        "conta": {
            "id": str(conta_id),
            "tipo": "PJ",
            "nome": dados.company.razao_social,
            "email": dados.access.email,
            "avatar_url": None,
        },
    }


def editar_perfil(
    conn: Connection,
    atual: dict,
    dados: EditarPerfil,
) -> dict:
    """Atualiza perfil, endereço e vitrine da conta autenticada."""

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

    account_data = alteracoes.get("account") or {}
    name = alteracoes.get("name") or account_data.get("nome")
    phone = alteracoes.get("phone") or account_data.get("telefone")
    cpf = alteracoes.get("cpf") or account_data.get("cpf_cnpj")
    avatar_url = alteracoes.get("avatar_url") or account_data.get("avatar_url")

    address_data = alteracoes.get("address")
    seller_data = alteracoes.get("seller")

    campos_modificados = []

    with conn.transaction():
        if name:
            conn.execute(
                """
                UPDATE safradireta.conta
                SET nome_publico = %s,
                    atualizado_em = now()
                WHERE id = %s
                """,
                (name, atual["conta_id"]),
            )
            if atual["tipo"] == "PF":
                conn.execute(
                    """
                    UPDATE safradireta.perfil_pf
                    SET nome = %s
                    WHERE conta_id = %s
                    """,
                    (name, atual["conta_id"]),
                )
            elif atual["tipo"] == "PJ":
                conn.execute(
                    """
                    UPDATE safradireta.empresa
                    SET razao_social = %s
                    WHERE conta_id = %s
                    """,
                    (name, atual["conta_id"]),
                )
            campos_modificados.append("name")

        if phone:
            conn.execute(
                """
                UPDATE safradireta.conta
                SET telefone_recuperacao = %s,
                    atualizado_em = now()
                WHERE id = %s
                """,
                (phone, atual["conta_id"]),
            )
            campos_modificados.append("phone")

        if cpf:
            if atual["tipo"] == "PF":
                perfil_pf = conn.execute(
                    """
                    SELECT cpf
                    FROM safradireta.perfil_pf
                    WHERE conta_id = %s
                    FOR UPDATE
                    """,
                    (atual["conta_id"],),
                ).fetchone()

                if perfil_pf is not None:
                    cpf_existente = perfil_pf["cpf"]
                    if cpf_existente:
                        if cpf_existente != cpf:
                            raise ErroApp(
                                422,
                                "DOCUMENTO_PROTEGIDO",
                                "O CPF vinculado a conta e protegido e nao pode ser alterado.",
                                {"cpf": "O CPF vinculado a conta e protegido e nao pode ser alterado."},
                            )
                    else:
                        outro = conn.execute(
                            """
                            SELECT conta_id
                            FROM safradireta.perfil_pf
                            WHERE cpf = %s AND conta_id <> %s
                            """,
                            (cpf, atual["conta_id"]),
                        ).fetchone()
                        if outro is not None:
                            raise conflito(
                                "Este CPF ja pertence a outra conta.",
                                {"cpf": "CPF ja cadastrado."},
                            )
                        conn.execute(
                            """
                            UPDATE safradireta.perfil_pf
                            SET cpf = %s
                            WHERE conta_id = %s
                            """,
                            (cpf, atual["conta_id"]),
                        )
                        campos_modificados.append("cpf")

        if avatar_url:
            if atual["tipo"] == "PF":
                conn.execute(
                    """
                    UPDATE safradireta.perfil_pf
                    SET avatar_url = %s
                    WHERE conta_id = %s
                    """,
                    (avatar_url, atual["conta_id"]),
                )
            elif atual["tipo"] == "PJ":
                conn.execute(
                    """
                    UPDATE safradireta.empresa
                    SET logo_url = %s
                    WHERE conta_id = %s
                    """,
                    (avatar_url, atual["conta_id"]),
                )
            campos_modificados.append("avatar_url")

        if address_data:
            end_atual = conn.execute(
                """
                SELECT id, logradouro, numero, complemento, bairro, municipio, uf, cep
                FROM safradireta.endereco
                WHERE conta_id = %s AND principal = TRUE AND ativo = TRUE
                FOR UPDATE
                """,
                (atual["conta_id"],),
            ).fetchone()

            logradouro = address_data.get("logradouro")
            numero = address_data.get("numero")
            complemento = address_data.get("complemento")
            bairro = address_data.get("bairro")
            cidade = address_data.get("cidade")
            uf = address_data.get("uf")
            cep = address_data.get("cep")

            if end_atual is not None:
                conn.execute(
                    """
                    UPDATE safradireta.endereco
                    SET logradouro = COALESCE(%s, logradouro),
                        numero = COALESCE(%s, numero),
                        complemento = COALESCE(%s, complemento),
                        bairro = COALESCE(%s, bairro),
                        municipio = COALESCE(%s, municipio),
                        uf = COALESCE(%s, uf),
                        cep = COALESCE(%s, cep)
                    WHERE id = %s
                    """,
                    (
                        logradouro,
                        numero,
                        complemento,
                        bairro,
                        cidade,
                        uf,
                        cep,
                        end_atual["id"],
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO safradireta.endereco
                        (conta_id, rotulo, logradouro, numero, complemento,
                         bairro, municipio, uf, cep, principal, ativo)
                    VALUES (%s, 'Principal', %s, %s, %s, %s, %s, %s, %s, TRUE, TRUE)
                    """,
                    (
                        atual["conta_id"],
                        logradouro or "Não informado",
                        numero or "S/N",
                        complemento,
                        bairro,
                        cidade or "Não informado",
                        uf or "SP",
                        cep,
                    ),
                )
            campos_modificados.append("address")

        if seller_data:
            farm_name = seller_data.get("farm_name")
            bio = seller_data.get("bio")
            city = seller_data.get("city")
            state = seller_data.get("state")
            public_phone = seller_data.get("public_phone")
            categories = seller_data.get("categories")
            has_own_transport = seller_data.get("has_own_transport")

            hab = conn.execute(
                """
                SELECT conta_id
                FROM safradireta.habilitacao_vendedor
                WHERE conta_id = %s
                FOR UPDATE
                """,
                (atual["conta_id"],),
            ).fetchone()

            if hab is not None:
                conn.execute(
                    """
                    UPDATE safradireta.habilitacao_vendedor
                    SET nome_propriedade = COALESCE(%s, nome_propriedade),
                        bio = COALESCE(%s, bio),
                        municipio = COALESCE(%s, municipio),
                        uf = COALESCE(%s, uf),
                        telefone_comercial = COALESCE(%s, telefone_comercial),
                        categorias = COALESCE(%s, categorias),
                        possui_transportadora = COALESCE(%s, possui_transportadora)
                    WHERE conta_id = %s
                    """,
                    (
                        farm_name,
                        bio,
                        city,
                        state,
                        public_phone,
                        categories,
                        has_own_transport,
                        atual["conta_id"],
                    ),
                )
                campos_modificados.append("seller")

        _auditar(
            conn,
            atual["conta_id"],
            atual["sessao_id"],
            "PERFIL_ATUALIZADO",
            "conta",
            atual["conta_id"],
            {"campos_alterados": campos_modificados or list(alteracoes.keys())},
        )

    perfil = consultar_perfil(conn, atual)
    perfil["message"] = "Perfil atualizado com sucesso."
    perfil["conta"] = {
        "id": str(atual["conta_id"]),
        "tipo": atual["tipo"],
        "nome": name or atual["nome"],
        "email": atual["email_acesso"],
        "avatar_url": avatar_url or atual.get("avatar_url"),
    }
    return perfil

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

    nome_usuario = conta["nome_publico"]
    avatar_url = None
    cpf = None
    cnpj = None
    razao_social = None
    nome_fantasia = None

    if conta["tipo"] == "PF":
        pessoa = conn.execute(
            """
            SELECT nome, cpf, avatar_url
            FROM safradireta.perfil_pf
            WHERE conta_id = %s
            """,
            (atual["conta_id"],),
        ).fetchone()

        if pessoa is not None:
            nome_usuario = pessoa["nome"] or conta["nome_publico"]
            cpf = pessoa["cpf"]
            avatar_url = pessoa["avatar_url"]

    elif conta["tipo"] == "PJ":
        empresa = conn.execute(
            """
            SELECT razao_social, nome_fantasia, cnpj, logo_url
            FROM safradireta.empresa
            WHERE conta_id = %s
            """,
            (atual["conta_id"],),
        ).fetchone()

        if empresa is not None:
            nome_usuario = empresa["razao_social"] or conta["nome_publico"]
            razao_social = empresa["razao_social"]
            nome_fantasia = empresa["nome_fantasia"]
            cnpj = empresa["cnpj"]
            avatar_url = empresa["logo_url"]

    enderecos = conn.execute(
        """
        SELECT id, rotulo, logradouro, numero, complemento,
               bairro, municipio, uf, cep, pais,
               referencia_acesso, principal
        FROM safradireta.endereco
        WHERE conta_id = %s
          AND ativo = TRUE
        ORDER BY principal DESC, rotulo
        """,
        (atual["conta_id"],),
    ).fetchall()

    enderecos_formatados = [
        {
            "id": str(endereco["id"]),
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

    end_principal = next((e for e in enderecos if e["principal"]), enderecos[0] if enderecos else None)
    address_bloco = {
        "cep": end_principal["cep"] if end_principal and end_principal["cep"] else "",
        "logradouro": end_principal["logradouro"] if end_principal and end_principal["logradouro"] else "",
        "numero": end_principal["numero"] if end_principal and end_principal["numero"] else "",
        "complemento": end_principal["complemento"] if end_principal and end_principal["complemento"] else "",
        "bairro": end_principal["bairro"] if end_principal and end_principal["bairro"] else "",
        "cidade": end_principal["municipio"] if end_principal and end_principal["municipio"] else "",
        "uf": end_principal["uf"] if end_principal and end_principal["uf"] else "",
    }

    hab = conn.execute(
        """
        SELECT estado, possui_transportadora, observacao_transporte,
               nome_propriedade, bio, municipio, uf, telefone_comercial,
               categorias, possui_selo_verificado
        FROM safradireta.habilitacao_vendedor
        WHERE conta_id = %s
        """,
        (atual["conta_id"],),
    ).fetchone()

    seller_bloco = None
    if hab is not None:
        seller_bloco = {
            "isHabilitado": hab["estado"] == "HABILITADO",
            "farmName": hab["nome_propriedade"] or "",
            "bio": hab["bio"] or "",
            "city": hab["municipio"] or "",
            "state": hab["uf"] or "",
            "publicPhone": hab["telefone_comercial"] or "",
            "categories": hab["categorias"] or [],
            "hasOwnTransport": bool(hab["possui_transportadora"]),
            "hasVerifiedBadge": bool(hab["possui_selo_verificado"]),
        }

    perfil = {
        "id": str(conta["id"]),
        "tipo": conta["tipo"],
        "nome": nome_usuario,
        "email": conta["email_acesso"],
        "telefone": conta["telefone_recuperacao"],
        "estado": conta["estado"],
        "avatarUrl": avatar_url,
        "avatar_url": avatar_url,
        "enderecos": enderecos_formatados,
        "account": {
            "id": str(conta["id"]),
            "tipo": conta["tipo"],
            "nome": nome_usuario,
            "email": conta["email_acesso"],
            "cpfCnpj": cpf or cnpj or "",
            "telefone": conta["telefone_recuperacao"] or "",
            "avatarUrl": avatar_url,
        },
        "address": address_bloco,
        "seller": seller_bloco,
    }

    if conta["tipo"] == "PF":
        perfil["cpf"] = cpf
    elif conta["tipo"] == "PJ":
        perfil["razaoSocial"] = razao_social
        perfil["nomeFantasia"] = nome_fantasia
        perfil["cnpj"] = cnpj

        representantes = conn.execute(
            """
            SELECT r.id, r.nome, r.cpf, r.vinculo,
                   r.inicio_vigencia, r.fim_vigencia
            FROM safradireta.representante_empresa r
            WHERE r.empresa_id = %s
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
            raise invalido("Senha atual incorreta.", {"senhaAtual": "Senha atual incorreta."})

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
