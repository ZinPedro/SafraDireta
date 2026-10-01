# Relatório — Cadastro comum do SafraDireta

Data: 01/10/2026 · Implementação: Codex, seguindo as referências e decisões de Pedro.

## Escopo confirmado

- Página própria `/cadastro`, sem cabeçalho e rodapé da landing page.
- Imagem fornecida `imagemCadastro.jpeg` no painel lateral; identidade SafraDireta.
- Título “Cadastro”, sem o complemento “Comprador”.
- Nome completo, e-mail, telefone, senha e aceite dos termos/privacidade.
- Sem login Google e sem indicador de força de senha nesta etapa.
- Dados válidos exibem “Integração em desenvolvimento — nenhuma conta foi criada”. Não há envio, persistência nem sessão simulada.

## Comportamento entregue

Os acessos a cadastro do cabeçalho, destaque e rodapé abrem `/cadastro`. As chamadas de vendedor abrem `/cadastro?intencao=produtor`, com a seção “Sou produtor — também quero vender” expandida. Essa seção informa que a habilitação será uma etapa adicional na mesma conta; não coleta documentos ou cria outro usuário.

O formulário valida campos ao sair deles e ao enviar. Exibe mensagens individuais, foca o primeiro campo inválido, formata telefone brasileiro e permite mostrar/ocultar senha. Requer pelo menos oito caracteres, conforme a referência visual; esta regra deverá ser alinhada ao backend. A validação do telefone é somente estrutural e não comprova existência, DDD atribuído ou posse do número.

“Voltar” retorna à origem interna registrada, ou ao início em acesso direto. “Fechar” retorna ao início. Login, termos e privacidade reutilizam as janelas de desenvolvimento existentes, preservando o formulário quando fechadas.

O painel lateral usa a imagem original sem alterações. Em telas pequenas, ele é ocultado para priorizar o formulário. A página utiliza os tokens, fontes e ícones do projeto. A rolagem é da página, sem um segundo painel com rolagem própria.

## Preparação para integração

`registration.ts` concentra valores, erros, intenção, normalização e o adaptador `RegisterAccount`. O adaptador atual retorna apenas `unavailable`. Ao integrar, substituir sua implementação por uma chamada ao contrato definido pela equipe; nenhuma URL de API foi presumida.

Resultados previstos: `registered`, `unavailable` e `error` com mensagem e erros por campo. A tela também trata `idle`, `submitting`, falha inesperada e bloqueio de envio duplicado. O resultado de sucesso só deve ser retornado após confirmação real do backend. O prop `onRegister` permite substituir o adaptador em testes e na integração.

O payload preparado normaliza nome, e-mail e telefone (`+55`), preserva a senha digitada e carrega `intent: buyer | seller`. Essa intenção é de navegação/cadastro, não um papel permanente nem uma autorização de venda.

Os dados permanecem somente no estado React. Sair/recarregar a página descarta o formulário; não é usado localStorage, sessionStorage ou armazenamento de senha. Expandir a seção de produtor e abrir/fechar as janelas informativas preserva os valores enquanto a página permanece montada.

## Arquivos modificados

| Arquivo (relativo a `frontend/`) | Alteração |
| --- | --- |
| `src/App.tsx` | Rota e título de cadastro, navegação dos pontos de entrada, layout sem cabeçalho/rodapé nessa rota. |
| `src/data/site.ts` | Constante `routes.registration`. |
| `src/components/Icon.tsx` | Ícones de voltar, e-mail, telefone, cadeado e visibilidade da senha. |

## Arquivos criados

| Arquivo (relativo a `frontend/`) | Responsabilidade |
| --- | --- |
| `src/features/registration/RegistrationPage.tsx` | Interface, validação interativa, intenção de produtor e estados do envio. |
| `src/features/registration/RegistrationPage.css` | Layout responsivo e estilos do formulário. |
| `src/features/registration/registration.ts` | Tipos, validação, normalização e limite de integração com backend. |
| `src/assets/images/registration-landscape.jpeg` | Cópia da imagem enviada pelo usuário (aproximadamente 3,9 MB). |
| `docs/relatorio-cadastro-comprador.md` | Este relatório. |

## Verificações

- Build de produção e TypeScript: aprovado.
- Oxlint: aprovado.
- 14 asserções executadas sobre validação, formatação, normalização, preservação da senha, intenção e retorno sem integração: aprovadas.
- Navegador: envio vazio com cinco erros e foco no primeiro campo; preenchimento fictício válido com aviso de que nenhuma conta foi criada; máscara de telefone; mostrar/ocultar senha; termos, login e fechamento com Escape; retorno à landing e acesso por chamada de vendedor.
- Inspeção visual em desktop, tablet e celular. Larguras verificadas: 320, 390, 768 e 1366 pixels.
- Nenhum erro ou aviso capturado no console da aba durante a inspeção.
- Playwright independente não pôde iniciar por ausência do binário Chromium; a verificação visual e interativa foi realizada no navegador integrado do Codex. Não foi instalado navegador adicional.

## Pendências para a equipe

1. Contrato real de cadastro, regras de duplicidade, sessão e erros do backend.
2. Textos definitivos dos termos e da privacidade, versão e registro de aceite. As janelas atuais são placeholders; o checkbox não representa um aceite persistido de documentos finais.
3. Implementação do login e destino após cadastro confirmado.
4. Definição do cadastro de produtor PF/PJ e da análise documental.
5. Endereços vinculados à conta, em configurações/compra, sem adicioná-los ao cadastro inicial.
6. Google, verificação de contatos e otimização da imagem como trabalhos posteriores.

O repositório já apresentava `frontend/` inteiro como não rastreado antes desta alteração. Nenhum commit foi criado. O build também atualiza os artefatos gerados em `dist/` e caches de compilação; eles não integram a lista de fontes acima.
