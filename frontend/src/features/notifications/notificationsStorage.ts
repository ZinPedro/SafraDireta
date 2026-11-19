import type { AppNotification } from "./notification.types";

const NOTIFICATIONS_STORAGE_KEY = "safradireta_notifications";

function carregarNotificacoesRaw(): AppNotification[] {
  if (typeof window === "undefined" && typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Erro ao carregar notificações do localStorage:", err);
    return [];
  }
}

function salvarNotificacoesRaw(notificacoes: AppNotification[]): void {
  if (typeof window === "undefined" && typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notificacoes));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("safra:notification-updated"));
    }
  } catch (err) {
    console.error("Erro ao salvar notificações no localStorage:", err);
  }
}

export function listarNotificacoes(usuarioId: string): AppNotification[] {
  if (!usuarioId) return [];
  return carregarNotificacoesRaw()
    .filter((n) => n.usuarioId === usuarioId)
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
}

export function obterTotalNaoLidas(usuarioId: string): number {
  if (!usuarioId) return 0;
  return carregarNotificacoesRaw().filter(
    (n) => n.usuarioId === usuarioId && !n.lida
  ).length;
}

export function marcarComoLida(notificationId: string, usuarioId?: string): void {
  if (!notificationId) return;
  const todas = carregarNotificacoesRaw();
  let houveAlteracao = false;

  const atualizadas = todas.map((n) => {
    if (
      n.id === notificationId &&
      !n.lida &&
      (!usuarioId || n.usuarioId === usuarioId)
    ) {
      houveAlteracao = true;
      return { ...n, lida: true };
    }
    return n;
  });

  if (houveAlteracao) {
    salvarNotificacoesRaw(atualizadas);
  }
}

export function marcarTodasComoLidas(usuarioId: string): void {
  if (!usuarioId) return;
  const todas = carregarNotificacoesRaw();
  let houveAlteracao = false;

  const atualizadas = todas.map((n) => {
    if (n.usuarioId === usuarioId && !n.lida) {
      houveAlteracao = true;
      return { ...n, lida: true };
    }
    return n;
  });

  if (houveAlteracao) {
    salvarNotificacoesRaw(atualizadas);
  }
}

export function criarNotificacao(
  params: Omit<AppNotification, "id" | "lida" | "criadoEm">
): AppNotification {
  const todas = carregarNotificacoesRaw();
  const nova: AppNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    usuarioId: params.usuarioId,
    tipo: params.tipo,
    titulo: params.titulo,
    mensagem: params.mensagem,
    linkDestino: params.linkDestino,
    lida: false,
    criadoEm: new Date().toISOString(),
  };

  // Mantém até 100 notificações mais recentes no storage para evitar crescimento infinito
  const atualizadas = [nova, ...todas].slice(0, 100);
  salvarNotificacoesRaw(atualizadas);
  return nova;
}

export function formatarTempoRelativo(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} dias`;

  return new Date(isoDate).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function getNotificationIcon(tipo: AppNotification["tipo"]) {
  switch (tipo) {
    case "CHAT_MESSAGE":
      return "chat" as const;
    case "DOCUMENT_REQUEST":
      return "file" as const;
    case "DOCUMENT_APPROVED":
      return "check" as const;
    case "DOCUMENT_REJECTED":
      return "alert" as const;
    case "FAVORITE_CLOSED":
      return "box" as const;
    case "FAVORITE_PAUSED":
      return "pause" as const;
    default:
      return "bell" as const;
  }
}

export function getNotificationToneClass(tipo: AppNotification["tipo"]): string {
  switch (tipo) {
    case "CHAT_MESSAGE":
      return "notif-item__icon--chat";
    case "DOCUMENT_REQUEST":
    case "DOCUMENT_APPROVED":
      return "notif-item__icon--doc";
    case "DOCUMENT_REJECTED":
      return "notif-item__icon--warn";
    case "FAVORITE_CLOSED":
    case "FAVORITE_PAUSED":
      return "notif-item__icon--fav";
    default:
      return "notif-item__icon--chat";
  }
}

