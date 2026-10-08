"""Erros da aplicacao e formato padrao de resposta de erro."""
from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


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


def _resposta(status, codigo, mensagem, campos=None, headers=None):
    return JSONResponse(
        status_code=status,
        content={"erro": {"codigo": codigo, "mensagem": mensagem, "campos": campos or {}}},
        headers=headers,
    )

def _mensagem_pt(erro: dict) -> str:
    """Traduz o erro do Pydantic para uma mensagem em portugues."""
    tipo = erro["type"]
    ctx = erro.get("ctx") or {}
    if tipo == "value_error":
        # nossas validacoes personalizadas: tira o prefixo "Value error, "
        return erro["msg"].removeprefix("Value error, ")
    if tipo == "missing":
        return "Campo obrigatório."
    if tipo == "string_too_short":
        return f"Use pelo menos {ctx.get('min_length')} caracteres."
    if tipo == "string_too_long":
        return f"Use no máximo {ctx.get('max_length')} caracteres."
    if tipo == "literal_error":
        return "Valor não permitido."
    if tipo in ("bool_parsing", "bool_type"):
        return "Informe verdadeiro ou falso."
    if tipo == "string_type":
        return "Informe um texto."
    if tipo == "json_invalid":
        return "O corpo da requisição não é um JSON válido."
    return "Valor inválido."

def registrar_handlers(app: FastAPI) -> None:
    @app.exception_handler(ErroApp)
    async def _tratar_erro_app(request: Request, exc: ErroApp):
        return _resposta(exc.status, exc.codigo, exc.mensagem, exc.campos)

    @app.exception_handler(RequestValidationError)
    async def _tratar_validacao(request: Request, exc: RequestValidationError):
        campos = {}
        for erro in exc.errors():
            caminho = [str(p) for p in erro["loc"] if p not in ("body", "query", "path")]
            campos[".".join(caminho) or "corpo"] = _mensagem_pt(erro)
        return _resposta(422, "DADOS_INVALIDOS", "Dados inválidos.", campos)

    @app.exception_handler(StarletteHTTPException)
    async def _tratar_http(request: Request, exc: StarletteHTTPException):
        # Padroniza so o 404 e o 405 gerados pelo proprio framework (rota/metodo inexistente).
        # Os demais HTTPException (ex.: 503 do /health/db) seguem o comportamento padrao.
        if exc.status_code == 404 and exc.detail == "Not Found":
            return _resposta(404, "NAO_ENCONTRADO", "Rota não encontrada.")
        if exc.status_code == 405 and exc.detail == "Method Not Allowed":
            return _resposta(
                405, "METODO_NAO_PERMITIDO", "Método não permitido para esta rota.",
                headers=exc.headers,
            )
        return await http_exception_handler(request, exc)
