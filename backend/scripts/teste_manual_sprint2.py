"""Roteiro automatico da Sprint 2 (US010, US011 e US014, formato do front) contra a API rodando.

Uso (com a API ligada em outro terminal: uvicorn app.main:app --reload):
    python scripts/teste_manual_sprint2.py
    python scripts/teste_manual_sprint2.py http://127.0.0.1:8000

Cria contas e anuncios novos a cada rodada (email e CPF unicos). Usa so a biblioteca padrao.
"""
import json
import random
import sys
import time
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
SEM_ID = "00000000-0000-0000-0000-000000000000"
resultados = []


def chamar(metodo, caminho, corpo=None, token=None):
    dados = None if corpo is None else json.dumps(corpo).encode()
    req = urllib.request.Request(BASE + caminho, data=dados, method=metodo)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        texto = e.read()
        try:
            return e.code, json.loads(texto)
        except ValueError:
            return e.code, {"texto": texto.decode(errors="replace")}


def conferir(nome, condicao, detalhe=""):
    resultados.append(bool(condicao))
    print(("  OK       " if condicao else "  FALHOU   ") + nome + ("" if condicao else f"   -> {detalhe}"))


def secao(titulo):
    print(f"\n{titulo}")


def gerar_cpf():
    n = [random.randint(0, 9) for _ in range(9)]
    for tamanho in (9, 10):
        soma = sum(d * p for d, p in zip(n, range(tamanho + 1, 1, -1)))
        n.append((soma * 10 % 11) % 10)
    return "".join(map(str, n))


def nova_conta(prefixo, vendedor):
    email = f"{prefixo}{int(time.time())}{random.randint(100, 999)}@teste.com"
    s, r = chamar("POST", "/api/auth/register", {
        "name": f"Teste {prefixo}", "email": email, "phone": "+5519999998888",
        "password": "senhaForte123", "acceptedTerms": True, "intent": "seller" if vendedor else "buyer"})
    assert s == 201, f"registro falhou: {s} {r}"
    token, conta_id = r["token"], r["conta"]["id"]
    if vendedor:
        s, r = chamar("POST", "/api/vendedor/habilitacao", {"cpf": gerar_cpf()}, token)
        assert s == 201, f"habilitacao falhou: {s} {r}"
    return token, conta_id


def campos(resp):
    return (resp or {}).get("erro", {}).get("campos", {})


# ---------------------------------------------------------------- preparacao
print(f"Testando {BASE}")
try:
    s, cat = chamar("GET", "/api/categorias")
except urllib.error.URLError:
    sys.exit("API fora do ar. Rode antes: uvicorn app.main:app --reload")

secao("Preparacao")
conferir("GET /api/categorias e publica (sem token)", s == 200, s)
conferir("traz as opcoes do formulario", "Nelore" in cat.get("opcoes", {}).get("racas", []), cat.get("opcoes"))
tok_a, id_a = nova_conta("vendedorA", True)
tok_b, id_b = nova_conta("vendedorB", True)
tok_c, _ = nova_conta("comprador", False)
print("  contas criadas: vendedor A, vendedor B e um comprador sem habilitacao")

URL = "/api/vendedor/anuncios"
boi = {"categoria": "ANIMAL", "especie": "BOVINO", "titulo": "30 bois nelore", "raca": "Nelore",
       "finalidade": "ENGORDA_ABATE", "quantidadeCabecas": 30, "pesoMedioKg": 480, "idadeMeses": 24,
       "cidade": "Campinas", "uf": "SP", "pricingMode": "TOTAL", "precoTotal": 150000}
soja = {"categoria": "GRAOS", "cultura": "SOJA", "subtipo": "CONVENCIONAL_NAO_TRANSGENICA",
        "titulo": "Soja safra nova", "safra": "2025/2026", "embalagem": "GRANEL", "umidadePercentual": 13,
        "quantidadeSacas": 1000, "cidade": "Sorriso", "uf": "MT", "pricingMode": "TOTAL", "precoTotal": 130000}
cafe = {**soja, "cultura": "CAFE", "subtipo": "ARABICA_TIPO6_DURA", "titulo": "Cafe arabica especial",
        "laudoTecnico": {"cafePeneira": "17_18_ACIMA", "cafeCatacaoDefeitos": "5 defeitos", "cafePontuacaoSca": 84}}


def invalido(nome, corpo, campo, token=tok_a):
    s, r = chamar("POST", URL, corpo, token)
    conferir(nome, s == 422 and campo in campos(r), f"{s} {r}")


# ---------------------------------------------------------------- US010
secao("US010: cadastrar lote de animais")
s, a = chamar("POST", URL, boi, tok_a)
conferir("vendedor habilitado cria o lote (201)", s == 201, f"{s} {a}")
conferir("anuncio nasce ATIVO e publicado", a.get("estadoComercial") == "ATIVO" and a.get("publicadoEm"), a)
conferir("anuncio fica ligado ao vendedor que criou", a.get("vendedorId") == id_a, a.get("vendedorId"))
conferir("produto escolhido pelo backend: Boi gordo", a.get("produto", {}).get("nome") == "Boi gordo", a.get("produto"))
conferir("preco por cabeca calculado (5000)", a.get("precoPorCabeca") == 5000, a.get("precoPorCabeca"))
id_boi = a.get("id")
s, _ = chamar("POST", URL, boi)
conferir("sem token: 401", s == 401, s)
s, _ = chamar("POST", URL, boi, tok_c)
conferir("conta sem habilitacao de vendedor: 403", s == 403, s)
s, r = chamar("POST", URL, {"categoria": "ANIMAL"}, tok_a)
conferir("so a categoria: 422 listando os campos", s == 422 and {"raca", "quantidadeCabecas", "precoTotal"} <= set(campos(r)), r)
invalido("quantidade 0: 422", {**boi, "quantidadeCabecas": 0}, "quantidadeCabecas")
invalido("peso medio 0: 422", {**boi, "pesoMedioKg": 0}, "pesoMedioKg")
invalido("preco 100.123: 422", {**boi, "precoTotal": 100.123}, "precoTotal")
invalido("titulo curto: 422", {**boi, "titulo": "abc"}, "titulo")
invalido("UF invalida: 422", {**boi, "uf": "XX"}, "uf")
invalido("raca fora da lista: 422", {**boi, "raca": "Dragao"}, "raca")
invalido("raca OUTRA sem nome: 422", {**boi, "raca": "OUTRA"}, "racaPersonalizada")
invalido("preco por cabeca que nao bate: 422", {**boi, "pricingMode": "PER_HEAD", "precoPorCabeca": 1}, "precoPorCabeca")
invalido("fotos no cadastro: 422", {**boi, "fotos": ["a.jpg"]}, "fotos")
s, a = chamar("POST", URL, {**boi, "pricingMode": "PER_HEAD", "precoPorCabeca": 5000}, tok_a)
conferir("preco por cabeca que bate: 201", s == 201 and a["pricingMode"] == "PER_HEAD", f"{s} {a}")

# ---------------------------------------------------------------- US011
secao("US011: cadastrar lote de graos ou cafe")
s, a = chamar("POST", URL, soja, tok_a)
conferir("cria lote de soja (201)", s == 201, f"{s} {a}")
conferir("soja: produto, preco por saca e toneladas",
         a.get("produto", {}).get("nome") == "Soja em grao" and a.get("precoPorSaca") == 130 and a.get("pesoTotalToneladas") == 60, a)
id_soja = a.get("id")
s, a = chamar("POST", URL, cafe, tok_a)
conferir("cria lote de cafe com laudo (201)", s == 201 and a["laudoTecnico"]["cafePeneira"] == "17_18_ACIMA", f"{s} {a}")
conferir("cafe arabica escolhido pelo backend", a.get("produto", {}).get("nome") == "Cafe arabica", a.get("produto"))
id_cafe = a.get("id")
s, a = chamar("POST", URL, {**cafe, "subtipo": "CONILON_ROBUSTA"}, tok_a)
conferir("cafe conilon escolhe o produto conilon", s == 201 and a["produto"]["nome"] == "Cafe conilon", f"{s} {a}")
for cultura, subtipo, nome in (("MILHO", "COMERCIAL_RACAO", "Milho em grao"), ("TRIGO", "PAO_TIPO1", "Trigo em grao")):
    extra = {"laudoTecnico": {"trigoPhKgHl": 78}} if cultura == "TRIGO" else {}
    s, a = chamar("POST", URL, {**soja, "cultura": cultura, "subtipo": subtipo, **extra}, tok_a)
    conferir(f"{cultura.lower()}: 201 com o produto certo", s == 201 and a["produto"]["nome"] == nome, f"{s} {a}")
s, r = chamar("POST", URL, {"categoria": "GRAOS"}, tok_a)
conferir("so a categoria: 422 listando os campos", s == 422 and {"cultura", "subtipo", "safra", "quantidadeSacas"} <= set(campos(r)), r)
invalido("subtipo de outra cultura: 422", {**soja, "subtipo": "PAO_TIPO1"}, "subtipo")
invalido("safra invalida: 422", {**soja, "safra": "2025/2027"}, "safra")
invalido("umidade 51: 422", {**soja, "umidadePercentual": 51}, "umidadePercentual")
invalido("sacas 0: 422", {**soja, "quantidadeSacas": 0}, "quantidadeSacas")
invalido("embalagem invalida: 422", {**soja, "embalagem": "CAIXA"}, "embalagem")
invalido("toneladas que nao batem: 422", {**soja, "pesoTotalToneladas": 10}, "pesoTotalToneladas")
invalido("preco por saca que nao bate: 422", {**soja, "pricingMode": "PER_SACK", "precoPorSaca": 1}, "precoPorSaca")
invalido("cafe sem peneira: 422", {**cafe, "laudoTecnico": {}}, "laudoTecnico.cafePeneira")
invalido("trigo sem pH: 422", {**soja, "cultura": "TRIGO", "subtipo": "PAO_TIPO1"}, "laudoTecnico.trigoPhKgHl")
invalido("laudo com campo desconhecido: 422", {**soja, "laudoTecnico": {"xyz": 1}}, "laudoTecnico.xyz")
invalido("OUTRO sem cultura personalizada: 422", {**soja, "cultura": "OUTRO", "subtipo": "OUTRO"}, "culturaPersonalizada")

# ---------------------------------------------------------------- US014
secao("US014: abrir e editar anuncio")
url = f"{URL}/{id_boi}"
s, a = chamar("GET", url, token=tok_a)
conferir("dono abre o anuncio com os campos preenchidos", s == 200 and a["titulo"] == "30 bois nelore" and a["raca"] == "Nelore", f"{s} {a}")
s, a = chamar("PATCH", url, {"titulo": "35 bois nelore", "precoTotal": 160000}, tok_a)
conferir("edicao parcial salva titulo e preco", s == 200 and a["titulo"] == "35 bois nelore" and a["precoTotal"] == 160000, f"{s} {a}")
conferir("versao sobe de 1 para 2", a.get("versao") == 2, a.get("versao"))
conferir("o que nao foi enviado continua igual", a.get("raca") == "Nelore" and a.get("quantidadeCabecas") == 30, a)
s, a = chamar("GET", url, token=tok_a)
conferir("alteracao ficou gravada (GET depois do PATCH)", a.get("titulo") == "35 bois nelore", a)
s, a = chamar("PATCH", url, a, tok_a)
conferir("reenviar o formulario inteiro do GET funciona", s == 200, f"{s} {a}")
s, a = chamar("PATCH", url, {"descricao": "Gado manso"}, tok_a)
s, a = chamar("PATCH", url, {"descricao": None}, tok_a)
conferir("descricao pode ser limpa com null", s == 200 and a["descricao"] is None, f"{s} {a}")
s, a = chamar("PATCH", url, {"estadoComercial": "VENDIDO", "vendedorId": id_b}, tok_a)
conferir("estado e dono nao mudam pela edicao", s == 200 and a["estadoComercial"] == "ATIVO" and a["vendedorId"] == id_a, a)
s, r = chamar("PATCH", url, {}, tok_a)
conferir("corpo vazio: 422", s == 422, f"{s} {r}")
for corpo, campo in (({"titulo": "abc"}, "titulo"), ({"precoTotal": 0}, "precoTotal"), ({"quantidadeCabecas": 0}, "quantidadeCabecas"),
                     ({"raca": "OUTRA"}, "racaPersonalizada"), ({"categoria": "GRAOS"}, "categoria"), ({"fotos": ["a.jpg"]}, "fotos")):
    s, r = chamar("PATCH", url, corpo, tok_a)
    conferir(f"edicao invalida {json.dumps(corpo)}: 422", s == 422 and campo in campos(r), f"{s} {r}")
s, a = chamar("PATCH", f"{URL}/{id_soja}", {"quantidadeSacas": 500, "embalagem": "BIG_BAG"}, tok_a)
conferir("edita graos (1000 para 500 sacas): 30 t e R$ 260 por saca", s == 200 and a["pesoTotalToneladas"] == 30 and a["precoPorSaca"] == 260, f"{s} {a}")
s, r = chamar("PATCH", f"{URL}/{id_soja}", {"cultura": "MILHO", "subtipo": "COMERCIAL_RACAO"}, tok_a)
conferir("trocar a cultura: 422", s == 422 and "cultura" in campos(r), f"{s} {r}")
s, a = chamar("PATCH", f"{URL}/{id_cafe}", {"subtipo": "CONILON_ROBUSTA"}, tok_a)
conferir("cafe arabica para conilon troca o produto", s == 200 and a["produto"]["nome"] == "Cafe conilon", f"{s} {a}")

secao("US014: outro usuario nao consegue acessar nem editar")
s, _ = chamar("GET", url, token=tok_b)
conferir("outro vendedor abrindo: 403", s == 403, s)
s, _ = chamar("PATCH", url, {"titulo": "Invadido por outro"}, tok_b)
conferir("outro vendedor editando: 403", s == 403, s)
s, a = chamar("GET", url, token=tok_a)
conferir("anuncio continua intacto depois da tentativa", a.get("titulo") == "35 bois nelore", a.get("titulo"))
s, _ = chamar("GET", url, token=tok_c)
conferir("comprador sem habilitacao: 403", s == 403, s)
s, _ = chamar("GET", url)
conferir("sem token: 401", s == 401, s)
s, _ = chamar("GET", f"{URL}/{SEM_ID}", token=tok_a)
conferir("anuncio inexistente: 404", s == 404, s)

total, ok = len(resultados), sum(resultados)
print(f"\nResultado: {ok} de {total} conferencias OK")
print("TUDO CERTO" if ok == total else "ATENCAO: ha conferencias que falharam (veja as linhas FALHOU acima)")
sys.exit(0 if ok == total else 1)
