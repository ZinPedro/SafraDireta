export const routes = {
  home: "/",
  registration: "/cadastro",
  corporateRegistration: "/cadastro/empresa",
  sellerUpgrade: "/habilitar-vendedor",
  profile: "/perfil",
  market: "/mercado",
  producers: "/produtores",
  guide: "/guia",
} as const;

// Categorias de navegação. Os destaques da home serão definidos pelo mercado.
export const navigationCategories = [
  "Café",
  "Boi gordo",
  "Soja",
  "Milho",
] as const;

export const developmentFeatures = {
  login: {
    title: "Entrar na sua conta",
    description:
      "O acesso à conta está em desenvolvimento. Em breve você poderá entrar para acompanhar suas negociações.",
  },
  registration: {
    title: "Cadastre-se no SafraDireta",
    description:
      "O cadastro está em desenvolvimento. Você terá uma única conta para comprar e, quando desejar, habilitar a venda.",
  },
  sellerRegistration: {
    title: "Comece a vender",
    description:
      "O cadastro de vendedor está em desenvolvimento. Este caminho abrirá o cadastro com a intenção de vender já selecionada, mantendo uma única conta.",
  },
  contact: {
    title: "Fale com a gente",
    description:
      "Nosso canal de contato está em desenvolvimento. Em breve você encontrará aqui uma forma de conversar com a equipe.",
  },
  terms: {
    title: "Termos de uso",
    description:
      "Os termos de uso estão em preparação e serão disponibilizados antes da abertura dos serviços.",
  },
  privacy: {
    title: "Privacidade",
    description:
      "As informações sobre tratamento de dados e privacidade serão disponibilizadas antes da abertura dos serviços.",
  },
} as const;

export type DevelopmentFeature = keyof typeof developmentFeatures;
export type OpenDevelopmentDialog = (feature: DevelopmentFeature) => void;

export const guideSteps = [
  {
    number: "01",
    title: "Cadastre-se",
    description:
      "Comece com uma única conta. Para vender, complete seu cadastro de vendedor no próprio perfil.",
  },
  {
    number: "02",
    title: "Publique ou busque",
    description:
      "Encontre o que precisa no mercado ou prepare seus lotes para apresentar a novos compradores.",
  },
  {
    number: "03",
    title: "Negocie",
    description:
      "Converse sobre o produto, esclareça dúvidas e alinhe as condições com a outra parte.",
  },
  {
    number: "04",
    title: "Combine a compra",
    description:
      "Alinhe preço, pagamento e entrega antes de concluir. Acordos externos são de responsabilidade das partes.",
  },
] as const;
