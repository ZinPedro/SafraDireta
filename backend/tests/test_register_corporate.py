"""Testes de cadastro de pessoa jurídica (POST /api/auth/register-corporate)."""
import random
from uuid import uuid4


def _gerar_cnpj(seq: int | None = None) -> str:
    if seq is None:
        seq = random.randint(10000000, 89999999)
    base = f"{seq:08d}0001"
    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s1 = sum((ord(c) - 48) * w for c, w in zip(base, w1))
    r1 = s1 % 11
    d1 = 0 if r1 < 2 else 11 - r1
    base13 = base + str(d1)
    w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s2 = sum((ord(c) - 48) * w for c, w in zip(base13, w2))
    r2 = s2 % 11
    d2 = 0 if r2 < 2 else 11 - r2
    return base + str(d1) + str(d2)


def _corpo_pj(**extra):
    sufixo = uuid4().hex[:6]
    base = {
        "company": {
            "cnpj": _gerar_cnpj(),
            "razaoSocial": f"Cooperativa Teste {sufixo} LTDA",
            "nomeFantasia": "Coop Teste",
            "naturezaJuridica": "Cooperativa",
        },
        "address": {
            "cep": "19800000",
            "logradouro": "Avenida Principal",
            "numero": "100",
            "complemento": "Bloco A",
            "bairro": "Centro",
            "cidade": "Assis",
            "uf": "SP",
        },
        "representative": {
            "nome": "Carlos Silveira",
            "cpf": "12345678909",
            "vinculo": "Diretor",
        },
        "documents": {
            "hasCompanyDoc": True,
            "hasRepresentativeDoc": True,
            "fileNames": ["estatuto.pdf", "cnh.pdf"],
        },
        "access": {
            "email": f"contato_{sufixo}@empresa.com.br",
            "telefone": "+5519999887766",
            "senha": "SenhaForte123!",
            "acceptedTerms": True,
        },
    }
    base.update(extra)
    return base


def test_cadastro_pj_sucesso(client):
    corpo = _corpo_pj()
    r = client.post("/api/auth/register-corporate", json=corpo)
    assert r.status_code == 201
    dados = r.json()
    assert dados["status"] == "registered_pending_validation"
    assert dados["protocol"].startswith("VER-")
    assert dados["conta"]["tipo"] == "PJ"
    assert len(dados["token"]) >= 43


def test_cadastro_pj_email_duplicado_retorna_409(client):
    corpo = _corpo_pj()
    r1 = client.post("/api/auth/register-corporate", json=corpo)
    assert r1.status_code == 201
    # Tenta cadastrar de novo com o mesmo email
    corpo2 = _corpo_pj()
    corpo2["access"]["email"] = corpo["access"]["email"]
    corpo2["company"]["cnpj"] = _gerar_cnpj()
    r2 = client.post("/api/auth/register-corporate", json=corpo2)
    assert r2.status_code == 409
    assert "email" in r2.json()["erro"]["campos"]


def test_cadastro_pj_cnpj_invalido_retorna_422(client):
    corpo = _corpo_pj()
    corpo["company"]["cnpj"] = "00000000000000"
    r = client.post("/api/auth/register-corporate", json=corpo)
    assert r.status_code == 422
    assert "company.cnpj" in r.json()["erro"]["campos"]


def test_cadastro_pj_cpf_invalido_retorna_422(client):
    corpo = _corpo_pj()
    corpo["representative"]["cpf"] = "11111111111"
    r = client.post("/api/auth/register-corporate", json=corpo)
    assert r.status_code == 422
    assert "representative.cpf" in r.json()["erro"]["campos"]


def test_cadastro_pj_uf_invalida_retorna_422(client):
    corpo = _corpo_pj()
    corpo["address"]["uf"] = "XX"
    r = client.post("/api/auth/register-corporate", json=corpo)
    assert r.status_code == 422
    assert "address.uf" in r.json()["erro"]["campos"]


def test_cadastro_pj_sem_documentos_retorna_422(client):
    corpo = _corpo_pj()
    corpo["documents"]["hasCompanyDoc"] = False
    r = client.post("/api/auth/register-corporate", json=corpo)
    assert r.status_code == 422
    assert "documents.hasCompanyDoc" in r.json()["erro"]["campos"]


