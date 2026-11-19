export type NotificationType =
  | "CHAT_MESSAGE"
  | "DOCUMENT_REQUEST"
  | "DOCUMENT_APPROVED"
  | "DOCUMENT_REJECTED"
  | "FAVORITE_CLOSED"
  | "FAVORITE_PAUSED";

export interface AppNotification {
  id: string;
  usuarioId: string;
  tipo: NotificationType;
  titulo: string;
  mensagem: string;
  linkDestino: string;
  lida: boolean;
  criadoEm: string;
}

export type NotificationFilterTab =
  | "TODAS"
  | "NAO_LIDAS"
  | "NEGOCIACOES"
  | "LOTES_DOCUMENTOS";
