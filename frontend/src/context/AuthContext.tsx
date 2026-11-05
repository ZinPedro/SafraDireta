import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { clearSession, getSession, saveSession, subscribeSession, updateSession } from "./session";
import { AuthContext } from "./authContext";
import type { AuthContextValue } from "./authContext";
import {
  listarEmpresasAdmin,
  obterStatusGovernancaProdutor,
  removerProdutorDaGovernanca,
} from "../features/admin/adminStorage";

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);

  // Revalida a sessão guardada e completa o estado de vendedor via GET /api/auth/me.
  const token = session?.token;
  useEffect(() => {
    if (!token) return;
    // Sessão administrativa local do backoffice não deve ser validada contra /api/auth/me
    if (session?.conta?.tipo === "ADMIN" || token.startsWith("admin-")) return;

    const controller = new AbortController();
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => {
        if (getSession()?.token !== token) return;
        if (response.status === 401) return clearSession();
        if (!response.ok) return;
        const data = await response.json();
        if (getSession()?.token !== token) return;

        const avatarUrl =
          data.conta?.avatar_url ||
          data.conta?.avatarUrl ||
          (data.conta?.id ? localStorage.getItem(`safradireta_avatar_${data.conta.id}`) : null) ||
          getSession()?.avatarUrl ||
          undefined;
        let resolvedVendedorEstado = data.vendedor?.estado ?? null;

        if (data.conta?.id) {
          if (data.conta.tipo === "PF" && !resolvedVendedorEstado) {
            // Conta PF sem habilitação no banco é estritamente compradora
            removerProdutorDaGovernanca(data.conta.id);
          } else {
            const statusGov = obterStatusGovernancaProdutor(data.conta.id);
            if (statusGov?.estado === "BANIDO") {
              resolvedVendedorEstado = "BANIDO";
            } else if (statusGov?.estado === "SUSPENSO") {
              resolvedVendedorEstado = "SUSPENSO";
            } else if (data.conta.tipo === "PJ") {
              const pjEmpresas = listarEmpresasAdmin();
              const pjAprovada = pjEmpresas.find(
                (e) =>
                  (e.id === data.conta.id ||
                    (e.cnpj &&
                      data.conta.cpf_cnpj &&
                      e.cnpj.replace(/\D/g, "") === data.conta.cpf_cnpj.replace(/\D/g, ""))) &&
                  e.estado === "APROVADA"
              );
              if (pjAprovada || statusGov?.estado === "HABILITADO") {
                resolvedVendedorEstado = "HABILITADO";
              }
            }
          }
        }

        updateSession({
          conta: data.conta,
          vendedorEstado: resolvedVendedorEstado,
          avatarUrl,
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [token, session?.conta?.tipo]);

  const signOut = useCallback(async () => {
    const current = getSession();
    clearSession();
    if (!current) return;
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
