const DB_NAME = "safradireta_producer_docs_db";
const STORE_NAME = "produtor_documentos";
const DB_VERSION = 1;

export interface StoredProducerDocs {
  userId: string;
  rgFrenteBlob?: Blob;
  rgFrenteNome?: string;
  rgVersoBlob?: Blob;
  rgVersoNome?: string;
  carBlob?: Blob;
  carNome?: string;
  atualizadoEm: number;
}

function abrirBancoDocsProdutor(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não disponível no ambiente"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function salvarDocumentosProdutorNoIndexedDB(
  userId: string,
  files: {
    rgFrente?: File;
    rgVerso?: File;
    car?: File;
  }
): Promise<boolean> {
  try {
    const db = await abrirBancoDocsProdutor();
    const existente = (await obterDocumentosProdutorDoIndexedDB(userId)) || {
      userId,
      atualizadoEm: Date.now(),
    };

    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const record: StoredProducerDocs = {
        ...existente,
        userId,
        rgFrenteBlob: files.rgFrente || existente.rgFrenteBlob,
        rgFrenteNome: files.rgFrente?.name || existente.rgFrenteNome,
        rgVersoBlob: files.rgVerso || existente.rgVersoBlob,
        rgVersoNome: files.rgVerso?.name || existente.rgVersoNome,
        carBlob: files.car || existente.carBlob,
        carNome: files.car?.name || existente.carNome,
        atualizadoEm: Date.now(),
      };

      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function obterDocumentosProdutorDoIndexedDB(
  userId: string
): Promise<StoredProducerDocs | null> {
  try {
    const db = await abrirBancoDocsProdutor();
    return await new Promise<StoredProducerDocs | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(userId);
      req.onsuccess = () => resolve((req.result as StoredProducerDocs) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function substituirDocumentoProdutorNoIndexedDB(
  userId: string,
  tipoDoc: "rgFrente" | "rgVerso" | "car",
  file: File
): Promise<boolean> {
  try {
    const db = await abrirBancoDocsProdutor();
    const atual = (await obterDocumentosProdutorDoIndexedDB(userId)) || {
      userId,
      atualizadoEm: Date.now(),
    };

    if (tipoDoc === "rgFrente") {
      atual.rgFrenteBlob = file;
      atual.rgFrenteNome = file.name;
    } else if (tipoDoc === "rgVerso") {
      atual.rgVersoBlob = file;
      atual.rgVersoNome = file.name;
    } else if (tipoDoc === "car") {
      atual.carBlob = file;
      atual.carNome = file.name;
    }
    atual.atualizadoEm = Date.now();

    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(atual);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
