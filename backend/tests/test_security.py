from app.security import (
    gerar_hash_senha, verificar_senha, senha_precisa_novo_hash,
    gerar_token, hash_token,
)


def test_senha_correta_e_errada():
    h = gerar_hash_senha("senhaForte123")
    assert verificar_senha("senhaForte123", h) is True
    assert verificar_senha("outra", h) is False


def test_hash_invalido_nao_estoura():
    assert verificar_senha("x", "isso nao e um hash") is False


def test_mesmo_texto_gera_hashes_diferentes():
    assert gerar_hash_senha("abc12345") != gerar_hash_senha("abc12345")


def test_hash_recente_nao_precisa_rehash():
    assert senha_precisa_novo_hash(gerar_hash_senha("abc12345")) is False


def test_tokens_unicos_e_hash_estavel():
    t1, t2 = gerar_token(), gerar_token()
    assert t1 != t2
    assert len(t1) >= 43
    assert hash_token(t1) == hash_token(t1)
    assert hash_token(t1) != hash_token(t2)
    assert len(hash_token(t1)) == 64