from uuid import uuid4


def _corpo(**extra):
    base = {
        "name": "Maria da Silva",
        "email": f"t{uuid4().hex[:10]}@exemplo.com",
        "phone": "+5519999998888",
        "password": "senhaForte123",
        "acceptedTerms": True,
        "intent": "buyer",
    }
    base.update(extra)
    return base


def test_cadastro_ok(client):
    r = client.post("/api/auth/register", json=_corpo())
    assert r.status_code == 201
    dados = r.json()
    assert dados["conta"]["tipo"] == "PF"
    assert len(dados["token"]) >= 43
    assert dados["proximoPasso"] is None


def test_intencao_vendedor_indica_proximo_passo(client):
    r = client.post("/api/auth/register", json=_corpo(intent="seller"))
    assert r.status_code == 201
    assert r.json()["proximoPasso"] == "SOLICITAR_HABILITACAO_VENDEDOR"


def test_email_e_normalizado(client):
    sufixo = uuid4().hex[:10]
    r = client.post("/api/auth/register", json=_corpo(email=f"  T{sufixo}@EXEMPLO.COM "))
    assert r.status_code == 201
    assert r.json()["conta"]["email"] == f"t{sufixo}@exemplo.com"


def test_senha_nao_fica_legivel_no_banco(client):
    corpo = _corpo()
    client.post("/api/auth/register", json=corpo)
    linha = client.db.execute(
        "SELECT senha_hash FROM safradireta.conta WHERE email_acesso = %s",
        (corpo["email"],),
    ).fetchone()
    assert linha["senha_hash"].startswith("$argon2id$")
    assert corpo["password"] not in linha["senha_hash"]


def test_email_repetido_retorna_409(client):
    corpo = _corpo()
    assert client.post("/api/auth/register", json=corpo).status_code == 201
    r = client.post("/api/auth/register", json=corpo)
    assert r.status_code == 409
    assert "email" in r.json()["erro"]["campos"]


def test_senha_curta_retorna_422(client):
    r = client.post("/api/auth/register", json=_corpo(password="123"))
    assert r.status_code == 422
    assert "password" in r.json()["erro"]["campos"]


def test_termos_nao_aceitos_retorna_422(client):
    r = client.post("/api/auth/register", json=_corpo(acceptedTerms=False))
    assert r.status_code == 422
    assert "acceptedTerms" in r.json()["erro"]["campos"]


def test_telefone_invalido_retorna_422(client):
    r = client.post("/api/auth/register", json=_corpo(phone="123"))
    assert r.status_code == 422
    assert "phone" in r.json()["erro"]["campos"]