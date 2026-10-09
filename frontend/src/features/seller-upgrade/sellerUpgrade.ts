import { getSession, updateSession } from "../../context/session";
import { MOCK_API } from "../../dev/mockApi";
import { isValidCpf, ufs } from "../corporate-registration/corporateRegistration";

export { formatCpf, formatFileSize, validateFile, ufs, ACCEPTED_FILE_TYPES } from "../corporate-registration/corporateRegistration";

export type SellerCategory = "cafe" | "boi_gordo" | "soja" | "milho";

export const sellerCategories: { value: SellerCategory; label: string }[] = [
  { value: "cafe", label: "Café" },
  { value: "boi_gordo", label: "Boi gordo" },
  { value: "soja", label: "Soja" },
  { value: "milho", label: "Milho" },
];

export interface SellerUpgradeData {
  cpf: string;
  farmName: string;
  city: string;
  state: string;
  categories: SellerCategory[];
  hasOwnTransport: boolean;
  documents: {
    hasCpfDocument: boolean;
    cpfFrontFileName: string;
    cpfBackFileName: string;
    hasCarDocument?: boolean;
    carFileName?: string;
  };
}

export type SellerUpgradeResult =
  | { ok: true; status: "habilitado"; message: string }
  | { ok: false; reason: "validation_error" | "unavailable"; message: string; fieldErrors?: Record<string, string> };

export type UpgradeToSeller = (data: SellerUpgradeData) => Promise<SellerUpgradeResult>;

// Simulação da Sprint 1 (definida no planejamento): habilitação imediata para PF.
// Nenhum dado é enviado ou persistido; será substituído pela integração com o backend.
export const defaultUpgradeToSeller: UpgradeToSeller = async (data: SellerUpgradeData) => {
  // Em simulação local, a sessão passa a refletir o vendedor habilitado e salva os dados no mock.
  if (MOCK_API) {
    updateSession({ vendedorEstado: "HABILITADO" });
    const session = getSession();
    if (session) {
      try {
        const key = `safradireta_mock_profile:${session.conta.id}`;
        const raw = localStorage.getItem(key);
        const stored = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        const account = (stored.account && typeof stored.account === "object" ? stored.account : {}) as Record<string, unknown>;
        const existingCpf = typeof account.cpfCnpj === "string" ? account.cpfCnpj.trim() : "";
        stored.account = { ...account, cpfCnpj: existingCpf || data.cpf };
        stored.seller = {
          isHabilitado: true,
          farmName: data.farmName,
          bio: (stored.seller as Record<string, unknown> | undefined)?.bio ?? "",
          city: data.city,
          state: data.state,
          publicPhone: (stored.seller as Record<string, unknown> | undefined)?.publicPhone ?? session.conta.telefone ?? "",
          categories: data.categories,
          hasOwnTransport: data.hasOwnTransport,
        };
        localStorage.setItem(key, JSON.stringify(stored));
      } catch {
        /* no-op */
      }
    }
  }
  return {
    ok: true,
    status: "habilitado",
    message: "Perfil de vendedor habilitado com sucesso!",
  };
};

export type TransportOption = "own" | "buyer" | "";

export interface SellerUpgradeValues {
  cpf: string;
  farmName: string;
  city: string;
  state: string;
  categories: SellerCategory[];
  transport: TransportOption;
}

export const initialSellerValues: SellerUpgradeValues = {
  cpf: "", farmName: "", city: "", state: "", categories: [], transport: "",
};

export function validateSellerUpgrade(v: SellerUpgradeValues, docs: { front: boolean; back: boolean }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isValidCpf(v.cpf)) e.cpf = "Informe um CPF válido.";
  if (v.farmName.trim().length < 2) e.farmName = "Informe o nome da propriedade ou fazenda.";
  if (!v.city.trim()) e.city = "Informe a cidade.";
  if (!(ufs as readonly string[]).includes(v.state)) e.state = "Selecione o estado.";
  if (v.categories.length === 0) e.categories = "Selecione ao menos uma categoria.";
  if (!v.transport) e.transport = "Informe como é feito o transporte.";
  if (!docs.front) e.cpfFrontDoc = "Anexe a foto da frente do documento.";
  if (!docs.back) e.cpfBackDoc = "Anexe a foto do verso do documento.";
  return e;
}

export function toSellerUpgradeData(
  v: SellerUpgradeValues,
  cpfFrontFileName: string | undefined,
  cpfBackFileName: string | undefined,
  carFileName: string | undefined,
): SellerUpgradeData {
  return {
    cpf: v.cpf.replace(/\D/g, ""),
    farmName: v.farmName.trim().replace(/\s+/g, " "),
    city: v.city.trim(),
    state: v.state,
    categories: v.categories,
    hasOwnTransport: v.transport === "own",
    documents: {
      hasCpfDocument: Boolean(cpfFrontFileName && cpfBackFileName),
      cpfFrontFileName: cpfFrontFileName ?? "",
      cpfBackFileName: cpfBackFileName ?? "",
      hasCarDocument: Boolean(carFileName),
      carFileName,
    },
  };
}
