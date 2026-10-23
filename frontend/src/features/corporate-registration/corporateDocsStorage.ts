const DB_NAME = "safradireta_corporate_docs_db";
const STORE_NAME = "empresa_documentos";
const DB_VERSION = 1;

export interface StoredCorporateDocs {
  cnpjClean: string;
  contratoSocialBlob?: Blob;
  contratoSocialNome?: string;
  cartaoCnpjBlob?: Blob;
  cartaoCnpjNome?: string;
  docRepFrenteBlob?: Blob;
  docRepFrenteNome?: string;
  docRepVersoBlob?: Blob;
  docRepVersoNome?: string;
  // Campos para Troca de Representante Legal
  novoRepFrenteBlob?: Blob;
  novoRepFrenteNome?: string;
  novoRepVersoBlob?: Blob;
  novoRepVersoNome?: string;
  comprovacaoPoderesBlob?: Blob;
  comprovacaoPoderesNome?: string;
  tipoComprovacao?: string;
  atualizadoEm: number;
}

function abrirBancoDocsPJ(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não disponível no ambiente"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "cnpjClean" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function salvarDocumentosPJNoIndexedDB(
  cnpj: string,
  files: {
    contrato?: File;
    cartaoCnpj?: File;
    repFrente?: File;
    repVerso?: File;
  }
): Promise<boolean> {
  try {
    const cnpjClean = cnpj.replace(/\D/g, "");
    if (!cnpjClean) return false;

    const db = await abrirBancoDocsPJ();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const record: StoredCorporateDocs = {
        cnpjClean,
        contratoSocialBlob: files.contrato,
        contratoSocialNome: files.contrato?.name,
        cartaoCnpjBlob: files.cartaoCnpj,
        cartaoCnpjNome: files.cartaoCnpj?.name,
        docRepFrenteBlob: files.repFrente,
        docRepFrenteNome: files.repFrente?.name,
        docRepVersoBlob: files.repVerso,
        docRepVersoNome: files.repVerso?.name,
        atualizadoEm: Date.now(),
      };

      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.warn("Erro ao salvar docs PJ no IndexedDB:", tx.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn("Falha ao abrir IndexedDB de docs PJ:", err);
    return false;
  }
}

export async function obterDocumentosPJDoIndexedDB(
  cnpj: string
): Promise<StoredCorporateDocs | null> {
  try {
    const cnpjClean = cnpj.replace(/\D/g, "");
    if (!cnpjClean) return null;

    const db = await abrirBancoDocsPJ();
    return await new Promise<StoredCorporateDocs | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cnpjClean);
      req.onsuccess = () => resolve((req.result as StoredCorporateDocs) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function substituirDocumentoPJNoIndexedDB(
  cnpj: string,
  tipo: "CONTRATO" | "CNPJ" | "REP_FRENTE" | "REP_VERSO",
  file: File
): Promise<boolean> {
  try {
    const cnpjClean = cnpj.replace(/\D/g, "");
    if (!cnpjClean) return false;

    const existente = (await obterDocumentosPJDoIndexedDB(cnpj)) || {
      cnpjClean,
      atualizadoEm: Date.now(),
    };

    const atualizado: StoredCorporateDocs = {
      ...existente,
      atualizadoEm: Date.now(),
    };

    if (tipo === "CONTRATO") {
      atualizado.contratoSocialBlob = file;
      atualizado.contratoSocialNome = file.name;
    } else if (tipo === "CNPJ") {
      atualizado.cartaoCnpjBlob = file;
      atualizado.cartaoCnpjNome = file.name;
    } else if (tipo === "REP_FRENTE") {
      atualizado.docRepFrenteBlob = file;
      atualizado.docRepFrenteNome = file.name;
    } else if (tipo === "REP_VERSO") {
      atualizado.docRepVersoBlob = file;
      atualizado.docRepVersoNome = file.name;
    }

    const db = await abrirBancoDocsPJ();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(atualizado);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn("Falha ao substituir documento individual no IndexedDB:", err);
    return false;
  }
}

export async function salvarTrocaRepresentanteDocsNoIndexedDB(
  cnpj: string,
  files: {
    repFrente?: File;
    repVerso?: File;
    comprovacaoPoderes?: File;
    tipoComprovacao?: string;
  }
): Promise<boolean> {
  try {
    const cnpjClean = cnpj.replace(/\D/g, "");
    if (!cnpjClean) return false;

    const existente = (await obterDocumentosPJDoIndexedDB(cnpj)) || {
      cnpjClean,
      atualizadoEm: Date.now(),
    };

    const atualizado: StoredCorporateDocs = {
      ...existente,
      novoRepFrenteBlob: files.repFrente ?? existente.novoRepFrenteBlob,
      novoRepFrenteNome: files.repFrente?.name ?? existente.novoRepFrenteNome,
      novoRepVersoBlob: files.repVerso ?? existente.novoRepVersoBlob,
      novoRepVersoNome: files.repVerso?.name ?? existente.novoRepVersoNome,
      comprovacaoPoderesBlob: files.comprovacaoPoderes ?? existente.comprovacaoPoderesBlob,
      comprovacaoPoderesNome: files.comprovacaoPoderes?.name ?? existente.comprovacaoPoderesNome,
      tipoComprovacao: files.tipoComprovacao ?? existente.tipoComprovacao,
      atualizadoEm: Date.now(),
    };

    const db = await abrirBancoDocsPJ();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(atualizado);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn("Falha ao salvar documentos de troca de representante no IndexedDB:", err);
    return false;
  }
}

export async function homologarTrocaRepresentanteDocsNoIndexedDB(cnpj: string): Promise<boolean> {
  try {
    const cnpjClean = cnpj.replace(/\D/g, "");
    if (!cnpjClean) return false;

    const existente = await obterDocumentosPJDoIndexedDB(cnpj);
    if (!existente) return false;

    const atualizado: StoredCorporateDocs = {
      ...existente,
      docRepFrenteBlob: existente.novoRepFrenteBlob || existente.docRepFrenteBlob,
      docRepFrenteNome: existente.novoRepFrenteNome || existente.docRepFrenteNome,
      docRepVersoBlob: existente.novoRepVersoBlob || existente.docRepVersoBlob,
      docRepVersoNome: existente.novoRepVersoNome || existente.docRepVersoNome,
      novoRepFrenteBlob: undefined,
      novoRepFrenteNome: undefined,
      novoRepVersoBlob: undefined,
      novoRepVersoNome: undefined,
      atualizadoEm: Date.now(),
    };

    const db = await abrirBancoDocsPJ();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(atualizado);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn("Falha ao homologar documentos de troca de representante no IndexedDB:", err);
    return false;
  }
}
