"""Rotas publicas (sem login): catalogo, detalhe do anuncio e arquivos das midias."""
from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from psycopg import Connection

from app.config import get_settings
from app.database import get_connection
from app.errors import nao_encontrado
from app.services import catalogo_service

router = APIRouter(prefix="/api", tags=["Catálogo"])


@router.get(
    "/anuncios",
    summary="Catálogo de anúncios (US018)",
    description="Público. Só anúncios ATIVOS. Filtros opcionais e paginação.",
)
def catalogo(
    categoria: Literal["ANIMAL", "GRAOS"] | None = None,
    cultura: Literal["SOJA", "MILHO", "CAFE", "TRIGO", "OUTRO"] | None = None,
    uf: str | None = Query(None, min_length=2, max_length=2),
    precoMin: Decimal | None = Query(None, ge=0),
    precoMax: Decimal | None = Query(None, ge=0),
    busca: str | None = Query(None, max_length=100),
    ordem: Literal["recentes", "menor_preco", "maior_preco"] = "recentes",
    pagina: int = Query(1, ge=1),
    tamanho: int = Query(12, ge=1, le=50),
    conn: Connection = Depends(get_connection),
):
    filtros = {"categoria": categoria, "cultura": cultura, "uf": uf, "preco_min": precoMin,
               "preco_max": precoMax, "busca": busca, "ordem": ordem, "pagina": pagina, "tamanho": tamanho}
    return catalogo_service.listar_catalogo(conn, filtros)


@router.get(
    "/anuncios/{anuncio_id}",
    summary="Detalhe do anúncio (US019)",
    description="Público. Anúncio pausado, vendido ou inexistente retorna 404.",
)
def detalhe(anuncio_id: UUID, conn: Connection = Depends(get_connection)):
    return catalogo_service.detalhe_publico(conn, anuncio_id)


@router.get(
    "/midias/{midia_id}",
    summary="Arquivo de uma foto ou vídeo do anúncio",
    description="Público. Só para mídias de anúncios ATIVOS. Serve o arquivo para o front exibir.",
)
def arquivo_da_midia(midia_id: UUID, conn: Connection = Depends(get_connection)):
    dados = catalogo_service.arquivo_da_midia(conn, midia_id)
    caminho = get_settings().upload_dir / dados["chave_storage"]
    if not caminho.is_file():
        raise nao_encontrado("Arquivo não encontrado.")
    return FileResponse(caminho, media_type=dados["mime_type"])
