# Contrato da API SafraDireta, Sprint 1

Versao: rascunho 0.1. Status: PROPOSTA para alinhar com Pedro (front) e Felipe (banco).
Itens marcados com [DECIDIR] dependem de resposta de alguem e podem mudar.

## 1. Convencoes gerais

* Base: `http://localhost:8000`, todas as rotas de negocio comecam com `/api`.
* Formato: JSON, nomes de campo em camelCase (o mesmo do front). No Python usamos snake_case internamente e alias do Pydantic converte.
* Autenticacao: header `Authorization: Bearer <token>`. O token e opaco (aleatorio), guardado no servidor como hash e pode ser revogado no logout. Sem cookies, entao CORS com `allow_credentials=false`.
* Normalizacao feita pelo back (o front ja manda assim, mas o back nao confia): email em minusculo e sem espacos, CNPJ em maiusculo sem pontuacao, CPF e CEP so digitos, telefone no formato `+55DDDNUMERO`.
* Datas em ISO 8601 UTC, por exemplo `2026-10-08T15:30:00Z`.
* Ids de conta e de verificacao seguem o tipo do banco (conferir com Felipe) e sempre trafegam como string.

### Formato unico de erro

Todo erro tratado pelo back responde assim:

```json
{
  "erro": {
    "codigo": "DADOS_INVALIDOS",
    "mensagem": "Corrija os campos destacados.",
    "campos": { "email": "Informe um email valido." }
  }
}
```

Regras:
* `campos` usa exatamente os nomes dos campos do formulario do front (`cnpj`, `razaoSocial`, `repCpf`, `email`, `senha`...), para o front pintar o erro no campo certo.
* `campos` e `{}` quando o erro nao e de um campo.

Codigos usados:
* 401 `NAO_AUTENTICADO`: token ausente, invalido, expirado ou revogado, ou login errado.
* 403 `PROIBIDO`: logado, mas sem permissao (ex: nao e vendedor habilitado).
* 404 `NAO_ENCONTRADO`: recurso ou rota inexistente.
* 409 `CONFLITO`: duplicado (email, CNPJ, CPF) ou transicao de estado invalida.
* 422 `DADOS_INVALIDOS`: validacao falhou.
* 429 `MUITAS_TENTATIVAS`: limite de login excedido.
* 503: banco indisponivel (rotas `/health`, formato do FastAPI: `{"detail": "..."}`).

## 2. Rotas publicas

### GET /health e GET /health/db
Ja existem (Felipe). `/health/db` responde 503 se o banco cair.

### GET /api/termos/vigente   (apoia US003)
Devolve o termo de uso vigente, para o front exibir antes do aceite.

200:
```json
{ "id": "1", "versao": "1.0", "texto": "...", "publicadoEm": "2026-10-01T00:00:00Z" }
```
404 se nao houver termo cadastrado. [DECIDIR] Felipe precisa fazer o seed de `termo_uso`.

### Qualquer rota inexistente   (US002)
404 com o formato de erro acima, nunca uma pagina HTML nem stack trace.

## 3. Cadastro e autenticacao

### POST /api/auth/register   (US003, conta pessoa fisica)

Publica. Cria a conta PF e o aceite do termo vigente numa unica transacao. CPF nao e pedido aqui.

Entrada (igual ao `RegistrationRequest` do front):
```json
{
  "name": "Maria da Silva",
  "email": "maria@exemplo.com",
  "phone": "+5519999998888",
  "password": "senhaForte123",
  "acceptedTerms": true,
  "intent": "buyer"
}
```

Validacoes:
* `name`: 2 a 150 caracteres apos limpar espacos duplicados.
* `email`: formato valido, ate 254 caracteres, unico.
* `phone`: `+55`, DDD de 2 digitos (primeiro nao e 0), 8 ou 9 digitos.
* `password`: 8 a 128 caracteres.
* `acceptedTerms`: precisa ser `true`. O back grava o aceite com o termo vigente (o front nao envia id de termo).
* `intent`: `buyer` ou `seller`.

Resposta 201:
```json
{
  "token": "<token opaco>",
  "expiraEm": "2026-10-09T03:30:00Z",
  "conta": { "id": "10", "tipo": "PF", "nome": "Maria da Silva", "email": "maria@exemplo.com" },
  "vendedor": { "estado": null },
  "proximoPasso": null
}
```
Se `intent` for `seller`, a conta e criada normalmente (compra liberada) e `proximoPasso` vem `"SOLICITAR_HABILITACAO_VENDEDOR"`, porque o CPF so e exigido na solicitacao de habilitacao. [DECIDIR] se o cadastro ja devolve sessao (recomendado) ou se o front redireciona para o login.

Erros: 422 (campos), 409 com `campos.email`.

### POST /api/auth/register-corporate   (US003 e US004, conta pessoa juridica)

Publica. Numa unica transacao cria: conta, empresa, representante, endereco principal e aceite do termo, mais uma verificacao inicial. Corresponde ao `CorporateRegistrationData` da dev (commit 1fcf041).

Entrada:
```json
{
  "company": {
    "cnpj": "12ABC34501DE35",
    "razaoSocial": "Cooperativa Exemplo LTDA",
    "nomeFantasia": "Coop Exemplo",
    "naturezaJuridica": "LTDA"
  },
  "address": {
    "cep": "13000000", "logradouro": "Rua A", "numero": "100",
    "complemento": "Galpao 2", "bairro": "Centro", "cidade": "Campinas", "uf": "SP"
  },
  "representative": { "nome": "Joao Souza", "cpf": "12345678909", "vinculo": "Socio-administrador" },
  "documents": {
    "hasCompanyDoc": true,
    "hasRepresentativeDoc": true,
    "fileNames": ["contrato.pdf", "rg.jpg"]
  },
  "access": {
    "email": "contato@empresa.com.br",
    "telefone": "+551933334444",
    "senha": "senhaForte123",
    "acceptedTerms": true
  }
}
```
Campos opcionais: `nomeFantasia`, `naturezaJuridica`, `complemento`.

Validacoes no back:
* CNPJ alfanumerico: 14 caracteres, 2 ultimos numericos, digitos verificadores pelo algoritmo oficial (valor do caractere = codigo ASCII menos 48). Unico.
* CPF do representante: 11 digitos, nao pode ser sequencia repetida, digitos verificadores.
* CEP 8 digitos, UF uma das 27 siglas, senha 8 a 128, email unico, `acceptedTerms` verdadeiro.
* `documents.hasCompanyDoc` e `hasRepresentativeDoc` precisam ser `true`.

Resposta 201:
```json
{
  "status": "registered_pending_validation",
  "protocol": "VER-000123",
  "message": "Cadastro recebido. Seus documentos serao analisados pela equipe.",
  "token": "<token opaco>",
  "expiraEm": "2026-10-09T03:30:00Z",
  "conta": { "id": "11", "tipo": "PJ", "nome": "Cooperativa Exemplo LTDA", "email": "contato@empresa.com.br" }
}
```
`protocol` e derivado do id da verificacao. A conta nasce ATIVA, mas a empresa so compra e vende depois da verificacao APROVADA. Ate la ela navega.

Erros:
* 409 com `campos.cnpj` ou `campos.email` (o front trata como `duplicate`).
* 422 com `campos` (o front trata como `validation_error`).

Pendencias [DECIDIR]:
1. Upload real: hoje o front so envia nomes de arquivo. Proposta do back, em dois passos: este cadastro devolve `token`; depois o front envia os arquivos em `POST /api/arquivos` (secao 5) ligados a verificacao. Ate la a verificacao fica em RASCUNHO e so vira ENVIADA com os documentos.
2. Mapeamento: `cidade` vira `municipio` no banco; `vinculo` e `naturezaJuridica` precisam de coluna ou enum (conferir com Felipe).
3. EIRELI foi extinta em 2021, sugerir ao Pedro remover da lista.
4. Confirmar com o cliente a regra PJ: um unico cadastro, compra e venda so apos validacao.

### POST /api/auth/login   (US005)

Publica. Entrada:
```json
{ "email": "maria@exemplo.com", "password": "senhaForte123" }
```
Resposta 200: mesmo corpo do registro PF (`token`, `expiraEm`, `conta`, `vendedor`).

Regras:
* Mesmo erro 401 `NAO_AUTENTICADO` para email inexistente e senha errada, sem revelar qual foi, e com tempo de resposta parecido nos dois casos.
* Conta SUSPENSA ou ENCERRADA: 403 `PROIBIDO`.
* Limite de tentativas por email e por IP (em memoria): excedeu, 429.

### POST /api/auth/logout   (US005)
Exige login. Revoga a sessao atual. Resposta 204 sem corpo.

### GET /api/auth/me   (US005)
Exige login. 200:
```json
{
  "conta": { "id": "10", "tipo": "PF", "nome": "Maria da Silva", "email": "maria@exemplo.com", "telefone": "+5519999998888" },
  "vendedor": { "estado": "PENDENTE" },
  "verificacao": null
}
```
`vendedor.estado` pode ser `null`, `PENDENTE`, `HABILITADO`, `REJEITADO` ou `SUSPENSO`. Para PJ, `verificacao` traz `{ "protocol": "VER-000123", "estado": "ENVIADA" }`.

## 4. Perfil   (US008)

### GET /api/perfil
Exige login. Devolve os dados editaveis da conta (PF: nome, telefone, endereco; PJ: dados da empresa e do representante).

### PATCH /api/perfil
Exige login. Atualiza so os campos enviados, com as mesmas validacoes do cadastro. Regras:
* O `contaId` vem sempre do token, nunca do corpo.
* Trocar email exige a senha atual no campo `senhaAtual`. Reutiliza a regra de email unico (409).
* Campos sensiveis (CPF, CNPJ) nao mudam por aqui: geram um registro em `alteracao_cadastral` para analise. [DECIDIR] com Felipe e cliente.
* Toda alteracao gera um evento de auditoria.

Resposta 200: perfil atualizado.

## 5. Vendedor   (US004)

### POST /api/vendedor/habilitacao
Exige login (PF). Solicita virar vendedor.

Entrada:
```json
{ "cpf": "12345678909" }
```
Regras: valida CPF, grava no perfil, cria `habilitacao_vendedor` em PENDENTE e uma verificacao do tipo habilitacao. 409 se ja existe habilitacao ativa ou CPF ja usado por outra conta.
Resposta 201: `{ "estado": "PENDENTE", "protocol": "VER-000124" }`.

### GET /api/vendedor/habilitacao
Exige login. 200: `{ "estado": "PENDENTE", "protocol": "VER-000124", "motivo": null }`. 404 se nunca solicitou.

### POST /api/arquivos   (upload de documento) [DECIDIR]
Exige login. `multipart/form-data` com os campos `verificacaoId`, `tipoDocumento` e `arquivo`. Aceita PDF, JPG e PNG ate 10 MB, valida tipo pelo conteudo e nao pelo nome. Resposta 201: `{ "id": "55", "nome": "contrato.pdf", "tamanho": 120394 }`. Define onde guardar (disco local ou storage) antes de implementar.

### Guarda para funcoes de vendedor
Qualquer rota futura de venda usa a dependencia `exige_vendedor_habilitado`: responde 403 `PROIBIDO` se a conta nao tiver `habilitacao_vendedor.estado = HABILITADO` com decisao APROVADA do tipo habilitacao.

## 6. Resumo por historia

* US001 (executar de ponta a ponta): `/health`, `/health/db`, CORS, formato de erro, rodar front e back juntos.
* US002 (areas publicas): `GET /api/termos/vigente`, 404 padronizado, rotas publicas sem token.
* US003 (cadastrar conta): `POST /api/auth/register` e `POST /api/auth/register-corporate`.
* US004 (cadastrar-se como vendedor): `POST` e `GET /api/vendedor/habilitacao`, `POST /api/arquivos`, estados da verificacao e da habilitacao.
* US005 (autenticar e proteger): `login`, `logout`, `me`, dependencia `conta_autenticada`, limite de tentativas.
* US008 (editar perfil): `GET` e `PATCH /api/perfil`.

## 7. Decisoes em aberto

1. Registro devolve sessao ou manda para o login? (recomendado: devolve)
2. Upload de documentos PJ: dois passos, como proposto? Onde guardar os arquivos?
3. Seed de `termo_uso`, operador de teste e role administrativa (Felipe).
4. Valores oficiais dos enums de estado e colunas para `vinculo` e `naturezaJuridica` (Felipe).
5. Regra PJ de compra e venda (cliente).
6. Alteracao de CPF e CNPJ: direta ou via `alteracao_cadastral`?
