from uuid import uuid4

SENHA = "senhaForte123"


def _cadastrar(client):
    """Cria uma conta PF pelo proprio endpoint e devolve (email, resposta)."""
    email = f"t{uuid4().hex[:10]}@exemplo.com"
    r = client.post("/api/auth/register", json={
        "name": "Maria da Silva",
        "email": email,
        "phone": "+5519999998888",
        "password": SENHA,
        "acceptedTerms": True,
        "intent": "buyer",
    })
    assert r.status_code == 201
    return email, r.json()


def _login(client, email, senha=SENHA):
    return client.post("/api/auth/login", json={"email": email, "password": senha})


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_login_ok(client):
    email, _ = _cadastrar(client)
    r = _login(client, email)
    assert r.status_code == 200
    dados = r.json()
    assert len(dados["token"]) >= 43
    assert dados["conta"]["email"] == email
    assert dados["conta"]["tipo"] == "PF"
    assert dados["vendedor"]["estado"] is None


def test_login_normaliza_o_email(client):
    email, _ = _cadastrar(client)
    r = _login(client, f"  {email.upper()} ")
    assert r.status_code == 200


def test_senha_errada_retorna_401(client):
    email, _ = _cadastrar(client)
    r = _login(client, email, "senhaErrada999")
    assert r.status_code == 401
    assert r.json()["erro"]["codigo"] == "NAO_AUTENTICADO"


def test_email_inexistente_tem_a_mesma_resposta_da_senha_errada(client):
    email, _ = _cadastrar(client)
    errada = _login(client, email, "senhaErrada999")
    inexistente = _login(client, f"nao{uuid4().hex[:8]}@exemplo.com")
    assert inexistente.status_code == errada.status_code == 401
    assert inexistente.json() == errada.json()


def test_login_sem_campos_retorna_422(client):
    r = client.post("/api/auth/login", json={})
    assert r.status_code == 422
    assert {"email", "password"} <= set(r.json()["erro"]["campos"])


def test_bloqueia_apos_5_erros_seguidos(client):
    email, _ = _cadastrar(client)
    for _ in range(5):
        assert _login(client, email, "senhaErrada999").status_code == 401
    # a partir daqui nem a senha certa entra
    assert _login(client, email, "senhaErrada999").status_code == 429
    r = _login(client, email)
    assert r.status_code == 429
    assert r.json()["erro"]["codigo"] == "MUITAS_TENTATIVAS"


def test_conta_suspensa_so_e_revelada_com_a_senha_certa(client):
    email, _ = _cadastrar(client)
    client.db.execute(
        "UPDATE safradireta.conta SET estado = 'SUSPENSA' WHERE email_acesso = %s", (email,)
    )
    assert _login(client, email, "senhaErrada999").status_code == 401
    r = _login(client, email)
    assert r.status_code == 403
    assert r.json()["erro"]["codigo"] == "PROIBIDO"


def test_me_com_token_do_cadastro(client):
    email, cadastro = _cadastrar(client)
    r = client.get("/api/auth/me", headers=_auth(cadastro["token"]))
    assert r.status_code == 200
    assert r.json()["conta"]["email"] == email
    assert r.json()["vendedor"]["estado"] is None


def test_me_sem_token_ou_com_token_invalido_retorna_401(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=_auth("token-que-nao-existe")).status_code == 401


def test_logout_revoga_so_a_sessao_usada(client):
    email, _ = _cadastrar(client)
    token_a = _login(client, email).json()["token"]
    token_b = _login(client, email).json()["token"]

    assert client.post("/api/auth/logout", headers=_auth(token_a)).status_code == 204
    assert client.get("/api/auth/me", headers=_auth(token_a)).status_code == 401
    assert client.get("/api/auth/me", headers=_auth(token_b)).status_code == 200


def test_sessao_expirada_retorna_401(client):
    email, cadastro = _cadastrar(client)
    client.db.execute(
        "UPDATE safradireta.sessao SET expira_em = now() - interval '1 hour'"
        " WHERE conta_id = (SELECT id FROM safradireta.conta WHERE email_acesso = %s)",
        (email,),
    )
    assert client.get("/api/auth/me", headers=_auth(cadastro["token"])).status_code == 401


def test_banco_guarda_so_o_hash_do_token(client):
    email, _ = _cadastrar(client)
    token = _login(client, email).json()["token"]
    existe = client.db.execute(
        "SELECT count(*) AS n FROM safradireta.sessao WHERE token_hash = %s", (token,)
    ).fetchone()
    assert existe["n"] == 0
