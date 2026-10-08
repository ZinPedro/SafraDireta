"""Preparacao compartilhada dos testes de integracao."""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app import ratelimit
from app.database import get_connection
from app.main import app


@pytest.fixture(autouse=True)
def _zerar_limite_de_login():
    """O limite de tentativas fica em memoria; zera para um teste nao afetar o outro."""
    ratelimit.resetar()
    yield


@pytest.fixture()
def client():
    """Cliente HTTP com banco real; tudo que o teste grava e desfeito no fim."""
    with TestClient(app) as c:
        with app.state.db_pool.connection() as conn:
            with conn.transaction(force_rollback=True):
                app.dependency_overrides[get_connection] = lambda: conn
                c.db = conn  # para o teste olhar o banco direto
                try:
                    yield c
                finally:
                    app.dependency_overrides.clear()


SENHA = "senhaForte123"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def criar_pf(client):
    """Cria uma conta PF pela API. Devolve {email, senha, token, headers}."""
    def _criar(nome="Maria da Silva", intent="buyer"):
        email = f"pf{uuid4().hex[:10]}@exemplo.com"
        r = client.post("/api/auth/register", json={
            "name": nome, "email": email, "phone": "+5519999998888",
            "password": SENHA, "acceptedTerms": True, "intent": intent,
        })
        assert r.status_code == 201, r.text
        token = r.json()["token"]
        return {"email": email, "senha": SENHA, "token": token, "headers": _auth(token)}
    return _criar


@pytest.fixture()
def enviar_pj(client):
    """Envia o cadastro PJ e devolve (email, resposta). Nao exige sucesso."""
    def _enviar(cnpj="12ABC34501DE35", cpf="12345678909", email=None):
        email = email or f"pj{uuid4().hex[:10]}@exemplo.com"
        r = client.post("/api/auth/register-corporate", json={
            "company": {"cnpj": cnpj, "razaoSocial": "Cooperativa Teste LTDA"},
            "address": {"cep": "13000000", "logradouro": "Rua A", "numero": "100",
                        "bairro": "Centro", "cidade": "Campinas", "uf": "SP"},
            "representative": {"nome": "Joao Souza", "cpf": cpf, "vinculo": "Diretor"},
            "documents": {"hasCompanyDoc": True, "hasRepresentativeDoc": True,
                          "fileNames": ["contrato.pdf", "rg.jpg"]},
            "access": {"email": email, "telefone": "+551933334444",
                       "senha": SENHA, "acceptedTerms": True},
        })
        return email, r
    return _enviar


@pytest.fixture()
def criar_pj(enviar_pj):
    """Cria uma conta PJ pela API (exige 201). Devolve {email, senha, token, headers, resposta}."""
    def _criar(**kwargs):
        email, r = enviar_pj(**kwargs)
        assert r.status_code == 201, r.text
        token = r.json()["token"]
        return {"email": email, "senha": SENHA, "token": token,
                "headers": _auth(token), "resposta": r.json()}
    return _criar
