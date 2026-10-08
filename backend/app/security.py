"""Senhas e tokens de sessao."""
import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()

# Hash de uma senha qualquer, usado para gastar o mesmo tempo
# quando o email nao existe (evita descobrir emails pelo tempo de resposta).
_HASH_FALSO = _hasher.hash("senha-falsa-para-igualar-tempo")


def gerar_hash_senha(senha: str) -> str:
    return _hasher.hash(senha)


def verificar_senha(senha: str, hash_salvo: str) -> bool:
    try:
        return _hasher.verify(hash_salvo, senha)
    except (VerificationError, InvalidHashError):
        return False


def senha_precisa_novo_hash(hash_salvo: str) -> bool:
    return _hasher.check_needs_rehash(hash_salvo)


def gastar_tempo_de_verificacao(senha: str) -> None:
    verificar_senha(senha, _HASH_FALSO)


def gerar_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()