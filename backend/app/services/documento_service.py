"""Custódia de documentos e controle de acesso por anúncio."""
import hashlib
from pathlib import Path

from psycopg import Connection

from app.errors import conflito, invalido, nao_encontrado, proibido
from app.services import midia_service

MAX_TAMANHO = 10 * 1024 * 1024
_CAMPOS_SOLICITACAO = """id, anuncio_id, comprador_id, mensagem, status,
    solicitada_em, respondida_em, motivo_recusa"""


def _anuncio(conn: Connection, anuncio_id, *, bloquear: bool = False) -> dict:
    sql = """SELECT vendedor_id, estado_comercial, estado_moderacao
             FROM safradireta.anuncio WHERE id = %s"""
    if bloquear:
        sql += " FOR UPDATE"
    anuncio = conn.execute(sql, (anuncio_id,)).fetchone()
    if anuncio is None:
        raise nao_encontrado("Anúncio não encontrado.")
    return anuncio


def _ativo(anuncio: dict) -> bool:
    return anuncio["estado_comercial"] == "ATIVO" and anuncio["estado_moderacao"] == "LIBERADO"


def _mime(conteudo: bytes) -> str:
    if not 0 < len(conteudo) <= MAX_TAMANHO:
        raise invalido("Envie um arquivo de até 10 MB.")
    if conteudo.startswith(b"%PDF-") and conteudo.rstrip().endswith(b"%%EOF"):
        return "application/pdf"
    tipo, mime = midia_service.identificar_tipo(conteudo)
    if tipo != "FOTO":
        raise invalido("Envie um arquivo PDF, JPEG, PNG ou WEBP.")
    midia_service.validar_imagem_real(conteudo, mime)
    return mime


def cadastrar(conn: Connection, anuncio_id, conta_id, tipo: str, nome: str, conteudo: bytes) -> dict:
    mime = _mime(conteudo)
    nome = Path(nome.replace("\\", "/")).name.replace("\x00", "")[:255] or "documento"
    checksum = hashlib.sha256(conteudo).hexdigest()
    caminho = None
    try:
        with conn.transaction():
            anuncio = _anuncio(conn, anuncio_id, bloquear=True)
            if anuncio["vendedor_id"] != conta_id:
                raise proibido("Este anúncio pertence a outro vendedor.")
            if anuncio["estado_comercial"] in ("VENDIDO", "CANCELADO"):
                raise conflito("Não é possível anexar documentos a um anúncio encerrado.")
            chave, caminho = midia_service.salvar_arquivo(conteudo, mime)
            arquivo = conn.execute(
                """INSERT INTO safradireta.arquivo
                       (conta_enviante_id, chave_storage, nome_original, mime_type, tamanho_bytes, checksum)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   RETURNING id, criado_em""",
                (conta_id, chave, nome, mime, len(conteudo), checksum),
            ).fetchone()
            documento = conn.execute(
                """INSERT INTO safradireta.documento_anuncio (anuncio_id, arquivo_id, tipo)
                   VALUES (%s, %s, %s) RETURNING id""",
                (anuncio_id, arquivo["id"], tipo),
            ).fetchone()
    except Exception:
        if caminho is not None:
            caminho.unlink(missing_ok=True)
        raise
    return {"id": documento["id"], "tipo": tipo, "nomeOriginal": nome, "mimeType": mime,
            "tamanhoBytes": len(conteudo), "criadoEm": arquivo["criado_em"]}


def listar(conn: Connection, anuncio_id, conta_id) -> dict:
    anuncio = _anuncio(conn, anuncio_id)
    dono = conta_id == anuncio["vendedor_id"]
    if not dono and not _ativo(anuncio):
        raise proibido("Os documentos deste anúncio estão indisponíveis.")
    documentos = conn.execute(
        """SELECT d.id, d.tipo, f.nome_original AS "nomeOriginal", f.mime_type AS "mimeType",
                  f.tamanho_bytes AS "tamanhoBytes", f.criado_em AS "criadoEm"
           FROM safradireta.documento_anuncio d
           JOIN safradireta.arquivo f ON f.id = d.arquivo_id AND f.removido_em IS NULL
           WHERE d.anuncio_id = %s ORDER BY f.criado_em, d.id""",
        (anuncio_id,),
    ).fetchall()
    if dono:
        solicitacoes = conn.execute(
            f"""SELECT {_CAMPOS_SOLICITACAO} FROM safradireta.solicitacao_documento
                WHERE anuncio_id = %s ORDER BY solicitada_em DESC, id DESC""",
            (anuncio_id,),
        ).fetchall()
        return {"documentos": documentos, "solicitacoes": solicitacoes}
    solicitacao = conn.execute(
        f"""SELECT {_CAMPOS_SOLICITACAO} FROM safradireta.solicitacao_documento
            WHERE anuncio_id = %s AND comprador_id = %s
            ORDER BY (status IN ('PENDENTE', 'APROVADO')) DESC, solicitada_em DESC, id DESC LIMIT 1""",
        (anuncio_id, conta_id),
    ).fetchone()
    return {"documentos": documentos, "solicitacao": solicitacao}


def solicitar(conn: Connection, anuncio_id, conta_id, mensagem: str) -> dict:
    with conn.transaction():
        anuncio = _anuncio(conn, anuncio_id, bloquear=True)
        if not _ativo(anuncio) or anuncio["vendedor_id"] == conta_id:
            raise proibido("A solicitação exige um anúncio disponível de outro vendedor.")
        if not conn.execute(
            """SELECT 1 FROM safradireta.documento_anuncio d
               JOIN safradireta.arquivo f ON f.id = d.arquivo_id AND f.removido_em IS NULL
               WHERE d.anuncio_id = %s LIMIT 1""",
            (anuncio_id,),
        ).fetchone():
            raise conflito("O anúncio ainda não possui documentos.")
        existente = conn.execute(
            f"""SELECT {_CAMPOS_SOLICITACAO} FROM safradireta.solicitacao_documento
                WHERE anuncio_id = %s AND comprador_id = %s AND status IN ('PENDENTE', 'APROVADO')""",
            (anuncio_id, conta_id),
        ).fetchone()
        if existente:
            return existente
        return conn.execute(
            f"""INSERT INTO safradireta.solicitacao_documento (anuncio_id, comprador_id, mensagem)
                VALUES (%s, %s, %s) RETURNING {_CAMPOS_SOLICITACAO}""",
            (anuncio_id, conta_id, mensagem),
        ).fetchone()


def decidir(conn: Connection, solicitacao_id, conta_id, status: str, motivo: str | None) -> dict:
    with conn.transaction():
        linha = conn.execute(
            "SELECT anuncio_id FROM safradireta.solicitacao_documento WHERE id = %s", (solicitacao_id,),
        ).fetchone()
        if linha is None:
            raise nao_encontrado("Solicitação não encontrada.")
        anuncio = _anuncio(conn, linha["anuncio_id"], bloquear=True)
        solicitacao = conn.execute(
            f"SELECT {_CAMPOS_SOLICITACAO} FROM safradireta.solicitacao_documento WHERE id = %s",
            (solicitacao_id,),
        ).fetchone()
        if solicitacao is None:
            raise nao_encontrado("Solicitação não encontrada.")
        autorizado = (
            solicitacao["comprador_id"] == conta_id if status == "CANCELADO"
            else anuncio["vendedor_id"] == conta_id
        )
        if not autorizado:
            raise proibido("Você não pode alterar esta solicitação.")
        if status == "APROVADO" and not _ativo(anuncio):
            raise conflito("O anúncio precisa estar disponível para aprovar o acesso.")
        origem = "APROVADO" if status == "REVOGADO" else "PENDENTE"
        if solicitacao["status"] != origem:
            raise conflito("A solicitação já foi processada.")
        return conn.execute(
            f"""UPDATE safradireta.solicitacao_documento
                SET status = %s, respondida_em = now(), motivo_recusa = %s
                WHERE id = %s RETURNING {_CAMPOS_SOLICITACAO}""",
            (status, motivo if status == "RECUSADO" else None, solicitacao_id),
        ).fetchone()


def arquivo_autorizado(conn: Connection, documento_id, conta_id) -> dict:
    linha = conn.execute(
        """SELECT f.chave_storage, f.mime_type, f.nome_original,
                  a.vendedor_id = %(conta)s OR (
                      a.estado_comercial = 'ATIVO' AND a.estado_moderacao = 'LIBERADO'
                      AND EXISTS (
                          SELECT 1 FROM safradireta.solicitacao_documento s
                          WHERE s.anuncio_id = a.id AND s.comprador_id = %(conta)s AND s.status = 'APROVADO'
                      )
                  ) AS autorizado
           FROM safradireta.documento_anuncio d
           JOIN safradireta.anuncio a ON a.id = d.anuncio_id
           JOIN safradireta.arquivo f ON f.id = d.arquivo_id AND f.removido_em IS NULL
           WHERE d.id = %(documento)s""",
        {"conta": conta_id, "documento": documento_id},
    ).fetchone()
    if linha is None:
        raise nao_encontrado("Documento não encontrado.")
    if not linha["autorizado"]:
        raise proibido("É necessária autorização do vendedor para visualizar o documento.")
    return linha
