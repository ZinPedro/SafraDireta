
"""Validadores reutilizaveis da Sprint 1.

Validacoes puras: nao consultam o banco nem alteram estados.
"""
import re

UFS = frozenset(
    "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split()
)


def somente_digitos(valor: str) -> str:
    return "".join(c for c in valor if c in "0123456789")


def normalizar_cpf(valor: str) -> str:
    return somente_digitos(valor)


def validar_cpf(cpf: str) -> bool:
    cpf = normalizar_cpf(cpf)
    if len(cpf) != 11 or len(set(cpf)) == 1:
        return False

    for tamanho in (9, 10):
        soma = sum(int(cpf[i]) * (tamanho + 1 - i) for i in range(tamanho))
        digito = (soma * 10) % 11

        if digito == 10:
            digito = 0

        if digito != int(cpf[tamanho]):
            return False

    return True


def normalizar_cnpj(valor: str) -> str:
    """Preserva letras: CNPJ alfanumerico nao pode perder caracteres."""
    return re.sub(r"[\s./-]", "", valor).upper()


def _digito_cnpj(base: str, pesos: tuple[int, ...]) -> str:
    soma = sum((ord(c) - 48) * peso for c, peso in zip(base, pesos))
    resto = soma % 11
    return str(0 if resto < 2 else 11 - resto)


def validar_cnpj(cnpj: str) -> bool:
    cnpj = normalizar_cnpj(cnpj)

    if not re.fullmatch(r"[A-Z0-9]{12}[0-9]{2}", cnpj):
        return False

    if len(set(cnpj)) == 1:
        return False

    primeiro = _digito_cnpj(
        cnpj[:12],
        (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
    )

    segundo = _digito_cnpj(
        cnpj[:12] + primeiro,
        (6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
    )

    return cnpj[-2:] == primeiro + segundo


def normalizar_cep(valor: str) -> str:
    return somente_digitos(valor)


def validar_cep(cep: str) -> bool:
    return bool(re.fullmatch(r"[0-9]{8}", normalizar_cep(cep)))


def normalizar_uf(valor: str) -> str:
    return valor.strip().upper()


def validar_uf(uf: str) -> bool:
    return normalizar_uf(uf) in UFS


TRANSICOES_VERIFICACAO = {
    "RASCUNHO": frozenset({"ENVIADA"}),
    "ENVIADA": frozenset({"EM_ANALISE"}),
    "EM_ANALISE": frozenset({
        "APROVADA",
        "REJEITADA",
        "CORRECAO_SOLICITADA"
    }),
    "APROVADA": frozenset(),
    "REJEITADA": frozenset(),
    "CORRECAO_SOLICITADA": frozenset(),
}


def transicao_verificacao_permitida(atual: str, destino: str) -> bool:
    """Uma revisao finalizada nao pode ser reaberta; crie nova revisao."""
    return destino in TRANSICOES_VERIFICACAO.get(
        atual,
        frozenset()
    )
