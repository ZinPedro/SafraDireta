"""Regras do formulario de anuncio que dependem de mais de um campo.

conferir() levanta erro 422 com o nome do campo (camelCase) que o front deve corrigir.
"""
import re
from decimal import Decimal

from app.errors import ErroApp, invalido
from app.schemas.anuncio import AnuncioAnimal, AnuncioGraos
from app.validators import normalizar_uf, validar_uf

SACA_KG = Decimal(60)

RACAS = [
    "Nelore", "Angus (Aberdeen Angus)", "Brangus", "Cruzamento Industrial F1", "Senepol",
    "Brahman", "Tabapua", "Guzera", "Hereford / Braford", "Anelorado / Mestico", "OUTRA",
]

# codigo -> texto de tela. O front envia o codigo.
SUBTIPOS = {
    "SOJA": {
        "EXPORTACAO_TRANSGENICA": "Comercial, Padrao Exportacao (Transgenica)",
        "CONVENCIONAL_NAO_TRANSGENICA": "Convencional (Nao Transgenica / Livre de OGM)",
        "INDUSTRIA_ESMAGAMENTO": "Padrao Industria (Esmagamento)",
        "SEMENTE": "Soja para Semente",
        "OUTRO": "Outro",
    },
    "MILHO": {
        "AMARELO_DURO_EXPORTACAO": "Amarelo Grao Duro (Tipo 1 / Exportacao)",
        "COMERCIAL_RACAO": "Comercial (Padrao Racao / Consumo Animal)",
        "BRANCO_CANJICA": "Milho Branco (Canjica / Industria)",
        "PIPOCA": "Milho Pipoca",
        "SILAGEM_GRAO_UMIDO": "Silagem / Grao Umido",
        "OUTRO": "Outro",
    },
    "CAFE": {
        "ARABICA_TIPO6_DURA": "Arabica, Tipo 6 / Bebida Dura",
        "ARABICA_MOLE_ESPECIAL": "Arabica, Bebida Mole / Especial",
        "ARABICA_RIADA_RIO": "Arabica, Bebida Riada / Rio",
        "CONILON_ROBUSTA": "Conilon / Robusta",
        "COCO_NATURAL": "Cafe em Coco / Natural",
        "OUTRO": "Outro",
    },
    "TRIGO": {
        "PAO_TIPO1": "Trigo Pao (Tipo 1)",
        "MELHORADOR": "Trigo Melhorador",
        "BRANDO_BISCOITO": "Trigo Brando (Biscoito / Confeitaria)",
        "RACAO_OUTROS": "Racao Animal / Outros Usos",
        "OUTRO": "Outro",
    },
    "OUTRO": {"OUTRO": "Outro"},
}

PENEIRAS = ["17_18_ACIMA", "16_ACIMA", "14_15", "MOCA", "BICA_CORRIDA"]

_SAFRA = re.compile(r"^(\d{4})/(\d{4})$")


def _erro(campos: dict):
    return invalido("Dados inválidos.", campos)


def _preco_confere(total: Decimal, unitario: Decimal | None, quantidade: int) -> bool:
    """Preco por unidade vezes quantidade tem de bater com o total (margem de arredondamento)."""
    if unitario is None:
        return True
    return abs(total - unitario * quantidade) <= Decimal("0.01") * quantidade + Decimal("0.01")


def _numero(laudo: dict, campo: str, minimo: float, maximo: float | None, erros: dict, obrigatorio=False):
    chave = f"laudoTecnico.{campo}"
    valor = laudo.get(campo)
    if valor is None:
        if obrigatorio:
            erros[chave] = "Campo obrigatório."
        return
    if isinstance(valor, bool) or not isinstance(valor, (int, float, str)):
        erros[chave] = "Informe um número."
        return
    try:
        numero = float(valor)
    except ValueError:
        erros[chave] = "Informe um número."
        return
    if numero < minimo or (maximo is not None and numero > maximo):
        faixa = f"entre {minimo:g} e {maximo:g}" if maximo is not None else f"maior ou igual a {minimo:g}"
        erros[chave] = f"Informe um valor {faixa}."


def _texto(laudo: dict, campo: str, limite: int, erros: dict):
    valor = laudo.get(campo)
    if valor is not None and (not isinstance(valor, str) or len(valor.strip()) > limite):
        erros[f"laudoTecnico.{campo}"] = f"Informe um texto de até {limite} caracteres."


def validar_laudo(cultura: str, laudo: dict | None) -> dict:
    """Confere o laudo tecnico da cultura e devolve so os campos permitidos."""
    laudo = laudo or {}
    erros: dict = {}
    campos_da_cultura = {
        "CAFE": ["cafePeneira", "cafeCatacaoDefeitos", "cafePontuacaoSca"],
        "SOJA": ["sojaImpurezasPct", "sojaAvariadosPct", "sojaQuebradosPct"],
        "MILHO": ["milhoImpurezasPct", "milhoArdidosPct", "milhoQuebradosPct"],
        "TRIGO": ["trigoPhKgHl", "trigoForcaGlutenW", "trigoFallingNumberSeg"],
        "OUTRO": ["outroObservacoesLaudo"],
    }[cultura]
    for chave in laudo:
        if chave not in campos_da_cultura:
            erros[f"laudoTecnico.{chave}"] = "Campo não se aplica a esta cultura."

    if cultura == "CAFE":
        if laudo.get("cafePeneira") not in PENEIRAS:
            erros["laudoTecnico.cafePeneira"] = "Escolha a peneira: " + ", ".join(PENEIRAS) + "."
        _texto(laudo, "cafeCatacaoDefeitos", 30, erros)
        _numero(laudo, "cafePontuacaoSca", 80, 100, erros)
    elif cultura in ("SOJA", "MILHO"):
        for campo in campos_da_cultura:
            _numero(laudo, campo, 0, 100, erros)
    elif cultura == "TRIGO":
        _numero(laudo, "trigoPhKgHl", 0.000001, None, erros, obrigatorio=True)
        _numero(laudo, "trigoForcaGlutenW", 0, None, erros)
        _numero(laudo, "trigoFallingNumberSeg", 0, None, erros)
    else:
        _texto(laudo, "outroObservacoesLaudo", 60, erros)

    if erros:
        raise _erro(erros)
    return {k: v for k, v in laudo.items() if k in campos_da_cultura and v is not None}


def conferir(d: AnuncioAnimal | AnuncioGraos) -> dict:
    """Confere as regras entre campos. Devolve o laudo limpo (graos) ou {} (animais)."""
    erros: dict = {}

    if d.fotos or d.video:
        erros["fotos" if d.fotos else "video"] = (
            "Fotos e vídeo não vão no cadastro. Envie depois, pelo envio de mídia do anúncio."
        )

    uf = normalizar_uf(d.uf)
    if not validar_uf(uf):
        erros["uf"] = "Informe uma UF válida."
    if not d.cidade.strip():
        erros["cidade"] = "Informe a cidade."

    laudo: dict = {}
    if isinstance(d, AnuncioAnimal):
        if d.raca not in RACAS:
            erros["raca"] = "Escolha uma raça da lista."
        elif d.raca == "OUTRA" and not (d.raca_personalizada or "").strip():
            erros["racaPersonalizada"] = "Informe a raça (até 30 caracteres)."
        if d.pricing_mode != "TOTAL" and not _preco_confere(d.preco_total, d.preco_por_cabeca, d.quantidade_cabecas):
            erros["precoPorCabeca"] = "O preço por cabeça não confere com o preço total."
    else:
        if d.cultura == "OUTRO" and not (d.cultura_personalizada or "").strip():
            erros["culturaPersonalizada"] = "Informe a cultura (até 30 caracteres)."
        if d.subtipo not in SUBTIPOS[d.cultura]:
            erros["subtipo"] = "Escolha um subtipo válido para a cultura."
        match = _SAFRA.match(d.safra)
        if not match or int(match.group(2)) != int(match.group(1)) + 1:
            erros["safra"] = "Informe a safra no formato 2025/2026."
        if d.peso_total_toneladas is not None and abs(
            d.peso_total_toneladas - Decimal(d.quantidade_sacas) * SACA_KG / 1000
        ) > Decimal("0.01"):
            erros["pesoTotalToneladas"] = "O peso não confere com a quantidade de sacas (1 saca = 60 kg)."
        if d.pricing_mode != "TOTAL" and not _preco_confere(d.preco_total, d.preco_por_saca, d.quantidade_sacas):
            erros["precoPorSaca"] = "O preço por saca não confere com o preço total."
        try:
            laudo = validar_laudo(d.cultura, d.laudo_tecnico)
        except ErroApp as e:  # os erros do laudo se juntam aos demais
            erros.update(e.campos)

    if erros:
        raise _erro(erros)
    return laudo
