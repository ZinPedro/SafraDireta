# Relatório — Landing page SafraDireta

Data: 30/09/2026. Implementação: Codex, com autorização explícita de Pedro nesta etapa.

## Referências e decisões

- Figma Make: https://www.figma.com/make/m296g8jegDaLBDhjgJMEei/Marketplace-for-Agricultural-Products
- Layout, hierarquia, cores e tipografia conferidos pela prévia do Figma no navegador. O conector retornou links de código que não puderam ser abertos; a implementação não é uma cópia literal desse código.
- Pôr do sol fornecido por Pedro no destaque inicial; fazenda verde na chamada final. Os arquivos originais em Downloads não foram alterados.
- Pedro confirmou páginas de desenvolvimento para Mercado, Produtores e Guia; janelas distintas para login, cadastro comum, vendedor e contato; adaptação dos quatro passos para conta única e regras do SafraDireta.

## Entregue

1. Marca SafraDireta e cabeçalho responsivo, com navegação principal, categorias, login e cadastro.
2. Menu de categorias com Café, Boi gordo, Soja e Milho. Todos levam ao Mercado, sem filtro por enquanto.
3. Destaque com fotografia de lavoura, texto de apresentação, acesso ao Mercado e Cadastre-se. Sem cotações ou estatísticas.
4. Quatro espaços de categorias reservados, com composição visual de cards e sem categorias de destaque fixadas.
5. Seis modelos de ofertas, sem filtros e sem dados reais, preços inventados ou ações de negociação ativas.
6. Quatro passos de Como funciona, sem promessa de escrow, contrato digital ou verificação documental.
7. Três modelos de perfis de produtores, sem nomes, notas, verificação ou histórico fictícios.
8. Chamada final apenas para vendedor, com contexto próprio em uma janela de desenvolvimento.
9. Rodapé com navegação, conta, contato e janelas para termos e privacidade, sem informações empresariais inventadas.
10. Rotas públicas com título de aba específico, tela 404 e retorno ao início.

## Arquivos e convenções

- Alterados: `src/App.tsx`, `src/App.css`, `src/index.css`, `index.html`, `package.json`, `package-lock.json` e `README.md`.
- Criados: componentes Header, Footer, Icon, DevelopmentDialog e PlaceholderCards; páginas HomePage e DevelopmentPage; estilos HomePage.css; dados site.ts; duas imagens locais e este relatório.
- Dependência adicionada: `react-router-dom`. React, TypeScript, Vite e Oxlint mantidos como base.
- Componentes com propriedades tipadas, rotas centralizadas e conteúdo separado do markup quando compartilhado.
- Variáveis CSS separadas entre paleta e responsabilidades semânticas; classes BEM; grids responsivos; fontes Fraunces, Source Sans 3 e JetBrains Mono.
- Os arquivos de exemplo de imagens/ícones não usados foram preservados, mas deixaram de ser referenciados pela aplicação.
- Alterações limitadas ao front-end; README geral do projeto e áreas dos demais integrantes preservados. Sem commit ou publicação.

## Verificação executada

- `npm run build`: aprovado, incluindo verificação de tipos e geração de `dist`.
- `npm run lint`: aprovado sem avisos após corrigir o cálculo do ano do rodapé fora da renderização.
- Revisão visual da página completa em desktop e conferência responsiva em 360, 768 e 1440 px; sem excesso de largura horizontal nessas medidas.
- Mercado por categoria, Produtores e Guia: navegação e mensagens conferidas.
- Recarga direta de `/mercado` pelo servidor Vite: funcionando.
- Rota inexistente: página 404 conferida.
- Janelas de login, cadastro comum, vendedor e contato: conteúdo distinto, abertura e fechamento conferidos.
- Escape e retorno de foco ao acionador conferidos; Tab e Shift+Tab mantêm o foco nos botões da janela após correção. Menu móvel e fechamento após navegação conferidos. Clique na marca retorna ao topo mesmo na página inicial.
- As duas fotografias carregaram; foto final usa lazy loading.
- Nenhum erro ou aviso de console registrado durante a conferência no navegador.

Esses checks não são uma suíte automatizada de regressão, uma auditoria completa de acessibilidade ou validação de integração com backend.

## Limitações e próximos passos

- A landing page é demonstrável; os serviços anunciados permanecem em desenvolvimento conforme solicitado.
- Categorias em destaque, ofertas e produtores aguardam regras e contratos de dados. Não há busca, autenticação, persistência ou cadastro real.
- O identificador do cadastro de vendedor guarda a intenção na interface, sem armazenamento ou navegação para formulário definitivo.
- Google Fonts requer acesso externo; fontes de sistema são o fallback.
- Imagem final original tem aproximadamente 4,2 MB. Planejar uma versão otimizada antes da publicação.
- Hospedagem precisa devolver `index.html` para as rotas da SPA.

## Sugestão para estudar o código

Leia nesta ordem: `data/site.ts` → `pages/HomePage.tsx` → `components/PlaceholderCards.tsx` → `components/Header.tsx` → `components/DevelopmentDialog.tsx` → `App.tsx`. Isso começa pelo conteúdo e componentes visuais e avança para estado, efeitos, foco e roteamento.
