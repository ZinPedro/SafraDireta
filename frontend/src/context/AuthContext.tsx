import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { MOCK_API } from "../dev/mockApi";
import { clearSession, getSession, saveSession, subscribeSession, updateSession } from "./session";
import { AuthContext } from "./authContext";
import type { AuthContextValue } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);

  // Revalida a sessão guardada e completa o estado de vendedor via GET /api/auth/me.
  const token = session?.token;
  useEffect(() => {
    if (!token || MOCK_API) return;
    const controller = new AbortController();
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return clearSession();
        if (!response.ok) return;
        const data = await response.json();
        updateSession({ conta: data.conta, vendedorEstado: data.vendedor?.estado ?? null });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [token]);

  const signOut = useCallback(async () => {
    const current = getSession();
    clearSession();
    if (!current || MOCK_API) return;
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${current.token}` } });
    } catch {
      // A sessão local já foi encerrada; a revogação no servidor é best effort.
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    signIn: saveSession,
    signOut,
    setAvatar: (url) => updateSession({ avatarUrl: url }),
    setVendedorEstado: (estado) => updateSession({ vendedorEstado: estado }),
  }), [session, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
