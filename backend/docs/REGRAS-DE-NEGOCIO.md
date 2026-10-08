# Regras da sprint 1 que pertencem ao FastAPI

Este é o contrato de implementação para a equipe; não é uma lista de funcionalidades já implementadas. A entrega atual implementa conexão e saúde da API. Definir schemas Pydantic, serviços, repositórios e autenticação antes de expor escrita de dados.

## Divisão de responsabilidades

O banco conserva armazenamento, tipos e tamanhos de colunas, `NOT NULL`, PK, FK, unicidade e índices. Os defaults de UUID, horário de criação e estado inicial são conveniências de inserção; não representam validação nem execução de fluxo. O backend deve validar também valores fornecidos explicitamente.

As validações de formato e domínio, autorização, aprovação, consistência entre estados, proteção do histórico e normalização são responsabilidade do código Python. Uma FK garante que o registro referenciado existe; ela não garante que uma decisão seja aprovada ou que um arquivo possa ser usado pelo usuário autenticado.

## Cadastro — US-005

- Validar formato de e-mail; aplicar `strip().lower()` em todos os caminhos de cadastro, login, alteração e busca. A regra de normalização é uma escolha uniforme da aplicação. O `UNIQUE` compara o texto armazenado e não converte letras.
- Validar tipo `PF`/`PJ`, nomes não vazios, telefone e demais campos obrigatórios; nunca confiar só na interface.
- Validar documentos e normalizar CPF/CNPJ/CEP/UF no backend. CPF não tem unicidade global definida. CNPJ deve respeitar seu formato aceito e validação aplicável; não remover letras de CNPJ alfanumérico.
- Gerar hash seguro da senha antes de salvar em `senha_hash`. Não registrar senhas ou tokens brutos em logs.
- Criar conta, exatamente um perfil compatível e aceite dos termos na mesma transação. Para PJ, exigir representante vigente e endereço principal antes de liberar a conta.
- Conferir existência e vigência da versão aceita. Guardar a referência/hash real dos termos; não inventar conteúdo jurídico ou aceite automático.
- Tratar duplicidade pelo erro de `UNIQUE`; uma consulta prévia sozinha não impede duas requisições concorrentes.

## Autenticação e sessões — US-007

- Comparar hash da senha, limitar tentativas e usar erros de login que não revelem a existência de uma conta.
- Gerar token aleatório e armazenar somente o hash em `sessao`. Fixar expiração maior que a criação.
- Em cada requisição, consultar validade/revogação e `conta.estado = ATIVA`; obter o ID da conta da autenticação.
- Revogar sessões ao encerrar/suspender conta ou trocar credenciais, na mesma transação da alteração. Coordenar login com o mesmo bloqueio da linha de conta para não criar sessão após a revogação.
- Nunca aceitar `conta_id`, `operador_id`, aprovação ou estado administrativo fornecidos pelo cliente como prova de autorização.

## Vendedor, documentos e revisão — US-006

- Criar habilitação na mesma conta; PF precisa de CPF, que não deve ser removido durante a habilitação.
- Validar tamanho positivo, tipo permitido, limites e integridade do upload. O banco guarda metadados; o conteúdo fica em armazenamento privado.
- Conferir dono do arquivo, disponibilidade (`removido_em IS NULL`), dono da verificação e propriedade de documentos substituídos.
- Conferir finalidade e conta da verificação anterior; impedir autorreferências/ciclos. Submissões representam snapshots e não aprovação automática.
- Estados de verificação: `RASCUNHO`, `ENVIADA`, `EM_ANALISE`, `APROVADA`, `REJEITADA`, `CORRECAO_SOLICITADA`. Envio e finalização precisam de datas coerentes; não reabrir uma submissão finalizada sem criar nova revisão.
- Somente operador autenticado, ativo e autorizado pode decidir; justificar decisões. Bloquear a verificação e inserir decisão/atualizar estado e data na mesma transação.
- Habilitação: `PENDENTE`, `HABILITADO`, `REJEITADO`, `SUSPENSO`. `HABILITADO` exige decisão aprovada de `HABILITACAO_VENDEDOR` da mesma conta. Suspensão e habilitação precisam das datas correspondentes.
- Conta ativa, empresa verificada e vendedor habilitado são estados diferentes. Envio de documento não implica aprovação.

## Edição de perfil — US-010

- Definir uma lista explícita de campos editáveis. Impedir alterações comuns em IDs, tipo da conta, proprietário de arquivos/verificações, aprovações e permissões administrativas.
- Autorizar por conta autenticada; retornar somente campos permitidos, nunca hash da senha ou documentos pessoais em respostas públicas.
- Atualizar `atualizado_em` explicitamente. Mudanças sujeitas a análise geram `alteracao_cadastral` e `verificacao`, preservando os valores vigentes.
- Aplicar dados aprovados e registrar `aplicada_em` na mesma transação. Comparar a versão/dados anteriores para não sobrescrever uma edição concorrente.
- Ao trocar representante, encerrar vigência e criar novo registro. Preservar histórico; validar datas e intervalos sem sobreposição. O índice de representante atual impede dois registros com fim nulo, mas não valida intervalos encerrados.
- Validar coordenadas, CEP/UF, pares latitude/longitude e coerência de `principal`/`ativo`. O índice de principal ativo limita a um por conta; exigir sua presença quando necessário é regra da aplicação.

## Histórico, termos e auditoria

- Não reescrever aceites, decisões e eventos de auditoria. Preservar identidade e vigência histórica dos representantes.
- Versões de termos publicadas são imutáveis; permitir somente o encerramento da vigência aberta. Serializar a publicação para impedir intervalos sobrepostos (por exemplo, lock transacional acordado por todos os escritores).
- Registrar eventos sensíveis na mesma transação quando forem dados do banco. Não inserir segredos, tokens nem documentos pessoais completos em `resumo`.
- Validar origem `CONTA`/`ADMIN`/`SISTEMA`, ator coerente e vínculo da sessão. Campos JSON de snapshots/resumos devem ter a estrutura de objeto esperada e tamanho limitado.

## Testes que a equipe deve acrescentar

1. Cadastro PF/PJ incompleto, tipo incompatível, e-mails normalizados concorrentes e CNPJ duplicado.
2. Acesso a conta/documento de terceiro, token expirado/revogado e conta suspensa.
3. Vendedor sem CPF, decisão de outra conta/finalidade, operador sem permissão e dupla decisão concorrente.
4. Edição sensível antes da aprovação, histórico reescrito e propostas concorrentes.
5. Troca de senha versus login concorrente, termos sobrepostos e representante sem vigência coerente.

US-001 usa a conexão e a infraestrutura. US-002 (navegação pública) não exige tabela. Catálogo, anúncios, pedidos, pagamentos, recuperação e segundo fator ficam fora deste recorte.
