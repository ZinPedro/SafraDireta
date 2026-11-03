import { obterAnuncioPorId } from "./adsStorage";
import type { MarketplaceAd } from "./ads.types";

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

export function alternarFavoritoStorage(usuarioId: string, anuncioId: string): boolean {
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

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("safra:favorites-updated", {
        detail: { usuarioId, anuncioId, isFavorito: !existe },
      })
    );
  }

  return !existe; // Retorna true se agora está favoritado
}

export function verificarIsFavorito(usuarioId: string, anuncioId: string): boolean {
  return obterFavoritosIds(usuarioId).includes(anuncioId);
}

export async function listarAnunciosFavoritados(usuarioId: string): Promise<MarketplaceAd[]> {
  const ids = obterFavoritosIds(usuarioId);
  if (ids.length === 0) return [];
  const promessas = ids.map((id) => obterAnuncioPorId(id));
  const resultados = await Promise.all(promessas);
  return resultados.filter((a): a is MarketplaceAd => a !== null);
}
