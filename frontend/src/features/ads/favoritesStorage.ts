import { obterAnuncioPorId } from "./adsStorage";
import type { MarketplaceAd } from "./ads.types";
import {
  apiFavoritarAnuncio,
  apiDesfavoritarAnuncio,
  apiListarFavoritos,
  adaptarAnuncioDaApiParaFrontend,
} from "./adsApi";

const PREFIXO_FAVORITOS = "safra_favoritos_";

export function obterFavoritosIds(usuarioId: string): string[] {
  if (!usuarioId) return [];
  try {
    const raw = localStorage.getItem(`${PREFIXO_FAVORITOS}${usuarioId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function alternarFavoritoStorage(
  usuarioId: string,
  anuncioId: string,
  token?: string
): boolean {
  if (!usuarioId || !anuncioId) return false;
  const atuais = obterFavoritosIds(usuarioId);
  const existe = atuais.includes(anuncioId);
  const novos = existe
    ? atuais.filter((id) => id !== anuncioId)
    : [...atuais, anuncioId];

  try {
    localStorage.setItem(`${PREFIXO_FAVORITOS}${usuarioId}`, JSON.stringify(novos));
  } catch (err) {
    console.error("Erro ao salvar favoritos:", err);
  }

  // Notificação no browser para reatividade em tempo real
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("safra:favorites-updated", {
        detail: { usuarioId, anuncioId, isFavorito: !existe },
      })
    );
  }

  // Sincronização em segundo plano com a API se houver token ativo
  if (token) {
    const acaoApi = existe
      ? apiDesfavoritarAnuncio(anuncioId, token)
      : apiFavoritarAnuncio(anuncioId, token);

    acaoApi.catch((err) => {
      console.warn("Aviso: Sincronização de favoritos com a API falhou (mantido fallback local):", err);
    });
  }

  return !existe; // Retorna true se agora está favoritado
}

export function verificarIsFavorito(usuarioId: string, anuncioId: string): boolean {
  return obterFavoritosIds(usuarioId).includes(anuncioId);
}

export async function listarAnunciosFavoritados(
  usuarioId: string,
  token?: string
): Promise<MarketplaceAd[]> {
  // 1. Se autenticado com token, consulta a API prioritariamente (SSOT)
  if (token) {
    try {
      const resp = await apiListarFavoritos(token, 1, 50);
      if (resp && Array.isArray(resp.itens)) {
        const adaptados = resp.itens.map((item) => adaptarAnuncioDaApiParaFrontend(item));
        // Sincroniza os IDs locais com a resposta da API
        try {
          const idsApi = adaptados.map((a) => a.id);
          localStorage.setItem(`${PREFIXO_FAVORITOS}${usuarioId}`, JSON.stringify(idsApi));
        } catch {
          /* ignora erro de escrita local */
        }
        return adaptados;
      }
    } catch (err) {
      console.warn("Aviso: Consulta de favoritos na API falhou, acionando fallback local:", err);
    }
  }

  // 2. Fallback resiliente: lê do storage local e hidrata anúncios
  const ids = obterFavoritosIds(usuarioId);
  if (ids.length === 0) return [];
  const promessas = ids.map((id) => obterAnuncioPorId(id));
  const resultados = await Promise.all(promessas);
  return resultados.filter((a): a is MarketplaceAd => a !== null);
}

