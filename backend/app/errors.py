"""Erros da aplicacao e formato padrao de resposta de erro."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ErroApp(Exception):
    """Erro de negocio: status HTTP, codigo, mensagem e erros por campo."""

    def __init__(self, status, codigo, mensagem, campos=None):
        super().__init__(mensagem)
        self.status = status
        self.codigo = codigo
        self.mensagem = mensagem
        self.campos = campos or {}


def invalido(mensagem="Dados inválidos.", campos=None):
    return ErroApp(422, "DADOS_INVALIDOS", mensagem, campos)


def nao_autenticado(mensagem="Credenciais inválidas ou sessão expirada."):
    return ErroApp(401, "NAO_AUTENTICADO", mensagem)


def proibido(mensagem="Você não tem permissão para esta ação."):
    return ErroApp(403, "PROIBIDO", mensagem)


def nao_encontrado(mensagem="Recurso não encontrado."):
    return ErroApp(404, "NAO_ENCONTRADO", mensagem)


def conflito(mensagem, campos=None):
    return ErroApp(409, "CONFLITO", mensagem, campos)


def _resposta(status, codigo, mensagem, campos=None):
    return JSONResponse(
        status_code=status,
        content={"erro": {"codigo": codigo, "mensagem": mensagem, "campos": campos or {}}},
    )


def registrar_handlers(app: FastAPI) -> None:
    @app.exception_handler(ErroApp)
    async def _tratar_erro_app(request: Request, exc: ErroApp):
        return _resposta(exc.status, exc.codigo, exc.mensagem, exc.campos)

    @app.exception_handler(RequestValidationError)
    async def _tratar_validacao(request: Request, exc: RequestValidationError):
        campos = {}
        for erro in exc.errors():
            caminho = [str(p) for p in erro["loc"] if p not in ("body", "query", "path")]
            campos[".".join(caminho) or "corpo"] = erro["msg"]
        return _resposta(422, "DADOS_INVALIDOS", "Dados inválidos.", campos)