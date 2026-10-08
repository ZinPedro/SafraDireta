"""Limite de tentativas de login, guardado em memoria.

So conta tentativas que FALHARAM. Cada chave (email ou ip) tem uma fila com o
instante de cada falha; as falhas que saem da janela de 15 minutos sao descartadas.
Limitacao: fica na memoria do processo. Reiniciar a API zera a contagem e,
com varios workers, cada um conta separado (ok para a Sprint 1).
"""
import threading
import time
from collections import deque

from app.errors import ErroApp

JANELA_SEGUNDOS = 15 * 60
MAX_POR_EMAIL = 5
MAX_POR_IP = 20

_falhas_email: dict[str, deque] = {}
_falhas_ip: dict[str, deque] = {}
_trava = threading.Lock()  # as rotas sync rodam em varias threads


def _excedeu(mapa: dict, chave: str, limite: int, agora: float) -> bool:
    fila = mapa.get(chave)
    if not fila:
        return False
    while fila and agora - fila[0] > JANELA_SEGUNDOS:
        fila.popleft()
    if not fila:
        del mapa[chave]  # nao deixa o dicionario crescer para sempre
        return False
    return len(fila) >= limite


def verificar(email: str, ip: str) -> None:
    """Chame ANTES de checar a senha. Levanta 429 se passou do limite."""
    agora = time.monotonic()
    with _trava:
        if _excedeu(_falhas_email, email, MAX_POR_EMAIL, agora) or _excedeu(
            _falhas_ip, ip, MAX_POR_IP, agora
        ):
            raise ErroApp(
                429,
                "MUITAS_TENTATIVAS",
                "Muitas tentativas de login. Aguarde alguns minutos e tente de novo.",
            )


def registrar_falha(email: str, ip: str) -> None:
    agora = time.monotonic()
    with _trava:
        _falhas_email.setdefault(email, deque()).append(agora)
        _falhas_ip.setdefault(ip, deque()).append(agora)


def limpar_email(email: str) -> None:
    """Login correto: zera as falhas daquele email."""
    with _trava:
        _falhas_email.pop(email, None)


def resetar() -> None:
    """Usado pelos testes para um teste nao afetar o outro."""
    with _trava:
        _falhas_email.clear()
        _falhas_ip.clear()
