# Sprint 3 — banco, integração e passo a passo

Verificação: 04/11/2026. Fonte funcional: “Sprint 3 — Atualizações e Pendências de Banco de Dados.md”, atualizado em 03/11. O arquivo descreve requisitos e funcionalidades demonstradas com armazenamento simulado no navegador; não comprova implementação na API ou no PostgreSQL.

**Resultado da execução:** migration 10 aplicada ao Neon em 04/11/2026. Agora são 30 tabelas; as três novas tabelas e as três colunas de auditoria foram confirmadas com a conexão `safra_app`. Não executar novamente no mesmo banco. Backup final: `.local/neon-antes-sprint3-20261104-144200.dump`, na raiz do workspace, fora do repositório. O catálogo do backup foi verificado; restauração completa não foi ensaiada.

Antes da aplicação, foram testados em transação revertida: cancelamento de rascunho, rejeição de estado inválido, favorito duplicado, FK inexistente, pedido ativo duplicado, estados de solicitação, UF inválida, região longa, normalização de acentos, cascata ao remover comprador/lote e permissões. Após a aplicação: nenhum registro de teste residual, nenhum índice inválido, contas preservadas e respostas HTTP 200 em `/health/db` e `/api/anuncios`. Estes testes validam a migration e a disponibilidade básica; não validam endpoints da sprint 3 ainda inexistentes.

## Diagnóstico

- GitHub `ZinPedro/SafraDireta`, branch `Exec`: commit `54ec3abd512d6ec91e18399a82da0603dd134e6e`, de 27/10/2026. Confirmado pelo conector GitHub.
- Render `safradireta-felipe`: mesmo commit, deploy `dep-dbgerl0mcsoc73a2iu2g` em estado `live`, publicação automática desligada. A compilação aplica ajustes adicionais de publicação; o site não é uma cópia pura do GitHub.
- `https://safradireta-felipe.onrender.com/health/db` respondeu 200 e `database: conectado`. O OpenAPI publicado não tinha rotas de favoritos, Data Room de anúncios, clonagem ou encerramento da sprint 3.
- Neon: banco `safradireta`, endpoint `ep-holy-wave-b5vb3e8u.c-7.us-east-2.aws.neon.tech`. Inspeção anterior à alteração: 27 tabelas, nenhum anúncio, sem as três tabelas novas e sem `encerrado_em`. Nenhuma credencial está incluída neste documento.
- A pasta local `repositorio` já estava na `Exec`, com alterações de publicação ainda não enviadas ao GitHub. Elas foram preservadas.

**Conclusão:** a Exec é a base da versão publicada e da estrutura anterior do Neon, mas não implementa o novo planejamento da sprint 3. Mesmo antes desta alteração, não era correto afirmar compatibilidade total de todos os fluxos (ver inconsistências administrativas abaixo). Alterar o Neon não atualiza automaticamente o GitHub, o backend ou o frontend.

## O que alterar no banco

Arquivo completo: [../sql/10_sprint3.sql](../sql/10_sprint3.sql). Foi escrito para a estrutura da Exec instalada no Neon, não para o modelo conceitual antigo da pasta `banco`.

| Requisito | Implementação proposta na migration 10 |
|---|---|
| Cancelar anúncio | Acrescenta `CANCELADO` ao CHECK de `anuncio.estado_comercial`; permite cancelar rascunho sem preço/publicação |
| Auditoria do encerramento | Acrescenta `encerrado_em`, `motivo_encerramento`, `observacoes_encerramento` |
| Favoritos | Cria `favorito_anuncio`, chave `(conta_id, anuncio_id)`, data e cascata nas duas FKs |
| Documentos do lote | Cria `documento_anuncio`, com tipo, vínculo com anúncio e `arquivo` |
| Pedidos de acesso | Cria `solicitacao_documento`, comprador, mensagem, cinco estados, datas, respondente e motivo de recusa |
| Evitar pedidos duplicados | Índice único para um pedido PENDENTE/APROVADO por comprador e anúncio; permite preservar histórico encerrado |
| Localização | Reutiliza `localizacao_anuncio`; valida as 27 UFs e região com até 120 caracteres |
| Busca e filtros | Índices numéricos, ordenação de ativos/liberados e trigramas em texto/localização normalizados |

Não criar `usuario`, outra tabela de localização ou colunas duplicadas de preço/peso. O modelo existente usa estes nomes:

| Nome no contrato/documento | Persistência existente |
|---|---|
| `usuario_id` | `conta.id`; favorito usa `conta_id` |
| `preco_total` | `anuncio.preco_lote` |
| `municipio` | `localizacao_anuncio.municipio_publico` |
| `uf` | `localizacao_anuncio.uf_publica` |
| `regiao_aproximada` | `localizacao_anuncio.regiao_publica` |
| Cabeças | `lote_animal.quantidade_animais` |
| Peso médio do animal | `lote_animal.peso_medio_kg` |
| Sacas | `lote_agricola.quantidade`, respeitando `unidade_id`; a API atual grava sacas de 60 kg |
| Toneladas | `anuncio.peso_total_kg / 1000` |
| Nome/MIME/tamanho/bucket/SHA-256 | `arquivo.nome_original`, `mime_type`, `tamanho_bytes`, `chave_storage`, `checksum` |

O frontend atual calcula arrobas comerciais estimadas como **peso vivo ÷ 30**, conforme `AnimalAdCreatePage.tsx`, e não ÷ 15. Preservar essa convenção ao implementar o filtro, ou alinhar outra regra explicitamente com a equipe. Não duplicar o peso em outra coluna.

`origem_encerramento` já significa `MANUAL` ou `PEDIDO`. Não usar esse campo para armazenar perda sanitária, venda externa etc.; usar `motivo_encerramento`. Os campos antigos `vendido_em` e `origem_encerramento` continuam exigidos somente em VENDIDO. Para CANCELADO, ambos permanecem nulos. Motivos operacionais foram mantidos como texto porque o documento só fornece exemplos, sem enumeração definitiva.

## Passo a passo para outro banco com a mesma versão

1. Confirmar que o destino é o banco SafraDireta e que as migrations 01 a 08 da Exec já foram instaladas. Não executar a estrutura geral antiga nem reinstalar as sprints anteriores por cima.
2. Fazer backup antes da alteração. Usar conexão do proprietário, via variáveis de ambiente ou gerenciador de conexões; não colocar a senha no GitHub.
3. Abrir `backend/sql/10_sprint3.sql` no editor SQL do Neon e executar o conteúdo inteiro uma única vez. Alternativa com conexão já configurada nas variáveis `PG*`:

   ```powershell
   & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -v ON_ERROR_STOP=1 -f .\backend\sql\10_sprint3.sql
   ```

4. Se ocorrer erro, executar `ROLLBACK;` se a ferramenta mantiver a transação aberta; investigar a divergência. A migration é transacional, não usa remoção de tabelas e não deve ser reaplicada. A existência da tabela não comprova que uma versão diferente do script foi aplicada.
5. Conferir o resultado:

   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'safradireta'
     AND table_name IN ('favorito_anuncio','documento_anuncio','solicitacao_documento');

   SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'safradireta' AND table_name = 'anuncio'
     AND column_name IN ('encerrado_em','motivo_encerramento','observacoes_encerramento');

   SELECT has_table_privilege('safra_app',
     'safradireta.solicitacao_documento','SELECT,INSERT,UPDATE');
   ```

6. Implementar e testar os contratos abaixo. Só então integrar o frontend e publicar a API. Banco preparado não significa sprint funcional.

## Conteúdo para a equipe de backend

### 1. Favoritos — US-025

Implementar POST/DELETE `/api/anuncios/{id}/favoritar` e GET `/api/favoritos`, sempre usando a conta da sessão (nunca um usuário arbitrário recebido no corpo).

```sql
INSERT INTO safradireta.favorito_anuncio(conta_id, anuncio_id)
VALUES (%s, %s) ON CONFLICT (conta_id, anuncio_id) DO NOTHING;

DELETE FROM safradireta.favorito_anuncio
WHERE conta_id = %s AND anuncio_id = %s;

SELECT a.id, a.titulo, a.estado_comercial, a.estado_moderacao, f.criado_em
FROM safradireta.favorito_anuncio f
JOIN safradireta.anuncio a ON a.id = f.anuncio_id
WHERE f.conta_id = %s
ORDER BY f.criado_em DESC, f.anuncio_id
LIMIT %s OFFSET %s;
```

Os `%s` são parâmetros do Psycopg, não substituição por concatenação. Validar visibilidade ao adicionar; na listagem pessoal, conservar o vínculo de itens indisponíveis e retornar apenas metadados permitidos. Não aplicar o filtro público ATIVO à lista pessoal inteira.

### 2. Encerramento — US-016

Implementar PATCH `/api/anuncios/{id}/status`. Dentro de **uma transação**, bloquear a linha com `SELECT ... FOR UPDATE`, validar proprietário, status atual e payload e então:

- Gravar VENDIDO/CANCELADO, motivo, observações e `encerrado_em`; atualizar versão e `atualizado_em`.
- Em VENDIDO, preencher `vendido_em` e a origem técnica MANUAL; em CANCELADO, manter esses dois campos nulos.
- Revogar solicitações PENDENTE/APROVADO daquele anúncio, registrando `atualizado_em` e demais informações de auditoria.
- Bloquear edição/reativação de VENDIDO e CANCELADO com 409.

Rotas de solicitação/aprovação precisam bloquear a mesma linha de anúncio e rever o estado, para impedir aprovação concorrente depois do encerramento. A visualização deve verificar o estado do lote e o pedido aprovado a cada acesso. **A migration não revoga acessos sozinha; não foram criados triggers de aplicação.**

### 3. Data Room — US-013

Implementar as cinco rotas descritas no planejamento: upload, metadados, solicitação, aprovação/recusa e visualização. Dono gerencia documentos/pedidos; comprador autenticado solicita; terceiros recebem 403 conforme contrato.

- Validar PDF/JPEG/PNG/WEBP pelo conteúdo real, além da extensão/MIME declarado; definir o limite de 10 MB em bytes de forma consistente.
- Calcular SHA-256 no servidor e gravar em `arquivo.checksum`; não confiar no hash do navegador.
- Guardar o objeto em bucket **privado**. O Neon guarda metadados, não substitui o bucket.
- Retornar metadados públicos explicitamente permitidos; não expor `chave_storage` ou URL permanente de documentos.
- Autorizar download em cada chamada e usar streaming ou assinatura curta. URL já assinada pode continuar válida até expirar; se a revogação precisa ser imediata, servir por streaming autenticado.
- Ao remover o anúncio, seus vínculos de documento e pedidos somem por cascata. O registro de `arquivo` e o objeto no bucket exigem limpeza controlada após verificar outros usos; cascata relacional não apaga arquivos externos.

### 4. Catálogo, filtros e ordenação — US-020/021/023/024

A API atual usa `busca`, `precoMin`, `precoMax`, `ordem`, `tamanho`, enquanto o novo contrato usa `q`, `preco_min`, `preco_max`, `ordenacao`, `itens_por_pagina`. Adicionar aliases compatíveis ou alinhar o frontend; enviar parâmetros desconhecidos hoje pode simplesmente não filtrar.

- Busca atual: somente `titulo ILIKE`, sem remoção de acentos. Estender a descrição, raça, variedade, fazenda/nome público e localização, com parâmetros seguros.
- Usar a expressão `translate(lower(...))` exatamente como nos índices da migration, também no termo buscado. Os índices não alteram automaticamente as consultas existentes.
- Trigramas oferecem busca aproximada, mas não são um algoritmo fonético português. Definir com o produto o que significa “normalização fonética” e exemplos esperados antes de prometer esse comportamento.
- Rejeitar mínimo maior que máximo com 422. Validar métrica de peso e valores não negativos; retornar erro quando houver faixa sem métrica.
- Traduzir a faixa para a unidade canônica, mantendo o índice: arrobas estimadas × 30 para kg vivos; toneladas × 1000 para kg; cabeças e sacas nas colunas correspondentes. Não comparar sacas com kg sem conversão/unidade.
- Implementar `maior_peso` por peso total em kg, com desempate por ID e política definida para valores nulos.
- Manter ATIVO + LIBERADO no catálogo e na vitrine pública. Contadores devem seguir os mesmos critérios de visibilidade e filtros definidos pelo produto.

### 5. Localização e clonagem — US-032/017

- Receber/salvar `regiao_aproximada` na tabela de localização existente; normalizar município e validar par município/UF pela base oficial atual do IBGE, sem lista restrita de cidades agrícolas. A migration valida UF/tamanho, não instala a base completa de municípios.
- DTO público deve listar campos permitidos: município, UF e região. Não serializar endereço fiscal, referência de endereço, latitude ou longitude, mesmo que existam no modelo.
- GET `/api/anuncios/{id}/clonar`: validar proprietário e devolver atributos estruturais/localização/descrição. Zerar ID novo, estado/auditoria de venda e todas as mídias/documentos; não copiar favoritos nem autorizações. GET apenas prepara o formulário; a criação posterior usa a rota de criação.

### 6. Pendência de Contrato do Catálogo: Exposição de `nome_propriedade` (Fazenda)

- **Diagnóstico:** O endpoint público de catálogo (`GET /api/anuncios`) e a rota de detalhes (`GET /api/anuncios/{id}`) atualmente não retornam o nome da fazenda/propriedade (`nome_propriedade` cadastrado em `safradireta.habilitacao_vendedor`). Com isso, os cards de mercado agropecuário e a ficha técnica dependem de fallback no cliente.
- **Ação necessária para o Backend (próxima iteração/sprint):**
  1. Em `catalogo_service.py` (`listar_catalogo`), adicionar `LEFT JOIN safradireta.habilitacao_vendedor hv ON hv.conta_id = a.vendedor_id` e selecionar `hv.nome_propriedade`, expondo o campo `farmName` (ou `nomePropriedade`) no payload de cada item do catálogo.
  2. Em `catalogo_service.py` (`detalhe_publico`), incluir `hv.nome_propriedade` na consulta de dados públicos do vendedor e retornar `farmName` / `nomePropriedade`.

### 7. Pendência de Alinhamento: `vendedorId` no detalhe do lote e persistência de solicitações de documentos

- **Diagnóstico:** Em `catalogo_service.py` (`detalhe_publico`), o backend remove intencionalmente o `vendedorId` do dicionário público (`anuncio.pop("vendedorId")`). Quando o próprio vendedor abre a URL do seu lote a partir de links diretos ou histórico, a identificação de posse do anúncio no cliente (`isOwner`) ficava comprometida.
- **Ação necessária para o Backend (próxima iteração/sprint):**
  1. Manter a rota de detalhes autenticada (`GET /api/anuncios/{id}`) para o proprietário com o `vendedor_id` íntegro no payload.
  2. Assegurar que `GET /api/anuncios/{id}/documentos` liste todas as solicitações registradas no PostgreSQL para aquele lote quando o token do vendedor for fornecido, permitindo que a lista do backend reflita fielmente os pedidos aprovados e pendentes.

### 8. Pendência no Catálogo: Inclusão de `la.raca` e `la.raca_personalizada` no SELECT da listagem pública

- **Diagnóstico:** A função `listar_catalogo` em `backend/app/services/catalogo_service.py` seleciona `la.quantidade_animais`, mas omitiu `la.raca` e `la.raca_personalizada` na query SQL de listagem (`GET /api/anuncios`). Dessa forma, a miniatura dos cards do catálogo vinha sem a informação de raça da API, dependendo de inferência no cliente, enquanto a rota de detalhes (`GET /api/anuncios/{id}`) trazia a raça normalmente.
- **Ação necessária para o Backend (próxima iteração/sprint):**
  1. Em `catalogo_service.py` (`listar_catalogo`), acrescentar `la.raca, la.raca_personalizada` nas colunas do `SELECT` de `linhas`.
  2. No loop de montagem dos itens, popular `item.update({"raca": r["raca"], "racaPersonalizada": r["raca_personalizada"]})` para lotes de animais.

## Ambiguidades a alinhar

- O documento chama PAUSADO de encerrado na parte de favoritos, mas define estados finais como VENDIDO/CANCELADO. Sugestão: PAUSADO = indisponível temporário; VENDIDO/CANCELADO = encerrado; todos permanecem nos favoritos. Confirmar nomes das abas.
- Definir enumeração definitiva de motivos de encerramento, normalização fonética e regras de contadores.
- Documentos: definir se nova solicitação pode ser aberta após recusa/revogação. O banco permite histórico e no máximo um acesso ativo.

## Inconsistências anteriores da Exec, fora da migration 10

`backend/app/services/admin_service.py` consulta `safradireta.documento_empresa` e grava `safradireta.punicao_governanca`. Essas tabelas não existem no Neon inspecionado; os SQLs da Exec criam `documento_verificacao` e `historico_punicao` com colunas diferentes. As rotas administrativas precisam ser adaptadas ao modelo real — criar tabelas duplicadas apenas para esconder a divergência não resolve os fluxos. O health check confirma conexão, não valida essas operações.

## Entrega e publicação

A migration 10 e este guia registram a estrutura aplicada no Neon para que a equipe possa reproduzi-la nos demais ambientes. O Render está com publicação automática desligada; a disponibilização dos novos endpoints depende de implementação e novo deploy.
