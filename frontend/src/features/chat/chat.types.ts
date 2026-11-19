import type { MarketplaceAd } from "../ads/ads.types";

export interface ChatAttachment {
  nome: string;
  tipoMime: string;
  tamanhoBytes: number;
  url: string;
  tipo: "IMAGEM" | "DOCUMENTO_PDF";
}

export interface ChatMessage {
  id: string;
  chatId: string;
  remetenteId: string;
  remetenteNome: string;
  remetenteAvatar?: string;
  texto: string;
  /** Campo legado mantido para retrocompatibilidade com mensagens já salvas */
  anexo?: ChatAttachment;
  anexos?: ChatAttachment[];
  criadoEm: string;
  lida: boolean;
}

export interface ChatRoom {
  id: string;
  anuncioId: string;
  anuncioTitulo: string;
  anuncioImagem?: string;
  anuncioPrecoTotal: number;
  anuncioCidade: string;
  anuncioUf: string;
  anuncioCategoria: "ANIMAL" | "GRAOS";
  vendedorId: string;
  vendedorNome: string;
  vendedorFarmName?: string;
  vendedorAvatar?: string;
  compradorId: string;
  compradorNome: string;
  compradorAvatar?: string;
  criadoEm: string;
  atualizadoEm: string;
  ultimaMensagem?: string;
  ultimaMensagemEm?: string;
  mensagens: ChatMessage[];
}

export interface ChatDraft {
  isDraft: true;
  anuncio: MarketplaceAd;
  compradorId: string;
  compradorNome: string;
  compradorAvatar?: string;
  vendedorId: string;
  vendedorNome: string;
  vendedorAvatar?: string;
}
