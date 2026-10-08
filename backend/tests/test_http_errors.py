"""404 e 405 no formato padrao, sem depender do banco."""
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.errors import registrar_handlers


def _cliente():
    app = FastAPI()
    registrar_handlers(app)

    @app.get("/so-get")
    def so_get():
        return {"ok": True}

    @app.get("/quebrado")
    def quebrado():
        raise HTTPException(status_code=503, detail="Banco indisponivel")

    return TestClient(app)


def test_rota_inexistente_usa_formato_padrao():
    r = _cliente().get("/nao-existe")
    assert r.status_code == 404
    assert r.json() == {
        "erro": {"codigo": "NAO_ENCONTRADO", "mensagem": "Rota não encontrada.", "campos": {}}
    }


def test_metodo_nao_permitido_usa_formato_padrao():
    r = _cliente().post("/so-get")
    assert r.status_code == 405
    assert r.json()["erro"]["codigo"] == "METODO_NAO_PERMITIDO"
    assert "GET" in r.headers["allow"]


def test_outros_http_exception_continuam_como_antes():
    # O teste de integracao do Felipe espera exatamente {"detail": "Banco indisponivel"}.
    r = _cliente().get("/quebrado")
    assert r.status_code == 503
    assert r.json() == {"detail": "Banco indisponivel"}
