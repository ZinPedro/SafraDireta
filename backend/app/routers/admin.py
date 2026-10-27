from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from psycopg import Connection

from app.database import get_connection
from app.deps import exigir_admin

from app.schemas.admin import (
    AdminLoginSchema,
    AdminSessionResponseSchema,
    ListaEmpresasPendentesResponse,
    AvaliacaoDocumentoSchema,
    AplicarPunicaoSchema,
)

from app.services.admin_service import (
    autenticar_admin,
    listar_empresas_pendentes,
    avaliar_documento_pj,
    suspender_conta_produtor,
)


router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post(
    "/auth/login",
    response_model=AdminSessionResponseSchema,
    status_code=status.HTTP_200_OK,
)
def login_admin(
    payload: AdminLoginSchema,
    request: Request,
    conn: Connection = Depends(get_connection),
):
    """Autentica o administrador usando e-mail, senha e PIN."""

    ip = request.client.host if request.client else "desconhecido"

    return autenticar_admin(
        db=conn,
        email=payload.email,
        senha=payload.senha,
        pin=payload.pin,
        ip=ip,
    )


@router.get(
    "/empresas/pendentes",
    response_model=ListaEmpresasPendentesResponse,
)
def listar_empresas(
    admin: dict = Depends(exigir_admin),
    conn: Connection = Depends(get_connection),
):
    """Lista as empresas que aguardam análise de dossiê."""

    return listar_empresas_pendentes(db=conn)


@router.patch("/empresas/documentos/{documento_id}/avaliar")
def avaliar_documento(
    documento_id: UUID,
    payload: AvaliacaoDocumentoSchema,
    admin: dict = Depends(exigir_admin),
    conn: Connection = Depends(get_connection),
):
    """Aprova ou recusa um documento de uma empresa."""

    return avaliar_documento_pj(
        db=conn,
        documento_id=documento_id,
        payload=payload,
        admin_id=admin["conta_id"],
    )


@router.post("/contas/{conta_id}/suspender")
def suspender_conta(
    conta_id: UUID,
    payload: AplicarPunicaoSchema,
    admin: dict = Depends(exigir_admin),
    conn: Connection = Depends(get_connection),
):
    """Aplica uma sanção a uma conta de produtor."""

    return suspender_conta_produtor(
        db=conn,
        conta_id=conta_id,
        payload=payload,
        admin_id=admin["conta_id"],
    )