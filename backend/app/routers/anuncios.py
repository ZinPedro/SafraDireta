from fastapi import APIRouter, Body, Depends, File, UploadFile
from psycopg import Connection

from app.database import get_connection
from app.deps import anuncio_do_dono, vendedor_habilitado
from app.schemas.anuncio import AnuncioEntrada
from app.services import anuncio_service, midia_service

router = APIRouter(prefix="/api/vendedor/anuncios", tags=["Anúncios"])


@router.post(
    "",
    status_code=201,
    summary="Cadastrar lote e publicar anúncio",
    description="Só vendedor habilitado. Recebe o formulário do front (categoria ANIMAL ou GRAOS). "
                "O anúncio fica ligado a quem o criou e já nasce ATIVO (disponível no marketplace).",
)
def criar(
    dados: AnuncioEntrada,
    atual: dict = Depends(vendedor_habilitado),
    conn: Connection = Depends(get_connection),
):
    return anuncio_service.criar_anuncio(conn, atual, dados)


@router.get(
    "/{anuncio_id}",
    summary="Abrir anúncio para edição",
    description="Só o dono. Devolve o anúncio com todos os campos preenchidos.",
)
def abrir(anuncio: dict = Depends(anuncio_do_dono), conn: Connection = Depends(get_connection)):
    return anuncio_service.obter_anuncio(conn, anuncio["id"])


@router.patch(
    "/{anuncio_id}",
    summary="Editar anúncio",
    description="Só o dono. Aceita o formulário completo ou só os campos alterados, com as "
                "mesmas regras da criação. Categoria, espécie e cultura não mudam. "
                "Anúncio vendido não pode ser editado.",
)
def editar(
    corpo: dict = Body(...),
    anuncio: dict = Depends(anuncio_do_dono),
    conn: Connection = Depends(get_connection),
):
    return anuncio_service.editar_anuncio(conn, anuncio, corpo)

@router.post(
    "/{anuncio_id}/pausar",
    summary="Pausar anúncio",
    description="Só o dono pode pausar um anúncio ATIVO.",
)
def pausar(
    anuncio: dict = Depends(anuncio_do_dono),
    atual: dict = Depends(vendedor_habilitado),
    conn: Connection = Depends(get_connection),
):
    return anuncio_service.pausar_anuncio(conn, anuncio, atual)


@router.post(
    "/{anuncio_id}/reativar",
    summary="Reativar anúncio",
    description="Só o dono pode reativar um anúncio PAUSADO.",
)
def reativar(
    anuncio: dict = Depends(anuncio_do_dono),
    atual: dict = Depends(vendedor_habilitado),
    conn: Connection = Depends(get_connection),
):
    return anuncio_service.reativar_anuncio(conn, anuncio, atual)


@router.post(
    "/{anuncio_id}/midias",
    status_code=201,
    summary="Adicionar foto ou vídeo ao anúncio",
    description="Permite que o dono do anúncio envie fotos e vídeos.",
)
async def adicionar_midia(
    arquivo: UploadFile = File(...),
    anuncio: dict = Depends(anuncio_do_dono),
    atual: dict = Depends(vendedor_habilitado),
    conn: Connection = Depends(get_connection),
):
    limite = midia_service.MAX_TAMANHO_VIDEO

    # Lê no máximo o limite permitido + 1 byte.
    # Isso evita carregar arquivos arbitrariamente grandes na memória.
    conteudo = await arquivo.read(limite + 1)

    try:
        return midia_service.cadastrar_midia(
            conn=conn,
            anuncio=anuncio,
            atual=atual,
            conteudo=conteudo,
            nome_original=arquivo.filename or "arquivo",
        )
    finally:
        await arquivo.close()
