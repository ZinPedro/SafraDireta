# SafraDireta — Front-end

Landing page em React, TypeScript e Vite, com navegação pelo React Router e análise de código pelo Oxlint.

## Executar

Use Node.js 22.12 ou superior na linha 22 (ambiente verificado: 22.22.2) e npm. Execute os comandos dentro desta pasta:

```bash
npm ci
npm run dev
```

Abra o endereço exibido pelo Vite. Para parar o servidor, use Ctrl+C.

```bash
npm run build   # Verifica os tipos e gera dist/
npm run lint    # Executa Oxlint
npm run preview # Visualiza o build localmente
```

## Organização

- `src/main.tsx`: inicializa React e importa o CSS global.
- `src/App.tsx`: configura rotas, layout compartilhado, título da aba e janela de desenvolvimento.
- `src/index.css`: paleta, tokens semânticos, tipografia, reset e elementos de interface compartilhados.
- `src/App.css`: cabeçalho, navegação, rodapé, páginas de desenvolvimento e janela modal.
- `src/pages/HomePage.tsx` e `HomePage.css`: seções da landing page e seus estilos.
- `src/pages/DevelopmentPage.tsx`: tela reutilizada por Mercado, Produtores, Guia e 404.
- `src/components/`: cabeçalho, rodapé, ícones, janela acessível e cards provisórios.
- `src/data/site.ts`: rotas, categorias de navegação, textos das janelas e quatro passos da jornada.
- `src/assets/images/`: imagens fornecidas por Pedro, copiadas para o projeto.

Use componentes em PascalCase, funções/variáveis em camelCase, tokens CSS em kebab-case e classes no padrão BEM. Reutilize os tokens antes de acrescentar valores específicos. CSS comum não tem isolamento automático por componente.

## Comportamento atual

| Rota | Entrega |
| --- | --- |
| `/` | Landing page completa |
| `/cadastro` | Cadastro com validação local e intenção opcional de produtor |
| `/mercado` | Em desenvolvimento |
| `/produtores` | Em desenvolvimento |
| `/guia` | Em desenvolvimento |
| Qualquer outra | Página não encontrada |

As quatro categorias do menu levam a `/mercado`, sem aplicar filtro. Os destaques da home continuam sem categorias definidas. Cards são modelos estáticos identificados; não representam dados carregando nem registros reais.

Login abre uma janela com e-mail e senha. O envio válido abre `/mercado` como prévia, sem autenticar ou criar sessão. Recuperação de senha permanece em desenvolvimento. Não há opção de lembrar de mim. Formulário e janela ficam separados em `src/features/login/`.

Cadastro comum e intenção de produtor abrem `/cadastro`; o envio valida e informa que nenhuma conta foi criada. Contato, termos e privacidade permanecem em janelas informativas. O fluxo de vendedor não cria uma identidade separada.

## Integração futura

- Substituir os cards provisórios por componentes alimentados por contratos definidos com o backend.
- Implementar filtros na página Mercado antes de alterar os links das categorias.
- Definir os destaques de categorias a partir das ofertas quando existirem dados e regras de ordenação aprovadas.
- Substituir as janelas informativas por funcionalidades reais quando autorizadas.
- Ao hospedar, configurar fallback das rotas para `index.html`; `npm run preview` não é servidor de produção.
- Fontes são obtidas de Google Fonts, com alternativas locais de sistema. As imagens são locais; a imagem da fazenda mantém o original de aproximadamente 4,2 MB e utiliza carregamento adiado. Otimização de imagens é uma melhoria antes da publicação.

Nenhuma API, autenticação, compra ou publicação de lotes está implementada nesta entrega.

Veja o [relatório da landing page](docs/relatorio-landing-page.md) para decisões e validações.
Veja também o [relatório do login](docs/relatorio-login.md).
