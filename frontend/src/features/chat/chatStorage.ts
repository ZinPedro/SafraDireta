import type { MarketplaceAd } from "../ads/ads.types";
import type { ChatMessage, ChatRoom } from "./chat.types";

const CHATS_STORAGE_KEY = "safradireta_chats";

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

export function salvarChats(chats: ChatRoom[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
    window.dispatchEvent(new CustomEvent("safra:chat-updated"));
  } catch (err) {
    console.error("Erro ao salvar chats no localStorage:", err);
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
}): { chat: ChatRoom; mensagem: ChatMessage } {
  const { anuncio, compradorId, compradorNome, compradorAvatar, texto } = params;
  const textoLimpo = texto.trim();
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
      criadoEm: agora,
      lida: false,
    };

    const chatAtualizado: ChatRoom = {
      ...chatExistente,
      compradorAvatar: resolvedCompradorAvatar || chatExistente.compradorAvatar,
      vendedorAvatar: resolvedVendedorAvatar || chatExistente.vendedorAvatar,
      mensagens: [...chatExistente.mensagens, novaMensagem],
      ultimaMensagem: textoLimpo,
      ultimaMensagemEm: agora,
      atualizadoEm: agora,
    };

    chats[chatExistenteIndex] = chatAtualizado;
    salvarChats(chats);
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
    ultimaMensagem: textoLimpo,
    ultimaMensagemEm: agora,
    mensagens: [primeiraMensagem],
  };

  chats.unshift(novoChat);
  salvarChats(chats);
  return { chat: novoChat, mensagem: primeiraMensagem };
}

export function enviarMensagem(
  chatId: string,
  remetenteId: string,
  remetenteNome: string,
  texto: string,
  remetenteAvatar?: string
): ChatMessage | null {
  const textoLimpo = texto.trim();
  if (!textoLimpo || !chatId || !remetenteId) return null;

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
    criadoEm: agora,
    lida: false,
  };

  const chatAtualizado: ChatRoom = {
    ...chat,
    compradorAvatar: chat.compradorId === remetenteId && avatar ? avatar : chat.compradorAvatar,
    vendedorAvatar: chat.vendedorId === remetenteId && avatar ? avatar : chat.vendedorAvatar,
    mensagens: [...chat.mensagens, novaMensagem],
    ultimaMensagem: textoLimpo,
    ultimaMensagemEm: agora,
    atualizadoEm: agora,
  };

  chats[chatIndex] = chatAtualizado;
  salvarChats(chats);
  return novaMensagem;
}

/**
 * Utilitário para testes e demonstrações: simula uma resposta do vendedor ao comprador
 */
export function simularRespostaVendedor(chatId: string, textoResposta?: string): ChatMessage | null {
  const chat = obterChatPorId(chatId);
  if (!chat) return null;

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
