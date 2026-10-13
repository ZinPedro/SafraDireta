import { getSession } from "../../context/session";
import type { Session } from "../../context/session";
import { GRAIN_CROP_LABELS, GRAIN_SUBTYPES } from "./ads.types";
import type {
  AnimalLotAd,
  CreateAnimalAdInput,
  CreateGrainAdInput,
  GrainLotAd,
  MarketplaceAd,
} from "./ads.types";
import defaultFarmImage from "../../assets/images/farm-landscape.jpeg";
import harvestSunsetImage from "../../assets/images/harvest-sunset.jpeg";

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

function isDataOrLargeUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith("data:") || url.length > 500;
}

function sanitizarAnunciosParaStorage(anuncios: MarketplaceAd[]): MarketplaceAd[] {
  return anuncios.map((anuncio) => {
    if (isDataOrLargeUrl(anuncio.vendedorAvatar)) {
      const { vendedorAvatar: _avatar, ...resto } = anuncio;
      return resto as MarketplaceAd;
    }
    return anuncio;
  });
}

function carregarDoStorage(): MarketplaceAd[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    let precisaLimpeza = false;
    const filtrados = (parsed as MarketplaceAd[]).filter((a) => {
      if (a.id === "lote-nelore-80" || a.id === "lote-angus-45") {
        precisaLimpeza = true;
        return false;
      }
      return true;
    });

    const limpos = filtrados.map((a) => {
      let item = a;
      if (!(item as { categoria?: string }).categoria) {
        item = { ...(item as object), categoria: "ANIMAL" } as AnimalLotAd;
      }
      if (isDataOrLargeUrl(item.vendedorAvatar)) {
        precisaLimpeza = true;
        const { vendedorAvatar: _avatar, ...resto } = item;
        return resto as MarketplaceAd;
      }
      return item;
    });

    if (precisaLimpeza) {
      salvarNoStorage(limpos);
    }
    return limpos;
  } catch {
    return [];
  }
}

function salvarNoStorage(anuncios: MarketplaceAd[]): boolean {
  try {
    const limpos = sanitizarAnunciosParaStorage(anuncios);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limpos));
    return true;
  } catch (err) {
    console.warn("Aviso ao salvar anúncios no localStorage:", err);
    try {
      const limpos = sanitizarAnunciosParaStorage(anuncios);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limpos));
      return true;
    } catch (e) {
      console.error("Falha crítica ao persistir anúncios no localStorage:", e);
      return false;
    }
  }
}

export function hidratarAnuncioComPerfil<T extends MarketplaceAd>(anuncio: T): T {
  try {
    const session = getSession();
    const isCurrentUser = Boolean(session && session.conta.id === anuncio.vendedorId);
    const raw = localStorage.getItem(`safradireta_mock_profile:${anuncio.vendedorId}`);
    const parsed = raw ? JSON.parse(raw) : null;

    const farmName =
      parsed?.seller?.farmName?.trim() ||
      anuncio.farmName;

    const vendedorNome =
      parsed?.account?.nome?.trim() ||
      (isCurrentUser && session?.conta.nome ? session.conta.nome : anuncio.vendedorNome);

    const vendedorAvatar =
      parsed?.account?.avatarUrl ||
      (isCurrentUser ? session?.avatarUrl : undefined) ||
      localStorage.getItem(`safradireta_avatar_${anuncio.vendedorId}`) ||
      (isCurrentUser ? localStorage.getItem("safradireta_avatar") ?? undefined : undefined) ||
      anuncio.vendedorAvatar;

    return {
      ...anuncio,
      farmName: farmName || anuncio.farmName,
      vendedorNome: vendedorNome || anuncio.vendedorNome,
      vendedorAvatar: vendedorAvatar || anuncio.vendedorAvatar,
    };
  } catch {
    return anuncio;
  }
}

export function sincronizarProdutorNosAnuncios(
  vendedorId: string,
  dados: { farmName?: string; vendedorNome?: string; avatarUrl?: string }
): void {
  try {
    const anuncios = carregarDoStorage();
    let modificado = false;

    const avatarParaPersistir = isDataOrLargeUrl(dados.avatarUrl) ? undefined : dados.avatarUrl;

    const atualizados = anuncios.map((anuncio) => {
      if (anuncio.vendedorId !== vendedorId) {
        return anuncio;
      }
      modificado = true;
      return {
        ...anuncio,
        ...(dados.farmName?.trim() ? { farmName: dados.farmName.trim() } : {}),
        ...(dados.vendedorNome?.trim() ? { vendedorNome: dados.vendedorNome.trim() } : {}),
        ...(avatarParaPersistir !== undefined ? { vendedorAvatar: avatarParaPersistir } : {}),
      };
    });

    if (modificado) {
      salvarNoStorage(atualizados);
    }
  } catch {
    /* falha silenciosa em ambientes restritos */
  }
}

export async function listarAnunciosMercado(): Promise<MarketplaceAd[]> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  const anuncios = carregarDoStorage();
  return anuncios
    .filter((a) => a.status === "ATIVO")
    .map((a) => hidratarAnuncioComPerfil(a))
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
}

export async function listarMeusAnuncios(vendedorId: string): Promise<MarketplaceAd[]> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  const anuncios = carregarDoStorage();
  return anuncios
    .filter((a) => a.vendedorId === vendedorId && a.status === "ATIVO")
    .map((a) => hidratarAnuncioComPerfil(a))
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
}

export async function obterAnuncioPorId(id: string): Promise<MarketplaceAd | null> {
  await new Promise((resolve) => setTimeout(resolve, 60));
  const anuncios = carregarDoStorage();
  const encontrado = anuncios.find((a) => a.id === id);
  return encontrado ? hidratarAnuncioComPerfil(encontrado) : null;
}

export async function obterPerfilProdutorPublico(vendedorId: string): Promise<PublicProducerProfile | null> {
  await new Promise((resolve) => setTimeout(resolve, 60));

  const session = getSession();
  const isCurrentUser = Boolean(session && session.conta.id === vendedorId);
  const anuncios = carregarDoStorage();
  const anuncioVendedor = anuncios.find((a) => a.vendedorId === vendedorId);

  try {
    const raw = localStorage.getItem(`safradireta_mock_profile:${vendedorId}`);
    const parsed = raw ? JSON.parse(raw) : null;

    if (parsed?.seller || parsed?.account || isCurrentUser || anuncioVendedor) {
      const avatarUrl =
        parsed?.account?.avatarUrl ||
        (isCurrentUser ? session?.avatarUrl : undefined) ||
        anuncioVendedor?.vendedorAvatar ||
        localStorage.getItem(`safradireta_avatar_${vendedorId}`) ||
        (isCurrentUser ? localStorage.getItem("safradireta_avatar") ?? undefined : undefined) ||
        undefined;

      const nome =
        parsed?.account?.nome?.trim() ||
        (isCurrentUser && session ? session.conta.nome : undefined) ||
        anuncioVendedor?.vendedorNome ||
        "Produtor Rural";

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
        anuncioVendedor?.farmName ||
        `Fazenda ${nome}`;

      const bio =
        parsed?.seller?.bio?.trim() ||
        "Produtor rural habilitado no SafraDireta, dedicado à produção agropecuária de alta qualidade com procedência garantida.";

      const city =
        parsed?.seller?.city?.trim() ||
        parsed?.address?.cidade?.trim() ||
        anuncioVendedor?.cidade ||
        "Uberaba";

      const state =
        parsed?.seller?.state?.trim() ||
        parsed?.address?.uf?.trim() ||
        anuncioVendedor?.uf ||
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
            : anuncioVendedor?.categoria === "GRAOS"
            ? ["Grãos e Café"]
            : ["Boi Gordo"],
        hasOwnTransport: Boolean(parsed?.seller?.hasOwnTransport ?? anuncioVendedor),
        seloVerificado: true,
      };
    }
  } catch {
    /* fallback para anúncios */
  }

  if (anuncioVendedor) {
    const avatarUrl =
      anuncioVendedor.vendedorAvatar ||
      (isCurrentUser ? session?.avatarUrl : undefined) ||
      localStorage.getItem(`safradireta_avatar_${vendedorId}`) ||
      (isCurrentUser ? localStorage.getItem("safradireta_avatar") ?? undefined : undefined) ||
      undefined;

    return {
      id: vendedorId,
      nome: anuncioVendedor.vendedorNome,
      avatarUrl,
      farmName: anuncioVendedor.farmName,
      bio: "Produtor rural habilitado no SafraDireta, dedicado à produção agropecuária de alta qualidade com procedência garantida.",
      city: anuncioVendedor.cidade,
      state: anuncioVendedor.uf,
      publicPhone: isCurrentUser && session?.conta.telefone ? session.conta.telefone : "",
      categories: anuncioVendedor.categoria === "GRAOS" ? ["Grãos e Café"] : ["Boi Gordo"],
      hasOwnTransport: true,
      seloVerificado: true,
    };
  }

  return null;
}

function resolverDadosProdutorSessao(
  session: Session,
  farmNameParam?: string
): { resolvedFarmName: string; avatarPersistivel?: string } {
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

  const avatarPersistivel = isDataOrLargeUrl(resolvedAvatar) ? undefined : resolvedAvatar;
  return { resolvedFarmName, avatarPersistivel };
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

  const { resolvedFarmName, avatarPersistivel } = resolverDadosProdutorSessao(session, farmNameParam);
  const novoId = `lote-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const novoAnuncio: AnimalLotAd = {
    id: novoId,
    vendedorId: session.conta.id,
    vendedorNome: session.conta.nome,
    vendedorAvatar: avatarPersistivel,
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
  const salvou = salvarNoStorage(atualizados);
  if (!salvou) {
    throw new Error("Não foi possível persistir o anúncio no armazenamento local do navegador.");
  }

  return hidratarAnuncioComPerfil(novoAnuncio);
}

export async function criarAnuncioGraos(
  input: CreateGrainAdInput,
  session: Session,
  farmNameParam?: string
): Promise<GrainLotAd> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const anuncios = carregarDoStorage();

  const quantidadeSacas = Math.max(1, Math.round(input.quantidadeSacas));
  const pesoTotalKg = Number((quantidadeSacas * 60).toFixed(2));
  const pesoTotalToneladas = Number(
    (input.pesoTotalToneladas > 0 ? input.pesoTotalToneladas : pesoTotalKg / 1000).toFixed(2)
  );

  let precoTotal = 0;
  if (input.pricingMode === "PER_SACK" && input.precoPorSaca) {
    precoTotal = Number((input.precoPorSaca * quantidadeSacas).toFixed(2));
  } else if (input.precoTotal) {
    precoTotal = Number(input.precoTotal.toFixed(2));
  }

  const precoPorSaca = Number((precoTotal / quantidadeSacas).toFixed(2));
  const precoPorTonelada = pesoTotalToneladas > 0 ? Number((precoTotal / pesoTotalToneladas).toFixed(2)) : 0;

  let tagPrincipal = GRAIN_CROP_LABELS[input.cultura];
  let tagSecundaria = input.subtipo.trim().slice(0, 30);

  if (input.cultura === "OUTRO") {
    tagPrincipal = "Outro";
    tagSecundaria = (input.culturaPersonalizada || input.subtipo || "Grão").trim().slice(0, 30);
  } else {
    const listaSubtipos = GRAIN_SUBTYPES[input.cultura];
    const match = listaSubtipos.find((item) => item.value === input.subtipo);
    if (match && match.value !== "OUTRO") {
      tagSecundaria = match.shortTag;
    }
  }

  const { resolvedFarmName, avatarPersistivel } = resolverDadosProdutorSessao(session, farmNameParam);
  const novoId = `safra-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const novoAnuncio: GrainLotAd = {
    id: novoId,
    vendedorId: session.conta.id,
    vendedorNome: session.conta.nome,
    vendedorAvatar: avatarPersistivel,
    farmName: resolvedFarmName,
    titulo: input.titulo.trim(),
    descricao: input.descricao?.trim() || undefined,
    categoria: "GRAOS",
    cultura: input.cultura,
    culturaPersonalizada: input.culturaPersonalizada?.trim().slice(0, 30) || undefined,
    subtipo: input.subtipo.trim(),
    tagPrincipal,
    tagSecundaria,
    safra: input.safra,
    embalagem: input.embalagem,
    umidadePercentual:
      typeof input.umidadePercentual === "number" && input.umidadePercentual > 0
        ? Number(input.umidadePercentual.toFixed(1))
        : 13.5,
    laudoTecnico: input.laudoTecnico,
    quantidadeSacas,
    pesoTotalToneladas,
    pesoTotalKg,
    precoTotal,
    precoPorSaca,
    precoPorTonelada,
    cidade: input.cidade.trim(),
    uf: input.uf.trim().toUpperCase(),
    imagemUrl: harvestSunsetImage,
    criadoEm: new Date().toISOString(),
    status: "ATIVO",
    seloVerificado: true,
  };

  const atualizados = [novoAnuncio, ...anuncios];
  const salvou = salvarNoStorage(atualizados);
  if (!salvou) {
    throw new Error("Não foi possível persistir o anúncio no armazenamento local do navegador.");
  }

  return hidratarAnuncioComPerfil(novoAnuncio);
}
