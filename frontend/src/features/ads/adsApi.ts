import type {
  AdStatus,
  AnimalLotAd,
  CreateAnimalAdInput,
  CreateGrainAdInput,
  GrainCrop,
  GrainLotAd,
  MarketplaceAd,
} from "./ads.types";
import { GRAIN_CROP_LABELS } from "./ads.types";
import defaultFarmImage from "../../assets/images/farm-landscape.jpeg";
import harvestSunsetImage from "../../assets/images/harvest-sunset.jpeg";

const BACKEND_RACAS = [
  "Nelore",
  "Angus (Aberdeen Angus)",
  "Brangus",
  "Cruzamento Industrial F1",
  "Senepol",
  "Brahman",
  "Tabapua",
  "Guzera",
  "Hereford / Braford",
  "Anelorado / Mestico",
  "OUTRA",
] as const;

const BREED_FRONT_TO_BACK: Record<string, string> = {
  "Tabapuã": "Tabapua",
  "Guzerá": "Guzera",
  "Anelorado / Mestiço": "Anelorado / Mestico",
};

const BREED_BACK_TO_FRONT: Record<string, string> = {
  "Tabapua": "Tabapuã",
  "Guzera": "Guzerá",
  "Anelorado / Mestico": "Anelorado / Mestiço",
};

const SUBTYPE_FRONT_TO_BACK: Record<string, Record<string, string>> = {
  SOJA: {
    "Comercial — Padrão Exportação (Transgênica)": "EXPORTACAO_TRANSGENICA",
    "Convencional (Não-Transgênica / Livre de OGM)": "CONVENCIONAL_NAO_TRANSGENICA",
    "Padrão Indústria (Esmagamento)": "INDUSTRIA_ESMAGAMENTO",
    "Soja para Semente": "SEMENTE",
    "OUTRO": "OUTRO",
  },
  MILHO: {
    "Amarelo Grão Duro (Tipo 1 / Exportação)": "AMARELO_DURO_EXPORTACAO",
    "Comercial (Padrão Ração / Consumo Animal)": "COMERCIAL_RACAO",
    "Milho Branco (Canjica / Indústria)": "BRANCO_CANJICA",
    "Milho Pipoca": "PIPOCA",
    "Silagem / Grão Úmido": "SILAGEM_GRAO_UMIDO",
    "OUTRO": "OUTRO",
  },
  CAFE: {
    "Arábica — Tipo 6 / Bebida Dura": "ARABICA_TIPO6_DURA",
    "Arábica — Bebida Mole / Especial": "ARABICA_MOLE_ESPECIAL",
    "Arábica — Bebida Riada / Rio": "ARABICA_RIADA_RIO",
    "Conilon / Robusta": "CONILON_ROBUSTA",
    "Café em Coco / Natural": "COCO_NATURAL",
    "OUTRO": "OUTRO",
  },
  TRIGO: {
    "Trigo Pão (Tipo 1)": "PAO_TIPO1",
    "Trigo Melhorador": "MELHORADOR",
    "Trigo Brando (Biscoito / Confeitaria)": "BRANDO_BISCOITO",
    "Ração Animal / Outros Usos": "RACAO_OUTROS",
    "OUTRO": "OUTRO",
  },
  OUTRO: {
    "OUTRO": "OUTRO",
  },
};

const SUBTYPE_BACK_TO_FRONT: Record<string, Record<string, { label: string; shortTag: string }>> = {
  SOJA: {
    EXPORTACAO_TRANSGENICA: {
      label: "Comercial — Padrão Exportação (Transgênica)",
      shortTag: "Padrão Exportação",
    },
    CONVENCIONAL_NAO_TRANSGENICA: {
      label: "Convencional (Não-Transgênica / Livre de OGM)",
      shortTag: "Convencional (Livre OGM)",
    },
    INDUSTRIA_ESMAGAMENTO: {
      label: "Padrão Indústria (Esmagamento)",
      shortTag: "Padrão Indústria",
    },
    SEMENTE: { label: "Soja para Semente", shortTag: "Soja Semente" },
    OUTRO: { label: "Outro", shortTag: "Outro" },
  },
  MILHO: {
    AMARELO_DURO_EXPORTACAO: {
      label: "Amarelo Grão Duro (Tipo 1 / Exportação)",
      shortTag: "Amarelo Grão Duro",
    },
    COMERCIAL_RACAO: {
      label: "Comercial (Padrão Ração / Consumo Animal)",
      shortTag: "Padrão Ração",
    },
    BRANCO_CANJICA: {
      label: "Milho Branco (Canjica / Indústria)",
      shortTag: "Milho Branco",
    },
    PIPOCA: { label: "Milho Pipoca", shortTag: "Milho Pipoca" },
    SILAGEM_GRAO_UMIDO: {
      label: "Silagem / Grão Úmido",
      shortTag: "Silagem / Grão Úmido",
    },
    OUTRO: { label: "Outro", shortTag: "Outro" },
  },
  CAFE: {
    ARABICA_TIPO6_DURA: {
      label: "Arábica — Tipo 6 / Bebida Dura",
      shortTag: "Arábica Bebida Dura",
    },
    ARABICA_MOLE_ESPECIAL: {
      label: "Arábica — Bebida Mole / Especial",
      shortTag: "Arábica Bebida Mole",
    },
    ARABICA_RIADA_RIO: {
      label: "Arábica — Bebida Riada / Rio",
      shortTag: "Arábica Riada / Rio",
    },
    CONILON_ROBUSTA: { label: "Conilon / Robusta", shortTag: "Conilon / Robusta" },
    COCO_NATURAL: { label: "Café em Coco / Natural", shortTag: "Café em Coco" },
    OUTRO: { label: "Outro", shortTag: "Outro" },
  },
  TRIGO: {
    PAO_TIPO1: { label: "Trigo Pão (Tipo 1)", shortTag: "Trigo Pão (Tipo 1)" },
    MELHORADOR: { label: "Trigo Melhorador", shortTag: "Trigo Melhorador" },
    BRANDO_BISCOITO: {
      label: "Trigo Brando (Biscoito / Confeitaria)",
      shortTag: "Trigo Brando",
    },
    RACAO_OUTROS: { label: "Ração Animal / Outros Usos", shortTag: "Trigo Ração" },
    OUTRO: { label: "Outro", shortTag: "Outro" },
  },
};

export function normalizarSafraParaBackend(safraRaw: string): string {
  const match = safraRaw.trim().match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (match) {
    const y1 = parseInt(match[1], 10);
    const y2 = parseInt(match[2], 10);
    if (y2 === y1 + 1) {
      return `${y1}/${y2}`;
    }
    return `${y1}/${y1 + 1}`;
  }
  const matchAno = safraRaw.match(/\d{4}/);
  if (matchAno) {
    const y = parseInt(matchAno[0], 10);
    return `${y}/${y + 1}`;
  }
  return "2025/2026";
}

export function converterDataUrlParaBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;
    const matchMime = parts[0].match(/:(.*?);/);
    const mime = matchMime ? matchMime[1] : "image/jpeg";
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  } catch {
    return null;
  }
}

export function payloadAnimalParaBackend(input: CreateAnimalAdInput) {
  let racaBackend = BREED_FRONT_TO_BACK[input.raca] || input.raca.trim();
  let racaPersonalizada: string | undefined = undefined;

  if (!BACKEND_RACAS.includes(racaBackend as (typeof BACKEND_RACAS)[number])) {
    racaPersonalizada = input.raca.trim().slice(0, 30);
    racaBackend = "OUTRA";
  } else if (racaBackend === "OUTRA") {
    racaPersonalizada = input.raca.trim().slice(0, 30) || "Cruzamento";
  }

  let finalidadeBackend = input.finalidade;
  if (finalidadeBackend === "CRIA") finalidadeBackend = "CRIA_DESMAMA";
  else if (finalidadeBackend === "RECRIA") finalidadeBackend = "RECRIA_GARROTES";
  else if (finalidadeBackend === "REPRODUCAO") finalidadeBackend = "REPRODUCAO_TOUROS";

  const cabecas = Math.max(1, Math.floor(input.quantidadeCabecas));
  const pesoVivoPorCabeca = Math.max(1, input.pesoMedioKg);

  let precoTotal = 0;
  let precoPorCabeca: number | undefined = undefined;

  if (input.pricingMode === "PER_HEAD" && input.precoPorCabeca) {
    precoPorCabeca = Number(input.precoPorCabeca.toFixed(2));
    precoTotal = Number((precoPorCabeca * cabecas).toFixed(2));
  } else if (input.precoTotal) {
    precoTotal = Number(input.precoTotal.toFixed(2));
    precoPorCabeca = Number((precoTotal / cabecas).toFixed(2));
  }

  return {
    categoria: "ANIMAL",
    especie: "BOVINO",
    titulo: input.titulo.trim(),
    descricao: input.descricao?.trim() || undefined,
    cidade: input.cidade.trim(),
    uf: input.uf.trim().toUpperCase(),
    ...(input.regiaoAproximada ? { regiaoAproximada: input.regiaoAproximada.trim() } : {}),
    raca: racaBackend,
    ...(racaPersonalizada ? { racaPersonalizada } : {}),
    finalidade: finalidadeBackend,
    quantidadeCabecas: cabecas,
    pesoMedioKg: pesoVivoPorCabeca,
    ...(input.idadeMeses ? { idadeMeses: Math.floor(Number(input.idadeMeses)) } : {}),
    pricingMode: input.pricingMode,
    precoTotal,
    ...(input.pricingMode === "PER_HEAD" ? { precoPorCabeca } : {}),
  };
}

export function payloadGraosParaBackend(input: CreateGrainAdInput) {
  const cultura = input.cultura;
  const mapaCultura = SUBTYPE_FRONT_TO_BACK[cultura] || {};
  let subtipoBackend = mapaCultura[input.subtipo] || input.subtipo.trim();
  let subtipoPersonalizado: string | undefined = undefined;

  if (!Object.values(mapaCultura).includes(subtipoBackend)) {
    subtipoPersonalizado = input.subtipo.trim().slice(0, 30);
    subtipoBackend = "OUTRO";
  }

  const quantidadeSacas = Math.max(1, Math.round(input.quantidadeSacas));
  const pesoTotalKg = Number((quantidadeSacas * 60).toFixed(2));
  const pesoTotalToneladas = Number(
    (input.pesoTotalToneladas > 0 ? input.pesoTotalToneladas : pesoTotalKg / 1000).toFixed(3)
  );

  let precoTotal = 0;
  let precoPorSaca: number | undefined = undefined;

  if (input.pricingMode === "PER_SACK" && input.precoPorSaca) {
    precoPorSaca = Number(input.precoPorSaca.toFixed(2));
    precoTotal = Number((precoPorSaca * quantidadeSacas).toFixed(2));
  } else if (input.precoTotal) {
    precoTotal = Number(input.precoTotal.toFixed(2));
    precoPorSaca = Number((precoTotal / quantidadeSacas).toFixed(2));
  }

  const safraBackend = normalizarSafraParaBackend(input.safra);

  let umidade = Number(input.umidadePercentual);
  if (isNaN(umidade) || umidade < 1) umidade = 13.5;
  if (umidade > 50) umidade = 50;

  return {
    categoria: "GRAOS",
    cultura,
    ...(cultura === "OUTRO" && input.culturaPersonalizada
      ? { culturaPersonalizada: input.culturaPersonalizada.trim().slice(0, 30) }
      : {}),
    subtipo: subtipoBackend,
    ...(subtipoPersonalizado ? { subtipoPersonalizado } : {}),
    safra: safraBackend,
    embalagem: input.embalagem,
    umidadePercentual: Number(umidade.toFixed(2)),
    quantidadeSacas,
    pesoTotalToneladas,
    pricingMode: input.pricingMode,
    precoTotal,
    ...(input.pricingMode === "PER_SACK" ? { precoPorSaca } : {}),
    ...(input.laudoTecnico ? { laudoTecnico: input.laudoTecnico } : {}),
    titulo: input.titulo.trim(),
    descricao: input.descricao?.trim() || undefined,
    cidade: input.cidade.trim(),
    uf: input.uf.trim().toUpperCase(),
    ...(input.regiaoAproximada ? { regiaoAproximada: input.regiaoAproximada.trim() } : {}),
  };
}

export interface KnownAdMeta {
  farmName: string;
  vendedorNome: string;
  vendedorId: string;
  raca?: string;
  racaPersonalizada?: string;
}

const AD_BREED_CACHE_KEY = "safradireta_ad_breed_cache";

export function salvarRacaEmCache(adId: string, raca: string, racaPersonalizada?: string): void {
  if (!adId) return;
  try {
    const raw = sessionStorage.getItem(AD_BREED_CACHE_KEY);
    const map: Record<string, { raca: string; racaPersonalizada?: string }> = raw ? JSON.parse(raw) : {};
    map[adId] = { raca, racaPersonalizada };
    sessionStorage.setItem(AD_BREED_CACHE_KEY, JSON.stringify(map));
  } catch {}
}

export function obterRacaDeCache(adId: string): { raca: string; racaPersonalizada?: string } | undefined {
  if (!adId) return undefined;
  try {
    const raw = sessionStorage.getItem(AD_BREED_CACHE_KEY);
    if (!raw) return undefined;
    const map = JSON.parse(raw);
    return map[adId];
  } catch {
    return undefined;
  }
}

export function inferirRacaDeTexto(texto?: string): { raca: string; racaPersonalizada?: string } | undefined {
  if (!texto) return undefined;
  const t = texto.toLowerCase();
  if (
    t.includes("cruzamento industrial") ||
    t.includes("cruzamento f1") ||
    t.includes("industrial f1") ||
    t.includes("girolando") ||
    t.includes("meio-sangue") ||
    t.includes("1/2 sangue") ||
    t.includes("f1")
  ) {
    return { raca: "Cruzamento Industrial F1" };
  }
  if (t.includes("angus") || t.includes("aberdeen")) {
    return { raca: "Angus (Aberdeen Angus)" };
  }
  if (t.includes("brangus")) {
    return { raca: "Brangus" };
  }
  if (t.includes("senepol")) {
    return { raca: "Senepol" };
  }
  if (t.includes("brahman")) {
    return { raca: "Brahman" };
  }
  if (t.includes("tabapuã") || t.includes("tabapua")) {
    return { raca: "Tabapuã" };
  }
  if (t.includes("guzerá") || t.includes("guzera")) {
    return { raca: "Guzerá" };
  }
  if (t.includes("hereford") || t.includes("braford")) {
    return { raca: "Hereford / Braford" };
  }
  if (t.includes("anelorado") || t.includes("mestiço") || t.includes("mestico")) {
    return { raca: "Anelorado / Mestiço" };
  }
  if (t.includes("dorper") || t.includes("borrega") || t.includes("ovino") || t.includes("carneiro")) {
    return { raca: "OUTRA", racaPersonalizada: "Ovinos / Dorper" };
  }
  if (t.includes("nelore")) {
    return { raca: "Nelore" };
  }
  return undefined;
}

export const KNOWN_AD_METADATA: Record<string, KnownAdMeta> = {
  // Fernando Kintschner - Fazenda Bela Vista (Uberaba / Araxá - MG)
  "2c2e20a6-4133-44af-a1b4-f49dd9db7731": {
    farmName: "Fazenda Bela Vista",
    vendedorNome: "Fernando Kintschner",
    vendedorId: "26aa7800-eb21-4d65-838e-91830e3cda5f",
    raca: "Nelore",
  },
  "0fb43c11-1b4e-4a33-a567-470aca113ad6": {
    farmName: "Fazenda Bela Vista",
    vendedorNome: "Fernando Kintschner",
    vendedorId: "26aa7800-eb21-4d65-838e-91830e3cda5f",
    raca: "Angus (Aberdeen Angus)",
  },
  "8c00d303-e008-46e6-833a-9045b133b008": {
    farmName: "Fazenda Bela Vista",
    vendedorNome: "Fernando Kintschner",
    vendedorId: "26aa7800-eb21-4d65-838e-91830e3cda5f",
    raca: "Nelore",
  },
  "0ab3a44a-82bb-48e1-a6a0-abc2878660d1": {
    farmName: "Fazenda Bela Vista",
    vendedorNome: "Fernando Kintschner",
    vendedorId: "26aa7800-eb21-4d65-838e-91830e3cda5f",
    raca: "Nelore",
  },
  "ed6510ce-7e31-4643-88cb-500696744f13": {
    farmName: "Fazenda Bela Vista",
    vendedorNome: "Fernando Kintschner",
    vendedorId: "26aa7800-eb21-4d65-838e-91830e3cda5f",
  },
  // Agropecuária Vale Dourado - Fazenda Vale Dourado (Rio Verde - GO)
  "bd31bd0e-8cff-40de-8c2f-42bbb2297b77": {
    farmName: "Fazenda Vale Dourado",
    vendedorNome: "Agropecuária Vale Dourado Comércio e Exportação LTDA",
    vendedorId: "6bc5b7b6-8334-44fb-83ea-67c6a04c0c0d",
  },
  // Maria Luisa Coan Zin - Fazendinha Hay Day da Maria (Chapecó / Lages - SC)
  "e357d58e-d8d5-4118-b0d9-e1b377a2f6c6": {
    farmName: "Fazendinha Hay Day da Maria",
    vendedorNome: "Maria Luisa Coan Zin",
    vendedorId: "66d23d46-5e71-47d1-8b56-be1654bc0cc0",
    raca: "Cruzamento Industrial F1",
  },
  "ed676a1a-cb2d-454c-a4bd-bd3af4ec7fbe": {
    farmName: "Fazendinha Hay Day da Maria",
    vendedorNome: "Maria Luisa Coan Zin",
    vendedorId: "66d23d46-5e71-47d1-8b56-be1654bc0cc0",
  },
  // Dorper / Ovinos
  "96c0f65a-5081-4fb3-8490-cab62bab5f2e": {
    farmName: "Fazenda Santa Fé",
    vendedorNome: "Produtor Rural",
    vendedorId: "66d23d46-5e71-47d1-8b56-be1654bc0cc0",
    raca: "OUTRA",
    racaPersonalizada: "Ovinos / Dorper",
  },
};

export function adaptarAnuncioDaApiParaFrontend(
  apiAd: Record<string, any>,
  fallbackLocal?: MarketplaceAd
): MarketplaceAd {
  const adId = String(apiAd.id || "");
  const knownMeta = KNOWN_AD_METADATA[adId];

  const resolvedVendedorId = String(
    apiAd.vendedorId || fallbackLocal?.vendedorId || knownMeta?.vendedorId || ""
  );
  const resolvedVendedorNome =
    apiAd.vendedor?.nome ||
    fallbackLocal?.vendedorNome ||
    knownMeta?.vendedorNome ||
    "Produtor Rural";
  const resolvedFarmName =
    apiAd.farmName ||
    apiAd.nomePropriedade ||
    fallbackLocal?.farmName ||
    knownMeta?.farmName ||
    "Fazenda";

  const isAnimal = apiAd.categoria === "ANIMAL" || Boolean(apiAd.quantidadeCabecas);
  const midias = Array.isArray(apiAd.midias) ? apiAd.midias : [];
  const fotosUrls = midias
    .filter((m: any) => m.tipo === "FOTO")
    .map((m: any) => m.url || `/api/midias/${m.id}`);

  const capaMidia = midias.find((m: any) => m.capa) || midias[0];
  const capaUrl =
    apiAd.capa?.url ||
    (capaMidia ? capaMidia.url || `/api/midias/${capaMidia.id}` : undefined) ||
    fallbackLocal?.imagemUrl ||
    (isAnimal ? defaultFarmImage : harvestSunsetImage);

  const statusMap: Record<string, AdStatus> = {
    ATIVO: "ATIVO",
    PAUSADO: "PAUSADO",
    VENDIDO: "VENDIDO",
    CANCELADO: "CANCELADO",
    RASCUNHO: "PAUSADO",
  };

  const isFallbackEncerrado =
    fallbackLocal?.status === "VENDIDO" || fallbackLocal?.status === "CANCELADO";

  const status: AdStatus = isFallbackEncerrado
    ? fallbackLocal.status
    : statusMap[apiAd.estadoComercial] || "ATIVO";

  const encerradoEm = isFallbackEncerrado
    ? fallbackLocal?.encerradoEm || apiAd.encerradoEm
    : apiAd.encerradoEm || fallbackLocal?.encerradoEm;

  const motivoEncerramento = isFallbackEncerrado
    ? fallbackLocal?.motivoEncerramento || apiAd.motivoEncerramento
    : apiAd.motivoEncerramento || fallbackLocal?.motivoEncerramento;

  const observacoesEncerramento = isFallbackEncerrado
    ? fallbackLocal?.observacoesEncerramento || apiAd.observacoesEncerramento
    : apiAd.observacoesEncerramento || fallbackLocal?.observacoesEncerramento;

  if (isAnimal) {
    const rawRacaApi = apiAd.raca ? (BREED_BACK_TO_FRONT[apiAd.raca] || apiAd.raca) : undefined;
    const localRaca = fallbackLocal?.categoria === "ANIMAL" ? fallbackLocal.raca : undefined;
    const cached = obterRacaDeCache(adId);
    const knownRaca = knownMeta?.raca;
    const inferred = inferirRacaDeTexto(`${apiAd.titulo || ""} ${apiAd.descricao || ""} ${apiAd.produto || ""}`);

    let raca =
      rawRacaApi ||
      localRaca ||
      cached?.raca ||
      knownRaca ||
      inferred?.raca ||
      "Nelore";

    let racaPersonalizada =
      apiAd.racaPersonalizada ||
      (fallbackLocal?.categoria === "ANIMAL" ? (fallbackLocal as any).racaPersonalizada : undefined) ||
      cached?.racaPersonalizada ||
      knownMeta?.racaPersonalizada ||
      inferred?.racaPersonalizada;

    if (raca === "OUTRA" && racaPersonalizada) {
      raca = racaPersonalizada;
    }

    if (adId && raca) {
      salvarRacaEmCache(adId, raca, racaPersonalizada);
    }

    const cabecas = apiAd.quantidadeCabecas || 1;
    const precoTotal = Number(apiAd.precoTotal || 0);
    const precoPorCabeca = apiAd.precoPorCabeca || (cabecas > 0 ? precoTotal / cabecas : 0);
    const pesoMedioKg = apiAd.pesoMedioKg || 450;
    const pesoMedioArroba = Number((pesoMedioKg / 30).toFixed(2));
    const pesoTotalKg = Number((pesoMedioKg * cabecas).toFixed(2));
    const pesoTotalArroba = Number((pesoTotalKg / 30).toFixed(2));
    const precoPorArroba = pesoTotalArroba > 0 ? Number((precoTotal / pesoTotalArroba).toFixed(2)) : 0;

    const animalAd: AnimalLotAd = {
      id: adId,
      vendedorId: resolvedVendedorId,
      vendedorNome: resolvedVendedorNome,
      vendedorAvatar: fallbackLocal?.vendedorAvatar,
      farmName: resolvedFarmName,
      titulo: apiAd.titulo || "",
      descricao: apiAd.descricao || undefined,
      categoria: "ANIMAL",
      especie: apiAd.especie || "BOVINO",
      raca,
      quantidadeCabecas: cabecas,
      finalidade: apiAd.finalidade || "ENGORDA_ABATE",
      idadeMeses: apiAd.idadeMeses,
      pesoMedioKg,
      pesoMedioArroba,
      pesoTotalKg,
      pesoTotalArroba,
      precoTotal,
      precoPorCabeca: Number(precoPorCabeca.toFixed(2)),
      precoPorArroba,
      cidade: apiAd.cidade || "",
      uf: apiAd.uf || "",
      regiaoAproximada: apiAd.regiaoAproximada || fallbackLocal?.regiaoAproximada,
      fotos: fotosUrls.length > 0 ? fotosUrls : fallbackLocal?.fotos,
      video: fallbackLocal?.video,
      documentos: fallbackLocal?.documentos,
      imagemUrl: capaUrl,
      criadoEm: apiAd.criadoEm || apiAd.publicadoEm || new Date().toISOString(),
      atualizadoEm: apiAd.atualizadoEm,
      status,
      seloVerificado: true,
      encerradoEm,
      motivoEncerramento,
      observacoesEncerramento,
    };
    return animalAd;
  } else {
    const cultura = (apiAd.cultura || "SOJA") as GrainCrop;
    const mapaSubtipos = SUBTYPE_BACK_TO_FRONT[cultura] || {};
    const infoSubtipo = mapaSubtipos[apiAd.subtipo];

    let subtipoFinal = infoSubtipo?.label || apiAd.subtipo || "Comercial";
    if (apiAd.subtipo === "OUTRO" && apiAd.subtipoPersonalizado) {
      subtipoFinal = apiAd.subtipoPersonalizado;
    }

    const tagPrincipal = GRAIN_CROP_LABELS[cultura] || "Grãos";
    const tagSecundaria = infoSubtipo?.shortTag || subtipoFinal.slice(0, 30);

    const quantidadeSacas = apiAd.quantidadeSacas || 1;
    const precoTotal = Number(apiAd.precoTotal || 0);
    const precoPorSaca = apiAd.precoPorSaca || (quantidadeSacas > 0 ? precoTotal / quantidadeSacas : 0);
    const pesoTotalKg = Number((quantidadeSacas * 60).toFixed(2));
    const pesoTotalToneladas = apiAd.pesoTotalToneladas || Number((pesoTotalKg / 1000).toFixed(2));
    const precoPorTonelada =
      pesoTotalToneladas > 0 ? Number((precoTotal / pesoTotalToneladas).toFixed(2)) : 0;

    const grainAd: GrainLotAd = {
      id: adId,
      vendedorId: resolvedVendedorId,
      vendedorNome: resolvedVendedorNome,
      vendedorAvatar: fallbackLocal?.vendedorAvatar,
      farmName: resolvedFarmName,
      titulo: apiAd.titulo || "",
      descricao: apiAd.descricao || undefined,
      categoria: "GRAOS",
      cultura,
      culturaPersonalizada: apiAd.culturaPersonalizada,
      subtipo: subtipoFinal,
      tagPrincipal,
      tagSecundaria,
      safra: apiAd.safra || "2025/2026",
      embalagem: apiAd.embalagem || "SACARIA",
      umidadePercentual: apiAd.umidadePercentual || 13.5,
      laudoTecnico: apiAd.laudoTecnico,
      quantidadeSacas,
      pesoTotalToneladas,
      pesoTotalKg,
      precoTotal,
      precoPorSaca: Number(precoPorSaca.toFixed(2)),
      precoPorTonelada,
      cidade: apiAd.cidade || "",
      uf: apiAd.uf || "",
      regiaoAproximada: apiAd.regiaoAproximada || fallbackLocal?.regiaoAproximada,
      fotos: fotosUrls.length > 0 ? fotosUrls : fallbackLocal?.fotos,
      video: fallbackLocal?.video,
      documentos: fallbackLocal?.documentos,
      imagemUrl: capaUrl,
      criadoEm: apiAd.criadoEm || apiAd.publicadoEm || new Date().toISOString(),
      atualizadoEm: apiAd.atualizadoEm,
      status,
      seloVerificado: true,
      encerradoEm,
      motivoEncerramento,
      observacoesEncerramento,
    };
    return grainAd;
  }
}

export async function apiCriarAnuncioBackend(
  payload: ReturnType<typeof payloadAnimalParaBackend> | ReturnType<typeof payloadGraosParaBackend>,
  token: string
): Promise<Record<string, any>> {
  const resp = await fetch("/api/vendedor/anuncios", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => null);
    const msg =
      errorBody?.erro?.mensagem ||
      (errorBody?.erro?.campos ? Object.values(errorBody.erro.campos).join(" ") : null) ||
      `Erro ao cadastrar anúncio (HTTP ${resp.status})`;
    throw new Error(msg);
  }

  return resp.json();
}

export async function apiUploadMidiaBackend(
  anuncioId: string,
  arquivo: Blob | File,
  nomeArquivo: string,
  token: string
): Promise<void> {
  const formData = new FormData();
  formData.append("arquivo", arquivo, nomeArquivo);

  const resp = await fetch(`/api/vendedor/anuncios/${anuncioId}/midias`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => null);
    console.warn("Falha no upload de mídia na API:", errorBody);
  }
}

export async function apiListarCatalogoPublico(
  filtros?: Record<string, string | number | undefined>
): Promise<{ itens: any[]; total: number }> {
  const params = new URLSearchParams();
  if (filtros) {
    for (const [k, v] of Object.entries(filtros)) {
      if (v !== undefined && v !== null && v !== "") {
        params.append(k, String(v));
      }
    }
  }

  const qs = params.toString();
  const url = `/api/anuncios${qs ? `?${qs}` : ""}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Falha ao consultar catálogo de anúncios (HTTP ${resp.status})`);
  }
  return resp.json();
}

export async function apiObterAnuncioPublico(anuncioId: string): Promise<Record<string, any>> {
  const resp = await fetch(`/api/anuncios/${anuncioId}`);
  if (!resp.ok) {
    throw new Error(`Anúncio não encontrado na API (HTTP ${resp.status})`);
  }
  return resp.json();
}

export async function apiObterAnuncioDono(anuncioId: string, token: string): Promise<Record<string, any>> {
  const resp = await fetch(`/api/vendedor/anuncios/${anuncioId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    throw new Error(`Anúncio não encontrado na API do vendedor (HTTP ${resp.status})`);
  }
  return resp.json();
}

export async function apiPausarAnuncioBackend(anuncioId: string, token: string): Promise<void> {
  const resp = await fetch(`/api/vendedor/anuncios/${anuncioId}/pausar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => null);
    throw new Error(errorBody?.erro?.mensagem || `Erro ao pausar anúncio (HTTP ${resp.status})`);
  }
}

export async function apiReativarAnuncioBackend(anuncioId: string, token: string): Promise<void> {
  const resp = await fetch(`/api/vendedor/anuncios/${anuncioId}/reativar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => null);
    throw new Error(errorBody?.erro?.mensagem || `Erro ao reativar anúncio (HTTP ${resp.status})`);
  }
}

export async function apiEditarAnuncioBackend(
  anuncioId: string,
  payload: Record<string, any>,
  token: string
): Promise<Record<string, any>> {
  const resp = await fetch(`/api/vendedor/anuncios/${anuncioId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => null);
    throw new Error(errorBody?.erro?.mensagem || `Erro ao atualizar anúncio (HTTP ${resp.status})`);
  }
  return resp.json();
}

function normalizarMotivoParaBackend(motivo: string): string {
  const mapa: Record<string, string> = {
    "Venda externa (Frigorífico / Indústria)": "VENDA_EXTERNA",
    "Venda para outro produtor / vizinho": "VENDA_OUTRO_PRODUTOR",
    "Negociação intermediada pelo SafraDireta": "NEGOCIACAO_SAFRADIRETA",
    "Outro destino comercial": "OUTRO_DESTINO_COMERCIAL",
    "Retenção na propriedade (recria / confinamento / silo)": "RETENCAO_PROPRIEDADE",
    "Perda física ou descarte sanitário": "PERDA_FISICA_SANITARIA",
    "Desistência comercial (mercado desfavorável)": "DESISTENCIA_COMERCIAL",
    "Erro de cadastro / Duplicidade": "ERRO_CADASTRO",
    "Outro motivo": "OUTRO_MOTIVO",
  };

  if (mapa[motivo]) return mapa[motivo];
  if (/^[A-Z][A-Z0-9_]*$/.test(motivo)) return motivo;

  const normalizado = motivo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .toUpperCase()
    .replace(/^_+|_+$/g, "");

  return normalizado || "OUTRO_MOTIVO";
}

export async function apiEncerrarAnuncioBackend(
  anuncioId: string,
  payload: {
    tipo: "VENDIDO" | "CANCELADO";
    motivo: string;
    observacoes?: string;
    desvincularDocumentos?: boolean;
  },
  token: string
): Promise<Record<string, any>> {
  const body = {
    status: payload.tipo,
    motivo: normalizarMotivoParaBackend(payload.motivo),
    observacoes: payload.observacoes?.trim() || undefined,
  };

  const resp = await fetch(`/api/anuncios/${anuncioId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => null);
    throw new Error(
      errorBody?.erro?.mensagem ||
      errorBody?.detail?.[0]?.msg ||
      errorBody?.message ||
      `Erro ao encerrar anúncio (HTTP ${resp.status})`
    );
  }
  return resp.json();
}

/* =========================================================================
   FAVORITOS (US-025)
   ========================================================================= */

export async function apiFavoritarAnuncio(anuncioId: string, token: string): Promise<void> {
  const resp = await fetch(`/api/anuncios/${anuncioId}/favoritar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok && resp.status !== 204) {
    const errorBody = await resp.json().catch(() => null);
    throw new Error(errorBody?.erro?.mensagem || `Erro ao favoritar anúncio (HTTP ${resp.status})`);
  }
}

export async function apiDesfavoritarAnuncio(anuncioId: string, token: string): Promise<void> {
  const resp = await fetch(`/api/anuncios/${anuncioId}/favoritar`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok && resp.status !== 204) {
    const errorBody = await resp.json().catch(() => null);
    throw new Error(errorBody?.erro?.mensagem || `Erro ao desfavoritar anúncio (HTTP ${resp.status})`);
  }
}

export async function apiListarFavoritos(
  token: string,
  pagina = 1,
  itensPorPagina = 24
): Promise<{ itens: any[]; total: number; pagina: number; tamanho: number }> {
  const params = new URLSearchParams({
    pagina: String(pagina),
    itens_por_pagina: String(itensPorPagina),
  });
  const resp = await fetch(`/api/favoritos?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    throw new Error(`Erro ao listar favoritos (HTTP ${resp.status})`);
  }
  return resp.json();
}

/* =========================================================================
   DOCUMENTOS E DATA ROOM (US-013)
   ========================================================================= */

export async function apiUploadDocumento(
  anuncioId: string,
  tipo: string,
  arquivo: File | Blob,
  nomeArquivo: string,
  token: string
): Promise<any> {
  const formData = new FormData();
  formData.append("tipo", tipo);
  formData.append("arquivo", arquivo, nomeArquivo);

  const resp = await fetch(`/api/anuncios/${anuncioId}/documentos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => null);
    throw new Error(errorBody?.erro?.mensagem || `Erro ao enviar documento (HTTP ${resp.status})`);
  }
  return resp.json();
}

export async function apiListarDocumentos(
  anuncioId: string,
  token: string
): Promise<{ documentos: any[]; solicitacao?: any; solicitacoes?: any[] }> {
  const resp = await fetch(`/api/anuncios/${anuncioId}/documentos`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    throw new Error(`Erro ao listar documentos do anúncio (HTTP ${resp.status})`);
  }
  return resp.json();
}

export async function apiSolicitarAcessoDocumento(
  anuncioId: string,
  mensagem: string,
  token: string
): Promise<any> {
  const resp = await fetch(`/api/anuncios/${anuncioId}/documentos/solicitar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mensagem }),
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => null);
    throw new Error(errorBody?.erro?.mensagem || `Erro ao solicitar acesso a documentos (HTTP ${resp.status})`);
  }
  return resp.json();
}

export async function apiDecidirSolicitacaoDocumento(
  solicitacaoId: string,
  status: "APROVADO" | "RECUSADO" | "REVOGADO" | "CANCELADO",
  motivoRecusa: string | null,
  token: string
): Promise<any> {
  const resp = await fetch(`/api/documentos/solicitacoes/${solicitacaoId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status,
      motivo_recusa: motivoRecusa,
    }),
  });
  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => null);
    throw new Error(errorBody?.erro?.mensagem || `Erro ao atualizar solicitação de documento (HTTP ${resp.status})`);
  }
  return resp.json();
}


