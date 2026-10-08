"""Consultar e editar perfil (US008), com banco real."""


def test_perfil_pf(client, criar_pf):
    pf = criar_pf()
    r = client.get("/api/perfil", headers=pf["headers"])
    assert r.status_code == 200
    dados = r.json()
    assert dados["tipo"] == "PF"
    assert dados["nome"] == "Maria da Silva"
    assert dados["email"] == pf["email"]
    assert dados["telefone"] == "+5519999998888"
    assert isinstance(dados["enderecos"], list)
    assert "representantes" not in dados


def test_perfil_pj_traz_empresa_endereco_e_representantes(client, criar_pj):
    """Cobre o join de representantes, que ja quebrou uma vez."""
    pj = criar_pj()
    r = client.get("/api/perfil", headers=pj["headers"])
    assert r.status_code == 200
    dados = r.json()
    assert dados["tipo"] == "PJ"
    assert dados["razaoSocial"] == "Cooperativa Teste LTDA"
    assert dados["cnpj"] == "12ABC34501DE35"
    assert len(dados["enderecos"]) == 1
    assert dados["enderecos"][0]["principal"] is True
    assert dados["enderecos"][0]["municipio"] == "Campinas"
    assert len(dados["representantes"]) == 1
    assert dados["representantes"][0]["cpf"] == "12345678909"
    assert dados["representantes"][0]["vinculo"] == "Diretor"


def test_editar_nome_e_telefone(client, criar_pf):
    pf = criar_pf()
    r = client.patch("/api/perfil", headers=pf["headers"], json={"name": "Maria Souza", "phone": "+5519988887777"})
    assert r.status_code == 200
    assert r.json()["conta"]["nome"] == "Maria Souza"

    perfil = client.get("/api/perfil", headers=pf["headers"]).json()
    assert perfil["nome"] == "Maria Souza"
    assert perfil["telefone"] == "+5519988887777"
    assert client.get("/api/auth/me", headers=pf["headers"]).json()["conta"]["nome"] == "Maria Souza"


def test_editar_so_o_nome_nao_mexe_no_telefone(client, criar_pf):
    pf = criar_pf()
    r = client.patch("/api/perfil", headers=pf["headers"], json={"name": "Maria Souza"})
    assert r.status_code == 200
    assert client.get("/api/perfil", headers=pf["headers"]).json()["telefone"] == "+5519999998888"


def test_editar_nome_do_pj(client, criar_pj):
    pj = criar_pj()
    r = client.patch("/api/perfil", headers=pj["headers"], json={"name": "Coop Nova"})
    assert r.status_code == 200
    assert client.get("/api/auth/me", headers=pj["headers"]).json()["conta"]["nome"] == "Coop Nova"


def test_corpo_vazio_retorna_422(client, criar_pf):
    pf = criar_pf()
    r = client.patch("/api/perfil", headers=pf["headers"], json={})
    assert r.status_code == 422
    assert r.json()["erro"]["codigo"] == "DADOS_INVALIDOS"


def test_campo_nulo_retorna_422(client, criar_pf):
    pf = criar_pf()
    assert client.patch("/api/perfil", headers=pf["headers"], json={"name": None}).status_code == 422


def test_telefone_invalido_retorna_422(client, criar_pf):
    pf = criar_pf()
    r = client.patch("/api/perfil", headers=pf["headers"], json={"phone": "123"})
    assert r.status_code == 422
    assert "phone" in r.json()["erro"]["campos"]


def test_perfil_sem_token_retorna_401(client):
    assert client.get("/api/perfil").status_code == 401
    assert client.patch("/api/perfil", json={"name": "Fulano de Tal"}).status_code == 401


def test_perfil_so_mostra_a_propria_conta(client, criar_pf):
    a, b = criar_pf(nome="Ana Lima"), criar_pf(nome="Bia Costa")
    assert client.get("/api/perfil", headers=a["headers"]).json()["nome"] == "Ana Lima"
    assert client.get("/api/perfil", headers=b["headers"]).json()["nome"] == "Bia Costa"
