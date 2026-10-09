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


def test_avatar_url_em_perfil_e_me(client, criar_pf):
    pf = criar_pf()
    r = client.patch(
        "/api/perfil",
        headers=pf["headers"],
        json={"avatar_url": "https://imagem.com/avatar.png"},
    )
    assert r.status_code == 200

    me = client.get("/api/auth/me", headers=pf["headers"]).json()
    assert (me["conta"].get("avatarUrl") or me["conta"].get("avatar_url")) == "https://imagem.com/avatar.png"

    perfil = client.get("/api/perfil", headers=pf["headers"]).json()
    assert perfil["avatarUrl"] == "https://imagem.com/avatar.png"
    assert perfil["account"]["avatarUrl"] == "https://imagem.com/avatar.png"


def test_editar_perfil_cpf_quando_nulo_e_bloqueia_quando_existente(client, criar_pf):
    pf = criar_pf()
    # 1. Usuário recém criado não tem CPF
    perfil = client.get("/api/perfil", headers=pf["headers"]).json()
    assert perfil.get("cpf") is None

    # 2. Permite gravar CPF pela primeira vez
    r = client.patch("/api/perfil", headers=pf["headers"], json={"cpf": "52998224725"})
    assert r.status_code == 200

    perfil = client.get("/api/perfil", headers=pf["headers"]).json()
    assert perfil["cpf"] == "52998224725"

    # 3. Tentar alterar o CPF cadastrado deve retornar 422 DOCUMENTO_PROTEGIDO
    r_alt = client.patch("/api/perfil", headers=pf["headers"], json={"cpf": "11144477735"})
    assert r_alt.status_code == 422
    assert r_alt.json()["erro"]["codigo"] == "DOCUMENTO_PROTEGIDO"


def test_editar_perfil_endereco_upsert(client, criar_pf):
    pf = criar_pf()
    # 1. Inserir primeiro endereço via perfil
    r = client.patch(
        "/api/perfil",
        headers=pf["headers"],
        json={
            "address": {
                "cep": "13083852",
                "logradouro": "Rua das Palmeiras",
                "numero": "50",
                "bairro": "Jardim Guanabara",
                "cidade": "Campinas",
                "uf": "SP",
            }
        },
    )
    assert r.status_code == 200

    perfil = client.get("/api/perfil", headers=pf["headers"]).json()
    assert perfil["address"]["logradouro"] == "Rua das Palmeiras"
    assert perfil["address"]["numero"] == "50"
    assert perfil["address"]["cidade"] == "Campinas"
    assert perfil["address"]["uf"] == "SP"

    # 2. Atualizar número e complemento
    r2 = client.patch(
        "/api/perfil",
        headers=pf["headers"],
        json={"address": {"numero": "52", "complemento": "Apto 101"}},
    )
    assert r2.status_code == 200

    perfil2 = client.get("/api/perfil", headers=pf["headers"]).json()
    assert perfil2["address"]["numero"] == "52"
    assert perfil2["address"]["complemento"] == "Apto 101"
    assert perfil2["address"]["logradouro"] == "Rua das Palmeiras"


def test_editar_perfil_vitrine_vendedor(client, criar_pf):
    pf = criar_pf()
    # Habilita como vendedor
    client.post(
        "/api/vendedor/habilitacao",
        headers=pf["headers"],
        json={"cpf": "52998224725", "possuiTransportadora": False},
    )

    # Atualiza vitrine
    r = client.patch(
        "/api/perfil",
        headers=pf["headers"],
        json={
            "seller": {
                "farmName": "Fazenda Bela Vista",
                "bio": "Produção agroecológica sustentável",
                "city": "Campinas",
                "state": "SP",
                "publicPhone": "+5519988887777",
                "categories": ["cafe", "milho"],
                "hasOwnTransport": True,
            }
        },
    )
    assert r.status_code == 200
    dados_resposta = r.json()
    assert dados_resposta["message"] == "Perfil atualizado com sucesso."
    assert dados_resposta["seller"]["farmName"] == "Fazenda Bela Vista"
    assert "account" in dados_resposta
    assert "conta" in dados_resposta

    perfil = client.get("/api/perfil", headers=pf["headers"]).json()
    assert perfil["seller"]["farmName"] == "Fazenda Bela Vista"
    assert perfil["seller"]["bio"] == "Produção agroecológica sustentável"
    assert perfil["seller"]["city"] == "Campinas"
    assert perfil["seller"]["categories"] == ["cafe", "milho"]
    assert perfil["seller"]["hasOwnTransport"] is True
    assert perfil["seller"]["publicPhone"] == "+5519988887777"

    # Remove o telefone público enviando vazio
    r_limpar = client.patch(
        "/api/perfil",
        headers=pf["headers"],
        json={"seller": {"publicPhone": ""}},
    )
    assert r_limpar.status_code == 200
    assert r_limpar.json()["seller"]["publicPhone"] == ""

    perfil_sem_tel = client.get("/api/perfil", headers=pf["headers"]).json()
    assert perfil_sem_tel["seller"]["publicPhone"] == ""

