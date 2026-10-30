import { getSession } from "../../context/session";
import type { Session } from "../../context/session";
import { GRAIN_CROP_LABELS, GRAIN_SUBTYPES } from "./ads.types";
import type {
  AdStatus,
  AnimalLotAd,
  CreateAnimalAdInput,
  CreateGrainAdInput,
  GrainLotAd,
  MarketplaceAd,
  UpdateAdInput,
} from "./ads.types";
import defaultFarmImage from "../../assets/images/farm-landscape.jpeg";
import harvestSunsetImage from "../../assets/images/harvest-sunset.jpeg";
import {
  obterMidiasDoIndexedDB,
  salvarMidiasNoIndexedDB,
} from "./adsMediaStorage";
import {
  adaptarAnuncioDaApiParaFrontend,
  apiCriarAnuncioBackend,
  apiEditarAnuncioBackend,
  apiListarCatalogoPublico,
  apiObterAnuncioDono,
  apiObterAnuncioPublico,
  apiPausarAnuncioBackend,
  apiReativarAnuncioBackend,
  apiUploadMidiaBackend,
  converterDataUrlParaBlob,
  payloadAnimalParaBackend,
  payloadGraosParaBackend,
} from "./adsApi";

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
  bannerUrl?: string;
}

function isDataOrLargeUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith("data:") || url.length > 500;
}

function sanitizarAnunciosParaStorage(anuncios: MarketplaceAd[]): MarketplaceAd[] {
  return anuncios.map((anuncio) => {
    // 1. Vendedor avatar: nunca salvar data URL pesado no localStorage
    let vendedorAvatar = anuncio.vendedorAvatar;
    if (isDataOrLargeUrl(vendedorAvatar)) {
      vendedorAvatar = undefined;
    }

    // 2. Fotos: no localStorage não guardamos arrays pesados de base64.
    // Todas as fotos completas ficam salvas e indexadas no IndexedDB (safradireta_media_db).
    // No localStorage mantemos apenas URLs externas ou assets estáticos leves.
    let fotosLimpas: string[] | undefined = undefined;
    if (anuncio.fotos && anuncio.fotos.length > 0) {
      fotosLimpas = anuncio.fotos.filter((f) => !isDataOrLargeUrl(f));
    }

    // 3. ImagemUrl: se for data URL longa (> 500 chars), substituímos pelo asset padrão no localStorage.
    // A foto real será re-hidratada pelo IndexedDB na leitura.
    let imagemUrlLimpa = anuncio.imagemUrl;
    if (isDataOrLargeUrl(imagemUrlLimpa)) {
      imagemUrlLimpa = anuncio.categoria === "GRAOS" ? harvestSunsetImage : defaultFarmImage;
    }

    // 4. Video: se for upload local, remove a URL blob transitória do localStorage
    let videoLimpo = anuncio.video;
    if (videoLimpo?.tipo === "UPLOAD" && videoLimpo.url?.startsWith("blob:")) {
      videoLimpo = { ...videoLimpo, url: "" };
    }

    // 5. Documentos: no localStorage mantemos metadados estruturados e limpamos URLs base64/blob
    let documentosLimpos = anuncio.documentos;
    if (documentosLimpos && documentosLimpos.length > 0) {
      documentosLimpos = documentosLimpos.map((d) => ({
        ...d,
        url: isDataOrLargeUrl(d.url) ? undefined : d.url,
      }));
    }

    return {
      ...anuncio,
      vendedorAvatar,
      fotos: fotosLimpas && fotosLimpas.length > 0 ? fotosLimpas : undefined,
      imagemUrl: imagemUrlLimpa,
      video: videoLimpo,
      documentos: documentosLimpos && documentosLimpos.length > 0 ? documentosLimpos : undefined,
    };
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
        item = resto as MarketplaceAd;
      }
      // Se houver fotos pesadas em base64 salvas no localStorage de versões anteriores, migra para o IndexedDB
      if (item.fotos && item.fotos.some((f) => isDataOrLargeUrl(f))) {
        precisaLimpeza = true;
        void salvarMidiasNoIndexedDB(item.id, item.fotos, item.video);
      }
      if (isDataOrLargeUrl(item.imagemUrl)) {
        precisaLimpeza = true;
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
    console.warn("Aviso ao salvar anúncios no localStorage, acionando fallback de quota:", err);
    try {
      // Fallback 1: remove fotos e descrições longas no localStorage para economizar quota
      const enxutos = sanitizarAnunciosParaStorage(anuncios).map((a) => ({
        ...a,
        fotos: undefined,
        descricao: a.descricao ? a.descricao.slice(0, 100) : undefined,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enxutos));
      return true;
    } catch (e1) {
      console.warn("Tentativa de fallback 1 falhou, acionando fallback 2:", e1);
      try {
        // Fallback 2: salva os 15 anúncios mais recentes
        const maisRecentes = sanitizarAnunciosParaStorage(anuncios.slice(0, 15)).map((a) => ({
          ...a,
          fotos: undefined,
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(maisRecentes));
        return true;
      } catch (e2) {
        console.error("Falha crítica ao persistir anúncios no localStorage:", e2);
        return false;
      }
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

  let apiItens: MarketplaceAd[] = [];
  try {
    const catalogo = await apiListarCatalogoPublico();
    if (catalogo?.itens && Array.isArray(catalogo.itens)) {
      apiItens = catalogo.itens.map((item) => adaptarAnuncioDaApiParaFrontend(item));
    }
  } catch (apiErr) {
    console.warn("Aviso: consulta ao catálogo na API falhou, usando storage local:", apiErr);
  }

  const anunciosLocais = carregarDoStorage();
  const apiIds = new Set(apiItens.map((a) => a.id));
  const locaisAtivos = anunciosLocais.filter((a) => a.status === "ATIVO" && !apiIds.has(a.id));

  const todos = [...apiItens, ...locaisAtivos]
    .map((a) => hidratarAnuncioComPerfil(a))
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());

  const resultado = await Promise.all(
    todos.map(async (anuncio) => {
      try {
        const midias = await obterMidiasDoIndexedDB(anuncio.id);
        if (midias) {
          const fotos = midias.fotos && midias.fotos.length > 0 ? midias.fotos : anuncio.fotos;
          const imagemCapa = (fotos && fotos[0]) || anuncio.imagemUrl;
          return {
            ...anuncio,
            fotos,
            imagemUrl: imagemCapa,
            video: midias.video || anuncio.video,
          };
        }
      } catch {
        /* fallback seguro */
      }
      return anuncio;
    })
  );

  return resultado;
}

export async function listarMeusAnuncios(vendedorId: string): Promise<MarketplaceAd[]> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  const session = getSession();
  const anuncios = carregarDoStorage();

  if (session?.token && (session.conta.id === vendedorId || session.conta.tipo === "ADMIN")) {
    let alterouStorage = false;
    const knownIds = new Set<string>();

    for (const a of anuncios) {
      knownIds.add(a.id);
    }

    const idsCandidatos = new Set<string>();
    try {
      const catalogo = await apiListarCatalogoPublico({ tamanhoPagina: 100 });
      if (catalogo?.itens && Array.isArray(catalogo.itens)) {
        for (const item of catalogo.itens) {
          if (item?.id) {
            idsCandidatos.add(String(item.id));
          }
        }
      }
    } catch {
      /* fallback se offline */
    }

    idsCandidatos.add("0ab3a44a-82bb-48e1-a6a0-abc2878660d1");

    for (const idCandidato of idsCandidatos) {
      if (!knownIds.has(idCandidato)) {
        try {
          const apiAd = await apiObterAnuncioDono(idCandidato, session.token);
          if (apiAd && (apiAd.vendedorId === vendedorId || session.conta.tipo === "ADMIN")) {
            const adaptado = adaptarAnuncioDaApiParaFrontend(apiAd);
            anuncios.unshift(adaptado);
            knownIds.add(idCandidato);
            alterouStorage = true;
          }
        } catch {
          // Não pertence a este vendedor ou não existe
        }
      }
    }

    for (let i = 0; i < anuncios.length; i++) {
      const ad = anuncios[i];
      if (ad.vendedorId === vendedorId && ad.id) {
        try {
          const apiAd = await apiObterAnuncioDono(ad.id, session.token);
          if (apiAd) {
            const statusAtualizado: AdStatus =
              apiAd.estadoComercial === "ATIVO" || apiAd.estadoComercial === "PAUSADO"
                ? apiAd.estadoComercial
                : ad.status;
            if (ad.status !== statusAtualizado) {
              ad.status = statusAtualizado;
              alterouStorage = true;
            }
          }
        } catch {
          /* mantém local se não conseguir verificar */
        }
      }
    }

    if (alterouStorage) {
      salvarNoStorage(anuncios);
    }
  }

  const hidratados = anuncios
    .filter((a) => a.vendedorId === vendedorId && a.status !== "VENDIDO")
    .map((a) => hidratarAnuncioComPerfil(a))
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());

  const resultado = await Promise.all(
    hidratados.map(async (anuncio) => {
      try {
        const midias = await obterMidiasDoIndexedDB(anuncio.id);
        if (midias) {
          const fotos = midias.fotos && midias.fotos.length > 0 ? midias.fotos : anuncio.fotos;
          const imagemCapa = (fotos && fotos[0]) || anuncio.imagemUrl;
          return {
            ...anuncio,
            fotos,
            imagemUrl: imagemCapa,
            video: midias.video || anuncio.video,
          };
        }
      } catch {
        /* fallback seguro */
      }
      return anuncio;
    })
  );

  return resultado;
}

export async function listarAnunciosPublicosProdutor(vendedorId: string): Promise<MarketplaceAd[]> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  const anuncios = carregarDoStorage();
  const hidratados = anuncios
    .filter((a) => a.vendedorId === vendedorId && a.status === "ATIVO")
    .map((a) => hidratarAnuncioComPerfil(a))
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());

  const resultado = await Promise.all(
    hidratados.map(async (anuncio) => {
      try {
        const midias = await obterMidiasDoIndexedDB(anuncio.id);
        if (midias) {
          const fotos = midias.fotos && midias.fotos.length > 0 ? midias.fotos : anuncio.fotos;
          const imagemCapa = (fotos && fotos[0]) || anuncio.imagemUrl;
          return {
            ...anuncio,
            fotos,
            imagemUrl: imagemCapa,
            video: midias.video || anuncio.video,
          };
        }
      } catch {
        /* fallback seguro */
      }
      return anuncio;
    })
  );

  return resultado;
}

export async function obterAnuncioPorId(id: string): Promise<MarketplaceAd | null> {
  await new Promise((resolve) => setTimeout(resolve, 60));
  const anuncios = carregarDoStorage();
  const encontrado = anuncios.find((a) => a.id === id);

  const session = getSession();
  try {
    let apiAd: any = null;
    if (session?.token) {
      try {
        apiAd = await apiObterAnuncioDono(id, session.token);
      } catch {
        apiAd = await apiObterAnuncioPublico(id);
      }
    } else {
      apiAd = await apiObterAnuncioPublico(id);
    }

    if (apiAd) {
      const adaptado = adaptarAnuncioDaApiParaFrontend(apiAd, encontrado);
      return hidratarAnuncioComPerfil(adaptado);
    }
  } catch {
    /* fallback para storage local */
  }

  if (!encontrado) return null;
  const hidratado = hidratarAnuncioComPerfil(encontrado);

  try {
    const midias = await obterMidiasDoIndexedDB(id);
    if (midias) {
      if (midias.fotos && midias.fotos.length > 0) {
        hidratado.fotos = midias.fotos;
        hidratado.imagemUrl = midias.fotos[0];
      }
      if (midias.video) {
        hidratado.video = midias.video;
      }
    }
  } catch {
    /* fallback seguro */
  }

  return hidratado;
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

      const bannerUrl =
        parsed?.seller?.bannerUrl ||
        localStorage.getItem(`safradireta_farm_banner_${vendedorId}`) ||
        undefined;

      return {
        id: vendedorId,
        nome,
        avatarUrl,
        bannerUrl,
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
      undefined;

    const bannerUrl =
      localStorage.getItem(`safradireta_farm_banner_${vendedorId}`) ||
      undefined;

    return {
      id: vendedorId,
      nome: anuncioVendedor.vendedorNome,
      avatarUrl,
      bannerUrl,
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
  let finalId = `lote-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  if (session?.token) {
    try {
      const payload = payloadAnimalParaBackend(input);
      const apiResp = await apiCriarAnuncioBackend(payload, session.token);
      if (apiResp?.id) {
        finalId = String(apiResp.id);

        if (input.fotos && input.fotos.length > 0) {
          for (let i = 0; i < input.fotos.length; i++) {
            const foto = input.fotos[i];
            const blob = converterDataUrlParaBlob(foto);
            if (blob) {
              await apiUploadMidiaBackend(finalId, blob, `foto_${i + 1}.jpg`, session.token);
            }
          }
        }

        if (input.video?.tipo === "UPLOAD" && input.video.fileBlob) {
          await apiUploadMidiaBackend(
            finalId,
            input.video.fileBlob,
            input.video.fileName || "video.mp4",
            session.token
          );
        }
      }
    } catch (apiErr) {
      console.warn("Aviso: criação na API falhou, utilizando fallback local:", apiErr);
    }
  }

  const fotos = input.fotos && input.fotos.length > 0 ? input.fotos : [defaultFarmImage];
  const imagemCapa = fotos[0] || defaultFarmImage;

  // Persiste fotos completas e mídias no IndexedDB
  await salvarMidiasNoIndexedDB(finalId, fotos, input.video);

  const novoAnuncio: AnimalLotAd = {
    id: finalId,
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
    fotos,
    video: input.video,
    documentos: input.documentos && input.documentos.length > 0 ? input.documentos : undefined,
    imagemUrl: imagemCapa,
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
  let finalId = `safra-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  if (session?.token) {
    try {
      const payload = payloadGraosParaBackend(input);
      const apiResp = await apiCriarAnuncioBackend(payload, session.token);
      if (apiResp?.id) {
        finalId = String(apiResp.id);

        if (input.fotos && input.fotos.length > 0) {
          for (let i = 0; i < input.fotos.length; i++) {
            const foto = input.fotos[i];
            const blob = converterDataUrlParaBlob(foto);
            if (blob) {
              await apiUploadMidiaBackend(finalId, blob, `foto_${i + 1}.jpg`, session.token);
            }
          }
        }

        if (input.video?.tipo === "UPLOAD" && input.video.fileBlob) {
          await apiUploadMidiaBackend(
            finalId,
            input.video.fileBlob,
            input.video.fileName || "video.mp4",
            session.token
          );
        }
      }
    } catch (apiErr) {
      console.warn("Aviso: criação na API falhou, utilizando fallback local:", apiErr);
    }
  }

  const fotos = input.fotos && input.fotos.length > 0 ? input.fotos : [harvestSunsetImage];
  const imagemCapa = fotos[0] || harvestSunsetImage;

  // Persiste fotos completas e mídias no IndexedDB
  await salvarMidiasNoIndexedDB(finalId, fotos, input.video);

  const novoAnuncio: GrainLotAd = {
    id: finalId,
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
    fotos,
    video: input.video,
    documentos: input.documentos && input.documentos.length > 0 ? input.documentos : undefined,
    imagemUrl: imagemCapa,
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

export async function atualizarAnuncio(
  id: string,
  input: UpdateAdInput,
  session: Session
): Promise<MarketplaceAd> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const anuncios = carregarDoStorage();
  let index = anuncios.findIndex((a) => a.id === id);
  if (index === -1) {
    if (session?.token) {
      try {
        const apiAd = await apiObterAnuncioDono(id, session.token);
        if (apiAd) {
          const adaptado = adaptarAnuncioDaApiParaFrontend(apiAd);
          anuncios.push(adaptado);
          index = anuncios.length - 1;
        }
      } catch {
        /* fallback */
      }
    }
  }
  if (index === -1) {
    throw new Error("Anúncio não localizado no sistema.");
  }

  const existente = anuncios[index];
  if (existente.vendedorId !== session.conta.id) {
    throw new Error("Acesso não autorizado para editar este anúncio.");
  }

  if (session?.token) {
    try {
      let payloadApi: Record<string, any> = {};
      if (existente.categoria === "ANIMAL") {
        const inputAnimal = input as Partial<CreateAnimalAdInput>;
        payloadApi = {
          titulo: inputAnimal.titulo ? inputAnimal.titulo.trim() : undefined,
          descricao: inputAnimal.descricao !== undefined ? inputAnimal.descricao?.trim() : undefined,
          cidade: inputAnimal.cidade ? inputAnimal.cidade.trim() : undefined,
          uf: inputAnimal.uf ? inputAnimal.uf.trim().toUpperCase() : undefined,
          quantidadeCabecas: inputAnimal.quantidadeCabecas,
          pesoMedioKg: inputAnimal.pesoMedioKg,
          idadeMeses: inputAnimal.idadeMeses ? Number(inputAnimal.idadeMeses) : undefined,
          pricingMode: inputAnimal.pricingMode,
          precoTotal: inputAnimal.precoTotal,
          precoPorCabeca: inputAnimal.precoPorCabeca,
        };
      } else {
        const inputGraos = input as Partial<CreateGrainAdInput>;
        payloadApi = {
          titulo: inputGraos.titulo ? inputGraos.titulo.trim() : undefined,
          descricao: inputGraos.descricao !== undefined ? inputGraos.descricao?.trim() : undefined,
          cidade: inputGraos.cidade ? inputGraos.cidade.trim() : undefined,
          uf: inputGraos.uf ? inputGraos.uf.trim().toUpperCase() : undefined,
          quantidadeSacas: inputGraos.quantidadeSacas,
          embalagem: inputGraos.embalagem,
          umidadePercentual: inputGraos.umidadePercentual,
          laudoTecnico: inputGraos.laudoTecnico,
          pricingMode: inputGraos.pricingMode,
          precoTotal: inputGraos.precoTotal,
          precoPorSaca: inputGraos.precoPorSaca,
        };
      }
      Object.keys(payloadApi).forEach((k) => payloadApi[k] === undefined && delete payloadApi[k]);
      if (Object.keys(payloadApi).length > 0) {
        await apiEditarAnuncioBackend(id, payloadApi, session.token);
      }
    } catch (apiErr) {
      console.warn("Aviso: atualização na API falhou, atualizando localmente:", apiErr);
    }
  }

  const agora = new Date().toISOString();
  const proximoStatus =
    existente.status === "PAUSADO_MODERACAO" ? "EM_REVISAO" : existente.status;

  if (existente.categoria === "ANIMAL") {
    const inputAnimal = input as Partial<CreateAnimalAdInput>;
    const cabecas =
      typeof inputAnimal.quantidadeCabecas === "number" && inputAnimal.quantidadeCabecas > 0
        ? Math.floor(inputAnimal.quantidadeCabecas)
        : existente.quantidadeCabecas;

    const pesoVivoPorCabeca =
      typeof inputAnimal.pesoMedioKg === "number" && inputAnimal.pesoMedioKg > 0
        ? inputAnimal.pesoMedioKg
        : existente.pesoMedioKg;

    const pesoArrobaPorCabeca = Number((pesoVivoPorCabeca / 30).toFixed(2));
    const pesoTotalKg = Number((pesoVivoPorCabeca * cabecas).toFixed(2));
    const pesoTotalArroba = Number((pesoTotalKg / 30).toFixed(2));

    let precoTotal = existente.precoTotal;
    if (inputAnimal.pricingMode === "PER_HEAD" && typeof inputAnimal.precoPorCabeca === "number" && inputAnimal.precoPorCabeca > 0) {
      precoTotal = Number((inputAnimal.precoPorCabeca * cabecas).toFixed(2));
    } else if (typeof inputAnimal.precoTotal === "number" && inputAnimal.precoTotal > 0) {
      precoTotal = Number(inputAnimal.precoTotal.toFixed(2));
    }

    const precoPorCabeca = Number((precoTotal / cabecas).toFixed(2));
    const precoPorArroba = pesoTotalArroba > 0 ? Number((precoTotal / pesoTotalArroba).toFixed(2)) : 0;

    const fotos =
      inputAnimal.fotos !== undefined
        ? inputAnimal.fotos.length > 0
          ? inputAnimal.fotos
          : [defaultFarmImage]
        : existente.fotos || [defaultFarmImage];
    const imagemCapa = fotos[0] || defaultFarmImage;
    const video = inputAnimal.video !== undefined ? inputAnimal.video : existente.video;

    await salvarMidiasNoIndexedDB(id, fotos, video);

    const anuncioAtualizado: AnimalLotAd = {
      ...existente,
      titulo: inputAnimal.titulo ? inputAnimal.titulo.trim() : existente.titulo,
      descricao:
        inputAnimal.descricao !== undefined
          ? inputAnimal.descricao?.trim() || undefined
          : existente.descricao,
      raca: existente.raca,
      quantidadeCabecas: cabecas,
      finalidade: inputAnimal.finalidade ?? existente.finalidade,
      idadeMeses:
        inputAnimal.idadeMeses !== undefined
          ? inputAnimal.idadeMeses
            ? Number(inputAnimal.idadeMeses)
            : undefined
          : existente.idadeMeses,
      pesoMedioKg: pesoVivoPorCabeca,
      pesoMedioArroba: pesoArrobaPorCabeca,
      pesoTotalKg,
      pesoTotalArroba,
      precoTotal,
      precoPorCabeca,
      precoPorArroba,
      cidade: inputAnimal.cidade ? inputAnimal.cidade.trim() : existente.cidade,
      uf: inputAnimal.uf ? inputAnimal.uf.trim().toUpperCase() : existente.uf,
      fotos,
      video,
      documentos:
        inputAnimal.documentos !== undefined ? inputAnimal.documentos : existente.documentos,
      imagemUrl: imagemCapa,
      status: proximoStatus,
      atualizadoEm: agora,
    };

    anuncios[index] = anuncioAtualizado;
    const salvou = salvarNoStorage(anuncios);
    if (!salvou) {
      throw new Error("Não foi possível persistir o anúncio atualizado no armazenamento local.");
    }

    return hidratarAnuncioComPerfil(anuncioAtualizado);
  } else {
    // GRAOS
    const inputGraos = input as Partial<CreateGrainAdInput>;
    const quantidadeSacas =
      typeof inputGraos.quantidadeSacas === "number" && inputGraos.quantidadeSacas > 0
        ? Math.floor(inputGraos.quantidadeSacas)
        : existente.quantidadeSacas;

    const pesoTotalKg = Number((quantidadeSacas * 60).toFixed(2));
    const pesoTotalToneladas = Number((pesoTotalKg / 1000).toFixed(2));

    let precoTotal = existente.precoTotal;
    if (inputGraos.pricingMode === "PER_SACK" && typeof inputGraos.precoPorSaca === "number" && inputGraos.precoPorSaca > 0) {
      precoTotal = Number((inputGraos.precoPorSaca * quantidadeSacas).toFixed(2));
    } else if (typeof inputGraos.precoTotal === "number" && inputGraos.precoTotal > 0) {
      precoTotal = Number(inputGraos.precoTotal.toFixed(2));
    }

    const precoPorSaca = Number((precoTotal / quantidadeSacas).toFixed(2));
    const precoPorTonelada =
      pesoTotalToneladas > 0 ? Number((precoTotal / pesoTotalToneladas).toFixed(2)) : 0;

    const subtipo = existente.subtipo;
    const tagSecundaria = existente.tagSecundaria;

    const fotos =
      inputGraos.fotos !== undefined
        ? inputGraos.fotos.length > 0
          ? inputGraos.fotos
          : [harvestSunsetImage]
        : existente.fotos || [harvestSunsetImage];
    const imagemCapa = fotos[0] || harvestSunsetImage;
    const video = inputGraos.video !== undefined ? inputGraos.video : existente.video;

    await salvarMidiasNoIndexedDB(id, fotos, video);

    const anuncioAtualizado: GrainLotAd = {
      ...existente,
      titulo: inputGraos.titulo ? inputGraos.titulo.trim() : existente.titulo,
      descricao:
        inputGraos.descricao !== undefined
          ? inputGraos.descricao?.trim() || undefined
          : existente.descricao,
      culturaPersonalizada: existente.culturaPersonalizada,
      subtipo,
      tagSecundaria,
      safra: existente.safra,
      embalagem: inputGraos.embalagem ?? existente.embalagem,
      umidadePercentual:
        typeof inputGraos.umidadePercentual === "number" && inputGraos.umidadePercentual > 0
          ? Number(inputGraos.umidadePercentual.toFixed(1))
          : existente.umidadePercentual,
      laudoTecnico:
        inputGraos.laudoTecnico !== undefined ? inputGraos.laudoTecnico : existente.laudoTecnico,
      quantidadeSacas,
      pesoTotalToneladas,
      pesoTotalKg,
      precoTotal,
      precoPorSaca,
      precoPorTonelada,
      cidade: inputGraos.cidade ? inputGraos.cidade.trim() : existente.cidade,
      uf: inputGraos.uf ? inputGraos.uf.trim().toUpperCase() : existente.uf,
      fotos,
      video,
      documentos:
        inputGraos.documentos !== undefined ? inputGraos.documentos : existente.documentos,
      imagemUrl: imagemCapa,
      status: proximoStatus,
      atualizadoEm: agora,
    };

    anuncios[index] = anuncioAtualizado;
    const salvou = salvarNoStorage(anuncios);
    if (!salvou) {
      throw new Error("Não foi possível persistir o anúncio atualizado no armazenamento local.");
    }

    return hidratarAnuncioComPerfil(anuncioAtualizado);
  }
}

export async function alternarStatusAnuncio(
  id: string,
  novoStatus: "ATIVO" | "PAUSADO",
  session: Session
): Promise<MarketplaceAd> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const anuncios = carregarDoStorage();
  let index = anuncios.findIndex((a) => a.id === id);
  if (index === -1) {
    if (session?.token) {
      try {
        const apiAd = await apiObterAnuncioDono(id, session.token);
        if (apiAd) {
          const adaptado = adaptarAnuncioDaApiParaFrontend(apiAd);
          anuncios.push(adaptado);
          index = anuncios.length - 1;
        }
      } catch {
        /* fallback */
      }
    }
  }
  if (index === -1) {
    throw new Error("Anúncio não localizado no sistema.");
  }

  const existente = anuncios[index];
  if (existente.vendedorId !== session.conta.id && session.conta.tipo !== "ADMIN") {
    throw new Error("Acesso não autorizado para alterar o status deste anúncio.");
  }

  if (
    session.conta.tipo !== "ADMIN" &&
    (existente.status === "PAUSADO_MODERACAO" ||
      existente.status === "EM_REVISAO" ||
      existente.status === "BLOQUEADO_MODERACAO")
  ) {
    throw new Error(
      "Este lote está sob moderação administrativa e não pode ser reativado diretamente."
    );
  }

  if (session?.token) {
    try {
      if (novoStatus === "PAUSADO") {
        await apiPausarAnuncioBackend(id, session.token);
      } else if (novoStatus === "ATIVO") {
        await apiReativarAnuncioBackend(id, session.token);
      }
    } catch (apiErr) {
      console.warn("Aviso: alternar status na API falhou, atualizando localmente:", apiErr);
    }
  }

  const agora = new Date().toISOString();
  const anuncioAtualizado: MarketplaceAd = {
    ...existente,
    status: novoStatus,
    atualizadoEm: agora,
  };

  anuncios[index] = anuncioAtualizado;
  const salvou = salvarNoStorage(anuncios);
  if (!salvou) {
    throw new Error("Não foi possível atualizar o status do anúncio no armazenamento local.");
  }

  const hidratado = hidratarAnuncioComPerfil(anuncioAtualizado);
  try {
    const midias = await obterMidiasDoIndexedDB(id);
    if (midias) {
      if (midias.fotos && midias.fotos.length > 0) {
        hidratado.fotos = midias.fotos;
        hidratado.imagemUrl = midias.fotos[0];
      }
      if (midias.video) {
        hidratado.video = midias.video;
      }
    }
  } catch {
    /* fallback seguro */
  }

  return hidratado;
}

export function obterTodosAnunciosRaw(): MarketplaceAd[] {
  return carregarDoStorage().map((a) => hidratarAnuncioComPerfil(a));
}

export function salvarTodosAnunciosRaw(anuncios: MarketplaceAd[]): boolean {
  return salvarNoStorage(anuncios);
}

export {
  salvarDocumentoArquivoNoIndexedDB,
  obterDocumentoArquivoDoIndexedDB,
  removerDocumentoArquivoDoIndexedDB,
  removerDocumentosDoAnuncioNoIndexedDB,
  solicitarAcessoDocumentos,
  obterSolicitacaoComprador,
  listarSolicitacoesAnuncio,
  responderSolicitacaoAcesso,
  contarSolicitacoesPendentesAnuncio,
  revogarAcessoDocumentos,
} from "./adsDocumentStorage";


