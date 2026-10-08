"""Troca de email (PATCH /api/perfil/email), com banco real."""
from uuid import uuid4


def _novo():
    return f"novo{uuid4().hex[:8]}@exemplo.com"


def _trocar(client, conta, novo, senha=None):
    return client.patch("/api/perfil/email", headers=conta["headers"], json={
        "novoEmail": novo, "senhaAtual": senha or conta["senha"],
    })


def _login(client, email, senha):
    return client.post("/api/auth/login", json={"email": email, "password": senha})


def test_trocar_email_ok(client, criar_pf):
    pf = criar_pf()
    novo = _novo()
    r = _trocar(client, pf, novo)
    assert r.status_code == 200
    assert r.json()["email"] == novo
    assert _login(client, novo, pf["senha"]).status_code == 200
    assert _login(client, pf["email"], pf["senha"]).status_code == 401


def test_novo_email_e_normalizado(client, criar_pf):
    pf = criar_pf()
    novo = _novo()
    r = _trocar(client, pf, f"  {novo.upper()} ")
    assert r.status_code == 200
    assert r.json()["email"] == novo


def test_senha_atual_errada_retorna_422_no_campo(client, criar_pf):
    pf = criar_pf()
    r = _trocar(client, pf, _novo(), senha="senhaErrada999")
    assert r.status_code == 422
    assert "senhaAtual" in r.json()["erro"]["campos"]
    assert _login(client, pf["email"], pf["senha"]).status_code == 200  # nada mudou


def test_email_ja_usado_retorna_409(client, criar_pf):
    a, b = criar_pf(), criar_pf()
    r = _trocar(client, a, b["email"])
    assert r.status_code == 409
    assert r.json()["erro"]["codigo"] == "CONFLITO"


def test_email_invalido_retorna_422(client, criar_pf):
    pf = criar_pf()
    r = _trocar(client, pf, "isso-nao-e-email")
    assert r.status_code == 422
    assert "novoEmail" in r.json()["erro"]["campos"]


def test_mesmo_email_nao_altera_nada(client, criar_pf):
    pf = criar_pf()
    r = _trocar(client, pf, pf["email"])
    assert r.status_code == 200
    assert _login(client, pf["email"], pf["senha"]).status_code == 200


def test_trocar_email_sem_token_retorna_401(client):
    r = client.patch("/api/perfil/email", json={"novoEmail": _novo(), "senhaAtual": "senhaForte123"})
    assert r.status_code == 401


def test_pj_tambem_troca_email(client, criar_pj):
    pj = criar_pj()
    novo = _novo()
    assert _trocar(client, pj, novo).status_code == 200
    assert _login(client, novo, pj["senha"]).json()["conta"]["tipo"] == "PJ"
