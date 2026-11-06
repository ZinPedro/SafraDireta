from uuid import UUID

from fastapi import APIRouter, Depends, Query
from psycopg import Connection

from app.database import get_connection
from app.deps import conta_autenticada
from app.services import favorito_service

router = APIRouter(prefix="/api", tags=["Favoritos"])


@router.post("/anuncios/{anuncio_id}/favoritar", status_code=204)
def adicionar(
    anuncio_id: UUID,
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    favorito_service.adicionar(conn, atual["conta_id"], anuncio_id)


@router.delete("/anuncios/{anuncio_id}/favoritar", status_code=204)
def remover(
    anuncio_id: UUID,
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    favorito_service.remover(conn, atual["conta_id"], anuncio_id)


@router.get("/favoritos")
def listar(
    pagina: int = Query(1, ge=1, le=2_147_483_647),
    itens_por_pagina: int = Query(12, ge=1, le=50),
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    return favorito_service.listar(conn, atual["conta_id"], pagina, itens_por_pagina)
