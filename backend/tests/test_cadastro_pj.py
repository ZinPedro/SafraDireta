"""Cadastro de pessoa juridica, com banco real (tudo e desfeito no fim)."""


def test_cadastro_pj_ok(client, enviar_pj):
    email, r = enviar_pj()
    assert r.status_code == 201
    dados = r.json()
    assert dados["status"] == "registered_pending_validation"
    assert dados["conta"]["tipo"] == "PJ"
    assert dados["conta"]["email"] == email
    assert len(dados["token"]) >= 43
    assert "expiraEm" in dados
    assert dados["protocol"]  # id da verificacao


def test_cadastro_pj_grava_tudo_no_banco(client, enviar_pj):
    _, r = enviar_pj()
    conta_id = r.json()["conta"]["id"]
    db = client.db

    empresa = db.execute("SELECT cnpj FROM safradireta.empresa WHERE conta_id = %s", (conta_id,)).fetchone()
    assert empresa["cnpj"] == "12ABC34501DE35"

    rep = db.execute("SELECT cpf FROM safradireta.representante_empresa WHERE empresa_id = %s", (conta_id,)).fetchone()
    assert rep["cpf"] == "12345678909"

    hab = db.execute("SELECT estado FROM safradireta.habilitacao_vendedor WHERE conta_id = %s", (conta_id,)).fetchone()
    assert hab["estado"] == "PENDENTE"

    ver = db.execute(
        "SELECT id, tipo, estado FROM safradireta.verificacao WHERE conta_id = %s", (conta_id,)
    ).fetchone()
    assert ver["tipo"] == "CADASTRO_PJ"
    assert ver["estado"] == "RASCUNHO"
    assert str(ver["id"]) == r.json()["protocol"]


def test_cnpj_duplicado_retorna_409(client, enviar_pj):
    assert enviar_pj()[1].status_code == 201
    _, r = enviar_pj()  # mesmo CNPJ, outro email
    assert r.status_code == 409
    assert r.json()["erro"]["codigo"] == "CONFLITO"
    assert "cnpj" in r.json()["erro"]["campos"]


def test_email_duplicado_retorna_409(client, enviar_pj):
    email, primeiro = enviar_pj()
    assert primeiro.status_code == 201
    _, r = enviar_pj(cnpj="11222333000181", cpf="52998224725", email=email)  # outro CNPJ, mesmo email
    assert r.status_code == 409
    assert "email" in r.json()["erro"]["campos"]


def test_me_do_pj_devolve_a_verificacao(client, criar_pj):
    pj = criar_pj()
    r = client.get("/api/auth/me", headers=pj["headers"])
    assert r.status_code == 200
    verificacao = r.json()["verificacao"]
    assert verificacao["protocol"] == pj["resposta"]["protocol"]
    assert verificacao["tipo"] == "CADASTRO_PJ"
    assert verificacao["estado"] == "RASCUNHO"


def test_pj_consegue_fazer_login(client, criar_pj):
    pj = criar_pj()
    r = client.post("/api/auth/login", json={"email": pj["email"], "password": pj["senha"]})
    assert r.status_code == 200
    assert r.json()["conta"]["tipo"] == "PJ"
