# Contrato da API SafraDireta, Sprint 1

Versao: rascunho 0.3 (atualizada em 08/10/2026). Status: PROPOSTA para alinhar com Pedro (front) e Felipe (banco).
Itens marcados com [DECIDIR] dependem de resposta de alguem e podem mudar.
Itens marcados com [IMPLEMENTADO] ja existem na branch `back`. Os itens de perfil, vendedor e cadastro PJ foram validados na mao (`/docs`); ainda faltam testes automaticos de integracao para eles.

## 1. Convencoes gerais

* Base: `http://localhost:8000`, todas as rotas de negocio comecam com `/api`.
* Formato: JSON, nomes de campo em camelCase (o mesmo do front). No Python usamos snake_case internamente e alias do Pydantic converte.
* Autenticacao: header `Authorization: Bearer <token>`. O token e opaco (aleatorio), guardado no servidor como hash e pode ser revogado no logout. Sem cookies, entao CORS com `allow_credentials=false`.
* Normalizacao feita pelo back (o front ja manda assim, mas o back nao confia): email em minusculo e sem espacos, CNPJ em maiusculo sem pontuacao, CPF e CEP so digitos, telefone no formato `+55DDDNUMERO`.
* Datas em ISO 8601 UTC, por exemplo `2026-10-08T15:30:00Z`.
* Ids sao UUID (ex: `5a139884-502b-43b7-ab05-bbcb481e4875`) e sempre trafegam como string.

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
* 403 `PROIBIDO`: logado, mas sem permissao (ex: nao e vendedor habilitado) ou conta suspensa/encerrada.
* 404 `NAO_ENCONTRADO`: recurso ou rota inexistente.
* 405 `METODO_NAO_PERMITIDO`: a rota existe, mas nao aceita aquele metodo HTTP (a resposta traz o cabecalho `Allow`).
* 409 `CONFLITO`: duplicado (email, CNPJ, CPF) ou transicao de estado invalida.
* 422 `DADOS_INVALIDOS`: validacao falhou.
* 429 `MUITAS_TENTATIVAS`: limite de login excedido.
* 503: banco indisponivel (rotas `/health`, formato do FastAPI: `{"detail": "..."}`).
* 503 `TERMO_INDISPONIVEL`: cadastro sem termo de uso vigente no banco.

## 2. Rotas publicas

### GET /health e GET /health/db
Ja existem (Felipe). `/health/db` responde 503 se o banco cair.

### GET /api/termos/vigente   (US002, apoia o aceite do cadastro)   [IMPLEMENTADO]
Publica (sem token). Devolve a versao vigente do termo de uso. O banco guarda a referencia do conteudo e o hash, nao o texto; o front mostra o termo a partir da `referenciaConteudo`.

200:
```json
{ "versao": "1.0", "referenciaConteudo": "termos/v1.0", "vigenteDesde": "2026-10-01T00:00:00Z" }
```
404 `NAO_ENCONTRADO` se nao houver termo vigente. O seed de desenvolvimento (`sql/03_seed_dev.sql`) cria o termo 1.0.

### Qualquer rota inexistente   (US002)   [IMPLEMENTADO]
404 `NAO_ENCONTRADO` com o formato de erro acima, nunca uma pagina HTML nem stack trace. Metodo errado numa rota que existe responde 405 `METODO_NAO_PERMITIDO`.

## 3. Cadastro e autenticacao

### POST /api/auth/register   (US003, conta pessoa fisica)   [IMPLEMENTADO]

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
  "conta": { "id": "5a139884-502b-43b7-ab05-bbcb481e4875", "tipo": "PF", "nome": "Maria da Silva", "email": "maria@exemplo.com" },
  "vendedor": { "estado": null },
  "proximoPasso": null
}
```
Se `intent` for `seller`, a conta e criada normalmente (compra liberada) e `proximoPasso` vem `"SOLICITAR_HABILITACAO_VENDEDOR"`, porque o CPF so e exigido na solicitacao de habilitacao. Decidido: o cadastro ja devolve a sessao, o front nao precisa chamar o login em seguida.

Erros: 422 (campos), 409 com `campos.email`, 503 `TERMO_INDISPONIVEL` se nao houver termo vigente.

### POST /api/auth/register-corporate   (US003 e US004, conta pessoa juridica)   [IMPLEMENTADO]

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
  "protocol": "7d1c0b52-3e4a-4c2f-9a6b-0e5f8a1d2c34",
  "message": "Cadastro criado. Aguardando envio dos documentos para analise.",
  "token": "<token opaco>",
  "expiraEm": "2026-10-09T03:30:00Z",
  "conta": { "id": "9c2f4b1e-7d3a-4e58-8a0b-1f6d2c9e3a47", "tipo": "PJ", "nome": "Cooperativa Exemplo LTDA", "email": "contato@empresa.com.br" }
}
```
`protocol` e o id (UUID) da verificacao do tipo CADASTRO_PJ, criada em RASCUNHO. Os nomes dos arquivos enviados ficam guardados na verificacao; o arquivo em si ainda nao e enviado. A conta nasce ATIVA, mas a empresa so compra e vende depois da verificacao APROVADA. Ate la ela navega.

Erros:
* 409 com `campos.cnpj` ou `campos.email` (o front trata como `duplicate`).
* 422 com `campos` em chaves planas, iguais aos campos do formulario: `cnpj`, `razaoSocial`, `nomeFantasia`, `naturezaJuridica`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `repNome`, `repCpf`, `repVinculo`, `companyDoc`, `representativeDoc`, `email`, `telefone`, `senha`, `acceptedTerms` (o front trata como `validation_error`). `confirmarSenha` e validado so no front.

Pendencias [DECIDIR]:
1. Upload real: hoje o front so envia nomes de arquivo. Proposta do back, em dois passos: este cadastro devolve `token`; depois o front envia os arquivos em `POST /api/arquivos` (secao 5) ligados a verificacao. Ate la a verificacao fica em RASCUNHO e so vira ENVIADA com os documentos.
2. Mapeamento: `cidade` vira `municipio` no banco; `vinculo` e `naturezaJuridica` precisam de coluna ou enum (conferir com Felipe).
3. EIRELI foi extinta em 2021, sugerir ao Pedro remover da lista.
4. Confirmar com o cliente a regra PJ: um unico cadastro, compra e venda so apos validacao.

### POST /api/auth/login   (US005)   [IMPLEMENTADO]

Publica. Entrada:
```json
{ "email": "maria@exemplo.com", "password": "senhaForte123" }
```
O email e normalizado (espacos e maiusculas). Resposta 200: mesmo corpo do registro PF (`token`, `expiraEm`, `conta`, `vendedor`, `proximoPasso` sempre `null`).

Regras:
* Mesmo erro 401 `NAO_AUTENTICADO` ("Email ou senha incorretos.") para email inexistente e senha errada, sem revelar qual foi, e com tempo de resposta parecido nos dois casos.
* Conta SUSPENSA ou ENCERRADA: 403 `PROIBIDO`, mas so depois de a senha estar correta.
* Limite de tentativas FALHAS, em memoria: 5 por email e 20 por IP em 15 minutos. Excedeu: 429 `MUITAS_TENTATIVAS`, mesmo com a senha certa, ate a janela passar. Login correto zera a contagem do email.
* Campos ausentes: 422 com `campos.email` e/ou `campos.password`.

### POST /api/auth/logout   (US005)   [IMPLEMENTADO]
Exige login (`Authorization: Bearer <token>`). Revoga so a sessao do token usado; outras sessoes da mesma conta continuam validas. Resposta 204 sem corpo. Depois disso, o mesmo token passa a responder 401.

### GET /api/auth/me   (US005)   [IMPLEMENTADO]
Exige login. 200:
```json
{
  "conta": { "id": "5a139884-502b-43b7-ab05-bbcb481e4875", "tipo": "PF", "nome": "Maria da Silva", "email": "maria@exemplo.com" },
  "vendedor": { "estado": null },
  "expiraEm": "2026-10-09T03:30:00Z"
}
```
`vendedor.estado` pode ser `null`, `PENDENTE`, `HABILITADO`, `REJEITADO` ou `SUSPENSO`. Nao devolve `telefone`. Para conta PJ devolve tambem `verificacao`: `{ "protocol": "<uuid>", "tipo": "CADASTRO_PJ", "estado": "RASCUNHO" }` (ausente ou `null` em conta PF).

## 4. Perfil   (US008)   [IMPLEMENTADO]

### GET /api/perfil
Exige login. 200: `id`, `tipo`, `nome`, `email`, `telefone`, `estado` e a lista `enderecos` (`rotulo`, `logradouro`, `numero`, `complemento`, `bairro`, `municipio`, `uf`, `cep`, `pais`, `referenciaAcesso`, `principal`).
* PF: acrescenta `cpf`.
* PJ: acrescenta `razaoSocial`, `nomeFantasia`, `cnpj` e a lista `representantes` (`id`, `nome`, `cpf`, `vinculo`, `inicioVigencia`, `fimVigencia`).

### PATCH /api/perfil
Exige login. Corpo com `name` e/ou `phone` (so o que for enviado muda; nenhum pode ser `null`; corpo vazio da 422). Telefone no formato `+55DDDNUMERO`. O `contaId` vem sempre do token. Gera evento de auditoria.
Resposta 200: `{ "message": "...", "conta": { "id", "tipo", "nome", "email" } }`.

### PATCH /api/perfil/email
Exige login. Corpo: `{ "novoEmail": "novo@exemplo.com", "senhaAtual": "..." }`.
* 422 com `campos.senhaAtual` se a senha atual estiver errada (nao e 401, para o front nao deslogar o usuario); 409 se o email ja pertence a outra conta; 422 se o email for invalido.
* Se o email enviado ja for o da conta, responde 200 sem alterar nada.
Resposta 200: `{ "message": "Email atualizado com sucesso.", "email": "novo@exemplo.com" }`.
Observacao: o contrato antigo previa a troca de email dentro do `PATCH /api/perfil`; ficou em rota separada. [DECIDIR] com Pedro.

Campos sensiveis (CPF, CNPJ) nao mudam por aqui. [DECIDIR] com Felipe e cliente: alteracao direta ou via `alteracao_cadastral`?

## 5. Vendedor   (US004)   [IMPLEMENTADO]

### POST /api/vendedor/habilitacao
Exige login. So conta PF (conta PJ recebe 403 `PROIBIDO`). Solicita virar vendedor.

Entrada:
```json
{ "cpf": "52998224725", "possuiTransportadora": false, "observacaoTransportadora": null }
```
`observacaoTransportadora` e opcional (maximo 500 caracteres). Tambem aceita os mesmos nomes em snake_case.
Regras: valida CPF; 409 se o CPF cadastrado na conta for diferente, se o CPF pertencer a outra conta (`campos.cpf`) ou se ja existe habilitacao ativa; cria `habilitacao_vendedor` em PENDENTE e uma verificacao do tipo HABILITACAO_VENDEDOR em RASCUNHO.
Resposta 201: `{ "message": "...", "estado": "PENDENTE", "protocol": "<uuid>" }`.

### GET /api/vendedor/habilitacao
Exige login. 200: `{ "possuiHabilitacao": true, "estado": "PENDENTE", "possuiTransportadora": false, "observacaoTransportadora": null }`. 404 `NAO_ENCONTRADO` se nunca solicitou.

### POST /api/arquivos   (upload de documento) [DECIDIR]
Exige login. `multipart/form-data` com os campos `verificacaoId`, `tipoDocumento` e `arquivo`. Aceita PDF, JPG e PNG ate 10 MB, valida tipo pelo conteudo e nao pelo nome. Resposta 201: `{ "id": "3b7e1d52-6a0c-4f9e-9d14-72c8a5e0b6f1", "nome": "contrato.pdf", "tamanho": 120394 }`. Define onde guardar (disco local ou storage) antes de implementar.

### Guarda para funcoes de vendedor
Qualquer rota futura de venda usa a dependencia `exige_vendedor_habilitado`: responde 403 `PROIBIDO` se a conta nao tiver `habilitacao_vendedor.estado = HABILITADO` com decisao APROVADA do tipo habilitacao.

## 6. Resumo por historia

* US001 (executar de ponta a ponta): `/health`, `/health/db`, CORS, formato de erro, rodar front e back juntos.
* US002 (areas publicas): `GET /api/termos/vigente`, 404 padronizado, rotas publicas sem token.
* US003 (cadastrar conta): `POST /api/auth/register` e `POST /api/auth/register-corporate`.
* US004 (cadastrar-se como vendedor): `POST` e `GET /api/vendedor/habilitacao`, `POST /api/arquivos`, estados da verificacao e da habilitacao.
* US005 (autenticar e proteger): `login`, `logout`, `me`, dependencia `conta_autenticada`, limite de tentativas.
* US008 (editar perfil): `GET` e `PATCH /api/perfil`, `PATCH /api/perfil/email`.

## 7. Decisoes em aberto

1. Registro devolve sessao ou manda para o login? (decidido: devolve)
2. Upload de documentos PJ: dois passos, como proposto? Onde guardar os arquivos?
3. Role administrativa para as decisoes de verificacao, ex: `safra_admin` (Felipe). O seed de termo e operador de teste ja existe em `sql/03_seed_dev.sql`.
4. Valores oficiais dos enums de estado e colunas para `vinculo` e `naturezaJuridica` (Felipe).
5. Regra PJ de compra e venda (cliente).
6. Alteracao de CPF e CNPJ: direta ou via `alteracao_cadastral`?
7. Todo cadastro PJ ja nasce com habilitacao de vendedor PENDENTE. Confirmar com o cliente.
