"""Validação local da origem do lote com a lista de municípios do IBGE."""
import json
import unicodedata
from pathlib import Path


def _chave(nome: str) -> str:
    texto = unicodedata.normalize("NFKD", " ".join(nome.split()).casefold())
    return "".join(c for c in texto if not unicodedata.combining(c))


_BASE = Path(__file__).resolve().parents[1] / "data" / "municipios_ibge.json"
_MUNICIPIOS = {
    uf: {_chave(nome) for nome in nomes}
    for uf, nomes in json.loads(_BASE.read_text(encoding="utf-8")).items()
}


def validar_municipio(cidade: str, uf: str) -> bool:
    return _chave(cidade) in _MUNICIPIOS.get(uf, ())
