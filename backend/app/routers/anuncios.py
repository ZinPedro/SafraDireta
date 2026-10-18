from fastapi import APIRouter, Body, Depends
from psycopg import Connection

from app.database import get_connection
from app.deps import anuncio_do_dono, vendedor_habilitado
from app.schemas.anuncio import AnuncioEntrada
from app.services import anuncio_service

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
