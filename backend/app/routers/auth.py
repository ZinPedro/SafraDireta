from fastapi import APIRouter, Depends, Request, Response
from psycopg import Connection

from app.database import get_connection
from app.deps import conta_autenticada
from app.schemas.auth import AlterarEmail, EditarPerfil, LoginEntrada, MeResposta, RegistroPF, SessaoResposta
from app.services import auth_service
from app.schemas.pj import RegistroPJ

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])


@router.post(
    "/register",
    status_code=201,
    response_model=SessaoResposta,
    summary="Cadastrar conta de pessoa física",
    description="Cria a conta, registra o aceite do termo vigente e já devolve a sessão.",
)
def registrar(dados: RegistroPF, conn: Connection = Depends(get_connection)):
    return auth_service.registrar_pf(conn, dados)


@router.post(
    "/login",
    response_model=SessaoResposta,
    summary="Entrar na conta",
    description="Valida email e senha e devolve um token de sessão. Após 5 erros seguidos no mesmo email, bloqueia por 15 minutos.",
)
def login(dados: LoginEntrada, request: Request, conn: Connection = Depends(get_connection)):
    ip = request.client.host if request.client else "desconhecido"
    return auth_service.autenticar(conn, dados, ip)


@router.post(
    "/logout",
    status_code=204,
    summary="Sair da conta",
    description="Revoga a sessão do token enviado no cabeçalho Authorization.",
)
def logout(atual: dict = Depends(conta_autenticada), conn: Connection = Depends(get_connection)):
    auth_service.encerrar_sessao(conn, atual)
    return Response(status_code=204)


@router.get(
    "/me",
    response_model=MeResposta,
    summary="Dados da conta autenticada",
    description="Devolve a conta dona do token enviado no cabeçalho Authorization.",
)
def me(atual: dict = Depends(conta_autenticada), conn: Connection = Depends(get_connection)):
    return auth_service.dados_da_conta(conn, atual)

@router.post(
    "/register-corporate",
    status_code=201,
    summary="Cadastrar pessoa juridica",
)
def registrar_empresa(
    dados: RegistroPJ,
    conn: Connection = Depends(get_connection),
):
    return auth_service.registrar_pj(conn, dados)


perfil_router = APIRouter(prefix="/api/perfil", tags=["Perfil"])


@perfil_router.get(
    "",
    summary="Consultar perfil da conta autenticada",
)
def consultar_perfil(
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    return auth_service.consultar_perfil(conn, atual)



@perfil_router.patch(
    "",
    summary="Editar perfil da conta autenticada",
)
def atualizar_perfil(
    dados: EditarPerfil,
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    return auth_service.editar_perfil(conn, atual, dados)


@perfil_router.patch(
    "/email",
    summary="Alterar email da conta autenticada",
)
def atualizar_email(
    dados: AlterarEmail,
    atual: dict = Depends(conta_autenticada),
    conn: Connection = Depends(get_connection),
):
    return auth_service.alterar_email(conn, atual, dados)
