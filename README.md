# SafraDireta

Projeto acadêmico da disciplina de Gerenciamento de Projetos da PUC Campinas, voltado à comercialização de lotes e à negociação entre compradores e vendedores.

Este README reúne as informações iniciais do projeto e o detalhamento dos cards da Sprint 1.

## Objetivo da Sprint 1

Construir a base integrada do SafraDireta, permitindo:

- Executar frontend, backend e banco de dados de forma integrada.
- Navegar pelas páginas públicas.
- Criar uma conta.
- Entrar na conta e acessar recursos protegidos.
- Consultar e editar o perfil.
- Habilitar o cadastro de vendedor na mesma conta.

A Sprint 1 contempla **US-001, US-002, US-003, US-004, US-005 e US-008**, totalizando **90 pontos**.

A publicação completa de anúncios pertence à US-010 e fica fora desta Sprint. Os cards atuais preparam a habilitação de vendedor e as regras de autorização necessárias para essa funcionalidade.

Da mesma forma, o acesso à página de mercado não significa que o catálogo completo será entregue nesta Sprint.

## Equipe

| Integrante | Área principal |
| --- | --- |
| Pedro | Frontend, interface e experiência do usuário |
| Lucas | Backend, arquitetura, APIs e autenticação |
| Eloise | Backend, regras de negócio, autorização e validações |
| Felipe | Banco de dados, modelagem, migrations e restrições |
| Tiago | Apoio entre áreas, integração, testes e infraestrutura |

Os responsáveis indicados nas tarefas são referências de colaboração. A equipe pode redistribuir o trabalho conforme a necessidade.

### Legenda das tarefas

| Sigla | Área |
| --- | --- |
| PLAN | Planejamento e definição técnica |
| UX | Experiência do usuário |
| FE | Frontend |
| BE | Backend |
| DB | Banco de dados |
| INT | Integração |
| INFRA | Infraestrutura e configuração do ambiente |
| TEST | Testes e validação |

## Cards da Sprint 1

| Card | História | Pontos |
| --- | --- | ---: |
| US-001 | Executar o SafraDireta de ponta a ponta | 18 |
| US-002 | Navegar pelas áreas públicas do SafraDireta | 12 |
| US-003 | Cadastrar conta | 18 |
| US-004 | Cadastrar-se como vendedor | 18 |
| US-005 | Autenticar conta e proteger recursos | 12 |
| US-008 | Editar perfil | 12 |
| **Total** | | **90** |

Os critérios de aceite descrevem o comportamento esperado. As tarefas descrevem o trabalho técnico previsto para alcançar esse comportamento.

Os checklists começam em aberto e devem ser atualizados conforme a implementação e a validação das entregas.

---

## US-001 — Executar o SafraDireta de ponta a ponta

**Módulo:** Fundação e Navegação  
**Pontos:** 18  
**Dependências:** Nenhuma história funcional anterior.

### História de usuário

Como equipe de desenvolvimento, quero possuir uma estrutura mínima funcional de frontend, backend e banco de dados, para conseguir desenvolver e demonstrar o SafraDireta de forma integrada.

### Descrição

Estabelecer a base técnica executável do produto, garantindo que as principais camadas possam iniciar, comunicar-se entre si e sustentar o desenvolvimento das demais funcionalidades.

### Critérios de aceite

- [ ] Frontend e backend podem ser iniciados no ambiente de desenvolvimento.
- [ ] O backend consegue acessar o banco de dados.
- [ ] O frontend consegue obter uma resposta válida do backend.
- [ ] A equipe consegue reproduzir a execução seguindo as instruções do projeto.

### Tarefas

- [ ] **Lucas + Felipe — PLAN:** Definir arquitetura inicial e responsabilidades das camadas.
- [ ] **Felipe — DB:** Configurar banco de desenvolvimento e migrations.
- [ ] **Lucas + Eloise — BE:** Criar backend base e health check.
- [ ] **Pedro — FE:** Criar estrutura base do frontend.
- [ ] **Pedro + Tiago — INT:** Integrar chamada inicial frontend-backend.
- [ ] **Tiago — INFRA:** Documentar variáveis e execução.
- [ ] **Tiago + Eloise — TEST:** Validar instalação em ambiente limpo.

---

## US-002 — Navegar pelas áreas públicas do SafraDireta

**Módulo:** Fundação e Navegação  
**Pontos:** 12  
**Dependências:** US-001.

### História de usuário

Como visitante, quero navegar pelas páginas públicas principais do SafraDireta, para encontrar mercado, cadastro e login sem precisar conhecer endereços específicos.

### Descrição

Criar a navegação pública que orienta o primeiro contato com o sistema e fornece acesso aos principais pontos de entrada do marketplace.

### Critérios de aceite

- [ ] Existe navegação clara para início, mercado, cadastro e login.
- [ ] Os links levam para as páginas corretas.
- [ ] Uma rota inexistente apresenta uma página de erro compreensível.
- [ ] A navegação permanece utilizável nos tamanhos de tela definidos pela equipe.

### Tarefas

- [ ] **Pedro — PLAN/UX:** Mapear páginas públicas e fluxo de navegação.
- [ ] **Pedro — FE:** Criar estrutura compartilhada de página e rotas.
- [ ] **Pedro + Tiago — FE:** Implementar cabeçalho/menu.
- [ ] **Lucas — BE:** Garantir acesso público aos recursos necessários.
- [ ] **Tiago — TEST:** Validar navegação e rota inexistente.

---

## US-003 — Cadastrar conta

**Módulo:** Conta, Autenticação e Perfil  
**Pontos:** 18  
**Dependências:** US-001 e navegação de acesso da US-002.

### História de usuário

Como novo usuário, quero criar uma conta no SafraDireta, para pesquisar produtos, realizar compras e acessar os recursos básicos da plataforma.

### Descrição

Toda pessoa entra no sistema por uma conta comum. Essa conta permite utilizar os recursos de compra, conforme forem disponibilizados no produto.

Para vender, o usuário precisa completar o cadastro de vendedor dentro do mesmo perfil, conforme a US-004.

### Critérios de aceite

- [ ] Um novo usuário consegue criar uma conta com os dados obrigatórios.
- [ ] Um identificador já utilizado não pode gerar uma conta duplicada.
- [ ] A senha é tratada de forma segura.
- [ ] A conta criada pode acessar funcionalidades de compra sem criar outro cadastro.

### Tarefas

- [ ] **Felipe + Lucas — PLAN/DB:** Modelar entidade única de usuário e restrições.
- [ ] **Lucas — BE:** Definir contrato de cadastro.
- [ ] **Lucas + Eloise — BE:** Implementar registro e proteção da senha.
- [ ] **Pedro — FE:** Criar formulário de cadastro.
- [ ] **Pedro + Tiago — INT:** Integrar formulário ao backend.
- [ ] **Tiago — TEST:** Validar cadastro válido, duplicidade e erros.

---

## US-004 — Cadastrar-se como vendedor

**Módulo:** Conta, Autenticação e Perfil  
**Pontos:** 18  
**Dependências:** US-003.

### História de usuário

Como usuário que deseja vender, quero completar meu cadastro de vendedor dentro da minha conta, para poder publicar e administrar anúncios no SafraDireta.

### Descrição

Habilitar a capacidade de venda na conta existente por meio do preenchimento das informações obrigatórias de vendedor.

O usuário mantém a capacidade de comprar com a mesma conta. Informações sobre possuir transportadora fazem parte do contexto do cadastro e não representam um fluxo logístico adicional nesta Sprint.

### Critérios de aceite

- [ ] O cadastro de vendedor é feito dentro da conta existente.
- [ ] Os campos obrigatórios de vendedor precisam estar completos antes da habilitação.
- [ ] Depois de habilitado, o usuário pode iniciar a publicação de anúncios.
- [ ] O usuário continua podendo comprar normalmente com a mesma conta.

### Tarefas

- [ ] **Lucas + Felipe — PLAN/DB:** Modelar perfil de vendedor vinculado 1:1 à conta.
- [ ] **Felipe — DB:** Preparar campos obrigatórios e contexto de transporte sem criar fluxo logístico adicional.
- [ ] **Lucas + Eloise — BE:** Implementar criação/atualização do cadastro de vendedor.
- [ ] **Eloise — BE:** Implementar regra de permissão para publicar anúncios.
- [ ] **Pedro — FE:** Criar formulário de vendedor dentro da edição de perfil.
- [ ] **Tiago — INT/TEST:** Validar habilitação e manutenção da capacidade de compra.

### Integração com os demais cards

O cadastro de vendedor deve estar acessível pela área de perfil e ser utilizado pelas regras de autorização.

Como a publicação completa de anúncios pertence à US-010, a equipe precisa alinhar a demonstração da habilitação de venda e de sua permissão nesta Sprint.

---

## US-005 — Autenticar conta e proteger recursos

**Módulo:** Conta, Autenticação e Perfil  
**Pontos:** 12  
**Dependências:** US-003. Para a permissão de venda, US-004.

### História de usuário

Como usuário cadastrado, quero entrar na minha conta, para acessar com segurança os recursos disponíveis para mim.

### Descrição

Implementar autenticação com uma única identidade por usuário.

As permissões devem considerar a identidade, a propriedade dos recursos, a participação do usuário e a habilitação de vendedor quando necessária.

### Critérios de aceite

- [ ] Usuário com credenciais válidas consegue entrar.
- [ ] Credenciais inválidas não liberam acesso.
- [ ] Um usuário não consegue alterar recursos pertencentes a outra pessoa.
- [ ] A publicação de anúncios exige cadastro de vendedor habilitado.

### Tarefas

- [ ] **Lucas + Eloise — PLAN/BE:** Definir autenticação e autorização por identidade/propriedade.
- [ ] **Lucas — BE:** Implementar login.
- [ ] **Eloise — BE:** Implementar middleware de autenticação.
- [ ] **Eloise — BE:** Aplicar checagem de vendedor nas rotas de publicação.
- [ ] **Pedro — FE:** Criar login e estado de sessão.
- [ ] **Tiago — TEST:** Validar login e acessos proibidos.

---

## US-008 — Editar perfil

**Módulo:** Conta, Autenticação e Perfil  
**Pontos:** 12  
**Dependências:** US-003 e US-005.

### História de usuário

Como usuário autenticado, quero atualizar meus dados de perfil, para manter minhas informações corretas e acessar as configurações da minha conta.

### Descrição

Centralizar os dados gerais da conta e oferecer acesso às configurações relacionadas ao perfil, incluindo o cadastro de vendedor.

Os campos editáveis e protegidos precisam ser definidos pela equipe antes da implementação.

### Critérios de aceite

- [ ] Usuário consegue visualizar seus dados atuais.
- [ ] Campos permitidos podem ser atualizados.
- [ ] Campos protegidos não podem ser alterados indevidamente.
- [ ] A área oferece acesso ao cadastro de vendedor quando aplicável.

### Tarefas

- [ ] **Pedro + Lucas — PLAN:** Definir campos gerais editáveis.
- [ ] **Lucas — BE:** Implementar consulta do perfil.
- [ ] **Eloise — BE:** Implementar atualização.
- [ ] **Felipe — DB:** Ajustar persistência se necessário.
- [ ] **Pedro — FE:** Criar página de perfil e acesso ao cadastro de vendedor.
- [ ] **Tiago — TEST:** Validar persistência e campos protegidos.

---

## Integração entre os cards

- **US-001:** fornece a estrutura técnica utilizada pelos demais cards.
- **US-002:** oferece os caminhos públicos para mercado, cadastro e login.
- **US-003:** cria a identidade compartilhada pelo login, perfil e cadastro de vendedor.
- **US-004:** habilita a venda na conta existente.
- **US-005:** autentica o usuário e protege os recursos conforme suas permissões.
- **US-008:** permite consultar e atualizar o perfil, com acesso ao cadastro de vendedor.

As dependências orientam a integração. O trabalho pode avançar em paralelo quando os contratos entre as partes estiverem definidos.

## Definições pendentes da equipe

- Campos obrigatórios da conta e identificador único.
- Campos obrigatórios do cadastro de vendedor.
- Campos editáveis e protegidos no perfil.
- Estratégia de autenticação e manutenção da sessão.
- Comportamento ao sair, ao expirar a sessão e ao acessar um recurso protegido.
- Contratos de API e formato das respostas de erro.
- Tamanhos de tela usados na validação da interface.
- Conteúdo das páginas cujas funcionalidades ainda não foram implementadas.
- Forma de demonstrar a permissão de publicação sem incluir toda a US-010.
- Ambiente e dados utilizados na demonstração.

## Execução do projeto

Para executar localmente no Windows, consulte [WINDOWS.md](WINDOWS.md), com preparação do ambiente, banco e comandos PowerShell.

A documentação de execução será preenchida durante a US-001 e deverá reunir:

- Tecnologias e versões utilizadas.
- Pré-requisitos do ambiente.
- Instalação das dependências.
- Variáveis de ambiente necessárias.
- Configuração do banco de dados e execução das migrations.
- Comandos para iniciar backend e frontend.
- Endereços locais dos serviços.
- Procedimento para verificar a comunicação entre frontend, backend e banco.

A US-001 exige que outro integrante consiga reproduzir a execução seguindo essas instruções.

## Roteiro sugerido para validar a Sprint

1. Iniciar frontend, backend e banco seguindo a documentação.
2. Conferir a comunicação entre as camadas.
3. Navegar pelas páginas públicas e acessar uma rota inexistente.
4. Criar uma conta válida.
5. Tentar cadastrar uma conta com identificador já utilizado.
6. Testar login com credenciais válidas e inválidas.
7. Consultar e atualizar os dados permitidos do perfil.
8. Conferir a persistência das alterações e a proteção dos campos restritos.
9. Preencher o cadastro de vendedor e validar os campos obrigatórios.
10. Conferir a habilitação de venda na mesma conta.
11. Validar bloqueios de acesso e tentativas de alteração de recursos de outra pessoa.
12. Conferir a navegação nos tamanhos de tela definidos pela equipe.

Este roteiro apoia a demonstração. O aceite de cada card depende dos critérios específicos registrados acima.

## Referências

- Planilha `Cards  SafraDireta.xlsx`, aba `Backlog_Completo`.
- Escopo negociado da Sprint 1: US-001 a US-005 e US-008, total de 90 pontos.
