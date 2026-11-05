import { clearSession, getSession, updateSession } from "../../context/session";
import type { Session } from "../../context/session";
import { formatCnpj, formatCpf, isValidCpf } from "../corporate-registration/corporateRegistration";
import type { SellerCategory } from "../seller-upgrade/sellerUpgrade";
import { sincronizarProdutorNosAnuncios } from "../ads/adsStorage";
import { registrarProdutorParaGovernanca, sincronizarDadosEmpresaAdmin } from "../admin/adminStorage";

export { formatCep, formatCnpj, formatCpf, formatPhone, isValidCpf, ufs } from "../corporate-registration/corporateRegistration";
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
    razaoSocial?: string;
    nomeFantasia?: string;
  };
  representantes?: Array<{
    id: string;
    nome: string;
    cpf: string;
    vinculo: string;
    inicioVigencia?: string | null;
    fimVigencia?: string | null;
  }>;
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
    bannerUrl?: string;
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
    const isHabilitado =
      session.vendedorEstado === "HABILITADO" || Boolean(nested.seller?.isHabilitado);
    const seller = isHabilitado
      ? {
          isHabilitado: true,
          farmName: "",
          bio: "",
          city: "",
          state: "",
          publicPhone: "",
          categories: [],
          hasOwnTransport: false,
          ...(nested.seller || {}),
        }
      : undefined;
    const representantes = (raw.representantes as UserProfileData["representantes"]) || (nested as any).representantes;
    const razaoSocial = (raw.razaoSocial as string | undefined) || (nested.account as any)?.razaoSocial;
    const nomeFantasia = (raw.nomeFantasia as string | undefined) || (nested.account as any)?.nomeFantasia;
    return {
      account: {
        id: session.conta.id, tipo: session.conta.tipo, nome: session.conta.nome, email: session.conta.email,
        cpfCnpj: "", telefone: "",
        avatarUrl: (nested.account?.avatarUrl as string | undefined) || session.avatarUrl,
        ...nested.account,
        razaoSocial,
        nomeFantasia,
        ...(session.avatarUrl ? { avatarUrl: (nested.account?.avatarUrl as string | undefined) || session.avatarUrl } : {}),
      },
      representantes,
      address: { ...emptyAddress, ...nested.address },
      seller,
    };
  }
  const flat = raw as {
    id?: string; tipo?: string; nome?: string; razaoSocial?: string; nomeFantasia?: string; email?: string; telefone?: string | null;
    cpf?: string | null; cnpj?: string | null; enderecos?: BackendEndereco[];
    avatar_url?: string | null; avatarUrl?: string | null;
    representantes?: UserProfileData["representantes"];
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
      avatarUrl:
        flat.avatar_url ||
        flat.avatarUrl ||
        (session.conta?.id ? localStorage.getItem(`safradireta_avatar_${session.conta.id}`) : null) ||
        session.avatarUrl,
      razaoSocial: flat.razaoSocial,
      nomeFantasia: flat.nomeFantasia,
    },
    representantes: flat.representantes,
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
  if (session.conta.tipo === "ADMIN" || session.token.startsWith("admin-")) {
    return { ok: true, profile: mockRead(session) };
  }
  try {
    const response = await fetch("/api/perfil", { headers: authHeaders(session) });
    if (response.status === 401) {
      if (getSession()?.token === session.token) {
        clearSession();
      }
      return { ok: false, reason: "unauthorized", message: "Sua sessão expirou. Entre novamente." };
    }
    if (!response.ok) return { ok: false, reason: "unavailable", message: "Não foi possível carregar seu perfil agora. Tente novamente mais tarde." };
    const profile = normalizeProfile(await response.json(), getSession() ?? session);
    try {
      localStorage.removeItem("safradireta_farm_banner");
      const savedBanner =
        (session.conta?.id ? localStorage.getItem(`safradireta_farm_banner_${session.conta.id}`) : null) ||
        undefined;
      if (profile.seller && savedBanner) {
        profile.seller.bannerUrl = savedBanner;
      }
    } catch {
      /* ignore */
    }
    const finalProfile = await withHabilitacao(profile, getSession() ?? session);
    try {
      const toStore = {
        ...finalProfile,
        account: {
          ...finalProfile.account,
          avatarUrl:
            finalProfile.account.avatarUrl && finalProfile.account.avatarUrl.startsWith("data:")
              ? undefined
              : finalProfile.account.avatarUrl,
        },
      };
      localStorage.setItem(`${MOCK_KEY}:${session.conta.id}`, JSON.stringify(toStore));
      if (session.conta.tipo === "PJ") {
        const primeiroRep = finalProfile.representantes?.[0];
        sincronizarDadosEmpresaAdmin({
          id: session.conta.id,
          razaoSocial: finalProfile.account.razaoSocial || finalProfile.account.nome || session.conta.nome,
          nomeFantasia: finalProfile.account.nomeFantasia,
          cnpj: finalProfile.account.cpfCnpj,
          email: finalProfile.account.email || session.conta.email,
          telefone: finalProfile.account.telefone,
          endereco: finalProfile.address,
          representante: primeiroRep
            ? {
                nome: primeiroRep.nome,
                cpf: primeiroRep.cpf,
                vinculo: primeiroRep.vinculo,
              }
            : undefined,
        });
      }
      if (finalProfile.seller?.isHabilitado) {
        registrarProdutorParaGovernanca({
          id: session.conta.id,
          nome: finalProfile.account.nome || session.conta.nome,
          farmName: finalProfile.seller.farmName || `Fazenda ${finalProfile.account.nome || session.conta.nome}`,
          documento: finalProfile.account.cpfCnpj || "",
          tipoDocumento: session.conta.tipo === "PJ" ? "CNPJ" : "CPF",
          email: finalProfile.account.email || session.conta.email,
          cidade: finalProfile.seller.city || finalProfile.address?.cidade || "",
          uf: finalProfile.seller.state || finalProfile.address?.uf || "",
          estado: "HABILITADO",
        });
      }
    } catch {
      /* ignore */
    }
    return { ok: true, profile: finalProfile };
  } catch {
    return { ok: false, reason: "unavailable", message: "Não foi possível conectar ao servidor. Verifique sua conexão." };
  }
}

export const loadUserProfile: LoadUserProfile = async () => {
  const session = getSession();
  if (!session) return { ok: false, reason: "unauthorized", message: "Entre na sua conta para acessar o perfil." };
  if (session.conta.tipo === "ADMIN" || session.token.startsWith("admin-")) {
    await new Promise((r) => setTimeout(r, 80));
    return { ok: true, profile: mockRead(session) };
  }
  return fetchRealProfile(session);
};

// Campos do PATCH /api/perfil do backend -> nomes dos campos do formulário.
const PATCH_FIELD_MAP: Record<string, string> = {
  name: "nome",
  "account.nome": "nome",
  phone: "telefone",
  "account.telefone": "telefone",
  cpf: "cpf",
  "account.cpf": "cpf",
  "account.cpfCnpj": "cpf",
  avatarUrl: "avatarUrl",
  "account.avatarUrl": "avatarUrl",
  // Endereço
  "address.cep": "cep",
  "address.logradouro": "logradouro",
  "address.numero": "numero",
  "address.complemento": "complemento",
  "address.bairro": "bairro",
  "address.cidade": "cidade",
  "address.uf": "uf",
  cep: "cep",
  logradouro: "logradouro",
  numero: "numero",
  complemento: "complemento",
  bairro: "bairro",
  cidade: "cidade",
  uf: "uf",
  // Vitrine do Produtor
  "seller.farmName": "farmName",
  "seller.farm_name": "farmName",
  farmName: "farmName",
  farm_name: "farmName",
  "seller.bio": "bio",
  bio: "bio",
  "seller.city": "city",
  city: "city",
  "seller.state": "state",
  state: "state",
  "seller.publicPhone": "publicPhone",
  "seller.public_phone": "publicPhone",
  publicPhone: "publicPhone",
  public_phone: "publicPhone",
  "seller.categories": "categories",
  categories: "categories",
  "seller.hasOwnTransport": "transport",
  "seller.has_own_transport": "transport",
  hasOwnTransport: "transport",
};


export const updateUserProfile: UpdateUserProfile = async (data) => {
  const session = getSession();
  if (!session) return { ok: false, reason: "unauthorized", message: "Entre na sua conta para salvar alterações." };
  if (session.conta.tipo === "ADMIN" || session.token.startsWith("admin-")) {
    await new Promise((r) => setTimeout(r, 80));
    const current = mockRead(session);
    const merged = { ...current };
    const currentCpf = current.account.cpfCnpj ? current.account.cpfCnpj.trim() : "";
    const nextCpf = session.conta.tipo === "PJ" || currentCpf
      ? current.account.cpfCnpj
      : (data.account?.cpfCnpj?.trim() ? data.account.cpfCnpj.trim() : "");
    merged.account = {
      ...current.account,
      ...data.account,
      nome: data.account?.nome ?? current.account.nome ?? session.conta.nome,
      email: current.account.email,
      cpfCnpj: nextCpf,
      avatarUrl: session.avatarUrl ?? current.account.avatarUrl,
    };
    merged.address = { ...current.address, ...data.address };
    merged.seller = current.seller && data.seller ? { ...current.seller, ...data.seller, isHabilitado: true } : current.seller;
    localStorage.setItem(`${MOCK_KEY}:${session.conta.id}`, JSON.stringify(merged));
    if (session.conta.tipo === "PJ") {
      sincronizarDadosEmpresaAdmin({
        id: session.conta.id,
        razaoSocial: merged.account.nome,
        cnpj: merged.account.cpfCnpj,
        telefone: merged.account.telefone,
        endereco: merged.address,
      });
    }
    if (merged.seller?.farmName || data.account?.nome) {
      sincronizarProdutorNosAnuncios(session.conta.id, {
        farmName: merged.seller?.farmName,
        vendedorNome: merged.account.nome,
        avatarUrl: merged.account.avatarUrl,
      });
      if (merged.seller) {
        registrarProdutorParaGovernanca({
          id: session.conta.id,
          nome: merged.account.nome,
          farmName: merged.seller.farmName,
          documento: merged.account.cpfCnpj || "",
          tipoDocumento: session.conta.tipo === "PJ" ? "CNPJ" : "CPF",
          email: merged.account.email,
          cidade: merged.seller.city || merged.address.cidade || "",
          uf: merged.seller.state || merged.address.uf || "",
          estado: "HABILITADO",
        });
      }
    }
    return { ok: true, message: "Alterações salvas com sucesso.", updatedProfile: merged };
  }

  const body: Record<string, unknown> = {};
  if (data.account?.nome?.trim()) {
    body.name = data.account.nome.trim().replace(/\s+/g, " ");
  }
  if (data.account?.telefone?.trim()) {
    const digits = phoneDigits(data.account.telefone);
    if (digits.length >= 10 && digits.length <= 11) {
      body.phone = `+55${digits}`;
    }
  }
  if (session.conta.tipo !== "PJ" && data.account?.cpfCnpj?.trim()) {
    const cleanCpf = data.account.cpfCnpj.replace(/\D/g, "");
    if (cleanCpf.length === 11) {
      body.cpf = cleanCpf;
    }
  }
  if (data.account?.avatarUrl && !data.account.avatarUrl.startsWith("data:") && data.account.avatarUrl.length <= 500) {
    body.avatarUrl = data.account.avatarUrl;
  }

  if (data.address && Object.values(data.address).some((v) => String(v ?? "").trim())) {
    const cleanCep = data.address.cep ? data.address.cep.replace(/\D/g, "") : null;
    const cleanUf = data.address.uf?.trim() ? data.address.uf.trim().toUpperCase() : null;
    body.address = {
      ...(cleanCep && cleanCep.length === 8 ? { cep: cleanCep } : {}),
      ...(data.address.logradouro?.trim() ? { logradouro: data.address.logradouro.trim() } : {}),
      ...(data.address.numero?.trim() ? { numero: data.address.numero.trim() } : {}),
      ...(data.address.complemento !== undefined ? { complemento: data.address.complemento.trim() || null } : {}),
      ...(data.address.bairro?.trim() ? { bairro: data.address.bairro.trim() } : {}),
      ...(data.address.cidade?.trim() ? { cidade: data.address.cidade.trim() } : {}),
      ...(cleanUf && cleanUf.length === 2 ? { uf: cleanUf } : {}),
    };
  }

  if (data.seller) {
    let publicPhone: string | null = null;
    if (data.seller.publicPhone && data.seller.publicPhone.trim()) {
      const digits = phoneDigits(data.seller.publicPhone);
      if (digits.length >= 10 && digits.length <= 11) {
        publicPhone = `+55${digits}`;
      }
    }

    const VALID_SELLER_CATEGORIES = new Set(["cafe", "boi_gordo", "soja", "milho"]);
    const CATEGORY_MAP: Record<string, "cafe" | "boi_gordo" | "soja" | "milho"> = {
      cafe: "cafe",
      "café": "cafe",
      boi_gordo: "boi_gordo",
      "boi gordo": "boi_gordo",
      soja: "soja",
      milho: "milho",
    };

    const cleanCategories = (data.seller.categories ?? [])
      .map((cat) => CATEGORY_MAP[String(cat).toLowerCase().trim()] || cat)
      .filter((cat): cat is "cafe" | "boi_gordo" | "soja" | "milho" => VALID_SELLER_CATEGORIES.has(cat as "cafe" | "boi_gordo" | "soja" | "milho"));

    const farmName = data.seller.farmName?.trim();
    const city = data.seller.city?.trim();
    const state = data.seller.state?.trim().toUpperCase();
    const bio = data.seller.bio !== undefined ? data.seller.bio.trim() : undefined;

    body.seller = {
      ...(farmName && farmName.length >= 2 ? { farmName } : {}),
      ...(bio !== undefined ? { bio: bio || null } : {}),
      ...(city && city.length >= 1 ? { city } : {}),
      ...(state && state.length === 2 ? { state } : {}),
      publicPhone,
      categories: cleanCategories,
      hasOwnTransport: Boolean(data.seller.hasOwnTransport),
    };

    if (data.seller.bannerUrl !== undefined) {
      localStorage.removeItem("safradireta_farm_banner");
      if (data.seller.bannerUrl) {
        localStorage.setItem(`safradireta_farm_banner_${session.conta.id}`, data.seller.bannerUrl);
      } else {
        localStorage.removeItem(`safradireta_farm_banner_${session.conta.id}`);
      }
    }
  }

  if (data.account?.avatarUrl !== undefined) {
    if (data.account.avatarUrl) {
      if (session.conta?.id) {
        localStorage.setItem(`safradireta_avatar_${session.conta.id}`, data.account.avatarUrl);
      }
      updateSession({ avatarUrl: data.account.avatarUrl });
    } else {
      if (session.conta?.id) {
        localStorage.removeItem(`safradireta_avatar_${session.conta.id}`);
      }
      updateSession({ avatarUrl: undefined });
    }
  }

  if (Object.keys(body).length === 0) {
    const avatarChanged = data.account?.avatarUrl !== undefined;
    const bannerChanged = data.seller?.bannerUrl !== undefined;
    if (avatarChanged || bannerChanged) {
      const current = await fetchRealProfile(session);
      if (current.ok) {
        const updated: UserProfileData = {
          ...current.profile,
          account: {
            ...current.profile.account,
            avatarUrl: data.account?.avatarUrl ?? current.profile.account.avatarUrl,
          },
          seller: current.profile.seller
            ? {
                ...current.profile.seller,
                bannerUrl: data.seller?.bannerUrl !== undefined ? (data.seller.bannerUrl || undefined) : current.profile.seller.bannerUrl,
              }
            : undefined,
        };
        try {
          localStorage.setItem(`${MOCK_KEY}:${session.conta.id}`, JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        return { ok: true, message: "Alterações salvas com sucesso.", updatedProfile: updated };
      }
    }
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
      const errors = Object.fromEntries(
        Object.entries(campos).map(([k, v]) => [
          PATCH_FIELD_MAP[k] ?? k.replace(/^(seller|address|account)\./, ""),
          v,
        ])
      );
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
      localStorage.removeItem("safradireta_farm_banner");
      const savedBanner =
        data.seller?.bannerUrl ||
        (session.conta?.id ? localStorage.getItem(`safradireta_farm_banner_${session.conta.id}`) : null) ||
        undefined;
      if (normalized.seller && savedBanner) {
        normalized.seller.bannerUrl = savedBanner;
      }
      if (data.account?.avatarUrl !== undefined) {
        normalized.account.avatarUrl = data.account.avatarUrl || undefined;
      }
      const finalUpdated = await withHabilitacao(normalized, getSession() ?? session);

      try {
        localStorage.setItem(`${MOCK_KEY}:${session.conta.id}`, JSON.stringify(finalUpdated));

        if (session.conta.tipo === "PJ") {
          const primeiroRep = finalUpdated.representantes?.[0];
          sincronizarDadosEmpresaAdmin({
            id: session.conta.id,
            razaoSocial: finalUpdated.account.razaoSocial || finalUpdated.account.nome || session.conta.nome,
            nomeFantasia: finalUpdated.account.nomeFantasia,
            cnpj: finalUpdated.account.cpfCnpj,
            email: finalUpdated.account.email || session.conta.email,
            telefone: finalUpdated.account.telefone,
            endereco: finalUpdated.address,
            representante: primeiroRep
              ? {
                  nome: primeiroRep.nome,
                  cpf: primeiroRep.cpf,
                  vinculo: primeiroRep.vinculo,
                }
              : undefined,
          });
        }

        if (finalUpdated.seller?.isHabilitado) {
          sincronizarProdutorNosAnuncios(session.conta.id, {
            farmName: finalUpdated.seller.farmName,
            vendedorNome: finalUpdated.account.nome,
            avatarUrl: session.avatarUrl,
          });
          registrarProdutorParaGovernanca({
            id: session.conta.id,
            nome: finalUpdated.account.nome,
            farmName: finalUpdated.seller.farmName || `Fazenda ${finalUpdated.account.nome}`,
            documento: finalUpdated.account.cpfCnpj || "",
            tipoDocumento: session.conta.tipo === "PJ" ? "CNPJ" : "CPF",
            email: session.conta.email,
            cidade: finalUpdated.seller.city || finalUpdated.address.cidade || "",
            uf: finalUpdated.seller.state || finalUpdated.address.uf || "",
            estado: "HABILITADO",
          });
        }
      } catch {
        /* ignore */
      }

      return {
        ok: true,
        message: saved.message ?? "Perfil salvo com sucesso.",
        updatedProfile: finalUpdated,
      };
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
