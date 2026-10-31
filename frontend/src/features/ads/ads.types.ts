export type AnimalSpecies = "BOVINO" | "SUINO" | "OVINO" | "EQUINO";

export type AnimalPurpose =
  | "ENGORDA_ABATE"
  | "RECRIA_GARROTES"
  | "CRIA_DESMAMA"
  | "REPRODUCAO_TOUROS"
  | "CRIA"
  | "RECRIA"
  | "REPRODUCAO";

export type PricingMode = "TOTAL" | "PER_HEAD";

export type GrainPricingMode = "TOTAL" | "PER_SACK";

export type AdStatus =
  | "ATIVO"
  | "PAUSADO"
  | "PAUSADO_MODERACAO"
  | "EM_REVISAO"
  | "BLOQUEADO_MODERACAO"
  | "VENDIDO"
  | "CANCELADO";

export type GrainCrop = "CAFE" | "SOJA" | "MILHO" | "TRIGO" | "OUTRO";

export type GrainPackaging = "SACARIA" | "BIG_BAG" | "GRANEL";

export interface AdVideoItem {
  tipo: "UPLOAD" | "YOUTUBE";
  url: string; // URL do blob local ou URL do YouTube
  fileBlob?: Blob;
  fileName?: string;
}

export type AdDocumentType =
  // Pecuária
  | "GTA"
  | "LAUDO_SANITARIO"
  | "REGISTRO_GENEALOGICO"
  | "EXAME_ANDROLOGICO"
  // Grãos e Café
  | "LAUDO_CLASSIFICACAO"
  | "LAUDO_SCA_CAFE"
  | "CERTIFICACAO_SUSTENTAVEL"
  | "NOTA_FISCAL_SEMENTE"
  // Geral
  | "OUTRO";

export interface AdDocumentItem {
  id: string;
  tipo: AdDocumentType;
  nomeArquivo: string;
  tamanhoBytes: number;
  mimeType: string;
  url?: string; // Data URL ou Blob URL transitória
  criadoEm: string;
}

export type DocumentAccessStatus = "PENDENTE" | "APROVADO" | "RECUSADO" | "REVOGADO" | "CANCELADO";

export interface AdDocumentAccessRequest {
  id: string;
  anuncioId: string;
  compradorId: string;
  compradorNome: string;
  compradorCidadeUf?: string;
  compradorTipo?: "PF" | "PJ";
  mensagem: string; // Obrigatória
  status: DocumentAccessStatus;
  motivoRecusa?: string;
  solicitadoEm: string;
  respondidoEm?: string;
}

export interface AnimalLotAd {
  id: string;
  vendedorId: string;
  vendedorNome: string;
  vendedorAvatar?: string;
  farmName: string;
  titulo: string;
  descricao?: string;
  categoria: "ANIMAL";
  especie: AnimalSpecies;
  raca: string;
  quantidadeCabecas: number;
  finalidade: AnimalPurpose;
  idadeMeses?: number;
  pesoMedioKg: number;
  pesoMedioArroba: number;
  pesoTotalKg: number;
  pesoTotalArroba: number;
  precoTotal: number;
  precoPorCabeca: number;
  precoPorArroba: number;
  cidade: string;
  uf: string;
  fotos?: string[];
  video?: AdVideoItem;
  documentos?: AdDocumentItem[];
  imagemUrl: string;
  criadoEm: string;
  atualizadoEm?: string;
  status: AdStatus;
  motivoModeracao?: string;
  moderadoEm?: string;
  seloVerificado?: boolean;
  encerradoEm?: string;
  motivoEncerramento?: string;
  observacoesEncerramento?: string;
}

export type CoffeeScreen =
  | "17_18_ACIMA"
  | "16_ACIMA"
  | "14_15"
  | "MOCA"
  | "BICA_CORRIDA";

export interface GrainQualitySpecs {
  // Soja (MAPA / ANEC)
  sojaImpurezasPct?: number;
  sojaAvariadosPct?: number;
  sojaQuebradosPct?: number;

  // Milho (MAPA / CONAB)
  milhoImpurezasPct?: number;
  milhoArdidosPct?: number;
  milhoQuebradosPct?: number;

  // Café (CECAFÉ / SCA)
  cafePeneira?: CoffeeScreen;
  cafeCatacaoDefeitos?: string;
  cafePontuacaoSca?: number;

  // Trigo (MAPA)
  trigoPhKgHl?: number;
  trigoForcaGlutenW?: number;
  trigoFallingNumberSeg?: number;

  // Outras Culturas
  outroObservacoesLaudo?: string;
}

export interface GrainLotAd {
  id: string;
  vendedorId: string;
  vendedorNome: string;
  vendedorAvatar?: string;
  farmName: string;
  titulo: string;
  descricao?: string;
  categoria: "GRAOS";
  cultura: GrainCrop;
  culturaPersonalizada?: string;
  subtipo: string;
  tagPrincipal: string;
  tagSecundaria: string;
  safra: string;
  embalagem: GrainPackaging;
  umidadePercentual: number;
  laudoTecnico?: GrainQualitySpecs;
  quantidadeSacas: number;
  pesoTotalToneladas: number;
  pesoTotalKg: number;
  precoTotal: number;
  precoPorSaca: number;
  precoPorTonelada: number;
  cidade: string;
  uf: string;
  fotos?: string[];
  video?: AdVideoItem;
  documentos?: AdDocumentItem[];
  imagemUrl: string;
  criadoEm: string;
  atualizadoEm?: string;
  status: AdStatus;
  motivoModeracao?: string;
  moderadoEm?: string;
  seloVerificado?: boolean;
  encerradoEm?: string;
  motivoEncerramento?: string;
  observacoesEncerramento?: string;
}

export type MarketplaceAd = AnimalLotAd | GrainLotAd;

export interface EncerramentoAnuncioPayload {
  tipo: "VENDIDO" | "CANCELADO";
  motivo: string;
  observacoes?: string;
  desvincularDocumentos?: boolean;
}

export const MOTIVOS_ENCERRAMENTO_VENDIDO = [
  "Venda externa (Frigorífico / Indústria)",
  "Venda para outro produtor / vizinho",
  "Negociação intermediada pelo SafraDireta",
  "Outro destino comercial",
] as const;

export const MOTIVOS_ENCERRAMENTO_CANCELADO = [
  "Retenção na propriedade (recria / confinamento / silo)",
  "Perda física ou descarte sanitário",
  "Desistência comercial (mercado desfavorável)",
  "Erro de cadastro / Duplicidade",
  "Outro motivo",
] as const;

export type AdModelTemplate =
  | (Partial<AnimalLotAd> & {
      categoria: "ANIMAL";
      pricingMode?: PricingMode;
      pesoUnitMode?: "KG" | "ARROBA";
    })
  | (Partial<GrainLotAd> & {
      categoria: "GRAOS";
      grainPricingMode?: GrainPricingMode;
      volumeUnitMode?: "SACAS" | "TONELADAS";
    });

export interface CreateAnimalAdInput {
  titulo: string;
  descricao?: string;
  especie: AnimalSpecies;
  raca: string;
  quantidadeCabecas: number;
  finalidade: AnimalPurpose;
  idadeMeses?: number;
  pesoMedioKg: number;
  pricingMode: PricingMode;
  precoTotal?: number;
  precoPorCabeca?: number;
  cidade: string;
  uf: string;
  fotos?: string[];
  video?: AdVideoItem;
  documentos?: AdDocumentItem[];
}

export interface CreateGrainAdInput {
  titulo: string;
  descricao?: string;
  cultura: GrainCrop;
  culturaPersonalizada?: string;
  subtipo: string;
  safra: string;
  embalagem: GrainPackaging;
  umidadePercentual: number;
  laudoTecnico?: GrainQualitySpecs;
  quantidadeSacas: number;
  pesoTotalToneladas: number;
  pricingMode: GrainPricingMode;
  precoTotal?: number;
  precoPorSaca?: number;
  cidade: string;
  uf: string;
  fotos?: string[];
  video?: AdVideoItem;
  documentos?: AdDocumentItem[];
}

export type UpdateAdInput =
  | (Partial<Omit<CreateAnimalAdInput, "pricingMode">> & { pricingMode?: PricingMode })
  | (Partial<Omit<CreateGrainAdInput, "pricingMode">> & { pricingMode?: GrainPricingMode });

export const SPECIES_LABELS: Record<AnimalSpecies, string> = {
  BOVINO: "Bovino (Boi Gordo)",
  SUINO: "Suíno",
  OVINO: "Ovino",
  EQUINO: "Equino",
};

export const BEEF_CATTLE_PURPOSES: { value: AnimalPurpose; label: string }[] = [
  { value: "ENGORDA_ABATE", label: "Engorda / Terminação / Boi Gordo" },
  { value: "RECRIA_GARROTES", label: "Recria / Garrotes" },
  { value: "CRIA_DESMAMA", label: "Cria / Bezerros / Desmama" },
  { value: "REPRODUCAO_TOUROS", label: "Touros / Reprodutores" },
];

export const PURPOSE_LABELS: Record<AnimalPurpose, string> = {
  ENGORDA_ABATE: "Boi Gordo / Terminação / Abate",
  RECRIA_GARROTES: "Recria / Garrotes",
  CRIA_DESMAMA: "Cria / Bezerros / Desmama",
  REPRODUCAO_TOUROS: "Touros / Reprodutores",
  CRIA: "Cria / Bezerros",
  RECRIA: "Recria / Garrotes",
  REPRODUCAO: "Touros / Reprodutores",
};

export interface BreedOption {
  value: string;
  label: string;
}

export const BEEF_CATTLE_BREEDS: BreedOption[] = [
  { value: "Nelore", label: "Nelore" },
  { value: "Angus (Aberdeen Angus)", label: "Angus (Aberdeen Angus)" },
  { value: "Brangus", label: "Brangus" },
  { value: "Cruzamento Industrial F1", label: "Cruzamento Industrial F1" },
  { value: "Senepol", label: "Senepol" },
  { value: "Brahman", label: "Brahman" },
  { value: "Tabapuã", label: "Tabapuã" },
  { value: "Guzerá", label: "Guzerá" },
  { value: "Hereford / Braford", label: "Hereford / Braford" },
  { value: "Anelorado / Mestiço", label: "Anelorado / Mestiço" },
  { value: "OUTRA", label: "Outra raça / Cruzamento específico" },
];

export const COMMON_BREEDS = BEEF_CATTLE_BREEDS.map((b) => b.value);

// ---------------------------------------------------------------------------
// Catálogo Agronômico — Grãos e Café (US-011)
// ---------------------------------------------------------------------------

export const GRAIN_CROPS: { value: GrainCrop; label: string }[] = [
  { value: "CAFE", label: "Café" },
  { value: "SOJA", label: "Soja" },
  { value: "MILHO", label: "Milho" },
  { value: "TRIGO", label: "Trigo" },
  { value: "OUTRO", label: "Outro Grão / Cereal" },
];

export const GRAIN_CROP_LABELS: Record<GrainCrop, string> = {
  CAFE: "Café",
  SOJA: "Soja",
  MILHO: "Milho",
  TRIGO: "Trigo",
  OUTRO: "Outro",
};

export interface GrainSubtypeOption {
  value: string;
  label: string;
  shortTag: string;
}

export const GRAIN_SUBTYPES: Record<Exclude<GrainCrop, "OUTRO">, GrainSubtypeOption[]> = {
  CAFE: [
    {
      value: "Arábica — Tipo 6 / Bebida Dura",
      label: "Arábica — Tipo 6 / Bebida Dura",
      shortTag: "Arábica Bebida Dura",
    },
    {
      value: "Arábica — Bebida Mole / Especial",
      label: "Arábica — Bebida Mole / Especial",
      shortTag: "Arábica Bebida Mole",
    },
    {
      value: "Arábica — Bebida Riada / Rio",
      label: "Arábica — Bebida Riada / Rio",
      shortTag: "Arábica Riada / Rio",
    },
    {
      value: "Conilon / Robusta",
      label: "Conilon / Robusta",
      shortTag: "Conilon / Robusta",
    },
    {
      value: "Café em Coco / Natural",
      label: "Café em Coco / Natural",
      shortTag: "Café em Coco",
    },
    {
      value: "OUTRO",
      label: "Outro tipo / classificação...",
      shortTag: "Outro",
    },
  ],
  SOJA: [
    {
      value: "Comercial — Padrão Exportação (Transgênica)",
      label: "Comercial — Padrão Exportação (Transgênica)",
      shortTag: "Padrão Exportação",
    },
    {
      value: "Convencional (Não-Transgênica / Livre de OGM)",
      label: "Convencional (Não-Transgênica / Livre de OGM)",
      shortTag: "Convencional (Livre OGM)",
    },
    {
      value: "Padrão Indústria (Esmagamento)",
      label: "Padrão Indústria (Esmagamento)",
      shortTag: "Padrão Indústria",
    },
    {
      value: "Soja para Semente",
      label: "Soja para Semente",
      shortTag: "Soja Semente",
    },
    {
      value: "OUTRO",
      label: "Outro tipo / classificação...",
      shortTag: "Outro",
    },
  ],
  MILHO: [
    {
      value: "Amarelo Grão Duro (Tipo 1 / Exportação)",
      label: "Amarelo Grão Duro (Tipo 1 / Exportação)",
      shortTag: "Amarelo Grão Duro",
    },
    {
      value: "Comercial (Padrão Ração / Consumo Animal)",
      label: "Comercial (Padrão Ração / Consumo Animal)",
      shortTag: "Padrão Ração",
    },
    {
      value: "Milho Branco (Canjica / Indústria)",
      label: "Milho Branco (Canjica / Indústria)",
      shortTag: "Milho Branco",
    },
    {
      value: "Milho Pipoca",
      label: "Milho Pipoca",
      shortTag: "Milho Pipoca",
    },
    {
      value: "Silagem / Grão Úmido",
      label: "Silagem / Grão Úmido",
      shortTag: "Silagem / Grão Úmido",
    },
    {
      value: "OUTRO",
      label: "Outro tipo / classificação...",
      shortTag: "Outro",
    },
  ],
  TRIGO: [
    {
      value: "Trigo Pão (Tipo 1)",
      label: "Trigo Pão (Tipo 1)",
      shortTag: "Trigo Pão (Tipo 1)",
    },
    {
      value: "Trigo Melhorador",
      label: "Trigo Melhorador",
      shortTag: "Trigo Melhorador",
    },
    {
      value: "Trigo Brando (Biscoito / Confeitaria)",
      label: "Trigo Brando (Biscoito / Confeitaria)",
      shortTag: "Trigo Brando",
    },
    {
      value: "Ração Animal / Outros Usos",
      label: "Ração Animal / Outros Usos",
      shortTag: "Trigo Ração",
    },
    {
      value: "OUTRO",
      label: "Outro tipo / classificação...",
      shortTag: "Outro",
    },
  ],
};

export const GRAIN_HARVEST_SEASONS: string[] = [
  "2025/2026",
  "2024/2025",
  "2023/2024",
];

export const GRAIN_PACKAGING_OPTIONS: {
  value: GrainPackaging;
  label: string;
  shortLabel: string;
}[] = [
  {
    value: "SACARIA",
    label: "Sacaria (Sacas de 60 kg)",
    shortLabel: "Sacaria (60 kg)",
  },
  {
    value: "BIG_BAG",
    label: "Big Bag (1.000 kg)",
    shortLabel: "Big Bag (1 t)",
  },
  {
    value: "GRANEL",
    label: "A Granel (Transporte Graneleiro)",
    shortLabel: "A Granel",
  },
];

export const GRAIN_PACKAGING_LABELS: Record<GrainPackaging, string> = {
  SACARIA: "Sacaria (60 kg)",
  BIG_BAG: "Big Bag (1.000 kg)",
  GRANEL: "A Granel",
};

export const COFFEE_SCREEN_OPTIONS: {
  value: CoffeeScreen;
  label: string;
  shortLabel: string;
}[] = [
  {
    value: "17_18_ACIMA",
    label: "Peneira 17/18 Acima (Grãos Graúdos / Nobres)",
    shortLabel: "Peneira 17/18 Acima",
  },
  {
    value: "16_ACIMA",
    label: "Peneira 16 Acima (Padrão Exportação)",
    shortLabel: "Peneira 16 Acima",
  },
  {
    value: "14_15",
    label: "Peneira 14/15 (Grãos Médios/Miúdos)",
    shortLabel: "Peneira 14/15",
  },
  {
    value: "MOCA",
    label: "Grão Moca (Peneira 10/11/12)",
    shortLabel: "Grão Moca",
  },
  {
    value: "BICA_CORRIDA",
    label: "Bica Corrida (Lote sem classificação)",
    shortLabel: "Bica Corrida",
  },
];

export const COFFEE_SCREEN_LABELS: Record<CoffeeScreen, string> = {
  "17_18_ACIMA": "Peneira 17/18 Acima",
  "16_ACIMA": "Peneira 16 Acima",
  "14_15": "Peneira 14/15",
  MOCA: "Grão Moca",
  BICA_CORRIDA: "Bica Corrida",
};

export function obterTagsAnuncio(anuncio: MarketplaceAd): [string, string] {
  if (anuncio.categoria === "GRAOS") {
    const tag1 = anuncio.tagPrincipal || GRAIN_CROP_LABELS[anuncio.cultura] || "Grãos";
    const tag2 = anuncio.tagSecundaria || anuncio.subtipo || anuncio.culturaPersonalizada || "Comercial";
    return [tag1, tag2];
  }
  const tag1 = anuncio.especie === "BOVINO" ? "Boi Gordo" : SPECIES_LABELS[anuncio.especie];
  const tag2 = anuncio.raca || "Nelore";
  return [tag1, tag2];
}

export function obterFotoCapa(anuncio: MarketplaceAd): string {
  if (anuncio.fotos && anuncio.fotos.length > 0 && anuncio.fotos[0]) {
    return anuncio.fotos[0];
  }
  return anuncio.imagemUrl;
}

export function extrairYoutubeId(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = trimmed.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function obterYoutubeEmbedUrl(url?: string): string | null {
  const id = extrairYoutubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

export function comprimirImagemParaUpload(
  file: File,
  maxDim = 800,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Erro ao carregar a imagem."));
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export const ANIMAL_DOCUMENT_TYPES: { value: AdDocumentType; label: string; descricao: string }[] = [
  {
    value: "GTA",
    label: "Guia de Trânsito Animal (GTA)",
    descricao: "Documento oficial do MAPA / Defesa Agropecuária para transporte e sanidade",
  },
  {
    value: "LAUDO_SANITARIO",
    label: "Atestado / Laudo Sanitário",
    descricao: "Comprovações de vacinação (Brucelose, Tuberculose, Febre Aftosa)",
  },
  {
    value: "REGISTRO_GENEALOGICO",
    label: "RGD / Registro Genealógico",
    descricao: "Certificado de associação de raça (ABCZ, ANCP, etc.)",
  },
  {
    value: "EXAME_ANDROLOGICO",
    label: "Exame Andrológico",
    descricao: "Laudo reprodutivo e de fertilidade para touros e matrizes",
  },
  {
    value: "OUTRO",
    label: "Outro Documento Zootécnico / Fiscal",
    descricao: "Laudos complementares, notas fiscais ou exames adicionais",
  },
];

export const GRAIN_DOCUMENT_TYPES: { value: AdDocumentType; label: string; descricao: string }[] = [
  {
    value: "LAUDO_CLASSIFICACAO",
    label: "Laudo de Classificação Vegetal",
    descricao: "Laudo oficial emitido por classificador credenciado no MAPA (umidade, impurezas)",
  },
  {
    value: "LAUDO_SCA_CAFE",
    label: "Laudo SCA (Cafés Especiais)",
    descricao: "Análise sensorial de xícara e pontuação SCA (Specialty Coffee Association)",
  },
  {
    value: "CERTIFICACAO_SUSTENTAVEL",
    label: "Certificação Sustentável / Selo",
    descricao: "Certificados socioambientais (Orgânico, Rainforest Alliance, Fairtrade)",
  },
  {
    value: "NOTA_FISCAL_SEMENTE",
    label: "NF de Origem da Semente",
    descricao: "Comprovação fiscal e genética de semente fiscalizada/certificada",
  },
  {
    value: "OUTRO",
    label: "Outro Laudo Técnico / Agronômico",
    descricao: "Laudos de solo, defensivos, talhão ou notas fiscais complementares",
  },
];

export const AD_DOCUMENT_LABELS: Record<AdDocumentType, string> = {
  GTA: "Guia de Trânsito Animal (GTA)",
  LAUDO_SANITARIO: "Atestado / Laudo Sanitário",
  REGISTRO_GENEALOGICO: "Registro Genealógico (RGD)",
  EXAME_ANDROLOGICO: "Exame Andrológico",
  LAUDO_CLASSIFICACAO: "Laudo de Classificação Vegetal",
  LAUDO_SCA_CAFE: "Laudo de Qualidade SCA",
  CERTIFICACAO_SUSTENTAVEL: "Certificação Socioambiental",
  NOTA_FISCAL_SEMENTE: "Nota Fiscal de Semente Certificada",
  OUTRO: "Outro Documento",
};

export const AD_DOCUMENT_SHORT_LABELS: Record<AdDocumentType, string> = {
  GTA: "GTA",
  LAUDO_SANITARIO: "Sanitário",
  REGISTRO_GENEALOGICO: "RGD",
  EXAME_ANDROLOGICO: "Andrológico",
  LAUDO_CLASSIFICACAO: "Classificação",
  LAUDO_SCA_CAFE: "Laudo SCA",
  CERTIFICACAO_SUSTENTAVEL: "Certificado",
  NOTA_FISCAL_SEMENTE: "NF Semente",
  OUTRO: "Outro",
};

export function formatarTamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

