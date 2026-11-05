from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from psycopg import Connection

from app.database import get_connection
from app.deps import anuncio_do_dono, conta_autenticada
from app.errors import nao_encontrado
from app.schemas.documento import DecisaoDocumento, SolicitacaoDocumento, TipoDocumento
from app.services import documento_service, midia_service

router = APIRouter(prefix="/api", tags=["Documentos"])


@router.post("/anuncios/{anuncio_id}/documentos", status_code=201)
def enviar(
    tipo: TipoDocumento = Form(...),
    arquivo: UploadFile = File(...),
    anuncio: dict = Depends(anuncio_do_dono),
    conn: Connection = Depends(get_connection),
):
    try:
        conteudo = arquivo.file.read(documento_service.MAX_TAMANHO + 1)
        return documento_service.cadastrar(
            conn, anuncio["id"], anuncio["vendedor_id"], tipo, arquivo.filename or "", conteudo,
        )
    finally:
        arquivo.file.close()


@router.get("/anuncios/{anuncio_id}/documentos")
def listar(
    anuncio_id: UUID,
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    return documento_service.listar(conn, anuncio_id, atual["conta_id"])


@router.post("/anuncios/{anuncio_id}/documentos/solicitar", status_code=201)
def solicitar(
    anuncio_id: UUID,
    dados: SolicitacaoDocumento,
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    return documento_service.solicitar(conn, anuncio_id, atual["conta_id"], dados.mensagem)


@router.patch("/documentos/solicitacoes/{solicitacao_id}")
def decidir(
    solicitacao_id: UUID,
    dados: DecisaoDocumento,
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    return documento_service.decidir(
        conn, solicitacao_id, atual["conta_id"], dados.status, dados.motivo_recusa,
    )


@router.get("/documentos/{documento_id}/visualizar")
def visualizar(
    documento_id: UUID,
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    dados = documento_service.arquivo_autorizado(conn, documento_id, atual["conta_id"])
    caminho = midia_service.pasta_uploads() / dados["chave_storage"]
    if not caminho.is_file():
        raise nao_encontrado("Documento não encontrado.")
    return FileResponse(
        caminho, media_type=dados["mime_type"], filename=dados["nome_original"],
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )
