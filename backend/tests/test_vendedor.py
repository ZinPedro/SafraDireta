"""Habilitacao de vendedor (US004), com banco real."""

CPF = "52998224725"
OUTRO_CPF = "11144477735"


def _solicitar(client, headers, cpf=CPF, **extra):
    return client.post("/api/vendedor/habilitacao", json={"cpf": cpf, "possuiTransportadora": False, **extra}, headers=headers)


def test_solicitar_habilitacao(client, criar_pf):
    pf = criar_pf()
    r = _solicitar(client, pf["headers"])
    assert r.status_code == 201
    assert r.json()["estado"] == "HABILITADO"
    assert r.json()["status"] == "habilitado"
    assert r.json()["protocol"]


def test_solicitar_grava_cpf_e_verificacao(client, criar_pf):
    pf = criar_pf()
    r = _solicitar(client, pf["headers"])
    conta_id = client.get("/api/auth/me", headers=pf["headers"]).json()["conta"]["id"]

    cpf = client.db.execute("SELECT cpf FROM safradireta.perfil_pf WHERE conta_id = %s", (conta_id,)).fetchone()
    assert cpf["cpf"] == CPF
    ver = client.db.execute(
        "SELECT id, tipo, estado FROM safradireta.verificacao WHERE conta_id = %s", (conta_id,)
    ).fetchone()
    assert ver["tipo"] == "HABILITACAO_VENDEDOR"
    assert str(ver["id"]) == r.json()["protocol"]


def test_consultar_habilitacao_devolve_a_observacao(client, criar_pf):
    """Garante que a coluna observacao_transporte e gravada e lida direito."""
    pf = criar_pf()
    r = client.post("/api/vendedor/habilitacao", headers=pf["headers"], json={
        "cpf": CPF, "possuiTransportadora": True, "observacaoTransportadora": "Frete proprio",
    })
    assert r.status_code == 201
    r = client.get("/api/vendedor/habilitacao", headers=pf["headers"])
    assert r.status_code == 200
    assert r.json() == {
        "possuiHabilitacao": True,
        "estado": "HABILITADO",
        "possuiTransportadora": True,
        "observacaoTransportadora": "Frete proprio",
    }


def test_aceita_tambem_snake_case(client, criar_pf):
    pf = criar_pf()
    r = client.post("/api/vendedor/habilitacao", headers=pf["headers"], json={
        "cpf": CPF, "possui_transportadora": True, "observacao_transportadora": "Caminhao",
    })
    assert r.status_code == 201


def test_me_mostra_o_estado_do_vendedor(client, criar_pf):
    pf = criar_pf()
    assert client.get("/api/auth/me", headers=pf["headers"]).json()["vendedor"]["estado"] is None
    _solicitar(client, pf["headers"])
    assert client.get("/api/auth/me", headers=pf["headers"]).json()["vendedor"]["estado"] == "HABILITADO"


def test_consultar_sem_solicitacao_retorna_404(client, criar_pf):
    pf = criar_pf()
    r = client.get("/api/vendedor/habilitacao", headers=pf["headers"])
    assert r.status_code == 404
    assert r.json()["erro"]["codigo"] == "NAO_ENCONTRADO"


def test_solicitar_duas_vezes_retorna_409(client, criar_pf):
    pf = criar_pf()
    assert _solicitar(client, pf["headers"]).status_code == 201
    r = _solicitar(client, pf["headers"])
    assert r.status_code == 409
    assert r.json()["erro"]["codigo"] == "CONFLITO"


def test_cpf_invalido_retorna_422(client, criar_pf):
    pf = criar_pf()
    r = _solicitar(client, pf["headers"], cpf="11111111111")
    assert r.status_code == 422
    assert "cpf" in r.json()["erro"]["campos"]


def test_cpf_de_outra_conta_retorna_409(client, criar_pf):
    a, b = criar_pf(), criar_pf()
    assert _solicitar(client, a["headers"]).status_code == 201
    r = _solicitar(client, b["headers"])  # mesmo CPF
    assert r.status_code == 409
    assert "cpf" in r.json()["erro"]["campos"]


def test_cpf_diferente_do_ja_cadastrado_retorna_409(client, criar_pf):
    """Conta cujo CPF ja esta gravado nao pode trocar por outro nesta rota."""
    pf = criar_pf()
    client.db.execute(
        "UPDATE safradireta.perfil_pf SET cpf = %s WHERE conta_id = %s",
        (OUTRO_CPF, client.get("/api/auth/me", headers=pf["headers"]).json()["conta"]["id"]),
    )
    r = _solicitar(client, pf["headers"], cpf=CPF)
    assert r.status_code == 409


def test_pj_nao_pode_solicitar(client, criar_pj):
    pj = criar_pj()
    r = _solicitar(client, pj["headers"])
    assert r.status_code == 403
    assert r.json()["erro"]["codigo"] == "PROIBIDO"


def test_sem_token_retorna_401(client):
    assert client.get("/api/vendedor/habilitacao").status_code == 401
    assert client.post("/api/vendedor/habilitacao", json={"cpf": CPF, "possuiTransportadora": False}).status_code == 401


def test_solicitar_habilitacao_payload_completo(client, criar_pf):
    pf = criar_pf()
    payload = {
        "cpf": CPF,
        "farmName": "Fazenda Boa Esperança",
        "city": "Campinas",
        "state": "SP",
        "categories": ["cafe", "milho"],
        "hasOwnTransport": True,
        "documents": {
            "hasCpfDocument": True,
            "cpfFrontFileName": "rg_frente.pdf",
            "cpfBackFileName": "rg_verso.pdf",
            "hasCarDocument": True,
            "carFileName": "car_registro.pdf",
        },
    }
    r = client.post("/api/vendedor/habilitacao", headers=pf["headers"], json=payload)
    assert r.status_code == 201
    assert r.json()["estado"] == "HABILITADO"
    assert r.json()["status"] == "habilitado"
    assert r.json()["protocol"]

    perfil = client.get("/api/perfil", headers=pf["headers"]).json()
    assert perfil["seller"] is not None
    assert perfil["seller"]["isHabilitado"] is True
    assert perfil["seller"]["farmName"] == "Fazenda Boa Esperança"
    assert perfil["seller"]["city"] == "Campinas"
    assert perfil["seller"]["state"] == "SP"
    assert perfil["seller"]["categories"] == ["cafe", "milho"]
    assert perfil["seller"]["hasOwnTransport"] is True


def test_habilitar_alias_funciona(client, criar_pf):
    pf = criar_pf()
    r = client.post("/api/vendedor/habilitar", headers=pf["headers"], json={
        "cpf": CPF,
        "farmName": "Sítio Verde",
        "city": "Ribeirão Preto",
        "state": "SP",
        "categories": ["soja"],
        "hasOwnTransport": False,
    })
    assert r.status_code == 201
    assert r.json()["estado"] == "HABILITADO"
