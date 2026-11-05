from uuid import UUID

from fastapi import HTTPException, status

from app import ratelimit

from app.security import (
    verificar_senha,
    gastar_tempo_de_verificacao,
    gerar_token,
    hash_token,
)

from app.schemas.admin import (
    AvaliacaoDocumentoSchema,
    AplicarPunicaoSchema,
)


def autenticar_admin(
    db,
    email: str,
    senha: str,
    pin: str,
    ip: str,
):
    """Autentica o administrador usando e-mail, senha e PIN."""

    email_normalizado = email.strip().lower()

    # Verifica o limite de tentativas antes de consultar as credenciais.
    ratelimit.verificar(email_normalizado, ip)

    conta = db.execute(
        """
        SELECT
            id,
            tipo,
            senha_hash,
            pin_hash,
            estado,
            nome_publico
        FROM safradireta.conta
        WHERE email_acesso = %(email)s
        """,
        {"email": email_normalizado},
    ).fetchone()

    # Conta inexistente ou conta que não é administrativa.
    if not conta or conta["tipo"] != "ADMIN":
        gastar_tempo_de_verificacao(senha)

        ratelimit.registrar_falha(email_normalizado, ip)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "erro": {
                    "codigo": "CREDENCIAIS_INVALIDAS",
                    "mensagem": (
                        "E-mail, senha ou PIN incorretos."
                    ),
                }
            },
        )

    # Verifica se a conta administrativa está ativa.
    if conta["estado"] != "ATIVA":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "erro": {
                    "codigo": "CONTA_INATIVA",
                    "mensagem": "Conta administrativa inativa.",
                }
            },
        )

    # Verifica a senha.
    if not verificar_senha(senha, conta["senha_hash"]):
        ratelimit.registrar_falha(email_normalizado, ip)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "erro": {
                    "codigo": "CREDENCIAIS_INVALIDAS",
                    "mensagem": (
                        "E-mail, senha ou PIN incorretos."
                    ),
                }
            },
        )

    # Verifica o PIN administrativo.
    if not conta["pin_hash"] or not verificar_senha(
        pin,
        conta["pin_hash"],
    ):
        ratelimit.registrar_falha(email_normalizado, ip)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "erro": {
                    "codigo": "PIN_INVALIDO",
                    "mensagem": (
                        "E-mail, senha ou PIN incorretos."
                    ),
                }
            },
        )

    # Credenciais corretas: limpa as falhas associadas ao e-mail.
    ratelimit.limpar_email(email_normalizado)

    # Gera o token da sessão administrativa.
    token_bruto = gerar_token()
    token_criptografado = hash_token(token_bruto)

    db.execute(
        """
        INSERT INTO safradireta.sessao (
            conta_id,
            token_hash,
            expira_em
        )
        VALUES (
            %(conta_id)s,
            %(token_hash)s,
            NOW() + INTERVAL '12 hours'
        )
        """,
        {
            "conta_id": conta["id"],
            "token_hash": token_criptografado,
        },
    )

    db.commit()

    return {
        "token": token_bruto,
        "tipo": "ADMIN",
        "conta_id": str(conta["id"]),
        "nome": conta["nome_publico"] or "Administrador",
        "email": email_normalizado,
    }


def listar_empresas_pendentes(db):
    """Busca empresas que aguardam análise do dossiê."""

    linhas = db.execute(
        """
        SELECT
            c.id AS conta_id,
            e.razao_social,
            e.cnpj,
            c.estado
        FROM safradireta.empresa e
        JOIN safradireta.conta c
            ON c.id = e.conta_id
        WHERE c.estado = 'AGUARDANDO_ANALISE'
        """
    ).fetchall()

    return {
        "empresas": [dict(linha) for linha in linhas],
        "total": len(linhas),
    }


def avaliar_documento_pj(
    db,
    documento_id: UUID,
    payload: AvaliacaoDocumentoSchema,
    admin_id: UUID,
):
    """Registra a aprovação ou recusa de um documento de empresa."""

    # Verifica se o documento existe e ainda está pendente.
    doc = db.execute(
        """
        SELECT id, status
        FROM safradireta.documento_verificacao
        WHERE id = %s
        """,
        (documento_id,),
    ).fetchone()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento não encontrado.",
        )

    if doc["status"] not in ("EM_ANALISE", "PENDENTE"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este documento já foi avaliado.",
        )

    # Atualiza o estado do documento.
    db.execute(
        """
        UPDATE safradireta.documento_verificacao
        SET
            status = %s,
            motivo_recusa = %s,
            atualizado_em = NOW()
        WHERE id = %s
        """,
        (
            payload.resultado,
            payload.motivo_recusa,
            documento_id,
        ),
    )

    db.commit()

    return {
        "status": "sucesso",
        "mensagem": (
            f"Documento marcado como {payload.resultado}."
        ),
    }


def suspender_conta_produtor(
    db,
    conta_id: UUID,
    payload: AplicarPunicaoSchema,
    admin_id: UUID,
):
    """Registra uma sanção e suspende a conta do produtor."""

    # Verifica se a conta existe.
    conta = db.execute(
        """
        SELECT id, estado
        FROM safradireta.conta
        WHERE id = %s
        """,
        (conta_id,),
    ).fetchone()

    if not conta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta não encontrada.",
        )

    # Registra o histórico da punição.
    db.execute(
        """
        INSERT INTO safradireta.historico_punicao (
            conta_id,
            autor_id,
            tipo,
            motivo,
            prazo_dias
        )
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            conta_id,
            admin_id,
            payload.tipo_punicao,
            payload.motivo,
            payload.dias_duracao,
        ),
    )

    # Atualiza o estado da conta.
    db.execute(
        """
        UPDATE safradireta.conta
        SET estado = 'SUSPENSA'
        WHERE id = %s
        """,
        (conta_id,),
    )

    db.commit()

    return {
        "status": "sucesso",
        "mensagem": (
            "Conta suspensa com sucesso e punição registrada."
        ),
    }