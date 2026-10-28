import type { AdVideoItem } from "./ads.types";

const DB_NAME = "safradireta_media_db";
const STORE_NAME = "anuncio_midias";
const DB_VERSION = 1;

export interface StoredAdMedia {
  adId: string;
  fotos: string[];
  video?: AdVideoItem;
  videoBlob?: Blob;
  atualizadoEm: number;
}

function abrirBancoMidias(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não disponível no ambiente"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "adId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function salvarMidiasNoIndexedDB(
  adId: string,
  fotos: string[],
  video?: AdVideoItem
): Promise<boolean> {
  try {
    const db = await abrirBancoMidias();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const data: StoredAdMedia = {
        adId,
        fotos,
        video: video
          ? {
              tipo: video.tipo,
              url: video.url,
              fileName: video.fileName,
            }
          : undefined,
        videoBlob: video?.fileBlob,
        atualizadoEm: Date.now(),
      };
      store.put(data);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.warn("Erro na transação de mídias do IndexedDB:", tx.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn("Aviso ao salvar mídias no IndexedDB:", err);
    return false;
  }
}

export async function obterMidiasDoIndexedDB(
  adId: string
): Promise<{ fotos?: string[]; video?: AdVideoItem } | null> {
  try {
    const db = await abrirBancoMidias();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(adId);
      req.onsuccess = () => {
        const res = req.result as StoredAdMedia | undefined;
        if (res) {
          let videoItem = res.video;
          if (videoItem && videoItem.tipo === "UPLOAD" && res.videoBlob) {
            videoItem = {
              ...videoItem,
              url: URL.createObjectURL(res.videoBlob),
              fileBlob: res.videoBlob,
            };
          }
          resolve({ fotos: res.fotos, video: videoItem });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function removerMidiasDoIndexedDB(adId: string): Promise<void> {
  try {
    const db = await abrirBancoMidias();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(adId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}
