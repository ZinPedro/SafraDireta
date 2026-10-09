import { createContext, useContext } from "react";
import type { Session, SessionConta, VendedorEstado } from "./session";

export interface AuthContextValue {
  session: Session | null;
  signIn: (token: string, conta: SessionConta, vendedorEstado?: VendedorEstado) => void;
  signOut: () => Promise<void>;
  setAvatar: (url: string | undefined) => void;
  setVendedorEstado: (estado: VendedorEstado) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return value;
}
