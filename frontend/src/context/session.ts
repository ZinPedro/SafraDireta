// Armazenamento de sessão do frontend, reativo (useSyncExternalStore) e persistido
// no localStorage nas mesmas chaves que o login/cadastro já usavam.
export type VendedorEstado = "PENDENTE" | "HABILITADO" | "REJEITADO" | "SUSPENSO" | null;

export interface SessionConta {
  id: string;
  tipo: string;
  nome: string;
  email: string;
  telefone?: string;
}

export interface Session {
  token: string;
  conta: SessionConta;
  vendedorEstado: VendedorEstado;
  // Apenas em memória: o upload de foto é local/provisório e não é persistido.
  avatarUrl?: string;
}

const TOKEN_KEY = "safradireta_token";
const CONTA_KEY = "safradireta_conta";
const VENDEDOR_KEY = "safradireta_vendedor";
const AVATAR_KEY = "safradireta_avatar";

function read(): Session | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const conta = localStorage.getItem(CONTA_KEY);
    if (!token || !conta) return null;
    const estado = localStorage.getItem(VENDEDOR_KEY) as VendedorEstado;
    const avatar = localStorage.getItem(AVATAR_KEY) ?? undefined;
    return { token, conta: JSON.parse(conta) as SessionConta, vendedorEstado: estado || null, avatarUrl: avatar };
  } catch {
    return null;
  }
}

let current: Session | null = read();
const listeners = new Set<() => void>();

function emit(next: Session | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || [TOKEN_KEY, CONTA_KEY, VENDEDOR_KEY, AVATAR_KEY].includes(event.key)) emit(read());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const getSession = (): Session | null => current;

export function saveSession(token: string, conta: SessionConta, vendedorEstado: VendedorEstado = null, avatarUrl?: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CONTA_KEY, JSON.stringify(conta));
  if (vendedorEstado) localStorage.setItem(VENDEDOR_KEY, vendedorEstado);
  else localStorage.removeItem(VENDEDOR_KEY);
  if (avatarUrl) localStorage.setItem(AVATAR_KEY, avatarUrl);
  emit({ token, conta, vendedorEstado, avatarUrl: avatarUrl ?? current?.avatarUrl });
}

export function updateSession(patch: Partial<Pick<Session, "vendedorEstado" | "avatarUrl">> & { conta?: Partial<SessionConta> }) {
  if (!current) return;
  const next: Session = {
    ...current,
    ...(patch.vendedorEstado !== undefined ? { vendedorEstado: patch.vendedorEstado } : {}),
    ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    conta: { ...current.conta, ...patch.conta },
  };
  localStorage.setItem(CONTA_KEY, JSON.stringify(next.conta));
  if (next.vendedorEstado) localStorage.setItem(VENDEDOR_KEY, next.vendedorEstado);
  else localStorage.removeItem(VENDEDOR_KEY);
  if (patch.avatarUrl !== undefined) {
    if (patch.avatarUrl) localStorage.setItem(AVATAR_KEY, patch.avatarUrl);
    else localStorage.removeItem(AVATAR_KEY);
  }
  emit(next);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CONTA_KEY);
  localStorage.removeItem(VENDEDOR_KEY);
  localStorage.removeItem(AVATAR_KEY);
  emit(null);
}
