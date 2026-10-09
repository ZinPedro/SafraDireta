import { MOCK_API, mockDelay } from "../../dev/mockApi";
import { clearSession, getSession, updateSession } from "../../context/session";
import type { Session } from "../../context/session";
import { formatCnpj, formatCpf, isValidCpf } from "../corporate-registration/corporateRegistration";
import type { SellerCategory } from "../seller-upgrade/sellerUpgrade";

export { formatCep, formatCnpj, formatCpf, formatPhone, ufs } from "../corporate-registration/corporateRegistration";
export { sellerCategories } from "../seller-upgrade/sellerUpgrade";
export type { SellerCategory } from "../seller-upgrade/sellerUpgrade";

export interface UserProfileData {
  account: {
    id: string;
    tipo: string;
    nome: string;
    email: string; // Protegido
    cpfCnpj: string; // Opcional para PF até habilitar venda
    telefone: string;
    avatarUrl?: string;
  };
  address: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  seller?: {
    isHabilitado: boolean;
    farmName: string;
    bio: string;
    city: string;
    state: string;
    publicPhone: string;
    categories: SellerCategory[];
    hasOwnTransport: boolean;
  };
}

export type ProfileUpdateResult =
  | { ok: true; message: string; updatedProfile: UserProfileData }
  | { ok: false; reason: "unavailable" | "validation_error" | "unauthorized"; message: string; errors?: Record<string, string> };

export type ProfileLoadResult =
  | { ok: true; profile: UserProfileData }
  | { ok: false; reason: "unavailable" | "unauthorized"; message: string };

export type LoadUserProfile = () => Promise<ProfileLoadResult>;
// Os campos protegidos (e-mail; CPF/CNPJ de PJ ou vendedor habilitado) nunca são alterados livremente.
export type UpdateUserProfile = (data: Partial<UserProfileData>) => Promise<ProfileUpdateResult>;

export const SELLER_BIO_LIMIT = 500;

const emptyAddress: UserProfileData["address"] = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" };

// ---------- Simulação local (somente dev com VITE_MOCK_API=true) ----------

const MOCK_KEY = "safradireta_mock_profile";

function mockSeed(session: Session): UserProfileData {
  const isSeller = session.vendedorEstado === "HABILITADO";
  return {
    account: {
      id: session.conta.id, tipo: session.conta.tipo, nome: session.conta.nome, email: session.conta.email,
      cpfCnpj: session.conta.tipo === "PJ" ? "11222333000181" : "",
      telefone: session.conta.telefone ?? "+5519999998888",
      avatarUrl: session.avatarUrl,
    },
    address: { ...emptyAddress },
    seller: isSeller
      ? { isHabilitado: true, farmName: "Fazenda Santa Maria", bio: "", city: "Campinas", state: "SP", publicPhone: "", categories: ["cafe"], hasOwnTransport: true }
      : undefined,
  };
}

function mockRead(session: Session): UserProfileData {
  try {
    const raw = localStorage.getItem(`${MOCK_KEY}:${session.conta.id}`);
    if (raw) {
      const stored = JSON.parse(raw) as UserProfileData;
      const seed = mockSeed(session);
      const isSeller = session.vendedorEstado === "HABILITADO";
      // Limpa CPF mock antigo 52998224725 se não for vendedor, mas preserva CPF preenchido pelo usuário
      const rawCpf = stored.account?.cpfCnpj || "";
      const cpfCnpj = (rawCpf === "52998224725" && !isSeller) ? "" : rawCpf;

      return {
        ...seed,
        ...stored,
        account: {
          ...seed.account,
          ...stored.account,
          id: session.conta.id,
          tipo: session.conta.tipo,
          nome: session.conta.nome,
          email: session.conta.email,
          cpfCnpj,
          avatarUrl: session.avatarUrl ?? stored.account?.avatarUrl,
        },
        address: { ...seed.address, ...stored.address },
        seller: isSeller ? (stored.seller ?? seed.seller) : undefined,
      };
    }
  } catch { /* usa o seed */ }
  return mockSeed(session);
}

// ---------- Adaptadores ----------

function authHeaders(session: Session): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` };
}

interface BackendEndereco {
  logradouro?: string; numero?: string; complemento?: string | null; bairro?: string;
  municipio?: string; uf?: string; cep?: string; principal?: boolean;
}

// Aceita o formato real do backend (plano: nome, cpf/cnpj, enderecos[]) e também o
// formato aninhado (account/address/seller) descrito no planejamento de integração.
function normalizeProfile(raw: Record<string, unknown>, session: Session): UserProfileData {
  if (raw.account) {
    const nested = raw as Partial<UserProfileData>;
    return {
      account: {
        id: session.conta.id, tipo: session.conta.tipo, nome: session.conta.nome, email: session.conta.email,
        cpfCnpj: "", telefone: "",
        avatarUrl: (nested.account?.avatarUrl as string | undefined) || session.avatarUrl,
        ...nested.account,
        ...(session.avatarUrl ? { avatarUrl: (nested.account?.avatarUrl as string | undefined) || session.avatarUrl } : {}),
      },
      address: { ...emptyAddress, ...nested.address },
      seller: nested.seller,
    };
  }
  const flat = raw as {
    id?: string; tipo?: string; nome?: string; razaoSocial?: string; email?: string; telefone?: string | null;
    cpf?: string | null; cnpj?: string | null; enderecos?: BackendEndereco[];
    avatar_url?: string | null; avatarUrl?: string | null;
  };
  const principal = flat.enderecos?.find((e) => e.principal) ?? flat.enderecos?.[0];
  return {
    account: {
      id: String(flat.id ?? session.conta.id),
      tipo: flat.tipo ?? session.conta.tipo,
      nome: flat.razaoSocial ?? flat.nome ?? session.conta.nome,
      email: flat.email ?? session.conta.email,
      cpfCnpj: flat.cpf ?? flat.cnpj ?? "",
      telefone: flat.telefone ?? "",
      avatarUrl: flat.avatar_url || flat.avatarUrl || session.avatarUrl,
    },
    address: {
      cep: principal?.cep ?? "", logradouro: principal?.logradouro ?? "", numero: principal?.numero ?? "",
      complemento: principal?.complemento ?? "", bairro: principal?.bairro ?? "",
      cidade: principal?.municipio ?? "", uf: principal?.uf ?? "",
    },
    // O backend ainda não devolve a vitrine; com a conta habilitada exibimos a aba com campos vazios.
    seller: session.vendedorEstado === "HABILITADO"
      ? { isHabilitado: true, farmName: "", bio: "", city: "", state: "", publicPhone: "", categories: [], hasOwnTransport: false }
      : undefined,
  };
}

// GET /api/vendedor/habilitacao: complementa a logística (possuiTransportadora) da aba de produtor.
async function withHabilitacao(profile: UserProfileData, session: Session): Promise<UserProfileData> {
  if (!profile.seller || session.vendedorEstado !== "HABILITADO") return profile;
  try {
    const response = await fetch("/api/vendedor/habilitacao", { headers: authHeaders(session) });
    if (!response.ok) return profile;
    const body = await response.json();
    return { ...profile, seller: { ...profile.seller, hasOwnTransport: Boolean(body.possuiTransportadora) } };
  } catch {
    return profile;
  }
}

async function fetchRealProfile(session: Session): Promise<ProfileLoadResult> {
  try {
    const response = await fetch("/api/perfil", { headers: authHeaders(session) });
    if (response.status === 401) {
      clearSession();
      return { ok: false, reason: "unauthorized", message: "Sua sessão expirou. Entre novamente." };
    }
    if (!response.ok) return { ok: false, reason: "unavailable", message: "Não foi possível carregar seu perfil agora. Tente novamente mais tarde." };
    const profile = normalizeProfile(await response.json(), session);
    return { ok: true, profile: await withHabilitacao(profile, session) };
  } catch {
    return { ok: false, reason: "unavailable", message: "Não foi possível conectar ao servidor. Verifique sua conexão." };
  }
}

export const loadUserProfile: LoadUserProfile = async () => {
  const session = getSession();
  if (!session) return { ok: false, reason: "unauthorized", message: "Entre na sua conta para acessar o perfil." };
  if (MOCK_API) {
    await mockDelay(300);
    return { ok: true, profile: mockRead(session) };
  }
  return fetchRealProfile(session);
};

// Campos do PATCH /api/perfil do backend -> nomes dos campos do formulário.
const PATCH_FIELD_MAP: Record<string, string> = {
  name: "nome",
  phone: "telefone",
  cpf: "cpf",
  avatarUrl: "avatarUrl",
};


export const updateUserProfile: UpdateUserProfile = async (data) => {
  const session = getSession();
  if (!session) return { ok: false, reason: "unauthorized", message: "Entre na sua conta para salvar alterações." };
  if (MOCK_API) {
    await mockDelay(500);
    const current = mockRead(session);
    const merged = { ...current };
    const currentCpf = current.account.cpfCnpj ? current.account.cpfCnpj.trim() : "";
    const nextCpf = session.conta.tipo === "PJ" || currentCpf
      ? current.account.cpfCnpj
      : (data.account?.cpfCnpj?.trim() ? data.account.cpfCnpj.trim() : "");
    merged.account = {
      ...current.account,
      ...data.account,
      email: current.account.email,
      cpfCnpj: nextCpf,
      avatarUrl: session.avatarUrl ?? current.account.avatarUrl,
    };
    merged.address = { ...current.address, ...data.address };
    merged.seller = current.seller && data.seller ? { ...current.seller, ...data.seller, isHabilitado: true } : current.seller;
    localStorage.setItem(`${MOCK_KEY}:${session.conta.id}`, JSON.stringify(merged));
    return { ok: true, message: "Alterações salvas (simulação local).", updatedProfile: merged };
  }

  const body: Record<string, unknown> = {};
  if (data.account?.nome) body.name = data.account.nome;
  if (data.account?.telefone) body.phone = data.account.telefone;
  if (data.account?.cpfCnpj?.trim()) body.cpf = data.account.cpfCnpj.trim();
  if (data.account?.avatarUrl && !data.account.avatarUrl.startsWith("data:") && data.account.avatarUrl.length <= 500) {
    body.avatarUrl = data.account.avatarUrl;
  }

  if (data.address && Object.values(data.address).some((v) => String(v ?? "").trim())) {
    body.address = {
      cep: data.address.cep ? data.address.cep.replace(/\D/g, "") : null,
      logradouro: data.address.logradouro?.trim() || null,
      numero: data.address.numero?.trim() || null,
      complemento: data.address.complemento?.trim() || null,
      bairro: data.address.bairro?.trim() || null,
      cidade: data.address.cidade?.trim() || null,
      uf: data.address.uf?.trim() || null,
    };
  }

  if (data.seller) {
    body.seller = {
      farmName: data.seller.farmName?.trim() || null,
      bio: data.seller.bio?.trim() || null,
      city: data.seller.city?.trim() || null,
      state: data.seller.state?.trim() || null,
      publicPhone: data.seller.publicPhone?.trim() || null,
      categories: data.seller.categories ?? [],
      hasOwnTransport: Boolean(data.seller.hasOwnTransport),
    };
  }

  if (Object.keys(body).length === 0) {
    return { ok: false, reason: "validation_error", message: "Nenhuma alteração informada." };
  }
  try {
    const response = await fetch("/api/perfil", { method: "PATCH", headers: authHeaders(session), body: JSON.stringify(body) });
    if (response.status === 401) {
      clearSession();
      return { ok: false, reason: "unauthorized", message: "Sua sessão expirou. Entre novamente." };
    }
    if (response.status === 409 || response.status === 422) {
      const err = await response.json().catch(() => null);
      const campos = (err?.erro?.campos ?? {}) as Record<string, string>;
      const errors = Object.fromEntries(Object.entries(campos).map(([k, v]) => [PATCH_FIELD_MAP[k] ?? k, v]));
      return { ok: false, reason: "validation_error", message: err?.erro?.mensagem ?? "Verifique os dados informados.", errors };
    }
    if (!response.ok) return { ok: false, reason: "unavailable", message: "Não foi possível salvar agora. Tente novamente mais tarde." };
    const saved = await response.json().catch(() => null);
    if (saved?.conta?.nome) updateSession({ conta: { nome: saved.conta.nome } });
    if (saved?.conta?.avatar_url || saved?.conta?.avatarUrl) {
      updateSession({ avatarUrl: saved.conta.avatar_url || saved.conta.avatarUrl });
    }
    if (saved && (saved.account || saved.enderecos)) {
      const normalized = normalizeProfile(saved, getSession() ?? session);
      return { ok: true, message: saved.message ?? "Perfil salvo com sucesso.", updatedProfile: await withHabilitacao(normalized, getSession() ?? session) };
    }
    const reloaded = await fetchRealProfile(getSession() ?? session);
    if (!reloaded.ok) return { ok: false, reason: reloaded.reason, message: reloaded.message };
    return { ok: true, message: "Perfil salvo com sucesso.", updatedProfile: reloaded.profile };
  } catch {
    return { ok: false, reason: "unavailable", message: "Não foi possível conectar ao servidor. Verifique sua conexão." };
  }
};

// ---------- Validação ----------

const PHONE_PATTERN = /^[1-9][0-9][0-9]{8,9}$/;

export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
}

export function toPhoneApi(value: string): string {
  const digits = phoneDigits(value);
  return digits ? `+55${digits}` : "";
}

export function validateAccount(values: {
  nome: string; telefone: string; cpf?: string;
  cep: string; logradouro: string; numero: string; bairro: string; cidade: string; uf: string;
}): Record<string, string> {
  const e: Record<string, string> = {};
  if (values.nome.trim().length < 2) e.nome = "Informe seu nome.";
  if (!PHONE_PATTERN.test(phoneDigits(values.telefone))) e.telefone = "Informe um telefone brasileiro com DDD (10 ou 11 números).";
  if (values.cpf && values.cpf.trim()) {
    if (!isValidCpf(values.cpf)) e.cpf = "Informe um CPF válido ou deixe em branco.";
  }
  const touched = [values.cep, values.logradouro, values.numero, values.bairro, values.cidade, values.uf].some((v) => v.trim());
  if (touched) {
    if (values.cep.replace(/\D/g, "").length !== 8) e.cep = "Informe um CEP com 8 números.";
    if (!values.logradouro.trim()) e.logradouro = "Informe o logradouro.";
    if (!values.numero.trim()) e.numero = "Informe o número (ou S/N).";
    if (!values.bairro.trim()) e.bairro = "Informe o bairro.";
    if (!values.cidade.trim()) e.cidade = "Informe a cidade.";
    if (!values.uf) e.uf = "Selecione o estado.";
  }
  return e;
}

export function validateSellerProfile(values: {
  farmName: string; bio: string; city: string; state: string; publicPhone: string; categories: SellerCategory[];
}): Record<string, string> {
  const e: Record<string, string> = {};
  if (values.farmName.trim().length < 2) e.farmName = "Informe o nome da propriedade.";
  if (values.bio.length > SELLER_BIO_LIMIT) e.bio = `Use no máximo ${SELLER_BIO_LIMIT} caracteres.`;
  if (!values.city.trim()) e.city = "Informe a cidade.";
  if (!values.state) e.state = "Selecione o estado.";
  if (values.publicPhone.trim() && !PHONE_PATTERN.test(phoneDigits(values.publicPhone))) {
    e.publicPhone = "Informe um telefone com DDD (10 ou 11 números).";
  }
  if (values.categories.length === 0) e.categories = "Selecione ao menos uma cultura.";
  return e;
}

export function formatDocument(value: string): string {
  const raw = value.replace(/[^0-9A-Za-z]/g, "");
  return raw.length <= 11 && /^\d*$/.test(raw) ? formatCpf(raw) : formatCnpj(raw);
}
