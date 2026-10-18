"""Testes das pequenas correcoes de robustez. Nao alteram nenhum fluxo existente."""
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import get_settings
from app.errors import registrar_handlers


def _login(client, email, senha):
    return client.post("/api/auth/login", json={"email": email, "password": senha})


# ---------------------------------------------------------------- avatarUrl

def test_avatar_com_javascript_e_recusado(client, criar_pf):
    pf = criar_pf()
    r = client.patch("/api/perfil", headers=pf["headers"], json={"avatarUrl": "javascript:alert(1)"})
    assert r.status_code == 422
    assert "avatarUrl" in r.json()["erro"]["campos"]


def test_avatar_com_data_url_e_recusado(client, criar_pf):
    pf = criar_pf()
    r = client.patch("/api/perfil", headers=pf["headers"], json={"avatarUrl": "data:text/html;base64,AAAA"})
    assert r.status_code == 422


def test_avatar_com_https_continua_funcionando(client, criar_pf):
    pf = criar_pf()
    r = client.patch("/api/perfil", headers=pf["headers"], json={"avatarUrl": "https://imagem.com/a.png"})
    assert r.status_code == 200


def test_avatar_dentro_de_account_tambem_e_validado(client, criar_pf):
    pf = criar_pf()
    r = client.patch("/api/perfil", headers=pf["headers"], json={"account": {"avatarUrl": "javascript:alert(1)"}})
    assert r.status_code == 422


# ---------------------------------------------------------------- endereco

def test_endereco_incompleto_nao_inventa_dados(client, criar_pf):
    pf = criar_pf()
    r = client.patch("/api/perfil", headers=pf["headers"], json={"address": {"cep": "13000000"}})
    assert r.status_code == 422
    campos = r.json()["erro"]["campos"]
    for campo in ("logradouro", "numero", "bairro", "cidade", "uf"):
        assert campo in campos
    assert client.get("/api/perfil", headers=pf["headers"]).json()["enderecos"] == []


def test_endereco_incompleto_nao_perde_outras_alteracoes_validas_em_outra_chamada(client, criar_pf):
    """A falha e do endereco; um PATCH so com o nome continua funcionando normalmente."""
    pf = criar_pf()
    assert client.patch("/api/perfil", headers=pf["headers"], json={"address": {"cep": "13000000"}}).status_code == 422
    assert client.patch("/api/perfil", headers=pf["headers"], json={"name": "Maria Souza"}).status_code == 200


# ---------------------------------------------------------------- troca de email

def test_trocar_email_derruba_as_outras_sessoes_e_mantem_a_atual(client, criar_pf):
    pf = criar_pf()
    outra = _login(client, pf["email"], pf["senha"]).json()["token"]
    h_outra = {"Authorization": f"Bearer {outra}"}
    assert client.get("/api/auth/me", headers=h_outra).status_code == 200

    r = client.patch("/api/perfil/email", headers=pf["headers"], json={
        "novoEmail": f"novo{uuid4().hex[:8]}@exemplo.com", "senhaAtual": pf["senha"],
    })
    assert r.status_code == 200
    assert client.get("/api/auth/me", headers=h_outra).status_code == 401  # outra sessao caiu
    assert client.get("/api/auth/me", headers=pf["headers"]).status_code == 200  # a atual segue valida


def test_senha_atual_errada_varias_vezes_bloqueia_com_429(client, criar_pf):
    pf = criar_pf()
    corpo = {"novoEmail": f"x{uuid4().hex[:8]}@exemplo.com", "senhaAtual": "senhaErrada999"}
    for _ in range(5):
        assert client.patch("/api/perfil/email", headers=pf["headers"], json=corpo).status_code == 422
    r = client.patch("/api/perfil/email", headers=pf["headers"], json={**corpo, "senhaAtual": pf["senha"]})
    assert r.status_code == 429
    assert r.json()["erro"]["codigo"] == "MUITAS_TENTATIVAS"


def test_senha_certa_zera_as_tentativas_erradas(client, criar_pf):
    pf = criar_pf()
    errada = {"novoEmail": f"x{uuid4().hex[:8]}@exemplo.com", "senhaAtual": "senhaErrada999"}
    for _ in range(3):
        client.patch("/api/perfil/email", headers=pf["headers"], json=errada)
    ok = client.patch("/api/perfil/email", headers=pf["headers"], json={
        "novoEmail": f"y{uuid4().hex[:8]}@exemplo.com", "senhaAtual": pf["senha"],
    })
    assert ok.status_code == 200


# ---------------------------------------------------------------- tratamento de erros

def test_erro_inesperado_responde_no_formato_padrao_sem_vazar_detalhes():
    mini = FastAPI()
    registrar_handlers(mini)

    @mini.get("/boom")
    def boom():
        raise RuntimeError("detalhe interno secreto")

    r = TestClient(mini, raise_server_exceptions=False).get("/boom")
    assert r.status_code == 500
    assert r.json()["erro"]["codigo"] == "ERRO_INTERNO"
    assert "secreto" not in r.text


def test_violacao_de_unicidade_vira_409_no_formato_padrao(client):
    """Simula a corrida de dois cadastros: o banco barra e a API responde 409."""
    mini = FastAPI()
    registrar_handlers(mini)
    email = f"dup{uuid4().hex[:8]}@exemplo.com"
    sql = ("INSERT INTO safradireta.conta(tipo,email_acesso,senha_hash,telefone_recuperacao) "
           "VALUES ('PF', %s, 'h', 't')")

    @mini.get("/dup")
    def dup():
        with client.db.transaction():
            client.db.execute(sql, (email,))
            client.db.execute(sql, (email,))

    r = TestClient(mini, raise_server_exceptions=False).get("/dup")
    assert r.status_code == 409
    assert r.json()["erro"]["codigo"] == "CONFLITO"
    assert "email" in r.json()["erro"]["campos"]


# ---------------------------------------------------------------- configuracao

def test_configuracoes_sao_lidas_uma_vez_so():
    assert get_settings() is get_settings()
