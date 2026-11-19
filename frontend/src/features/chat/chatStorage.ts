import type { MarketplaceAd } from "../ads/ads.types";
import type { ChatAttachment, ChatMessage, ChatRoom } from "./chat.types";
import { criarNotificacao } from "../notifications/notificationsStorage";

export const CHATS_STORAGE_KEY = "safradireta_chats";

export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_CHAT_ATTACHMENTS_PER_MESSAGE = 5;
export const SUPPORTED_CHAT_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const SUPPORTED_CHAT_PDF_MIME = "application/pdf";

export function formatarTamanhoArquivo(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export function validarArquivoChat(file: {
  type: string;
  size: number;
  name?: string;
}):
  | { valid: true; tipo: "IMAGEM" | "DOCUMENTO_PDF"; tipoMime: string }
  | { valid: false; error: string } {
  const mime = (file.type || "").toLowerCase();
  const nome = (file.name || "").toLowerCase();

  let tipo: "IMAGEM" | "DOCUMENTO_PDF" | null = null;
  let tipoMime = mime;

  if (
    SUPPORTED_CHAT_IMAGE_MIMES.includes(
      mime as (typeof SUPPORTED_CHAT_IMAGE_MIMES)[number]
    )
  ) {
    tipo = "IMAGEM";
  } else if (mime === SUPPORTED_CHAT_PDF_MIME) {
    tipo = "DOCUMENTO_PDF";
  } else if (!mime) {
    if (/\.(jpe?g)$/.test(nome)) {
      tipo = "IMAGEM";
      tipoMime = "image/jpeg";
    } else if (/\.png$/.test(nome)) {
      tipo = "IMAGEM";
      tipoMime = "image/png";
    } else if (/\.webp$/.test(nome)) {
      tipo = "IMAGEM";
      tipoMime = "image/webp";
    } else if (/\.pdf$/.test(nome)) {
      tipo = "DOCUMENTO_PDF";
      tipoMime = SUPPORTED_CHAT_PDF_MIME;
    }
  }

  if (!tipo) {
    return {
      valid: false,
      error: "Formato não suportado. Envie imagens (JPEG, PNG, WEBP) ou documentos PDF.",
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: "O arquivo selecionado está vazio.",
    };
  }

  if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    return {
      valid: false,
      error: `O arquivo excede o limite máximo de 10 MB (${formatarTamanhoArquivo(file.size)}).`,
    };
  }

  return { valid: true, tipo, tipoMime };
}

function lerArquivoComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Falha ao ler arquivo como DataURL."));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo selecionado."));
    reader.readAsDataURL(file);
  });
}

function estimarTamanhoBase64Bytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return dataUrl.length;
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export async function comprimirImagemParaDataUrl(
  file: File,
  maxWidth = 1600,
  quality = 0.8
): Promise<{ url: string; tamanhoBytes: number; tipoMime: string }> {
  const rawDataUrl = await lerArquivoComoDataUrl(file);

  if (typeof document === "undefined" || typeof Image === "undefined") {
    return {
      url: rawDataUrl,
      tamanhoBytes: file.size,
      tipoMime: file.type || "image/jpeg",
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let targetWidth = img.naturalWidth || img.width;
        let targetHeight = img.naturalHeight || img.height;

        if (targetWidth > maxWidth && targetWidth > 0) {
          const ratio = maxWidth / targetWidth;
          targetWidth = maxWidth;
          targetHeight = Math.max(1, Math.round(targetHeight * ratio));
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({
            url: rawDataUrl,
            tamanhoBytes: file.size,
            tipoMime: file.type || "image/jpeg",
          });
          return;
        }

        // Fundo branco para evitar transparência preta ao converter PNG/WEBP para JPEG
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const compressedUrl = canvas.toDataURL("image/jpeg", quality);
        const compressedSize = estimarTamanhoBase64Bytes(compressedUrl);

        resolve({
          url: compressedUrl,
          tamanhoBytes: compressedSize,
          tipoMime: "image/jpeg",
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Não foi possível processar a imagem selecionada."));
    img.src = rawDataUrl;
  });
}

export async function processarArquivoAnexoChat(file: File): Promise<ChatAttachment> {
  const validacao = validarArquivoChat(file);
  if (!validacao.valid) {
    throw new Error(validacao.error);
  }

  if (validacao.tipo === "IMAGEM") {
    const comprimida = await comprimirImagemParaDataUrl(file, 1280, 0.75);
    return {
      nome: file.name,
      tipoMime: comprimida.tipoMime,
      tamanhoBytes: comprimida.tamanhoBytes,
      url: comprimida.url,
      tipo: "IMAGEM",
    };
  }

  const pdfUrl = await lerArquivoComoDataUrl(file);
  return {
    nome: file.name,
    tipoMime: validacao.tipoMime,
    tamanhoBytes: file.size,
    url: pdfUrl,
    tipo: "DOCUMENTO_PDF",
  };
}

export async function processarArquivosAnexoChat(
  files: FileList | File[],
  quantidadeAtual = 0
): Promise<{ anexos: ChatAttachment[]; erros: string[] }> {
  const lista = Array.from(files);
  const vagasRestantes = Math.max(0, MAX_CHAT_ATTACHMENTS_PER_MESSAGE - quantidadeAtual);
  const anexos: ChatAttachment[] = [];
  const erros: string[] = [];

  if (vagasRestantes === 0 && lista.length > 0) {
    erros.push(`Limite máximo de ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} anexos por mensagem atingido.`);
    return { anexos, erros };
  }

  const arquivosParaProcessar = lista.slice(0, vagasRestantes);
  if (lista.length > vagasRestantes) {
    erros.push(
      `Apenas os primeiros ${vagasRestantes} arquivo(s) foram considerados (limite de ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} por mensagem).`
    );
  }

  for (const file of arquivosParaProcessar) {
    try {
      const anexo = await processarArquivoAnexoChat(file);
      anexos.push(anexo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao processar arquivo.";
      erros.push(`${file.name}: ${msg}`);
    }
  }

  return { anexos, erros };
}

export function obterAnexosMensagem(
  msg: Pick<ChatMessage, "anexo" | "anexos">
): ChatAttachment[] {
  if (Array.isArray(msg.anexos) && msg.anexos.length > 0) {
    return msg.anexos;
  }
  if (msg.anexo) {
    return [msg.anexo];
  }
  return [];
}

function resumirMensagemChat(texto: string, anexos?: ChatAttachment[]): string {
  if (texto) return texto;
  if (!anexos || anexos.length === 0) return "";
  if (anexos.length === 1) {
    const unico = anexos[0];
    return unico.tipo === "IMAGEM" ? `📷 Imagem: ${unico.nome}` : `📄 PDF: ${unico.nome}`;
  }
  const totalImagens = anexos.filter((a) => a.tipo === "IMAGEM").length;
  const totalPdfs = anexos.filter((a) => a.tipo === "DOCUMENTO_PDF").length;
  if (totalImagens > 0 && totalPdfs === 0) return `📷 ${totalImagens} imagens`;
  if (totalPdfs > 0 && totalImagens === 0) return `📄 ${totalPdfs} documentos PDF`;
  return `📎 ${anexos.length} anexos (${totalImagens} img, ${totalPdfs} PDF)`;
}

export function obterChatsArmazenados(): ChatRoom[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Erro ao carregar chats do localStorage:", err);
    return [];
  }
}

export function salvarChats(chats: ChatRoom[], throwOnError = false): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
    window.dispatchEvent(new CustomEvent("safra:chat-updated"));
  } catch (err) {
    console.error("Erro ao salvar chats no localStorage:", err);
    if (throwOnError) {
      throw new Error(
        "Limite de armazenamento local do navegador atingido. Envie arquivos menores ou em menor quantidade."
      );
    }
  }
}

export function listarChatsUsuario(usuarioId: string): ChatRoom[] {
  if (!usuarioId) return [];
  const chats = obterChatsArmazenados();
  return chats
    .filter((c) => c.compradorId === usuarioId || c.vendedorId === usuarioId)
    .sort((a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime());
}

export function obterChatPorId(chatId: string): ChatRoom | null {
  if (!chatId) return null;
  const chats = obterChatsArmazenados();
  return chats.find((c) => c.id === chatId) || null;
}

export function obterChatPorAnuncioEComprador(
  anuncioId: string,
  compradorId: string
): ChatRoom | null {
  if (!anuncioId || !compradorId) return null;
  const chats = obterChatsArmazenados();
  return chats.find((c) => c.anuncioId === anuncioId && c.compradorId === compradorId) || null;
}

export function obterTotalNaoLidas(usuarioId: string): number {
  if (!usuarioId) return 0;
  const chats = obterChatsArmazenados();
  let total = 0;
  for (const chat of chats) {
    if (chat.compradorId === usuarioId || chat.vendedorId === usuarioId) {
      for (const msg of chat.mensagens) {
        if (msg.remetenteId !== usuarioId && !msg.lida) {
          total++;
        }
      }
    }
  }
  return total;
}

export function marcarMensagensComoLidas(chatId: string, usuarioId: string): void {
  if (!chatId || !usuarioId) return;
  const chats = obterChatsArmazenados();
  const chatIndex = chats.findIndex((c) => c.id === chatId);
  if (chatIndex === -1) return;

  let houveAlteracao = false;
  const mensagensAtualizadas = chats[chatIndex].mensagens.map((msg) => {
    if (msg.remetenteId !== usuarioId && !msg.lida) {
      houveAlteracao = true;
      return { ...msg, lida: true };
    }
    return msg;
  });

  if (houveAlteracao) {
    chats[chatIndex] = {
      ...chats[chatIndex],
      mensagens: mensagensAtualizadas,
    };
    salvarChats(chats);
  }
}

export function obterAvatarUsuario(usuarioId: string, fallback?: string): string | undefined {
  if (fallback) return fallback;
  if (typeof window === "undefined" || !usuarioId) return undefined;
  try {
    const local = localStorage.getItem(`safradireta_avatar_${usuarioId}`);
    if (local) return local;

    const profileRaw = localStorage.getItem(`safradireta_mock_profile:${usuarioId}`);
    if (profileRaw) {
      const parsed = JSON.parse(profileRaw);
      if (parsed?.account?.avatarUrl) return parsed.account.avatarUrl;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function criarOuEnviarPrimeiraMensagem(params: {
  anuncio: MarketplaceAd;
  compradorId: string;
  compradorNome: string;
  compradorAvatar?: string;
  texto: string;
  anexo?: ChatAttachment;
  anexos?: ChatAttachment[];
}): { chat: ChatRoom; mensagem: ChatMessage } {
  const { anuncio, compradorId, compradorNome, compradorAvatar, texto, anexo, anexos } = params;
  const textoLimpo = texto.trim();
  const listaAnexos = anexos && anexos.length > 0 ? anexos : anexo ? [anexo] : undefined;
  const resumo = resumirMensagemChat(textoLimpo, listaAnexos);
  const agora = new Date().toISOString();
  const chats = obterChatsArmazenados();
  const resolvedCompradorAvatar = compradorAvatar || obterAvatarUsuario(compradorId);
  const resolvedVendedorAvatar = anuncio.vendedorAvatar || obterAvatarUsuario(anuncio.vendedorId);

  // Verifica se já existe uma sala para esse par anúncio e comprador
  const chatExistenteIndex = chats.findIndex(
    (c) => c.anuncioId === anuncio.id && c.compradorId === compradorId
  );

  if (chatExistenteIndex !== -1) {
    const chatExistente = chats[chatExistenteIndex];
    const novaMensagem: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      chatId: chatExistente.id,
      remetenteId: compradorId,
      remetenteNome: compradorNome,
      remetenteAvatar: resolvedCompradorAvatar,
      texto: textoLimpo,
      ...(listaAnexos ? { anexos: listaAnexos } : {}),
      criadoEm: agora,
      lida: false,
    };

    const chatAtualizado: ChatRoom = {
      ...chatExistente,
      compradorAvatar: resolvedCompradorAvatar || chatExistente.compradorAvatar,
      vendedorAvatar: resolvedVendedorAvatar || chatExistente.vendedorAvatar,
      mensagens: [...chatExistente.mensagens, novaMensagem],
      ultimaMensagem: resumo,
      ultimaMensagemEm: agora,
      atualizadoEm: agora,
    };

    chats[chatExistenteIndex] = chatAtualizado;
    salvarChats(chats, true);
    if (anuncio.vendedorId && anuncio.vendedorId !== compradorId) {
      criarNotificacao({
        usuarioId: anuncio.vendedorId,
        tipo: "CHAT_MESSAGE",
        titulo: `Nova mensagem de ${compradorNome}`,
        mensagem: `${anuncio.titulo}: "${resumo}"`,
        linkDestino: `/negociacoes/${chatExistente.id}`,
      });
    }
    return { chat: chatAtualizado, mensagem: novaMensagem };
  }

  // Criação sob Demanda (Lazy Creation): persistir apenas agora!
  const novoChatId = `chat_${anuncio.id}_${compradorId}_${Date.now().toString(36)}`;
  const primeiraMensagem: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    chatId: novoChatId,
    remetenteId: compradorId,
    remetenteNome: compradorNome,
    remetenteAvatar: resolvedCompradorAvatar,
    texto: textoLimpo,
    ...(listaAnexos ? { anexos: listaAnexos } : {}),
    criadoEm: agora,
    lida: false,
  };

  const fotoCapa =
    anuncio.imagemUrl || (anuncio.fotos && anuncio.fotos.length > 0 ? anuncio.fotos[0] : undefined);

  const novoChat: ChatRoom = {
    id: novoChatId,
    anuncioId: anuncio.id,
    anuncioTitulo: anuncio.titulo,
    anuncioImagem: fotoCapa,
    anuncioPrecoTotal: anuncio.precoTotal,
    anuncioCidade: anuncio.cidade,
    anuncioUf: anuncio.uf,
    anuncioCategoria: anuncio.categoria,
    vendedorId: anuncio.vendedorId,
    vendedorNome: anuncio.vendedorNome || "Produtor Rural",
    vendedorFarmName: anuncio.farmName,
    vendedorAvatar: resolvedVendedorAvatar,
    compradorId,
    compradorNome,
    compradorAvatar: resolvedCompradorAvatar,
    criadoEm: agora,
    atualizadoEm: agora,
    ultimaMensagem: resumo,
    ultimaMensagemEm: agora,
    mensagens: [primeiraMensagem],
  };

  chats.unshift(novoChat);
  salvarChats(chats, true);
  if (anuncio.vendedorId && anuncio.vendedorId !== compradorId) {
    criarNotificacao({
      usuarioId: anuncio.vendedorId,
      tipo: "CHAT_MESSAGE",
      titulo: `Nova mensagem de ${compradorNome}`,
      mensagem: `${anuncio.titulo}: "${resumo}"`,
      linkDestino: `/negociacoes/${novoChat.id}`,
    });
  }
  return { chat: novoChat, mensagem: primeiraMensagem };
}

export function enviarMensagem(
  chatId: string,
  remetenteId: string,
  remetenteNome: string,
  texto: string,
  remetenteAvatar?: string,
  anexosInput?: ChatAttachment | ChatAttachment[]
): ChatMessage | null {
  const textoLimpo = texto.trim();
  const listaAnexos = Array.isArray(anexosInput)
    ? anexosInput.length > 0
      ? anexosInput
      : undefined
    : anexosInput
    ? [anexosInput]
    : undefined;

  if ((!textoLimpo && !listaAnexos) || !chatId || !remetenteId) return null;

  const chats = obterChatsArmazenados();
  const chatIndex = chats.findIndex((c) => c.id === chatId);
  if (chatIndex === -1) return null;

  const chat = chats[chatIndex];
  const avatar =
    remetenteAvatar ||
    obterAvatarUsuario(remetenteId) ||
    (chat.compradorId === remetenteId ? chat.compradorAvatar : chat.vendedorAvatar);

  const agora = new Date().toISOString();
  const novaMensagem: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    chatId,
    remetenteId,
    remetenteNome,
    remetenteAvatar: avatar,
    texto: textoLimpo,
    ...(listaAnexos ? { anexos: listaAnexos } : {}),
    criadoEm: agora,
    lida: false,
  };

  const resumo = resumirMensagemChat(textoLimpo, listaAnexos);
  const chatAtualizado: ChatRoom = {
    ...chat,
    compradorAvatar: chat.compradorId === remetenteId && avatar ? avatar : chat.compradorAvatar,
    vendedorAvatar: chat.vendedorId === remetenteId && avatar ? avatar : chat.vendedorAvatar,
    mensagens: [...chat.mensagens, novaMensagem],
    ultimaMensagem: resumo,
    ultimaMensagemEm: agora,
    atualizadoEm: agora,
  };

  chats[chatIndex] = chatAtualizado;
  salvarChats(chats, true);

  const destinatarioId =
    chat.compradorId === remetenteId ? chat.vendedorId : chat.compradorId;
  if (destinatarioId && destinatarioId !== remetenteId) {
    criarNotificacao({
      usuarioId: destinatarioId,
      tipo: "CHAT_MESSAGE",
      titulo: `Nova mensagem de ${remetenteNome}`,
      mensagem: `${chat.anuncioTitulo}: "${resumo}"`,
      linkDestino: `/negociacoes/${chat.id}`,
    });
  }

  return novaMensagem;
}

/**
 * Utilitário para testes e demonstrações: simula uma resposta do vendedor ao comprador
 */
export function simularRespostaVendedor(chatId: string, textoResposta?: string): ChatMessage | null {
  const chat = obterChatPorId(chatId);
  if (!chat) return null;

  // Ao responder, o vendedor leu as mensagens anteriores do comprador
  marcarMensagensComoLidas(chat.id, chat.vendedorId);

  const respostasPadrao = [
    "Olá! O lote está disponível para visita e carregamento sim.",
    "Perfeito, as especificações e laudos técnicos estão em dia.",
    "Podemos agendar a pesagem e conferência da carga.",
    "O valor do frete pode ser combinado com base na distância de retirada.",
  ];

  const texto =
    textoResposta ||
    respostasPadrao[Math.floor(Math.random() * respostasPadrao.length)];

  const avatar = chat.vendedorAvatar || obterAvatarUsuario(chat.vendedorId);
  return enviarMensagem(chat.id, chat.vendedorId, chat.vendedorNome, texto, avatar);
}
