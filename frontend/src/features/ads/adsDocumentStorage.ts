import type {
  AdDocumentAccessRequest,
  DocumentAccessStatus,
} from "./ads.types";

const DB_NAME = "safradireta_ad_docs_db";
const STORE_NAME = "anuncio_documentos";
const DB_VERSION = 1;

const REQUESTS_STORAGE_KEY = "safradireta_ad_doc_requests";

export interface StoredAdDocumentFile {
  docId: string;
  anuncioId: string;
  blob?: Blob;
  dataUrl?: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  atualizadoEm: number;
}

function abrirBancoDocsAnuncio(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não disponível no ambiente"));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "docId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Erro ao abrir IndexedDB"));
    request.onblocked = () => {
      console.warn("Aviso: Conexão IndexedDB bloqueada por outra aba/instância aberta.");
      reject(new Error("IndexedDB bloqueado"));
    };
  });
}

export async function salvarDocumentoArquivoNoIndexedDB(
  docId: string,
  anuncioId: string,
  file: File | Blob,
  nomeArquivo: string,
  mimeType: string,
  tamanhoBytes: number
): Promise<boolean> {
  try {
    // 1. Desacopla o arquivo dos descritores do SO lendo em memória antecipadamente via arrayBuffer
    let blobArmazenar: Blob = file;
    try {
      if (typeof file.arrayBuffer === "function") {
        const buffer = await Promise.race([
          file.arrayBuffer(),
          new Promise<ArrayBuffer>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout ao ler arrayBuffer")), 2000)
          ),
        ]);
        blobArmazenar = new Blob([buffer], { type: mimeType || file.type || "application/octet-stream" });
      }
    } catch (errBuffer) {
      console.warn("Aviso ao converter arquivo para Blob em memória (usando original):", errBuffer);
    }

    // 2. Abre o IndexedDB protegido com Promise.race e timeout de 2.500 ms
    const db = await Promise.race([
      abrirBancoDocsAnuncio(),
      new Promise<IDBDatabase>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout ao abrir IndexedDB")), 2500)
      ),
    ]);

    // 3. Executa a transação protegida com Promise.race e timeout de 2.500 ms
    return await Promise.race([
      new Promise<boolean>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const data: StoredAdDocumentFile = {
            docId,
            anuncioId,
            blob: blobArmazenar,
            nomeArquivo,
            mimeType,
            tamanhoBytes,
            atualizadoEm: Date.now(),
          };
          store.put(data);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => {
            console.warn("Erro na transação ao salvar documento no IndexedDB:", tx.error);
            resolve(false);
          };
          tx.onabort = () => {
            console.warn("Transação abortada ao salvar documento no IndexedDB:", tx.error);
            resolve(false);
          };
        } catch (errTx) {
          console.warn("Exceção ao criar transação ou put no IndexedDB:", errTx);
          resolve(false);
        }
      }),
      new Promise<boolean>((resolve) =>
        setTimeout(() => {
          console.warn("Timeout de 2.500ms excedido na transação do IndexedDB");
          resolve(false);
        }, 2500)
      ),
    ]);
  } catch (err) {
    console.warn("Aviso ao salvar documento no IndexedDB:", err);
    return false;
  }
}

export async function obterDocumentoArquivoDoIndexedDB(
  docId: string
): Promise<{ blob?: Blob; url: string; mimeType: string; nomeArquivo: string } | null> {
  try {
    const db = await abrirBancoDocsAnuncio();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(docId);
      req.onsuccess = () => {
        const res = req.result as StoredAdDocumentFile | undefined;
        if (res) {
          let url = res.dataUrl || "";
          if (res.blob) {
            url = URL.createObjectURL(res.blob);
          }
          resolve({
            blob: res.blob,
            url,
            mimeType: res.mimeType,
            nomeArquivo: res.nomeArquivo,
          });
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

export async function removerDocumentoArquivoDoIndexedDB(docId: string): Promise<void> {
  try {
    const db = await abrirBancoDocsAnuncio();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(docId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

export async function removerDocumentosDoAnuncioNoIndexedDB(anuncioId: string): Promise<void> {
  try {
    const db = await abrirBancoDocsAnuncio();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const val = cursor.value as StoredAdDocumentFile;
          if (val.anuncioId === anuncioId) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

/* =========================================================================
   SOLICITAÇÕES DE ACESSO AO DATA ROOM (AdDocumentAccessRequest)
   ========================================================================= */

export function listarTodasSolicitacoesStorage(): AdDocumentAccessRequest[] {
  try {
    const raw = localStorage.getItem(REQUESTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function salvarTodasSolicitacoesStorage(solicitacoes: AdDocumentAccessRequest[]): void {
  try {
    localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(solicitacoes));
  } catch (err) {
    console.warn("Erro ao salvar solicitações de acesso a documentos:", err);
  }
}

import {
  apiSolicitarAcessoDocumento,
  apiDecidirSolicitacaoDocumento,
  apiListarDocumentos,
} from "./adsApi";

export async function solicitarAcessoDocumentos(
  anuncioId: string,
  comprador: {
    id: string;
    nome: string;
    cidadeUf?: string;
    tipo?: "PF" | "PJ";
  },
  mensagem: string,
  token?: string
): Promise<AdDocumentAccessRequest> {
  // 1. Se houver token, tenta cadastrar via API REST primeiro
  if (token) {
    try {
      const apiResp = await apiSolicitarAcessoDocumento(anuncioId, mensagem, token);
      if (apiResp && apiResp.id) {
        const novaApiReq: AdDocumentAccessRequest = {
          id: String(apiResp.id),
          anuncioId,
          compradorId: String(apiResp.comprador_id || comprador.id),
          compradorNome: comprador.nome,
          compradorCidadeUf: comprador.cidadeUf,
          compradorTipo: comprador.tipo,
          mensagem: apiResp.mensagem || mensagem.trim(),
          status: apiResp.status || "PENDENTE",
          solicitadoEm: apiResp.solicitada_em || apiResp.solicitado_em || new Date().toISOString(),
          respondidoEm: apiResp.respondida_em || apiResp.respondido_em,
          motivoRecusa: apiResp.motivo_recusa,
        };

        // Sincroniza localmente para fallback
        const todas = listarTodasSolicitacoesStorage();
        const index = todas.findIndex(
          (s) => s.anuncioId === anuncioId && s.compradorId === comprador.id
        );
        if (index >= 0) {
          todas[index] = novaApiReq;
        } else {
          todas.unshift(novaApiReq);
        }
        salvarTodasSolicitacoesStorage(todas);

        return novaApiReq;
      }
    } catch (err) {
      console.warn("Aviso: Falha ao solicitar acesso via API, acionando fallback local:", err);
    }
  }

  // 2. Fallback resiliente no localStorage
  await new Promise((resolve) => setTimeout(resolve, 80));
  const todas = listarTodasSolicitacoesStorage();

  // Verifica se já existe solicitação do comprador para este lote
  const index = todas.findIndex(
    (s) => s.anuncioId === anuncioId && s.compradorId === comprador.id
  );

  const nova: AdDocumentAccessRequest = {
    id:
      index >= 0
        ? todas[index].id
        : `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    anuncioId,
    compradorId: comprador.id,
    compradorNome: comprador.nome,
    compradorCidadeUf: comprador.cidadeUf,
    compradorTipo: comprador.tipo,
    mensagem: mensagem.trim(),
    status: "PENDENTE",
    solicitadoEm: new Date().toISOString(),
  };

  if (index >= 0) {
    todas[index] = nova;
  } else {
    todas.unshift(nova);
  }

  salvarTodasSolicitacoesStorage(todas);
  return nova;
}

export async function obterSolicitacaoComprador(
  anuncioId: string,
  compradorId: string,
  token?: string
): Promise<AdDocumentAccessRequest | null> {
  // 1. Tenta obter da API se houver token
  if (token) {
    try {
      const resp = await apiListarDocumentos(anuncioId, token);
      if (resp && resp.solicitacao) {
        const s = resp.solicitacao;
        return {
          id: String(s.id),
          anuncioId,
          compradorId: String(s.comprador_id || compradorId),
          compradorNome: "Comprador",
          mensagem: s.mensagem || "",
          status: s.status || "PENDENTE",
          solicitadoEm: s.solicitada_em || s.solicitado_em || new Date().toISOString(),
          respondidoEm: s.respondida_em || s.respondido_em,
          motivoRecusa: s.motivo_recusa,
        };
      }
    } catch {
      /* fallback para storage local */
    }
  }

  // 2. Fallback local
  await new Promise((resolve) => setTimeout(resolve, 40));
  const todas = listarTodasSolicitacoesStorage();
  const encontrada = todas.find(
    (s) => s.anuncioId === anuncioId && s.compradorId === compradorId
  );
  return encontrada || null;
}

export async function listarSolicitacoesAnuncio(
  anuncioId: string,
  token?: string
): Promise<AdDocumentAccessRequest[]> {
  const todasLocais = listarTodasSolicitacoesStorage();
  const localDoAnuncio = todasLocais.filter((s) => s.anuncioId === anuncioId);

  // 1. Tenta obter da API se for o dono com token
  if (token) {
    try {
      const resp = await apiListarDocumentos(anuncioId, token);
      if (resp && Array.isArray(resp.solicitacoes)) {
        const apiMapped: AdDocumentAccessRequest[] = resp.solicitacoes.map((s) => ({
          id: String(s.id),
          anuncioId,
          compradorId: String(s.comprador_id),
          compradorNome: s.comprador_nome || "Comprador",
          compradorCidadeUf: s.comprador_cidade_uf,
          compradorTipo: s.comprador_tipo,
          mensagem: s.mensagem || "",
          status: s.status,
          solicitadoEm: s.solicitada_em || s.solicitado_em || new Date().toISOString(),
          respondidoEm: s.respondida_em || s.respondido_em,
          motivoRecusa: s.motivo_recusa,
        }));

        if (apiMapped.length > 0) {
          // Mescla com eventuais solicitações do mock local garantindo integridade
          const apiIds = new Set(apiMapped.map((r) => r.id));
          const mescladas = [
            ...apiMapped,
            ...localDoAnuncio.filter((l) => !apiIds.has(l.id)),
          ];
          return mescladas.sort(
            (a, b) => new Date(b.solicitadoEm).getTime() - new Date(a.solicitadoEm).getTime()
          );
        }
      }
    } catch {
      /* fallback para storage local */
    }
  }

  // 2. Se a API retornou vazia ou houve falha/offline, utiliza as solicitações locais
  await new Promise((resolve) => setTimeout(resolve, 40));
  return localDoAnuncio.sort(
    (a, b) => new Date(b.solicitadoEm).getTime() - new Date(a.solicitadoEm).getTime()
  );
}

export async function responderSolicitacaoAcesso(
  solicitacaoId: string,
  status: DocumentAccessStatus,
  motivoRecusa: string | null = null,
  token?: string
): Promise<AdDocumentAccessRequest> {
  // 1. Tenta persistir na API se houver token e for uma decisão válida (não PENDENTE)
  if (token && status !== "PENDENTE") {
    try {
      const resp = await apiDecidirSolicitacaoDocumento(
        solicitacaoId,
        status as "APROVADO" | "RECUSADO" | "REVOGADO" | "CANCELADO",
        motivoRecusa,
        token
      );
      if (resp && resp.id) {
        const atualizadaApi: AdDocumentAccessRequest = {
          id: String(resp.id),
          anuncioId: String(resp.anuncio_id || ""),
          compradorId: String(resp.comprador_id || ""),
          compradorNome: "Comprador",
          mensagem: resp.mensagem || "",
          status: resp.status || status,
          solicitadoEm: resp.solicitada_em || resp.solicitado_em || new Date().toISOString(),
          respondidoEm: resp.respondida_em || resp.respondido_em || new Date().toISOString(),
          motivoRecusa: resp.motivo_recusa,
        };

        // Sincroniza localmente
        const todas = listarTodasSolicitacoesStorage();
        const idx = todas.findIndex((s) => s.id === solicitacaoId);
        if (idx !== -1) {
          todas[idx] = { ...todas[idx], ...atualizadaApi };
          salvarTodasSolicitacoesStorage(todas);
        }
        return atualizadaApi;
      }
    } catch (err) {
      console.warn("Aviso: Falha ao responder solicitação via API, usando fallback local:", err);
    }
  }

  // 2. Fallback local
  await new Promise((resolve) => setTimeout(resolve, 80));
  const todas = listarTodasSolicitacoesStorage();
  const index = todas.findIndex((s) => s.id === solicitacaoId);
  if (index === -1) {
    throw new Error("Solicitação de acesso não encontrada.");
  }

  const atualizada: AdDocumentAccessRequest = {
    ...todas[index],
    status,
    motivoRecusa: motivoRecusa || todas[index].motivoRecusa,
    respondidoEm: new Date().toISOString(),
  };

  todas[index] = atualizada;
  salvarTodasSolicitacoesStorage(todas);
  return atualizada;
}

export function contarSolicitacoesPendentesAnuncio(anuncioId: string): number {
  const todas = listarTodasSolicitacoesStorage();
  return todas.filter((s) => s.anuncioId === anuncioId && s.status === "PENDENTE").length;
}

export async function revogarAcessoDocumentos(
  solicitacaoId: string,
  token?: string
): Promise<AdDocumentAccessRequest> {
  return responderSolicitacaoAcesso(solicitacaoId, "REVOGADO", null, token);
}

export async function revogarAcessosAoEncerrarAnuncio(anuncioId: string): Promise<void> {
  const todas = listarTodasSolicitacoesStorage();
  const agora = new Date().toISOString();
  let alterou = false;

  const atualizadas = todas.map((s) => {
    if (s.anuncioId !== anuncioId) return s;
    if (s.status === "APROVADO") {
      alterou = true;
      return {
        ...s,
        status: "REVOGADO" as DocumentAccessStatus,
        respondidoEm: agora,
      };
    }
    if (s.status === "PENDENTE") {
      alterou = true;
      return {
        ...s,
        status: "CANCELADO" as DocumentAccessStatus,
        motivoRecusa: "Lote encerrado pelo produtor — negociação finalizada",
        respondidoEm: agora,
      };
    }
    return s;
  });

  if (alterou) {
    salvarTodasSolicitacoesStorage(atualizadas);
  }
}


