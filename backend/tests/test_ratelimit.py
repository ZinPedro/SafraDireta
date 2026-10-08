"""Testes do limite de tentativas (sem banco, o tempo e controlado na mao)."""
import pytest

from app import ratelimit
from app.errors import ErroApp


@pytest.fixture()
def relogio(monkeypatch):
    agora = [1000.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: agora[0])
    return agora


def test_bloqueia_apos_o_limite_de_falhas_por_email(relogio):
    for _ in range(ratelimit.MAX_POR_EMAIL):
        ratelimit.verificar("a@x.com", "1.1.1.1")
        ratelimit.registrar_falha("a@x.com", "1.1.1.1")
    with pytest.raises(ErroApp) as erro:
        ratelimit.verificar("a@x.com", "1.1.1.1")
    assert erro.value.status == 429


def test_outro_email_nao_e_afetado(relogio):
    for _ in range(ratelimit.MAX_POR_EMAIL):
        ratelimit.registrar_falha("a@x.com", "1.1.1.1")
    ratelimit.verificar("b@x.com", "2.2.2.2")  # nao levanta


def test_libera_depois_da_janela(relogio):
    for _ in range(ratelimit.MAX_POR_EMAIL):
        ratelimit.registrar_falha("a@x.com", "1.1.1.1")
    relogio[0] += ratelimit.JANELA_SEGUNDOS + 1
    ratelimit.verificar("a@x.com", "1.1.1.1")  # nao levanta


def test_login_correto_zera_o_contador_do_email(relogio):
    for _ in range(ratelimit.MAX_POR_EMAIL):
        ratelimit.registrar_falha("a@x.com", "1.1.1.1")
    ratelimit.limpar_email("a@x.com")
    ratelimit.verificar("a@x.com", "9.9.9.9")  # nao levanta


def test_bloqueia_por_ip_mesmo_com_emails_diferentes(relogio):
    for i in range(ratelimit.MAX_POR_IP):
        ratelimit.registrar_falha(f"u{i}@x.com", "3.3.3.3")
    with pytest.raises(ErroApp):
        ratelimit.verificar("novo@x.com", "3.3.3.3")
