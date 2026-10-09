import { getSession, saveSession } from "../../context/session";
import { MOCK_API, mockDelay } from "../../dev/mockApi";
export interface CorporateRegistrationData {
  company: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia?: string;
    naturezaJuridica?: string;
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
  representative: {
    nome: string;
    cpf: string;
    vinculo: string;
  };
  documents: {
    hasCompanyDoc: boolean;
    hasRepresentativeDoc: boolean;
    representativeFrontFileName: string;
    representativeBackFileName: string;
    fileNames: string[];
  };
  access: {
    email: string;
    telefone: string;
    senha: string;
    acceptedTerms: boolean;
  };
}

export type CorporateRegisterResult =
  | { ok: true; status: "registered_pending_validation"; protocol: string; message: string }
  | {
      ok: false;
      reason: "unavailable" | "validation_error" | "duplicate";
      message: string;
      fieldErrors?: Record<string, string>;
    };

export type RegisterCorporateAccount = (data: CorporateRegistrationData) => Promise<CorporateRegisterResult>;

export const registerCorporateAccount: RegisterCorporateAccount = async (data: CorporateRegistrationData): Promise<CorporateRegisterResult> => {
  const currentSession = getSession();
  if (currentSession) {
    return {
      ok: false,
      reason: "unavailable",
      message: currentSession.conta.tipo === "PF"
        ? "Você já está conectado em uma conta de Pessoa Física. Saia da sua conta antes de cadastrar uma empresa."
        : "Você já possui uma sessão ativa. Saia da sua conta antes de iniciar um novo cadastro corporativo.",
    };
  }

  if (MOCK_API) {
    await mockDelay();
    const contaId = `mock-${data.access.email}`;
    saveSession("mock-token", { id: contaId, tipo: "PJ", nome: data.company.razaoSocial, email: data.access.email }, null);
    try {
      const key = `safradireta_mock_profile:${contaId}`;
      const stored = {
        account: {
          id: contaId,
          tipo: "PJ",
          nome: data.company.razaoSocial,
          email: data.access.email,
          cpfCnpj: data.company.cnpj,
          telefone: data.access.telefone,
        },
        address: {
          cep: data.address.cep,
          logradouro: data.address.logradouro,
          numero: data.address.numero,
          complemento: data.address.complemento ?? "",
          bairro: data.address.bairro,
          cidade: data.address.cidade,
          uf: data.address.uf,
        },
      };
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      /* no-op */
    }
    return {
      ok: true,
      status: "registered_pending_validation",
      protocol: `SIM-${Date.now().toString(36).toUpperCase()}`,
      message: "Simulação local: nenhuma conta foi realmente criada.",
    };
  }

  try {
    const response = await fetch("/api/auth/register-corporate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (response.status === 201) {
      const res = await response.json();
      if (res.token) {
        saveSession(res.token, res.conta, res.vendedor?.estado ?? null);
      }
      return {
        ok: true,
        status: "registered_pending_validation",
        protocol: res.protocol,
        message: res.message,
      };
    }

    if (response.status === 409 || response.status === 422) {
      const res = await response.json();
      return {
        ok: false,
        reason: response.status === 409 ? "duplicate" : "validation_error",
        message: res.erro?.mensagem ?? "Verifique os dados informados.",
        fieldErrors: res.erro?.campos ?? {},
      };
    }

    return {
      ok: false,
      reason: "unavailable",
      message: "Serviço temporariamente indisponível. Tente novamente mais tarde.",
    };
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      message: "Não foi possível conectar ao servidor. Verifique sua conexão.",
    };
  }
};

export type StepId = "company" | "address" | "representative" | "documents" | "access";
export type FieldErrors = Record<string, string>;

export interface CorporateFormValues {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  naturezaJuridica: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  repNome: string;
  repCpf: string;
  repVinculo: string;
  email: string;
  telefone: string;
  senha: string;
  confirmarSenha: string;
  acceptedTerms: boolean;
}

export const initialCorporateValues: CorporateFormValues = {
  cnpj: "", razaoSocial: "", nomeFantasia: "", naturezaJuridica: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  repNome: "", repCpf: "", repVinculo: "",
  email: "", telefone: "", senha: "", confirmarSenha: "", acceptedTerms: false,
};

export const steps: { id: StepId; label: string }[] = [
  { id: "company", label: "Empresa" },
  { id: "address", label: "Endereço" },
  { id: "representative", label: "Representante" },
  { id: "documents", label: "Documentos" },
  { id: "access", label: "Acesso" },
];

export const naturezasJuridicas = ["LTDA", "SLU", "S/A", "MEI", "Cooperativa"] as const;
export const vinculos = ["Sócio-administrador", "Diretor", "Procurador com poderes"] as const;
export const ufs = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE",
  "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const ACCEPTED_FILE_TYPES = [".pdf", ".jpg", ".jpeg", ".png"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// ---------- Máscaras ----------

export function formatCnpj(value: string): string {
  const raw = value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 14);
  // Os dois últimos caracteres (dígitos verificadores) são sempre numéricos.
  const clean = raw.slice(0, 12) + raw.slice(12).replace(/\D/g, "");
  const parts = [clean.slice(0, 2), clean.slice(2, 5), clean.slice(5, 8), clean.slice(8, 12), clean.slice(12, 14)];
  let out = parts[0];
  if (parts[1]) out += `.${parts[1]}`;
  if (parts[2]) out += `.${parts[2]}`;
  if (parts[3]) out += `/${parts[3]}`;
  if (parts[4]) out += `-${parts[4]}`;
  return out;
}

export function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  let out = d.slice(0, 3);
  if (d.length > 3) out += `.${d.slice(3, 6)}`;
  if (d.length > 6) out += `.${d.slice(6, 9)}`;
  if (d.length > 9) out += `-${d.slice(9, 11)}`;
  return out;
}

export function formatCep(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 3) return digits;
  const area = digits.slice(0, 2);
  const number = digits.slice(2);
  const split = number.length > 8 ? 5 : 4;
  return `(${area}) ${number.slice(0, split)}${number.length > split ? `-${number.slice(split)}` : ""}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------- Validadores ----------

export function normalizeCnpj(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function cnpjCheckDigit(base: string): number {
  // Algoritmo oficial: valor = código ASCII - 48 (compatível com o CNPJ numérico).
  const weights = base.length === 12
    ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = [...base].reduce((acc, ch, i) => acc + (ch.charCodeAt(0) - 48) * weights[i], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  const d1 = cnpjCheckDigit(cnpj.slice(0, 12));
  const d2 = cnpjCheckDigit(cnpj.slice(0, 12) + d1);
  return cnpj.slice(12) === `${d1}${d2}`;
}

export function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    const sum = [...cpf.slice(0, len)].reduce((acc, ch, i) => acc + Number(ch) * (len + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStep(step: StepId, v: CorporateFormValues, fileCount?: { company: number; repFront: number; repBack: number }): FieldErrors {
  const e: FieldErrors = {};
  if (step === "company") {
    if (!isValidCnpj(v.cnpj)) e.cnpj = "Informe um CNPJ válido, com 14 caracteres.";
    if (v.razaoSocial.trim().length < 2) e.razaoSocial = "Informe a razão social da empresa.";
  }
  if (step === "address") {
    if (v.cep.replace(/\D/g, "").length !== 8) e.cep = "Informe um CEP com 8 números.";
    if (!v.logradouro.trim()) e.logradouro = "Informe o logradouro.";
    if (!v.numero.trim()) e.numero = "Informe o número (ou S/N).";
    if (!v.bairro.trim()) e.bairro = "Informe o bairro.";
    if (!v.cidade.trim()) e.cidade = "Informe a cidade.";
    if (!(ufs as readonly string[]).includes(v.uf)) e.uf = "Selecione o estado.";
  }
  if (step === "representative") {
    if (v.repNome.trim().split(/\s+/).filter(Boolean).length < 2) e.repNome = "Informe nome e sobrenome do representante.";
    if (!isValidCpf(v.repCpf)) e.repCpf = "Informe um CPF válido.";
    if (!(vinculos as readonly string[]).includes(v.repVinculo)) e.repVinculo = "Selecione o vínculo com a empresa.";
  }
  if (step === "documents") {
    if (!fileCount?.company) e.companyDoc = "Anexe o documento de constituição da empresa.";
    if (!fileCount?.repFront) e.repFrontDoc = "Anexe a foto da frente do documento do representante.";
    if (!fileCount?.repBack) e.repBackDoc = "Anexe a foto do verso do documento do representante.";
  }
  if (step === "access") {
    if (!EMAIL_PATTERN.test(v.email.trim())) e.email = "Informe um e-mail válido, como contato@empresa.com.br.";
    if (!/^[1-9][0-9][0-9]{8,9}$/.test(v.telefone.replace(/\D/g, ""))) {
      e.telefone = "Informe um telefone brasileiro com DDD (10 ou 11 números).";
    }
    if (v.senha.length < 8) e.senha = "Use pelo menos 8 caracteres.";
    if (v.confirmarSenha !== v.senha) e.confirmarSenha = "As senhas não coincidem.";
    if (!v.acceptedTerms) e.acceptedTerms = "Marque a opção de aceite para continuar.";
  }
  return e;
}

export function validateFile(file: { name: string; size: number }): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ACCEPTED_FILE_TYPES.includes(ext)) return `"${file.name}": use arquivos PDF, JPG ou PNG.`;
  if (file.size > MAX_FILE_BYTES) return `"${file.name}": o arquivo excede 10 MB.`;
  return null;
}

export function toCorporateRegistrationData(
  v: CorporateFormValues,
  files: { company: string[]; repFront: string; repBack: string },
): CorporateRegistrationData {
  const optional = (s: string) => s.trim() || undefined;
  return {
    company: {
      cnpj: normalizeCnpj(v.cnpj),
      razaoSocial: v.razaoSocial.trim().replace(/\s+/g, " "),
      nomeFantasia: optional(v.nomeFantasia),
      naturezaJuridica: optional(v.naturezaJuridica),
    },
    address: {
      cep: v.cep.replace(/\D/g, ""),
      logradouro: v.logradouro.trim(),
      numero: v.numero.trim(),
      complemento: optional(v.complemento),
      bairro: v.bairro.trim(),
      cidade: v.cidade.trim(),
      uf: v.uf,
    },
    representative: {
      nome: v.repNome.trim().replace(/\s+/g, " "),
      cpf: v.repCpf.replace(/\D/g, ""),
      vinculo: v.repVinculo,
    },
    documents: {
      hasCompanyDoc: files.company.length > 0,
      hasRepresentativeDoc: Boolean(files.repFront && files.repBack),
      representativeFrontFileName: files.repFront,
      representativeBackFileName: files.repBack,
      fileNames: [...files.company, files.repFront, files.repBack].filter(Boolean),
    },
    access: {
      email: v.email.trim().toLowerCase(),
      telefone: `+55${v.telefone.replace(/\D/g, "")}`,
      senha: v.senha,
      acceptedTerms: v.acceptedTerms,
    },
  };
}
