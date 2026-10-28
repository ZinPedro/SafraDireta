// Armazenamento de sessão do frontend, reativo (useSyncExternalStore) e persistido
// no localStorage nas mesmas chaves que o login/cadastro já usavam.
export type VendedorEstado = "PENDENTE" | "HABILITADO" | "REJEITADO" | "SUSPENSO" | "BANIDO" | null;

export interface SessionConta {
  id: string;
  tipo: string;
  nome: string;
  email: string;
  telefone?: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
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

function liberarEspacoRedundanteStorage() {
  try {
    localStorage.removeItem(AVATAR_KEY);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("safradireta_mock_profile:")) {
        const raw = localStorage.getItem(key);
        if (raw && raw.length > 50000) {
          try {
            const parsed = JSON.parse(raw);
            let alterado = false;
            if (parsed?.account?.avatarUrl && String(parsed.account.avatarUrl).startsWith("data:")) {
              delete parsed.account.avatarUrl;
              alterado = true;
            }
            if (alterado) {
              localStorage.setItem(key, JSON.stringify(parsed));
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
}

function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    liberarEspacoRedundanteStorage();
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Se ainda assim exceder a cota (ex: imagem muito grande), mantém em memória sem quebrar o fluxo */
    }
  }
}

function sanitizeContaForStorage(conta: SessionConta): SessionConta {
  const copy = { ...conta };
  if (copy.avatar_url && copy.avatar_url.startsWith("data:")) {
    delete copy.avatar_url;
  }
  if (copy.avatarUrl && copy.avatarUrl.startsWith("data:")) {
    delete copy.avatarUrl;
  }
  return copy;
}

function isBuyerOnlyAccount(conta?: Partial<SessionConta> | null): boolean {
  if (!conta) return false;
  return (
    conta.id === "a7f57e8e-d032-4107-963c-2de3a078fe13" ||
    conta.email?.toLowerCase() === "pedro.h.c.zin@gmail.com"
  );
}

function read(): Session | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const conta = localStorage.getItem(CONTA_KEY);
    if (!token || !conta) return null;
    const parsed = JSON.parse(conta) as SessionConta;
    let estado = localStorage.getItem(VENDEDOR_KEY) as VendedorEstado;
    if (isBuyerOnlyAccount(parsed)) {
      estado = null;
      localStorage.removeItem(VENDEDOR_KEY);
    }
    try {
      localStorage.removeItem(AVATAR_KEY);
    } catch {
      /* ignore */
    }
    const userAvatarKey = parsed.id ? `${AVATAR_KEY}_${parsed.id}` : null;
    const avatar =
      (userAvatarKey ? localStorage.getItem(userAvatarKey) : null) ??
      parsed.avatar_url ??
      parsed.avatarUrl ??
      undefined;
    return { token, conta: parsed, vendedorEstado: estado || null, avatarUrl: avatar };
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
  let scheduled = false;
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      [TOKEN_KEY, CONTA_KEY, VENDEDOR_KEY, AVATAR_KEY].includes(event.key) ||
      event.key.startsWith(`${AVATAR_KEY}_`)
    ) {
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(() => {
          scheduled = false;
          emit(read());
        });
      }
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const getSession = (): Session | null => current;

export function saveSession(
  token: string,
  conta: SessionConta,
  vendedorEstado: VendedorEstado = null,
  avatarUrl?: string
) {
  const effectiveEstado: VendedorEstado = isBuyerOnlyAccount(conta) ? null : vendedorEstado;
  let localSaved: string | null = null;
  const userAvatarKey = conta?.id ? `${AVATAR_KEY}_${conta.id}` : null;
  try {
    localSaved = userAvatarKey ? localStorage.getItem(userAvatarKey) : null;
  } catch {
    localSaved = null;
  }
  const finalAvatar = avatarUrl ?? (conta?.avatar_url || conta?.avatarUrl || localSaved || undefined);

  try {
    // Remove a chave global redundante para economizar espaço no localStorage
    localStorage.removeItem(AVATAR_KEY);
    safeSetItem(TOKEN_KEY, token);
    safeSetItem(CONTA_KEY, JSON.stringify(sanitizeContaForStorage(conta)));
    if (effectiveEstado) {
      safeSetItem(VENDEDOR_KEY, effectiveEstado);
    } else {
      localStorage.removeItem(VENDEDOR_KEY);
    }
    if (finalAvatar && userAvatarKey) {
      if (finalAvatar !== localSaved) {
        safeSetItem(userAvatarKey, finalAvatar);
      }
    }
  } catch {
    /* garante que emit seja chamado mesmo se o storage estiver bloqueado ou cheio */
  }

  emit({ token, conta, vendedorEstado: effectiveEstado, avatarUrl: finalAvatar });
}

export function updateSession(
  patch: Partial<Pick<Session, "vendedorEstado" | "avatarUrl">> & { conta?: Partial<SessionConta> }
) {
  if (!current) return;
  const mergedConta = { ...current.conta, ...patch.conta };
  const rawEstado = patch.vendedorEstado !== undefined ? patch.vendedorEstado : current.vendedorEstado;
  const effectiveEstado: VendedorEstado = isBuyerOnlyAccount(mergedConta) ? null : rawEstado;
  const next: Session = {
    ...current,
    vendedorEstado: effectiveEstado,
    ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    conta: mergedConta,
  };
  try {
    localStorage.removeItem(AVATAR_KEY);
    safeSetItem(CONTA_KEY, JSON.stringify(sanitizeContaForStorage(next.conta)));
    if (next.vendedorEstado) {
      safeSetItem(VENDEDOR_KEY, next.vendedorEstado);
    } else {
      localStorage.removeItem(VENDEDOR_KEY);
    }
    if (patch.avatarUrl !== undefined) {
      const userAvatarKey = next.conta?.id ? `${AVATAR_KEY}_${next.conta.id}` : null;
      if (patch.avatarUrl) {
        if (userAvatarKey) safeSetItem(userAvatarKey, patch.avatarUrl);
      } else {
        if (userAvatarKey) localStorage.removeItem(userAvatarKey);
      }
    }
  } catch {
    /* garante que emit seja chamado mesmo se o storage falhar */
  }
  emit(next);
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CONTA_KEY);
    localStorage.removeItem(VENDEDOR_KEY);
    localStorage.removeItem(AVATAR_KEY);
  } catch {
    /* ignore */
  }
  emit(null);
}
