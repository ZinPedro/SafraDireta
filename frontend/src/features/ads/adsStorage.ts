import { getSession } from "../../context/session";
import type { Session } from "../../context/session";
import type { AnimalLotAd, CreateAnimalAdInput } from "./ads.types";
import defaultFarmImage from "../../assets/images/farm-landscape.jpeg";

const STORAGE_KEY = "safradireta_anuncios";

export interface PublicProducerProfile {
  id: string;
  nome: string;
  avatarUrl?: string;
  farmName: string;
  bio: string;
  city: string;
  state: string;
  publicPhone: string;
  categories: string[];
  hasOwnTransport: boolean;
  seloVerificado: boolean;
}

const INITIAL_SEEDS: AnimalLotAd[] = [
  {
    id: "lote-nelore-80",
    vendedorId: "seed-produtor-01",
    vendedorNome: "Pedro Zin",
    farmName: "Fazenda Santa Maria",
    titulo: "Lote de 80 Bois Nelore — Prontos para Abate",
    descricao:
      "Lote uniforme de machos Nelore terminados em confinamento de 90 dias com dieta de grão inteiro e silagem. Excelente acabamento de carcaça, vacinação e vermifugação 100% em dia. Carregamento com fácil acesso para carreta boiadeira.",
    categoria: "ANIMAL",
    especie: "BOVINO",
    raca: "Nelore",
    quantidadeCabecas: 80,
    finalidade: "ENGORDA_ABATE",
    idadeMeses: 30,
    pesoMedioKg: 540,
    pesoMedioArroba: 18,
    pesoTotalKg: 43200,
    pesoTotalArroba: 1440,
    precoTotal: 240000,
    precoPorCabeca: 3000,
    precoPorArroba: 166.67,
    cidade: "Uberaba",
    uf: "MG",
    imagemUrl: defaultFarmImage,
    criadoEm: "2026-10-10T14:30:00.000Z",
    status: "ATIVO",
    seloVerificado: true,
  },
  {
    id: "lote-angus-45",
    vendedorId: "seed-produtor-02",
    vendedorNome: "Carlos Alberto Silveira",
    farmName: "Agropecuária Vale Verde",
    titulo: "Lote de 45 Novilhas Angus — Recria Confinada",
    descricao:
      "Fêmeas Angus de excelente genética e desenvolvimento zootécnico. Criadas a pasto rotacionado com suplementação proteica. Ideais para terminação intensiva ou cruzamento industrial.",
    categoria: "ANIMAL",
    especie: "BOVINO",
    raca: "Angus",
    quantidadeCabecas: 45,
    finalidade: "RECRIA_GARROTES",
    idadeMeses: 18,
    pesoMedioKg: 360,
    pesoMedioArroba: 12,
    pesoTotalKg: 16200,
    pesoTotalArroba: 540,
    precoTotal: 112500,
    precoPorCabeca: 2500,
    precoPorArroba: 208.33,
    cidade: "Barretos",
    uf: "SP",
    imagemUrl: defaultFarmImage,
    criadoEm: "2026-10-09T10:15:00.000Z",
    status: "ATIVO",
    seloVerificado: true,
  },
];

function carregarDoStorage(): AnimalLotAd[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEEDS));
      return INITIAL_SEEDS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEEDS));
      return INITIAL_SEEDS;
    }
    return parsed as AnimalLotAd[];
  } catch {
    return INITIAL_SEEDS;
  }
}

function salvarNoStorage(anuncios: AnimalLotAd[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(anuncios));
  } catch {
    /* falha silenciosa em ambientes restritos */
  }
}

export async function listarAnunciosMercado(): Promise<AnimalLotAd[]> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  const anuncios = carregarDoStorage();
  return anuncios
    .filter((a) => a.status === "ATIVO")
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
}

export async function listarMeusAnuncios(vendedorId: string): Promise<AnimalLotAd[]> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  const anuncios = carregarDoStorage();
  return anuncios
    .filter((a) => a.vendedorId === vendedorId && a.status === "ATIVO")
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
}

export async function obterAnuncioPorId(id: string): Promise<AnimalLotAd | null> {
  await new Promise((resolve) => setTimeout(resolve, 60));
  const anuncios = carregarDoStorage();
  const encontrado = anuncios.find((a) => a.id === id);
  return encontrado || null;
}

export async function obterPerfilProdutorPublico(vendedorId: string): Promise<PublicProducerProfile | null> {
  await new Promise((resolve) => setTimeout(resolve, 60));

  const session = getSession();
  const isCurrentUser = Boolean(session && session.conta.id === vendedorId);

  // 1. Tenta carregar dados sincronizados do perfil armazenado no mock ou na sessão ativa
  try {
    const raw = localStorage.getItem(`safradireta_mock_profile:${vendedorId}`);
    const parsed = raw ? JSON.parse(raw) : null;

    if (parsed?.seller || parsed?.account || isCurrentUser) {
      const avatarUrl =
        parsed?.account?.avatarUrl ||
        (isCurrentUser ? session?.avatarUrl : undefined) ||
        localStorage.getItem(`safradireta_avatar_${vendedorId}`) ||
        (isCurrentUser ? localStorage.getItem("safradireta_avatar") ?? undefined : undefined) ||
        undefined;

      const nome =
        parsed?.account?.nome ||
        (isCurrentUser && session ? session.conta.nome : "Produtor Rural");

      const rawPhone =
        parsed?.seller?.publicPhone ||
        parsed?.account?.telefone ||
        (isCurrentUser && session ? session.conta.telefone || "" : "") ||
        "";

      const digits = rawPhone.replace(/\D/g, "");
      const cleanDigits = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
      const formattedPhone =
        cleanDigits.length === 11
          ? `(${cleanDigits.slice(0, 2)}) ${cleanDigits.slice(2, 7)}-${cleanDigits.slice(7)}`
          : cleanDigits.length === 10
          ? `(${cleanDigits.slice(0, 2)}) ${cleanDigits.slice(2, 6)}-${cleanDigits.slice(6)}`
          : rawPhone;

      const farmName =
        parsed?.seller?.farmName?.trim() ||
        `Fazenda ${nome}`;

      const bio =
        parsed?.seller?.bio?.trim() ||
        "Produtor rural habilitado no SafraDireta, dedicado à pecuária de corte de alta qualidade com procedência sanitária garantida.";

      const city =
        parsed?.seller?.city?.trim() ||
        parsed?.address?.cidade?.trim() ||
        "Uberaba";

      const state =
        parsed?.seller?.state?.trim() ||
        parsed?.address?.uf?.trim() ||
        "MG";

      return {
        id: vendedorId,
        nome,
        avatarUrl,
        farmName,
        bio,
        city,
        state,
        publicPhone: formattedPhone,
        categories:
          parsed?.seller?.categories && parsed.seller.categories.length > 0
            ? parsed.seller.categories
            : ["Boi Gordo"],
        hasOwnTransport: Boolean(parsed?.seller?.hasOwnTransport),
        seloVerificado: true,
      };
    }
  } catch {
    /* fallback para sementes e anúncios */
  }

  // 2. Perfis semeados de demonstração
  if (vendedorId === "seed-produtor-01") {
    return {
      id: "seed-produtor-01",
      nome: "Pedro Zin",
      farmName: "Fazenda Santa Maria",
      bio: "Tradição de mais de 30 anos na seleção de gado Nelore PO e cruzamento industrial de alta performance. Manejo focado em bem-estar animal, nutrição de precisão e terminação intensiva com excelente acabamento de carcaça.",
      city: "Uberaba",
      state: "MG",
      publicPhone: "(34) 99876-5432",
      categories: ["Boi Gordo", "Café"],
      hasOwnTransport: true,
      seloVerificado: true,
    };
  }

  if (vendedorId === "seed-produtor-02") {
    return {
      id: "seed-produtor-02",
      nome: "Carlos Alberto Silveira",
      farmName: "Agropecuária Vale Verde",
      bio: "Pecuária sustentável voltada à recria e engorda de bezerros e novilhas de corte no interior paulista. Rastreabilidade completa do rebanho, sanidade impecável e compromisso com o comprador.",
      city: "Barretos",
      state: "SP",
      publicPhone: "(17) 98765-4321",
      categories: ["Boi Gordo"],
      hasOwnTransport: false,
      seloVerificado: true,
    };
  }

  // 3. Fallback a partir de anúncios cadastrados no storage
  const anuncios = carregarDoStorage();
  const anuncioProdutor = anuncios.find((a) => a.vendedorId === vendedorId);
  if (anuncioProdutor) {
    const avatarUrl =
      anuncioProdutor.vendedorAvatar ||
      (isCurrentUser ? session?.avatarUrl : undefined) ||
      localStorage.getItem(`safradireta_avatar_${vendedorId}`) ||
      (isCurrentUser ? localStorage.getItem("safradireta_avatar") ?? undefined : undefined) ||
      undefined;

    return {
      id: vendedorId,
      nome: anuncioProdutor.vendedorNome,
      avatarUrl,
      farmName: anuncioProdutor.farmName,
      bio: "Produtor rural habilitado no SafraDireta, dedicado à pecuária de corte de alta qualidade com procedência sanitária e bem-estar animal.",
      city: anuncioProdutor.cidade,
      state: anuncioProdutor.uf,
      publicPhone: isCurrentUser && session?.conta.telefone ? session.conta.telefone : "",
      categories: ["Boi Gordo"],
      hasOwnTransport: true,
      seloVerificado: true,
    };
  }

  return null;
}

export async function criarAnuncioAnimal(
  input: CreateAnimalAdInput,
  session: Session,
  farmNameParam?: string
): Promise<AnimalLotAd> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const anuncios = carregarDoStorage();

  const cabecas = Math.max(1, Math.floor(input.quantidadeCabecas));
  const pesoVivoPorCabeca = Math.max(1, input.pesoMedioKg);
  const pesoArrobaPorCabeca = Number((pesoVivoPorCabeca / 30).toFixed(2));

  const pesoTotalKg = Number((pesoVivoPorCabeca * cabecas).toFixed(2));
  const pesoTotalArroba = Number((pesoTotalKg / 30).toFixed(2));

  let precoTotal = 0;
  if (input.pricingMode === "PER_HEAD" && input.precoPorCabeca) {
    precoTotal = Number((input.precoPorCabeca * cabecas).toFixed(2));
  } else if (input.precoTotal) {
    precoTotal = Number(input.precoTotal.toFixed(2));
  }

  const precoPorCabeca = Number((precoTotal / cabecas).toFixed(2));
  const precoPorArroba = pesoTotalArroba > 0 ? Number((precoTotal / pesoTotalArroba).toFixed(2)) : 0;

  let resolvedFarmName = farmNameParam?.trim();
  let resolvedAvatar = session.avatarUrl;

  try {
    const rawProfile = localStorage.getItem(`safradireta_mock_profile:${session.conta.id}`);
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      if (!resolvedFarmName && parsed?.seller?.farmName) {
        resolvedFarmName = parsed.seller.farmName.trim();
      }
      if (!resolvedAvatar && parsed?.account?.avatarUrl) {
        resolvedAvatar = parsed.account.avatarUrl;
      }
    }
    if (!resolvedAvatar) {
      resolvedAvatar =
        localStorage.getItem(`safradireta_avatar_${session.conta.id}`) ||
        localStorage.getItem("safradireta_avatar") ||
        undefined;
    }
  } catch {
    /* ignore */
  }

  if (!resolvedFarmName) {
    resolvedFarmName = `Fazenda ${session.conta.nome}`;
  }

  const novoId = `lote-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const novoAnuncio: AnimalLotAd = {
    id: novoId,
    vendedorId: session.conta.id,
    vendedorNome: session.conta.nome,
    vendedorAvatar: resolvedAvatar,
    farmName: resolvedFarmName,
    titulo: input.titulo.trim(),
    descricao: input.descricao?.trim() || undefined,
    categoria: "ANIMAL",
    especie: input.especie,
    raca: input.raca.trim(),
    quantidadeCabecas: cabecas,
    finalidade: input.finalidade,
    idadeMeses: input.idadeMeses ? Number(input.idadeMeses) : undefined,
    pesoMedioKg: pesoVivoPorCabeca,
    pesoMedioArroba: pesoArrobaPorCabeca,
    pesoTotalKg,
    pesoTotalArroba,
    precoTotal,
    precoPorCabeca,
    precoPorArroba,
    cidade: input.cidade.trim(),
    uf: input.uf.trim().toUpperCase(),
    imagemUrl: defaultFarmImage,
    criadoEm: new Date().toISOString(),
    status: "ATIVO",
    seloVerificado: true,
  };

  const atualizados = [novoAnuncio, ...anuncios];
  salvarNoStorage(atualizados);

  return novoAnuncio;
}
