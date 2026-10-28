import { getSession, saveSession, updateSession } from "../../context/session";
import type { MarketplaceAd } from "../ads/ads.types";
import { obterTodosAnunciosRaw, salvarTodosAnunciosRaw } from "../ads/adsStorage";
import { obterMidiasDoIndexedDB } from "../ads/adsMediaStorage";
import { homologarTrocaRepresentanteDocsNoIndexedDB } from "../corporate-registration/corporateDocsStorage";
import {
  loginAdminApi,
  listarEmpresasPendentesApi,
  suspenderContaApi,
} from "./adminApi";

// ---------------------------------------------------------------------------
// Credenciais Oficiais de Demonstração do Backoffice
// ---------------------------------------------------------------------------
export const ADMIN_DEMO_EMAIL = "admin@safradireta.com.br";
export const ADMIN_DEMO_PASS = "admin123";
export const ADMIN_DEMO_PIN = "984021";

// ---------------------------------------------------------------------------
// Tipagens de Governança — Aba 1: Empresas PJ
// ---------------------------------------------------------------------------
export type CorporateVerificationState = "EM_ANALISE" | "APROVADA" | "REJEITADA";
export type DocConformityStatus = "VALIDADO" | "EM_REANALISE" | "RECUSADO";

export interface CorporateDocMetadata {
  nome: string;
  status: DocConformityStatus;
  motivoRecusa?: string;
  atualizadoEm: string;
  tamanhoFormatado?: string;
  isNovaVersao?: boolean;
}

export type RepresentativeChangeStatus = "PENDENTE" | "HOMOLOGADA" | "INDEFERIDA";

export interface RepresentativeChangeRequest {
  id: string;
  solicitadoEm: string;
  status: RepresentativeChangeStatus;
  representanteAtual: {
    nome: string;
    cpf: string;
    vinculo: string;
  };
  novoRepresentante: {
    nome: string;
    cpf: string;
    vinculo: string;
  };
  documentos: {
    docFrenteNome: string;
    docVersoNome: string;
    comprovacaoPoderesNome: string;
    tipoComprovacao: "ATA_ELEICAO" | "ALTERACAO_CONTRATUAL" | "PROCURACAO_PUBLICA";
  };
  termoAceito: boolean;
  analisadoEm?: string;
  motivoIndeferimento?: string;
  parecerAdmin?: string;
}

export interface CorporateVerificationRecord {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  naturezaJuridica?: string;
  cnpj: string;
  email: string;
  telefone: string;
  representante: {
    nome: string;
    cpf: string;
    vinculo: string;
  };
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  documentos: {
    contratoSocialNome: string;
    cartaoCnpjNome: string;
    docRepresentanteFrente: string;
    docRepresentanteVerso: string;
  };
  documentosStatus?: {
    contratoSocial?: CorporateDocMetadata;
    cartaoCnpj?: CorporateDocMetadata;
    docRepresentanteFrente?: CorporateDocMetadata;
    docRepresentanteVerso?: CorporateDocMetadata;
  };
  solicitacaoTrocaRepresentante?: RepresentativeChangeRequest;
  historicoTrocasRepresentante?: RepresentativeChangeRequest[];
  estado: CorporateVerificationState;
  motivoRejeicao?: string;
  submetidoEm: string;
  analisadoEm?: string;
}

// ---------------------------------------------------------------------------
// Tipagens de Governança — Aba 3: Produtores e Vendedores
// ---------------------------------------------------------------------------
export type ProducerAccountState = "HABILITADO" | "SUSPENSO" | "BANIDO";
export type SuspensionDurationDays = 7 | 15 | 30 | "INDETERMINADO";

export interface ProducerAppeal {
  textoDefesa: string;
  documentoAnexoNome?: string;
  enviadoEm: string;
  status: "PENDENTE" | "ACEITA" | "NEGADA";
  respostaAdmin?: string;
  analisadoEm?: string;
}

export interface PunishmentHistoryEntry {
  id: string;
  tipo:
    | "SUSPENSAO"
    | "BANIMENTO"
    | "REATIVACAO"
    | "CONTESTACAO_ACEITA"
    | "CONTESTACAO_NEGADA";
  motivo: string;
  prazoDias?: SuspensionDurationDays;
  suspensoAte?: string | null;
  data: string;
  autor: string;
}

export interface ProducerDocMetadata {
  nome: string;
  status: "EM_REANALISE" | "VALIDADO" | "RECUSADO";
  motivoRecusa?: string;
  atualizadoEm: string;
  tamanhoFormatado?: string;
  isNovaVersao?: boolean;
}

export interface ProducerGovernanceRecord {
  id: string;
  nome: string;
  farmName: string;
  documento: string;
  tipoDocumento: "CPF" | "CNPJ";
  email: string;
  cidade: string;
  uf: string;
  dataEntrada: string;
  estado: ProducerAccountState;
  // Auditoria Interna do Admin
  revisadoPeloAdmin?: boolean;
  auditadoEm?: string;
  auditadoPor?: string;
  observacoesAuditoria?: string;

  // Documentos Oficiais de Identificação (PF)
  documentosStatus?: {
    rgFrente?: ProducerDocMetadata;
    rgVerso?: ProducerDocMetadata;
    car?: ProducerDocMetadata;
  };

  motivoPunicao?: string;
  prazoSuspensao?: SuspensionDurationDays;
  suspensoEm?: string;
  suspensoAte?: string | null;
  contestacaoPendente?: boolean;
  contestacao?: ProducerAppeal;
  historicoPunicoes: PunishmentHistoryEntry[];
}

const ADMIN_PJ_STORAGE_KEY = "safradireta_admin_pj_records_v1";
const ADMIN_PRODUCERS_STORAGE_KEY = "safradireta_admin_producers_v1";

// ---------------------------------------------------------------------------
// Identificadores de Purga de Contas Fictícias
// ---------------------------------------------------------------------------
const FAKE_PJ_IDS = new Set(["pj-corp-001", "pj-corp-002", "pj-corp-003"]);
const FAKE_PRODUCER_IDS = new Set([
  "produtor-demo-001",
  "produtor-graos-001",
  "produtor-graos-002",
  "produtor-susp-002",
  "produtor-ban-003",
]);

function formatDigitsCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatDigitsCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

interface StoredMockProfile {
  account?: {
    id?: string;
    tipo?: string;
    nome?: string;
    email?: string;
    cpfCnpj?: string;
    telefone?: string;
    avatarUrl?: string;
  };
  address?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
  seller?: {
    isHabilitado?: boolean;
    farmName?: string;
    bio?: string;
    city?: string;
    state?: string;
    publicPhone?: string;
    categories?: string[];
    hasOwnTransport?: boolean;
  };
  representative?: {
    nome?: string;
    cpf?: string;
    vinculo?: string;
  };
  documents?: {
    fileNames?: string[];
    representativeFrontFileName?: string;
    representativeBackFileName?: string;
  };
  createdAt?: string;
}

function carregarTodosPerfisLocais(): Map<string, StoredMockProfile> {
  const map = new Map<string, StoredMockProfile>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("safradireta_mock_profile:")) {
        const id = key.substring("safradireta_mock_profile:".length);
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            map.set(id, JSON.parse(raw) as StoredMockProfile);
          } catch {
            /* ignore JSON parse error */
          }
        }
      }
    }
  } catch {
    /* ignore storage access error */
  }
  return map;
}

// ---------------------------------------------------------------------------
// Contas Reais Registradas no Ambiente do SafraDireta (PostgreSQL / Sessão)
// ---------------------------------------------------------------------------
interface KnownAccountInfo {
  id: string;
  nome: string;
  email: string;
  tipo: "PF" | "PJ";
  cpfCnpj: string;
  farmName?: string;
  cidade?: string;
  uf?: string;
  estadoVendedor?: ProducerAccountState;
  pjData?: {
    razaoSocial: string;
    nomeFantasia?: string;
    cnpj: string;
    naturezaJuridica?: string;
    telefone?: string;
    representante: {
      nome: string;
      cpf: string;
      vinculo: string;
    };
    endereco: {
      cep: string;
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cidade: string;
      uf: string;
    };
    documentos: {
      contratoSocialNome: string;
      cartaoCnpjNome: string;
      docRepresentanteFrente: string;
      docRepresentanteVerso: string;
    };
  };
}

// Contas pessoais estritamente compradoras (mesmo que a pessoa física seja representante legal de uma PJ)
export const BUYER_ONLY_ACCOUNT_IDS = new Set<string>([
  "a7f57e8e-d032-4107-963c-2de3a078fe13", // Pedro Henrique Coan Zin (Comprador PF)
]);

const KNOWN_REAL_ACCOUNTS: KnownAccountInfo[] = [
  {
    id: "26aa7800-eb21-4d65-838e-91830e3cda5f",
    nome: "Fernando Kintschner",
    email: "fernando@gmail.com",
    tipo: "PF",
    cpfCnpj: "12345678909",
    farmName: "PUC Campinas",
    cidade: "Campinas",
    uf: "SP",
    estadoVendedor: "HABILITADO",
  },
  {
    id: "66d23d46-5e71-47d1-8b56-be1654bc0cc0",
    nome: "Maria Luisa Coan Zin",
    email: "maria.l.c.zin@gmail.com",
    tipo: "PF",
    cpfCnpj: "15875033959",
    farmName: "Fazendinha Hay Day da Maria",
    cidade: "Baneario Camboriu",
    uf: "SC",
    estadoVendedor: "HABILITADO",
  },
  {
    id: "a7f57e8e-d032-4107-963c-2de3a078fe13",
    nome: "Pedro Henrique Coan Zin",
    email: "pedro.h.c.zin@gmail.com",
    tipo: "PF",
    cpfCnpj: "15875046937",
    cidade: "Indaiatuba",
    uf: "SP",
  },
  {
    id: "19bcad31-bb73-4d69-82ef-7c70a71d87a8",
    nome: "PUCCamp",
    email: "pucc@gmail.com",
    tipo: "PJ",
    cpfCnpj: "74608768000189",
    pjData: {
      razaoSocial: "PUCCamp",
      nomeFantasia: "PUCC",
      cnpj: "74.608.768/0001-89",
      naturezaJuridica: "Cooperativa",
      telefone: "(47) 99192-2783",
      representante: {
        nome: "Pedro Henrique Coan Zin",
        cpf: "158.750.469-37",
        vinculo: "Procurador com poderes",
      },
      endereco: {
        cep: "13331-372",
        logradouro: "Rua Louvre",
        numero: "25",
        complemento: "Universidade",
        bairro: "Maison Du Park",
        cidade: "Indaiatuba",
        uf: "SP",
      },
      documentos: {
        contratoSocialNome: "SafraDireta-Contas-e-Banco-MVP.pdf",
        cartaoCnpjNome: "SafraDireta_Especificacoes_Internas_Equipe_Atualizado.pdf",
        docRepresentanteFrente: "SafraDireta-Modelagem-Sprint-01.pdf",
        docRepresentanteVerso: "Doc_Representante_Verso.jpg",
      },
    },
  },
];

function resolverDadosConta(id: string, email?: string, nome?: string): KnownAccountInfo | undefined {
  const cleanEmail = email?.trim().toLowerCase();
  const cleanNome = nome?.trim().toLowerCase();

  return KNOWN_REAL_ACCOUNTS.find((acc) => {
    if (acc.id === id) return true;
    if (cleanEmail && acc.email.toLowerCase() === cleanEmail) return true;
    if (cleanNome && acc.nome.toLowerCase() === cleanNome) return true;
    if (cleanNome && (acc.nome.toLowerCase().includes(cleanNome) || cleanNome.includes(acc.nome.toLowerCase()))) return true;
    return false;
  });
}

function formatCepDisplay(raw?: string): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return raw;
}

function formatPhoneDisplay(raw?: string): string {
  if (!raw) return "—";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Autenticação Administrativa
// ---------------------------------------------------------------------------
export async function autenticarAdmin(
  email: string,
  senha: string,
  pin: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPin = pin.trim();

  // 1. Tenta autenticação real no backend via API
  const apiRes = await loginAdminApi({
    email: cleanEmail,
    senha,
    pin: cleanPin,
  });

  if (apiRes.ok) {
    saveSession(
      apiRes.data.token,
      {
        id: apiRes.data.conta_id,
        tipo: "ADMIN",
        nome: apiRes.data.nome,
        email: apiRes.data.email,
      },
      null
    );
    return { ok: true };
  }

  // 2. Fallback de desenvolvimento caso o backend ainda não tenha rodado as migrations
  const isDemo =
    (cleanEmail === ADMIN_DEMO_EMAIL || cleanEmail === "admin@safradireta.com") &&
    senha === ADMIN_DEMO_PASS &&
    (cleanPin === ADMIN_DEMO_PIN || cleanPin === "123456");

  if (isDemo) {
    saveSession(
      "admin-token-backoffice-v1",
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        tipo: "ADMIN",
        nome: "Admin Safra Direta",
        email: cleanEmail,
      },
      null
    );
    return { ok: true };
  }

  return {
    ok: false,
    erro: apiRes.erro || "Credenciais administrativas ou PIN de segurança operacional inválidos.",
  };
}

// ---------------------------------------------------------------------------
// Gestão de Contas Corporativas (Aba 1)
// ---------------------------------------------------------------------------
export function listarEmpresasAdmin(): CorporateVerificationRecord[] {
  let base: CorporateVerificationRecord[] = [];
  try {
    const raw = localStorage.getItem(ADMIN_PJ_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CorporateVerificationRecord[];
      if (Array.isArray(parsed)) {
        base = parsed.filter((item) => !FAKE_PJ_IDS.has(item.id));
      }
    }
  } catch {
    base = [];
  }

  let modificado = false;

  // 1. Sincroniza contas PJ reais do projeto conhecidas no ambiente e corrige dados estáticos desatualizados
  for (const acc of KNOWN_REAL_ACCOUNTS) {
    if (acc.tipo === "PJ" && acc.pjData) {
      const pj = acc.pjData;
      const cnpjFormatado = formatDigitsCnpj(pj.cnpj);
      const idx = base.findIndex((item) => item.id === acc.id || item.cnpj === cnpjFormatado);
      if (idx === -1) {
        modificado = true;
        base.unshift({
          id: acc.id,
          razaoSocial: pj.razaoSocial,
          nomeFantasia: pj.nomeFantasia,
          naturezaJuridica: pj.naturezaJuridica,
          cnpj: cnpjFormatado,
          email: acc.email,
          telefone: pj.telefone || "(47) 99192-2783",
          representante: {
            nome: pj.representante.nome,
            cpf: formatDigitsCpf(pj.representante.cpf),
            vinculo: pj.representante.vinculo,
          },
          endereco: pj.endereco,
          documentos: pj.documentos,
          estado: "EM_ANALISE",
          submetidoEm: new Date().toISOString(),
        });
      } else {
        const atual = base[idx];
        const endAntigoInvalido =
          atual.endereco?.cep === "13086-900" ||
          atual.endereco?.logradouro?.includes("Euryclides de Jesus Zerbini") ||
          !atual.endereco?.logradouro ||
          atual.endereco.logradouro === "—";
        const natAntigaInvalida =
          atual.naturezaJuridica === "Sociedade Anônima Fechada" && pj.naturezaJuridica === "Cooperativa";
        const telAntigoInvalido =
          (atual.telefone === "(19) 99999-9999" || !atual.telefone || atual.telefone === "—") && Boolean(pj.telefone);

        if (endAntigoInvalido || natAntigaInvalida || telAntigoInvalido) {
          modificado = true;
          base[idx] = {
            ...atual,
            naturezaJuridica: natAntigaInvalida ? pj.naturezaJuridica : atual.naturezaJuridica,
            telefone: telAntigoInvalido && pj.telefone ? pj.telefone : atual.telefone,
            endereco: endAntigoInvalido ? { ...pj.endereco } : atual.endereco,
          };
        }
      }
    }
  }

  // 2. Sincroniza qualquer conta corporativa (PJ) cadastrada ou editada localmente
  const perfis = carregarTodosPerfisLocais();
  for (const [userId, profile] of perfis.entries()) {
    if (profile.account?.tipo === "PJ") {
      const cnpj = profile.account.cpfCnpj ? formatDigitsCnpj(profile.account.cpfCnpj) : "";
      const idx = base.findIndex((item) => item.id === userId || (cnpj && item.cnpj === cnpj));
      if (idx === -1) {
        modificado = true;
        base.unshift({
          id: userId,
          razaoSocial: profile.account.nome || "Empresa PJ",
          nomeFantasia: profile.account.nome,
          cnpj: cnpj || "Não informado",
          email: profile.account.email || (userId.startsWith("mock-") ? userId.replace(/^mock-/, "") : "—"),
          telefone: formatPhoneDisplay(profile.account.telefone),
          representante: {
            nome: profile.representative?.nome || profile.account.nome || "Representante Legal",
            cpf: profile.representative?.cpf ? formatDigitsCpf(profile.representative.cpf) : "—",
            vinculo: profile.representative?.vinculo || "Sócio-administrador",
          },
          endereco: {
            cep: formatCepDisplay(profile.address?.cep),
            logradouro: profile.address?.logradouro || "—",
            numero: profile.address?.numero || "S/N",
            complemento: profile.address?.complemento,
            bairro: profile.address?.bairro || "—",
            cidade: profile.address?.cidade || "—",
            uf: profile.address?.uf || "—",
          },
          documentos: {
            contratoSocialNome: profile.documents?.fileNames?.[0] || "Contrato_Social.pdf",
            cartaoCnpjNome: profile.documents?.fileNames?.[1] || "Cartao_CNPJ.pdf",
            docRepresentanteFrente: profile.documents?.representativeFrontFileName || "Doc_Representante_Frente.jpg",
            docRepresentanteVerso: profile.documents?.representativeBackFileName || "Doc_Representante_Verso.jpg",
          },
          estado: "EM_ANALISE",
          submetidoEm: profile.createdAt || new Date().toISOString(),
        });
      } else {
        const atual = base[idx];
        const novoNome = profile.account.nome?.trim();
        const novoTel = profile.account.telefone ? formatPhoneDisplay(profile.account.telefone) : undefined;
        const temEnderecoPerfil = Boolean(
          profile.address?.logradouro?.trim() && profile.address?.cidade?.trim()
        );
        const novoEndereco = temEnderecoPerfil
          ? {
              cep: formatCepDisplay(profile.address?.cep),
              logradouro: profile.address!.logradouro!.trim(),
              numero: profile.address?.numero?.trim() || "S/N",
              complemento: profile.address?.complemento?.trim() || undefined,
              bairro: profile.address?.bairro?.trim() || "—",
              cidade: profile.address!.cidade!.trim(),
              uf: profile.address?.uf?.trim() || "SP",
            }
          : atual.endereco;

        const mudouNome = Boolean(novoNome && novoNome !== atual.razaoSocial);
        const mudouTel = Boolean(novoTel && novoTel !== "—" && novoTel !== atual.telefone);
        const mudouEnd =
          temEnderecoPerfil &&
          (novoEndereco.cep !== atual.endereco.cep ||
            novoEndereco.logradouro !== atual.endereco.logradouro ||
            novoEndereco.numero !== atual.endereco.numero ||
            (novoEndereco.complemento || "") !== (atual.endereco.complemento || "") ||
            novoEndereco.bairro !== atual.endereco.bairro ||
            novoEndereco.cidade !== atual.endereco.cidade ||
            novoEndereco.uf !== atual.endereco.uf);

        if (mudouNome || mudouTel || mudouEnd) {
          modificado = true;
          base[idx] = {
            ...atual,
            razaoSocial: novoNome || atual.razaoSocial,
            telefone: novoTel && novoTel !== "—" ? novoTel : atual.telefone,
            endereco: novoEndereco,
          };
        }
      }
    }
  }

  if (modificado) {
    salvarEmpresasAdmin(base);
  }

  return base;
}

export function sincronizarDadosEmpresaAdmin(dados: {
  id: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  representante?: {
    nome: string;
    cpf: string;
    vinculo: string;
  };
  endereco?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
}): void {
  const lista = listarEmpresasAdmin();
  const cnpjClean = dados.cnpj ? dados.cnpj.replace(/\D/g, "") : "";
  const idx = lista.findIndex(
    (emp) =>
      emp.id === dados.id ||
      (cnpjClean && emp.cnpj.replace(/\D/g, "") === cnpjClean) ||
      (dados.email && emp.email.toLowerCase() === dados.email.toLowerCase())
  );

  const temEndereco = Boolean(dados.endereco?.logradouro?.trim() && dados.endereco?.cidade?.trim());

  if (idx === -1) {
    const cnpjFormatado = dados.cnpj ? formatDigitsCnpj(dados.cnpj) : "—";
    const novo: CorporateVerificationRecord = {
      id: dados.id,
      razaoSocial: dados.razaoSocial?.trim() || "Empresa PJ",
      nomeFantasia: dados.nomeFantasia?.trim() || undefined,
      cnpj: cnpjFormatado,
      email: dados.email || "—",
      telefone: dados.telefone ? formatPhoneDisplay(dados.telefone) : "—",
      representante: dados.representante
        ? {
            nome: dados.representante.nome.trim(),
            cpf: formatDigitsCpf(dados.representante.cpf),
            vinculo: dados.representante.vinculo.trim(),
          }
        : {
            nome: "Representante Legal",
            cpf: "—",
            vinculo: "Sócio-administrador",
          },
      endereco: {
        cep: formatCepDisplay(dados.endereco?.cep),
        logradouro: dados.endereco?.logradouro?.trim() || "—",
        numero: dados.endereco?.numero?.trim() || "S/N",
        complemento: dados.endereco?.complemento?.trim() || undefined,
        bairro: dados.endereco?.bairro?.trim() || "—",
        cidade: dados.endereco?.cidade?.trim() || "—",
        uf: dados.endereco?.uf?.trim() || "SP",
      },
      documentos: {
        contratoSocialNome: "Contrato_Social.pdf",
        cartaoCnpjNome: "Cartao_CNPJ.pdf",
        docRepresentanteFrente: "Doc_Representante_Frente.jpg",
        docRepresentanteVerso: "Doc_Representante_Verso.jpg",
      },
      estado: "APROVADA",
      submetidoEm: new Date().toISOString(),
    };
    lista.unshift(novo);
    salvarEmpresasAdmin(lista);
    return;
  }

  const atual = lista[idx];
  const atualizado: CorporateVerificationRecord = {
    ...atual,
    razaoSocial: dados.razaoSocial?.trim() || atual.razaoSocial,
    nomeFantasia: dados.nomeFantasia?.trim() || atual.nomeFantasia,
    email: dados.email || atual.email,
    telefone: dados.telefone ? formatPhoneDisplay(dados.telefone) : atual.telefone,
    representante: dados.representante
      ? {
          nome: dados.representante.nome.trim() || atual.representante.nome,
          cpf: dados.representante.cpf ? formatDigitsCpf(dados.representante.cpf) : atual.representante.cpf,
          vinculo: dados.representante.vinculo.trim() || atual.representante.vinculo,
        }
      : atual.representante,
    endereco: temEndereco
      ? {
          cep: formatCepDisplay(dados.endereco?.cep),
          logradouro: dados.endereco!.logradouro!.trim(),
          numero: dados.endereco?.numero?.trim() || "S/N",
          complemento: dados.endereco?.complemento?.trim() || undefined,
          bairro: dados.endereco?.bairro?.trim() || "—",
          cidade: dados.endereco!.cidade!.trim(),
          uf: dados.endereco?.uf?.trim() || atual.endereco.uf,
        }
      : atual.endereco,
  };
  lista[idx] = atualizado;
  salvarEmpresasAdmin(lista);
}

function salvarEmpresasAdmin(lista: CorporateVerificationRecord[]): void {
  try {
    localStorage.setItem(ADMIN_PJ_STORAGE_KEY, JSON.stringify(lista));
  } catch {
    /* ignore quota errors */
  }
}

export async function listarEmpresasAdminAsync(): Promise<CorporateVerificationRecord[]> {
  const localList = listarEmpresasAdmin();
  const session = getSession();
  if (!session?.token || session.conta.tipo !== "ADMIN") {
    return localList;
  }

  const apiRes = await listarEmpresasPendentesApi(session.token);
  if (!apiRes.ok || !apiRes.data?.empresas) {
    return localList;
  }

  let modificado = false;
  const atualizada = [...localList];

  for (const empBackend of apiRes.data.empresas) {
    const idx = atualizada.findIndex(
      (e) =>
        e.id === empBackend.conta_id ||
        (e.cnpj && e.cnpj.replace(/\D/g, "") === empBackend.cnpj.replace(/\D/g, ""))
    );
    if (idx === -1) {
      modificado = true;
      atualizada.unshift({
        id: empBackend.conta_id,
        razaoSocial: empBackend.razao_social,
        cnpj: formatDigitsCnpj(empBackend.cnpj),
        email: "—",
        telefone: "—",
        representante: {
          nome: "—",
          cpf: "—",
          vinculo: "—",
        },
        endereco: {
          cep: "—",
          logradouro: "—",
          numero: "—",
          bairro: "—",
          cidade: "—",
          uf: "—",
        },
        documentos: {
          contratoSocialNome: "contrato_social.pdf",
          cartaoCnpjNome: "cartao_cnpj.pdf",
          docRepresentanteFrente: "doc_frente.pdf",
          docRepresentanteVerso: "doc_verso.pdf",
        },
        estado: (empBackend.estado === "AGUARDANDO_ANALISE" ? "EM_ANALISE" : empBackend.estado) as CorporateVerificationState,
        submetidoEm: new Date().toISOString(),
      });
    } else {
      if (empBackend.estado === "AGUARDANDO_ANALISE" && atualizada[idx].estado !== "EM_ANALISE") {
        modificado = true;
        atualizada[idx] = {
          ...atualizada[idx],
          estado: "EM_ANALISE",
        };
      }
    }
  }

  if (modificado) {
    salvarEmpresasAdmin(atualizada);
  }

  return atualizada;
}

export function registrarEmpresaParaValidacao(
  registro: Omit<CorporateVerificationRecord, "estado" | "submetidoEm">
): void {
  const atual = listarEmpresasAdmin();
  const novo: CorporateVerificationRecord = {
    ...registro,
    estado: "EM_ANALISE",
    submetidoEm: new Date().toISOString(),
  };
  const filtrada = atual.filter((item) => item.id !== registro.id && item.cnpj !== registro.cnpj);
  salvarEmpresasAdmin([novo, ...filtrada]);
}

export function aprovarEmpresaAdmin(id: string): CorporateVerificationRecord[] {
  const lista = listarEmpresasAdmin();
  const agora = new Date().toISOString();
  let empresaAprovada: CorporateVerificationRecord | undefined;
  const atualizada = lista.map((emp) => {
    if (emp.id === id) {
      empresaAprovada = {
        ...emp,
        estado: "APROVADA" as const,
        motivoRejeicao: undefined,
        analisadoEm: agora,
      };
      return empresaAprovada;
    }
    return emp;
  });
  salvarEmpresasAdmin(atualizada);

  if (empresaAprovada) {
    registrarProdutorParaGovernanca({
      id: empresaAprovada.id,
      nome: empresaAprovada.razaoSocial,
      farmName: empresaAprovada.nomeFantasia || empresaAprovada.razaoSocial,
      documento: empresaAprovada.cnpj,
      tipoDocumento: "CNPJ",
      email: empresaAprovada.email,
      cidade: empresaAprovada.endereco.cidade,
      uf: empresaAprovada.endereco.uf,
      dataEntrada: agora,
      estado: "HABILITADO",
      revisadoPeloAdmin: true,
      auditadoEm: agora,
      auditadoPor: "Auditor de Governança SafraDireta (Onboarding PJ)",
      observacoesAuditoria: "Empresa aprovada no fluxo de admissão e conformidade documental PJ.",
    });
  }

  return atualizada;
}

export function recusarEmpresaAdmin(id: string, motivo: string): CorporateVerificationRecord[] {
  const lista = listarEmpresasAdmin();
  const agora = new Date().toISOString();
  const atualizada = lista.map((emp) =>
    emp.id === id
      ? {
          ...emp,
          estado: "REJEITADA" as const,
          motivoRejeicao: motivo.trim(),
          analisadoEm: agora,
        }
      : emp
  );
  salvarEmpresasAdmin(atualizada);
  return atualizada;
}

export function obterEmpresaPorIdOuCnpj(idOuCnpj?: string): CorporateVerificationRecord | null {
  if (!idOuCnpj) return null;
  const lista = listarEmpresasAdmin();
  const clean = idOuCnpj.replace(/\D/g, "");
  const lower = idOuCnpj.trim().toLowerCase();
  return (
    lista.find(
      (e) =>
        e.id === idOuCnpj ||
        e.cnpj === idOuCnpj ||
        (clean && e.cnpj.replace(/\D/g, "") === clean) ||
        (lower && e.email && e.email.toLowerCase() === lower) ||
        (lower && e.razaoSocial && e.razaoSocial.toLowerCase() === lower)
    ) || null
  );
}

export function obterStatusDocumentosEmpresa(
  empresa: CorporateVerificationRecord
): Record<"contratoSocial" | "cartaoCnpj" | "docRepresentanteFrente" | "docRepresentanteVerso", CorporateDocMetadata> {
  const agora = empresa.submetidoEm || new Date().toISOString();
  const defaultStatus: DocConformityStatus =
    empresa.estado === "APROVADA"
      ? "VALIDADO"
      : empresa.estado === "REJEITADA"
      ? "RECUSADO"
      : "EM_REANALISE";

  const statusExistente = empresa.documentosStatus || {};

  return {
    contratoSocial: statusExistente.contratoSocial || {
      nome: empresa.documentos.contratoSocialNome,
      status: defaultStatus,
      motivoRecusa: empresa.estado === "REJEITADA" ? empresa.motivoRejeicao : undefined,
      atualizadoEm: agora,
      tamanhoFormatado: "1.2 MB",
    },
    cartaoCnpj: statusExistente.cartaoCnpj || {
      nome: empresa.documentos.cartaoCnpjNome,
      status: defaultStatus,
      motivoRecusa: empresa.estado === "REJEITADA" ? empresa.motivoRejeicao : undefined,
      atualizadoEm: agora,
      tamanhoFormatado: "420 KB",
    },
    docRepresentanteFrente: statusExistente.docRepresentanteFrente || {
      nome: empresa.documentos.docRepresentanteFrente,
      status: defaultStatus,
      motivoRecusa: empresa.estado === "REJEITADA" ? empresa.motivoRejeicao : undefined,
      atualizadoEm: agora,
      tamanhoFormatado: "850 KB",
    },
    docRepresentanteVerso: statusExistente.docRepresentanteVerso || {
      nome: empresa.documentos.docRepresentanteVerso,
      status: defaultStatus,
      motivoRecusa: empresa.estado === "REJEITADA" ? empresa.motivoRejeicao : undefined,
      atualizadoEm: agora,
      tamanhoFormatado: "820 KB",
    },
  };
}

export function substituirDocumentoEmpresa(
  empresaId: string,
  tipoDoc: "contratoSocial" | "cartaoCnpj" | "docRepresentanteFrente" | "docRepresentanteVerso",
  novoNome: string,
  tamanhoFormatado?: string
): CorporateVerificationRecord[] {
  const lista = listarEmpresasAdmin();
  const agora = new Date().toISOString();

  const atualizada = lista.map((emp) => {
    if (emp.id === empresaId || emp.cnpj.replace(/\D/g, "") === empresaId.replace(/\D/g, "")) {
      const statusMap = obterStatusDocumentosEmpresa(emp);
      statusMap[tipoDoc] = {
        nome: novoNome,
        status: "EM_REANALISE",
        atualizadoEm: agora,
        tamanhoFormatado: tamanhoFormatado || "Arquivo digital",
        isNovaVersao: true,
        motivoRecusa: undefined,
      };

      const docKeys = {
        contratoSocial: "contratoSocialNome" as const,
        cartaoCnpj: "cartaoCnpjNome" as const,
        docRepresentanteFrente: "docRepresentanteFrente" as const,
        docRepresentanteVerso: "docRepresentanteVerso" as const,
      };

      const novosDocs = {
        ...emp.documentos,
        [docKeys[tipoDoc]]: novoNome,
      };

      // Se a empresa foi rejeitada anteriormente, o reenvio move de volta para análise
      const novoEstado: CorporateVerificationState =
        emp.estado === "REJEITADA" ? "EM_ANALISE" : emp.estado;

      const atual: CorporateVerificationRecord = {
        ...emp,
        documentos: novosDocs,
        documentosStatus: statusMap,
        estado: novoEstado,
        motivoRejeicao: novoEstado === "EM_ANALISE" ? undefined : emp.motivoRejeicao,
      };

      // Sincroniza o perfil local
      try {
        const key = `safradireta_mock_profile:${emp.id}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const prof = JSON.parse(raw);
          if (!prof.documents) prof.documents = {};
          if (tipoDoc === "contratoSocial") {
            prof.documents.fileNames = [novoNome, prof.documents.fileNames?.[1] || "Cartao_CNPJ.pdf"];
          } else if (tipoDoc === "cartaoCnpj") {
            prof.documents.fileNames = [prof.documents.fileNames?.[0] || "Contrato_Social.pdf", novoNome];
          } else if (tipoDoc === "docRepresentanteFrente") {
            prof.documents.representativeFrontFileName = novoNome;
          } else if (tipoDoc === "docRepresentanteVerso") {
            prof.documents.representativeBackFileName = novoNome;
          }
          localStorage.setItem(key, JSON.stringify(prof));
        }
      } catch {
        /* no-op */
      }

      return atual;
    }
    return emp;
  });

  salvarEmpresasAdmin(atualizada);
  return atualizada;
}

export function homologarDocumentoIndividualAdmin(
  empresaId: string,
  tipoDoc: "contratoSocial" | "cartaoCnpj" | "docRepresentanteFrente" | "docRepresentanteVerso"
): CorporateVerificationRecord[] {
  const lista = listarEmpresasAdmin();
  const agora = new Date().toISOString();

  const atualizada = lista.map((emp) => {
    if (emp.id === empresaId) {
      const statusMap = obterStatusDocumentosEmpresa(emp);
      statusMap[tipoDoc] = {
        ...statusMap[tipoDoc],
        status: "VALIDADO",
        motivoRecusa: undefined,
        isNovaVersao: false,
        atualizadoEm: agora,
      };

      const todosValidados = Object.values(statusMap).every((doc) => doc.status === "VALIDADO");
      const novoEstado = todosValidados && emp.estado === "EM_ANALISE" ? "APROVADA" : emp.estado;

      return {
        ...emp,
        documentosStatus: statusMap,
        estado: novoEstado,
        analisadoEm: agora,
      };
    }
    return emp;
  });

  salvarEmpresasAdmin(atualizada);
  return atualizada;
}

export function recusarDocumentoIndividualAdmin(
  empresaId: string,
  tipoDoc: "contratoSocial" | "cartaoCnpj" | "docRepresentanteFrente" | "docRepresentanteVerso",
  motivo: string
): CorporateVerificationRecord[] {
  const lista = listarEmpresasAdmin();
  const agora = new Date().toISOString();

  const atualizada = lista.map((emp) => {
    if (emp.id === empresaId) {
      const statusMap = obterStatusDocumentosEmpresa(emp);
      statusMap[tipoDoc] = {
        ...statusMap[tipoDoc],
        status: "RECUSADO",
        motivoRecusa: motivo.trim(),
        isNovaVersao: false,
        atualizadoEm: agora,
      };

      return {
        ...emp,
        documentosStatus: statusMap,
        analisadoEm: agora,
      };
    }
    return emp;
  });

  salvarEmpresasAdmin(atualizada);
  return atualizada;
}

export function solicitarTrocaRepresentanteEmpresa(
  empresaId: string,
  payload: {
    novoRepresentante: {
      nome: string;
      cpf: string;
      vinculo: string;
    };
    docFrenteNome: string;
    docVersoNome: string;
    comprovacaoPoderesNome: string;
    tipoComprovacao: "ATA_ELEICAO" | "ALTERACAO_CONTRATUAL" | "PROCURACAO_PUBLICA";
  }
): CorporateVerificationRecord[] {
  const lista = listarEmpresasAdmin();
  const agora = new Date().toISOString();

  const atualizada = lista.map((emp) => {
    if (emp.id === empresaId || emp.cnpj.replace(/\D/g, "") === empresaId.replace(/\D/g, "")) {
      const req: RepresentativeChangeRequest = {
        id: `req-troca-${Date.now()}`,
        solicitadoEm: agora,
        status: "PENDENTE",
        representanteAtual: { ...emp.representante },
        novoRepresentante: {
          nome: payload.novoRepresentante.nome.trim(),
          cpf: formatDigitsCpf(payload.novoRepresentante.cpf),
          vinculo: payload.novoRepresentante.vinculo.trim(),
        },
        documentos: {
          docFrenteNome: payload.docFrenteNome,
          docVersoNome: payload.docVersoNome,
          comprovacaoPoderesNome: payload.comprovacaoPoderesNome,
          tipoComprovacao: payload.tipoComprovacao,
        },
        termoAceito: true,
      };

      return {
        ...emp,
        solicitacaoTrocaRepresentante: req,
      };
    }
    return emp;
  });

  salvarEmpresasAdmin(atualizada);
  return atualizada;
}

export function homologarTrocaRepresentanteAdmin(
  empresaId: string,
  parecer?: string
): CorporateVerificationRecord[] {
  const lista = listarEmpresasAdmin();
  const agora = new Date().toISOString();

  const atualizada = lista.map((emp) => {
    if (emp.id === empresaId && emp.solicitacaoTrocaRepresentante) {
      const req = emp.solicitacaoTrocaRepresentante;
      const homologada: RepresentativeChangeRequest = {
        ...req,
        status: "HOMOLOGADA",
        analisadoEm: agora,
        parecerAdmin: parecer?.trim() || "Homologado pelo Auditor de Governança.",
      };

      const statusMap = obterStatusDocumentosEmpresa(emp);
      statusMap.docRepresentanteFrente = {
        nome: req.documentos.docFrenteNome,
        status: "VALIDADO",
        atualizadoEm: agora,
        tamanhoFormatado: "Documento oficial homologado",
        isNovaVersao: false,
      };
      statusMap.docRepresentanteVerso = {
        nome: req.documentos.docVersoNome,
        status: "VALIDADO",
        atualizadoEm: agora,
        tamanhoFormatado: "Documento oficial homologado",
        isNovaVersao: false,
      };

      // Dispara a troca de arquivos binários no IndexedDB
      homologarTrocaRepresentanteDocsNoIndexedDB(emp.cnpj).catch(() => {});

      // Sincroniza o mock profile
      try {
        const key = `safradireta_mock_profile:${emp.id}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const prof = JSON.parse(raw);
          prof.representative = { ...req.novoRepresentante };
          if (prof.documents) {
            prof.documents.representativeFrontFileName = req.documentos.docFrenteNome;
            prof.documents.representativeBackFileName = req.documentos.docVersoNome;
          }
          localStorage.setItem(key, JSON.stringify(prof));
        }
      } catch {
        /* no-op */
      }

      return {
        ...emp,
        representante: { ...req.novoRepresentante },
        documentos: {
          ...emp.documentos,
          docRepresentanteFrente: req.documentos.docFrenteNome,
          docRepresentanteVerso: req.documentos.docVersoNome,
        },
        documentosStatus: statusMap,
        solicitacaoTrocaRepresentante: undefined,
        historicoTrocasRepresentante: [homologada, ...(emp.historicoTrocasRepresentante || [])],
      };
    }
    return emp;
  });

  salvarEmpresasAdmin(atualizada);
  return atualizada;
}

export function indeferirTrocaRepresentanteAdmin(
  empresaId: string,
  motivo: string
): CorporateVerificationRecord[] {
  const lista = listarEmpresasAdmin();
  const agora = new Date().toISOString();

  const atualizada = lista.map((emp) => {
    if (emp.id === empresaId && emp.solicitacaoTrocaRepresentante) {
      const indeferida: RepresentativeChangeRequest = {
        ...emp.solicitacaoTrocaRepresentante,
        status: "INDEFERIDA",
        analisadoEm: agora,
        motivoIndeferimento: motivo.trim(),
      };

      return {
        ...emp,
        solicitacaoTrocaRepresentante: undefined,
        historicoTrocasRepresentante: [indeferida, ...(emp.historicoTrocasRepresentante || [])],
      };
    }
    return emp;
  });

  salvarEmpresasAdmin(atualizada);
  return atualizada;
}

// ---------------------------------------------------------------------------
// Moderação de Anúncios e Lotes (Aba 2)
// ---------------------------------------------------------------------------
export async function hidratarAnunciosComMidias(anuncios: MarketplaceAd[]): Promise<MarketplaceAd[]> {
  return await Promise.all(
    anuncios.map(async (anuncio) => {
      try {
        const midias = await obterMidiasDoIndexedDB(anuncio.id);
        if (midias) {
          const fotos = midias.fotos && midias.fotos.length > 0 ? midias.fotos : anuncio.fotos;
          const imagemCapa = (fotos && fotos[0]) || anuncio.imagemUrl;
          return {
            ...anuncio,
            fotos,
            imagemUrl: imagemCapa,
            video: midias.video || anuncio.video,
          };
        }
      } catch {
        /* fallback seguro */
      }
      return anuncio;
    })
  );
}

export function listarTodosAnunciosAdmin(): MarketplaceAd[] {
  return obterTodosAnunciosRaw().sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
  );
}

export async function listarTodosAnunciosAdminAsync(): Promise<MarketplaceAd[]> {
  const base = listarTodosAnunciosAdmin();
  return await hidratarAnunciosComMidias(base);
}

export function pausarAnuncioModeracao(anuncioId: string, motivo: string): MarketplaceAd[] {
  const anuncios = obterTodosAnunciosRaw();
  const agora = new Date().toISOString();
  const atualizados = anuncios.map((anuncio) =>
    anuncio.id === anuncioId
      ? {
          ...anuncio,
          status: "PAUSADO_MODERACAO" as const,
          motivoModeracao: motivo.trim(),
          moderadoEm: agora,
          atualizadoEm: agora,
        }
      : anuncio
  );
  salvarTodosAnunciosRaw(atualizados);
  return atualizados;
}

export function liberarAnuncioModeracao(anuncioId: string): MarketplaceAd[] {
  const anuncios = obterTodosAnunciosRaw();
  const agora = new Date().toISOString();
  const atualizados = anuncios.map((anuncio) =>
    anuncio.id === anuncioId
      ? {
          ...anuncio,
          status: "ATIVO" as const,
          motivoModeracao: undefined,
          moderadoEm: agora,
          atualizadoEm: agora,
        }
      : anuncio
  );
  salvarTodosAnunciosRaw(atualizados);
  return atualizados;
}

export function bloquearAnuncioDefinitivo(anuncioId: string, motivo: string): MarketplaceAd[] {
  const anuncios = obterTodosAnunciosRaw();
  const agora = new Date().toISOString();
  const atualizados = anuncios.map((anuncio) =>
    anuncio.id === anuncioId
      ? {
          ...anuncio,
          status: "BLOQUEADO_MODERACAO" as const,
          motivoModeracao: motivo.trim(),
          moderadoEm: agora,
          atualizadoEm: agora,
        }
      : anuncio
  );
  salvarTodosAnunciosRaw(atualizados);
  return atualizados;
}

// ---------------------------------------------------------------------------
// Governança de Produtores e Vendedores (Aba 3)
// ---------------------------------------------------------------------------
export function listarProdutoresAdmin(): ProducerGovernanceRecord[] {
  let base: ProducerGovernanceRecord[] = [];
  let modificado = false;

  // Limpa qualquer bloco seller residual de contas estritamente compradoras (ex: Pedro)
  for (const buyerId of BUYER_ONLY_ACCOUNT_IDS) {
    try {
      const mockKey = `safradireta_mock_profile:${buyerId}`;
      const rawProfile = localStorage.getItem(mockKey);
      if (rawProfile) {
        const prof = JSON.parse(rawProfile);
        if (prof && prof.seller) {
          delete prof.seller;
          localStorage.setItem(mockKey, JSON.stringify(prof));
        }
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const raw = localStorage.getItem(ADMIN_PRODUCERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProducerGovernanceRecord[];
      if (Array.isArray(parsed)) {
        const filtrada = parsed.filter((p) => {
          if (FAKE_PRODUCER_IDS.has(p.id) || BUYER_ONLY_ACCOUNT_IDS.has(p.id)) return false;
          if (p.email?.toLowerCase() === "pedro.h.c.zin@gmail.com") return false;
          return true;
        });
        if (filtrada.length !== parsed.length) {
          modificado = true;
        }
        base = filtrada;
      }
    }
  } catch {
    base = [];
  }

  const perfis = carregarTodosPerfisLocais();
  const anuncios = obterTodosAnunciosRaw();

  // 0. Sincroniza contas reais conhecidas habilitadas que ainda não constem na lista
  for (const acc of KNOWN_REAL_ACCOUNTS) {
    if (acc.estadoVendedor === "HABILITADO" && !BUYER_ONLY_ACCOUNT_IDS.has(acc.id)) {
      const jaExiste = base.some(
        (p) => p.id === acc.id || (acc.email && p.email?.toLowerCase() === acc.email.toLowerCase())
      );
      if (!jaExiste) {
        modificado = true;
        const isCnpj = acc.tipo === "PJ";
        base.unshift({
          id: acc.id,
          nome: acc.nome,
          farmName: acc.farmName || `Fazenda ${acc.nome}`,
          documento: isCnpj ? formatDigitsCnpj(acc.cpfCnpj) : formatDigitsCpf(acc.cpfCnpj),
          tipoDocumento: isCnpj ? "CNPJ" : "CPF",
          email: acc.email,
          cidade: acc.cidade || "—",
          uf: acc.uf || "—",
          dataEntrada: new Date().toISOString(),
          estado: "HABILITADO",
          revisadoPeloAdmin: isCnpj,
          auditadoEm: isCnpj ? new Date().toISOString() : undefined,
          auditadoPor: isCnpj ? "Auditor de Governança SafraDireta (Onboarding PJ)" : undefined,
          observacoesAuditoria: isCnpj
            ? "Empresa aprovada no fluxo de admissão e conformidade documental PJ."
            : undefined,
          historicoPunicoes: [],
        });
      }
    }
  }

  // 0.5. Sincroniza empresas aprovadas no Onboarding PJ
  const empresasPj = listarEmpresasAdmin();
  for (const emp of empresasPj) {
    if (emp.estado === "APROVADA") {
      const jaExisteIndex = base.findIndex(
        (p) =>
          p.id === emp.id ||
          (emp.cnpj && p.documento && p.documento.replace(/\D/g, "") === emp.cnpj.replace(/\D/g, "")) ||
          (emp.email && p.email?.toLowerCase() === emp.email.toLowerCase())
      );
      if (jaExisteIndex >= 0) {
        if (
          base[jaExisteIndex].estado !== "HABILITADO" &&
          base[jaExisteIndex].estado !== "BANIDO" &&
          base[jaExisteIndex].estado !== "SUSPENSO"
        ) {
          base[jaExisteIndex].estado = "HABILITADO";
          modificado = true;
        }
      } else {
        modificado = true;
        base.unshift({
          id: emp.id,
          nome: emp.razaoSocial,
          farmName: emp.nomeFantasia || emp.razaoSocial,
          documento: formatDigitsCnpj(emp.cnpj),
          tipoDocumento: "CNPJ",
          email: emp.email,
          cidade: emp.endereco?.cidade || "—",
          uf: emp.endereco?.uf || "—",
          dataEntrada: emp.submetidoEm || new Date().toISOString(),
          estado: "HABILITADO",
          revisadoPeloAdmin: true,
          auditadoEm: emp.analisadoEm || new Date().toISOString(),
          auditadoPor: "Auditor de Governança SafraDireta (Onboarding PJ)",
          observacoesAuditoria: "Empresa aprovada no fluxo de admissão e conformidade documental PJ.",
          historicoPunicoes: [],
        });
      }
    }
  }

  // 1. Sincroniza qualquer perfil habilitado como vendedor no armazenamento local
  for (const [userId, profile] of perfis.entries()) {
    if (BUYER_ONLY_ACCOUNT_IDS.has(userId)) continue;
    if (profile.account?.email?.toLowerCase() === "pedro.h.c.zin@gmail.com") continue;

    const isSeller = Boolean(
      profile.seller?.isHabilitado ||
      profile.seller?.farmName ||
      (profile.seller?.categories && profile.seller.categories.length > 0)
    );

    if (isSeller && !base.some((p) => p.id === userId)) {
      modificado = true;
      const account = profile.account || {};
      const seller = profile.seller || {};
      const address = profile.address || {};
      const known = resolverDadosConta(userId, account.email, account.nome);
      const rawDoc = account.cpfCnpj ? String(account.cpfCnpj).trim() : (known?.cpfCnpj || "");
      const isCnpj = account.tipo === "PJ" || known?.tipo === "PJ" || rawDoc.length > 14;
      const docFormatado = rawDoc
        ? isCnpj ? formatDigitsCnpj(rawDoc) : formatDigitsCpf(rawDoc)
        : "Não informado";
      const cleanEmail =
        account.email ||
        known?.email ||
        (userId.startsWith("mock-") && userId.includes("@") ? userId.replace(/^mock-/, "") : "—");

      base.unshift({
        id: userId,
        nome: account.nome || known?.nome || "Produtor Rural",
        farmName: seller.farmName || known?.farmName || (account.nome ? `Fazenda ${account.nome}` : "Propriedade Rural"),
        documento: docFormatado,
        tipoDocumento: isCnpj ? "CNPJ" : "CPF",
        email: cleanEmail,
        cidade: seller.city || address.cidade || known?.cidade || "—",
        uf: seller.state || address.uf || known?.uf || "—",
        dataEntrada: profile.createdAt || new Date().toISOString(),
        estado: "HABILITADO",
        revisadoPeloAdmin: isCnpj,
        auditadoEm: isCnpj ? (profile.createdAt || new Date().toISOString()) : undefined,
        auditadoPor: isCnpj ? "Auditor de Governança SafraDireta (Onboarding PJ)" : undefined,
        observacoesAuditoria: isCnpj
          ? "Empresa aprovada no fluxo de admissão e conformidade documental PJ."
          : undefined,
        historicoPunicoes: [],
      });
    }
  }

  // 2. Sincroniza vendedores que criaram anúncios no mercado
  for (const ad of anuncios) {
    if (BUYER_ONLY_ACCOUNT_IDS.has(ad.vendedorId)) continue;
    if (!base.some((p) => p.id === ad.vendedorId)) {
      modificado = true;
      const profile = perfis.get(ad.vendedorId);
      const known = resolverDadosConta(ad.vendedorId, undefined, ad.vendedorNome);
      const rawDoc = profile?.account?.cpfCnpj ? String(profile.account.cpfCnpj).trim() : (known?.cpfCnpj || "");
      const isCnpj = profile?.account?.tipo === "PJ" || known?.tipo === "PJ" || rawDoc.length > 14;
      const cleanEmail =
        profile?.account?.email ||
        known?.email ||
        (ad.vendedorId.startsWith("mock-") && ad.vendedorId.includes("@")
          ? ad.vendedorId.replace(/^mock-/, "")
          : "—");

      base.unshift({
        id: ad.vendedorId,
        nome: profile?.account?.nome || known?.nome || ad.vendedorNome || "Produtor Rural",
        farmName: profile?.seller?.farmName || known?.farmName || ad.farmName || "Propriedade Rural",
        documento: rawDoc ? (isCnpj ? formatDigitsCnpj(rawDoc) : formatDigitsCpf(rawDoc)) : "Não informado",
        tipoDocumento: isCnpj ? "CNPJ" : "CPF",
        email: cleanEmail,
        cidade: profile?.seller?.city || profile?.address?.cidade || known?.cidade || ad.cidade || "—",
        uf: profile?.seller?.state || profile?.address?.uf || known?.uf || ad.uf || "—",
        dataEntrada: ad.criadoEm || new Date().toISOString(),
        estado: "HABILITADO",
        revisadoPeloAdmin: isCnpj,
        auditadoEm: isCnpj ? (ad.criadoEm || new Date().toISOString()) : undefined,
        auditadoPor: isCnpj ? "Auditor de Governança SafraDireta (Onboarding PJ)" : undefined,
        observacoesAuditoria: isCnpj
          ? "Empresa aprovada no fluxo de admissão e conformidade documental PJ."
          : undefined,
        historicoPunicoes: [],
      });
    }
  }

  // 3. Sincroniza a sessão atual se for vendedor e não admin
  const session = getSession();
  if (
    session &&
    session.conta.tipo !== "ADMIN" &&
    !BUYER_ONLY_ACCOUNT_IDS.has(session.conta.id) &&
    session.conta.email?.toLowerCase() !== "pedro.h.c.zin@gmail.com" &&
    (session.vendedorEstado === "HABILITADO" ||
      session.vendedorEstado === "SUSPENSO" ||
      session.vendedorEstado === "BANIDO")
  ) {
    if (!base.some((p) => p.id === session.conta.id)) {
      modificado = true;
      const profile = perfis.get(session.conta.id);
      const known = resolverDadosConta(session.conta.id, session.conta.email, session.conta.nome);
      const rawDoc = profile?.account?.cpfCnpj ? String(profile.account.cpfCnpj).trim() : (known?.cpfCnpj || "");
      const isCnpj = session.conta.tipo === "PJ" || known?.tipo === "PJ" || rawDoc.length > 14;
      base.unshift({
        id: session.conta.id,
        nome: session.conta.nome,
        farmName: profile?.seller?.farmName || known?.farmName || `Fazenda ${session.conta.nome}`,
        documento: rawDoc ? (isCnpj ? formatDigitsCnpj(rawDoc) : formatDigitsCpf(rawDoc)) : "Não informado",
        tipoDocumento: isCnpj ? "CNPJ" : "CPF",
        email: session.conta.email,
        cidade: profile?.seller?.city || profile?.address?.cidade || known?.cidade || "—",
        uf: profile?.seller?.state || profile?.address?.uf || known?.uf || "—",
        dataEntrada: new Date().toISOString(),
        estado:
          session.vendedorEstado === "SUSPENSO"
            ? "SUSPENSO"
            : session.vendedorEstado === "BANIDO"
            ? "BANIDO"
            : "HABILITADO",
        revisadoPeloAdmin: isCnpj,
        auditadoEm: isCnpj ? new Date().toISOString() : undefined,
        auditadoPor: isCnpj ? "Auditor de Governança SafraDireta (Onboarding PJ)" : undefined,
        observacoesAuditoria: isCnpj
          ? "Empresa aprovada no fluxo de admissão e conformidade documental PJ."
          : undefined,
        historicoPunicoes: [],
      });
    }
  }

  // 4. Higieniza dados genéricos/falsos de execuções anteriores que possam ter ficado no storage
  for (let i = 0; i < base.length; i++) {
    const prod = base[i];
    const profile = perfis.get(prod.id);
    const known = resolverDadosConta(prod.id, prod.email, prod.nome);
    const matchingAd = anuncios.find((a) => a.vendedorId === prod.id);

    let alterado = false;
    let doc = prod.documento;
    let email = prod.email;
    let nome = prod.nome;
    let farm = prod.farmName;
    let cid = prod.cidade;
    let uf = prod.uf;

    // Purga de documentos fictícios legados ("418.772.901-34", "529.982.247-25", etc.)
    if (
      doc === "418.772.901-34" ||
      doc === "529.982.247-25" ||
      doc === "314.882.190-54" ||
      doc === "508.219.446-82" ||
      doc === "629.401.778-11"
    ) {
      if (profile?.account?.cpfCnpj || known?.cpfCnpj) {
        const raw = profile?.account?.cpfCnpj || known?.cpfCnpj || "";
        doc = raw.length > 14 ? formatDigitsCnpj(raw) : formatDigitsCpf(raw);
      } else {
        doc = "Não informado";
      }
      alterado = true;
    }

    // Se o documento estiver como "Não informado" ou vazio, mas tivermos dados em profile ou known
    if ((!doc || doc === "Não informado") && (profile?.account?.cpfCnpj || known?.cpfCnpj)) {
      const raw = profile?.account?.cpfCnpj || known?.cpfCnpj || "";
      const isCnpj = known?.tipo === "PJ" || profile?.account?.tipo === "PJ" || raw.length > 14;
      doc = isCnpj ? formatDigitsCnpj(raw) : formatDigitsCpf(raw);
      alterado = true;
    }

    // Purga de e-mails fictícios gerados como @safradireta.com.br
    if (email?.endsWith("@safradireta.com.br") && prod.id !== "admin-master-001") {
      if (profile?.account?.email) {
        email = profile.account.email;
      } else if (known?.email) {
        email = known.email;
      } else if (prod.id.startsWith("mock-") && prod.id.includes("@")) {
        email = prod.id.replace(/^mock-/, "");
      } else {
        email = "—";
      }
      alterado = true;
    }

    // Se e-mail estiver como "—" ou indefinido, preenche se conhecido
    if ((email === "—" || !email) && (profile?.account?.email || known?.email)) {
      email = profile?.account?.email || known?.email || email;
      alterado = true;
    }

    // Corrige nome genérico se houver perfil real, known ou anúncio
    if ((nome === "Produtor Rural" || !nome) && (profile?.account?.nome || known?.nome || matchingAd?.vendedorNome)) {
      nome = profile?.account?.nome || known?.nome || matchingAd?.vendedorNome || nome;
      alterado = true;
    }

    // Corrige fazenda genérica se houver perfil real, known ou anúncio
    if (
      (farm === "Propriedade Rural" || farm === "Fazenda Cadastrada" || !farm) &&
      (profile?.seller?.farmName || known?.farmName || matchingAd?.farmName)
    ) {
      farm = profile?.seller?.farmName || known?.farmName || matchingAd?.farmName || farm;
      alterado = true;
    }

    // Corrige localização se houver perfil real, known ou anúncio
    if ((cid === "—" || !cid || cid === "Uberaba") && (profile?.seller?.city || known?.cidade || matchingAd?.cidade)) {
      const realCity = profile?.seller?.city || profile?.address?.cidade || known?.cidade || matchingAd?.cidade;
      const realUf = profile?.seller?.state || profile?.address?.uf || known?.uf || matchingAd?.uf;
      if (realCity && realCity !== cid) {
        cid = realCity;
        uf = realUf || uf;
        alterado = true;
      }
    }

    // Higienização e default de auditoria interna (PJ aprovada = auditada, PF = pendente por padrão)
    const isPJ = prod.tipoDocumento === "CNPJ" || known?.tipo === "PJ" || profile?.account?.tipo === "PJ";
    const finalRevisado = prod.revisadoPeloAdmin !== undefined ? prod.revisadoPeloAdmin : (isPJ ? true : false);
    const finalAuditadoEm = prod.auditadoEm || (isPJ && finalRevisado ? prod.dataEntrada : undefined);
    const finalAuditadoPor =
      prod.auditadoPor ||
      (isPJ && finalRevisado ? "Auditor de Governança SafraDireta (Onboarding PJ)" : undefined);
    const finalObs =
      prod.observacoesAuditoria ||
      (isPJ && finalRevisado ? "Empresa aprovada no fluxo de admissão e conformidade documental PJ." : undefined);

    if (
      prod.revisadoPeloAdmin !== finalRevisado ||
      prod.auditadoEm !== finalAuditadoEm ||
      prod.auditadoPor !== finalAuditadoPor ||
      prod.observacoesAuditoria !== finalObs
    ) {
      alterado = true;
    }

    if (alterado) {
      base[i] = {
        ...prod,
        nome,
        farmName: farm,
        documento: doc,
        email,
        cidade: cid,
        uf,
        revisadoPeloAdmin: finalRevisado,
        auditadoEm: finalAuditadoEm,
        auditadoPor: finalAuditadoPor,
        observacoesAuditoria: finalObs,
      };
      modificado = true;
    }
  }

  if (modificado) {
    salvarProdutoresAdmin(base);
  }

  return base;
}

function salvarProdutoresAdmin(lista: ProducerGovernanceRecord[]): void {
  try {
    localStorage.setItem(ADMIN_PRODUCERS_STORAGE_KEY, JSON.stringify(lista));
  } catch {
    /* ignore */
  }
}

export function registrarProdutorParaGovernanca(dados: {
  id: string;
  nome: string;
  farmName: string;
  documento: string;
  tipoDocumento?: "CPF" | "CNPJ";
  email: string;
  cidade: string;
  uf: string;
  dataEntrada?: string;
  estado?: ProducerAccountState;
  revisadoPeloAdmin?: boolean;
  auditadoEm?: string;
  auditadoPor?: string;
  observacoesAuditoria?: string;
  documentosStatus?: {
    rgFrente?: ProducerDocMetadata;
    rgVerso?: ProducerDocMetadata;
    car?: ProducerDocMetadata;
  };
}): void {
  if (BUYER_ONLY_ACCOUNT_IDS.has(dados.id) || dados.email?.toLowerCase() === "pedro.h.c.zin@gmail.com") {
    return;
  }
  const lista = listarProdutoresAdmin();
  const existente = lista.find((p) => p.id === dados.id);
  const agora = new Date().toISOString();

  const rawDoc = dados.documento.trim();
  const isCnpj = dados.tipoDocumento === "CNPJ" || rawDoc.length > 14;
  const docFormatado = rawDoc
    ? isCnpj ? formatDigitsCnpj(rawDoc) : formatDigitsCpf(rawDoc)
    : "Não informado";

  if (existente) {
    const atualizado: ProducerGovernanceRecord = {
      ...existente,
      nome: dados.nome || existente.nome,
      farmName: dados.farmName || existente.farmName,
      documento: docFormatado !== "Não informado" ? docFormatado : existente.documento,
      tipoDocumento: isCnpj ? "CNPJ" : "CPF",
      email: dados.email || existente.email,
      cidade: dados.cidade || existente.cidade,
      uf: dados.uf || existente.uf,
      estado: dados.estado || existente.estado,
      revisadoPeloAdmin:
        dados.revisadoPeloAdmin !== undefined ? dados.revisadoPeloAdmin : existente.revisadoPeloAdmin,
      auditadoEm: dados.auditadoEm !== undefined ? dados.auditadoEm : existente.auditadoEm,
      auditadoPor: dados.auditadoPor !== undefined ? dados.auditadoPor : existente.auditadoPor,
      observacoesAuditoria:
        dados.observacoesAuditoria !== undefined
          ? dados.observacoesAuditoria
          : existente.observacoesAuditoria,
      documentosStatus: dados.documentosStatus
        ? { ...(existente.documentosStatus || {}), ...dados.documentosStatus }
        : existente.documentosStatus,
    };
    const novaLista = lista.map((p) => (p.id === dados.id ? atualizado : p));
    salvarProdutoresAdmin(novaLista);
  } else {
    const novo: ProducerGovernanceRecord = {
      id: dados.id,
      nome: dados.nome,
      farmName: dados.farmName,
      documento: docFormatado,
      tipoDocumento: isCnpj ? "CNPJ" : "CPF",
      email: dados.email,
      cidade: dados.cidade,
      uf: dados.uf,
      dataEntrada: dados.dataEntrada || agora,
      estado: dados.estado || "HABILITADO",
      revisadoPeloAdmin: dados.revisadoPeloAdmin !== undefined ? dados.revisadoPeloAdmin : isCnpj,
      auditadoEm: dados.auditadoEm || (isCnpj ? agora : undefined),
      auditadoPor:
        dados.auditadoPor || (isCnpj ? "Auditor de Governança SafraDireta (Onboarding PJ)" : undefined),
      observacoesAuditoria: dados.observacoesAuditoria,
      documentosStatus: dados.documentosStatus,
      historicoPunicoes: [],
    };
    salvarProdutoresAdmin([novo, ...lista]);
  }
}

export function obterStatusGovernancaProdutor(
  produtorId: string
): ProducerGovernanceRecord | null {
  const todos = listarProdutoresAdmin();
  return todos.find((p) => p.id === produtorId) || null;
}

export function removerProdutorDaGovernanca(produtorId: string): void {
  try {
    const raw = localStorage.getItem(ADMIN_PRODUCERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProducerGovernanceRecord[];
      if (Array.isArray(parsed)) {
        const filtrada = parsed.filter((p) => p.id !== produtorId);
        if (filtrada.length !== parsed.length) {
          salvarProdutoresAdmin(filtrada);
        }
      }
    }
    const mockKey = `safradireta_mock_profile:${produtorId}`;
    const rawProfile = localStorage.getItem(mockKey);
    if (rawProfile) {
      const prof = JSON.parse(rawProfile);
      if (prof && prof.seller) {
        delete prof.seller;
        localStorage.setItem(mockKey, JSON.stringify(prof));
      }
    }
  } catch {
    /* ignore */
  }
}

export function suspenderProdutorAdmin(
  produtorId: string,
  motivo: string,
  prazo: SuspensionDurationDays
): ProducerGovernanceRecord[] {
  const lista = listarProdutoresAdmin();
  const agora = new Date();
  const suspensoAte =
    prazo === "INDETERMINADO"
      ? null
      : new Date(agora.getTime() + prazo * 24 * 60 * 60 * 1000).toISOString();

  const novaEntradaHistorico: PunishmentHistoryEntry = {
    id: `hist-${Date.now()}`,
    tipo: "SUSPENSAO",
    motivo: motivo.trim(),
    prazoDias: prazo,
    suspensoAte,
    data: agora.toISOString(),
    autor: ADMIN_DEMO_EMAIL,
  };

  const atualizada = lista.map((prod) =>
    prod.id === produtorId
      ? {
          ...prod,
          estado: "SUSPENSO" as const,
          motivoPunicao: motivo.trim(),
          prazoSuspensao: prazo,
          suspensoEm: agora.toISOString(),
          suspensoAte,
          historicoPunicoes: [novaEntradaHistorico, ...prod.historicoPunicoes],
        }
      : prod
  );

  salvarProdutoresAdmin(atualizada);

  // Sincroniza punição com o backend se a conta for UUID e houver sessão administrativa ativa
  const sess = getSession();
  if (sess?.token && sess.conta.tipo === "ADMIN" && produtorId.length === 36) {
    suspenderContaApi(
      produtorId,
      {
        motivo: motivo.trim(),
        tipo_punicao: "SUSPENSAO_TEMPORARIA",
        dias_duracao: prazo === "INDETERMINADO" ? undefined : prazo,
      },
      sess.token
    ).catch(() => {});
  }

  // Despublica preventivamente todos os anúncios ativos do produtor suspenso
  const anuncios = obterTodosAnunciosRaw();
  let alterouAnuncios = false;
  const anunciosAtualizados = anuncios.map((ad) => {
    if (ad.vendedorId === produtorId && ad.status === "ATIVO") {
      alterouAnuncios = true;
      return {
        ...ad,
        status: "PAUSADO_MODERACAO" as const,
        motivoModeracao: `Produtor suspenso temporariamente pela Governança: ${motivo.trim()}`,
        moderadoEm: agora.toISOString(),
      };
    }
    return ad;
  });
  if (alterouAnuncios) {
    salvarTodosAnunciosRaw(anunciosAtualizados);
  }

  // Se o produtor suspenso for o usuário da sessão atual, sincroniza o estado
  const session = getSession();
  if (session && session.conta.id === produtorId) {
    updateSession({ vendedorEstado: "SUSPENSO" });
  }

  return atualizada;
}

export function reativarProdutorAdmin(
  produtorId: string,
  observacao = "Reativação administrativa da conta de vendedor."
): ProducerGovernanceRecord[] {
  const lista = listarProdutoresAdmin();
  const agora = new Date().toISOString();

  const atualizada = lista.map((prod) => {
    if (prod.id !== produtorId) return prod;
    const tinhaContestacao = Boolean(prod.contestacaoPendente && prod.contestacao);
    const novaEntrada: PunishmentHistoryEntry = {
      id: `hist-${Date.now()}`,
      tipo: tinhaContestacao ? "CONTESTACAO_ACEITA" : "REATIVACAO",
      motivo: observacao,
      data: agora,
      autor: ADMIN_DEMO_EMAIL,
    };

    return {
      ...prod,
      estado: "HABILITADO" as const,
      motivoPunicao: undefined,
      prazoSuspensao: undefined,
      suspensoEm: undefined,
      suspensoAte: undefined,
      contestacaoPendente: false,
      contestacao: prod.contestacao
        ? {
            ...prod.contestacao,
            status: "ACEITA" as const,
            respostaAdmin: observacao,
            analisadoEm: agora,
          }
        : undefined,
      historicoPunicoes: [novaEntrada, ...prod.historicoPunicoes],
    };
  });

  salvarProdutoresAdmin(atualizada);

  // Restaura automaticamente os anúncios que haviam sido pausados apenas em razão da suspensão da conta
  const anuncios = obterTodosAnunciosRaw();
  let alterouAnuncios = false;
  const anunciosAtualizados = anuncios.map((ad) => {
    if (
      ad.vendedorId === produtorId &&
      ad.status === "PAUSADO_MODERACAO" &&
      (!ad.motivoModeracao ||
        ad.motivoModeracao.startsWith("Produtor suspenso temporariamente pela Governança:"))
    ) {
      alterouAnuncios = true;
      return {
        ...ad,
        status: "ATIVO" as const,
        motivoModeracao: undefined,
        moderadoEm: agora,
        atualizadoEm: agora,
      };
    }
    return ad;
  });
  if (alterouAnuncios) {
    salvarTodosAnunciosRaw(anunciosAtualizados);
  }

  const session = getSession();
  if (session && session.conta.id === produtorId) {
    updateSession({ vendedorEstado: "HABILITADO" });
  }

  return atualizada;
}

export function banirProdutorAdmin(
  produtorId: string,
  motivo: string
): ProducerGovernanceRecord[] {
  const lista = listarProdutoresAdmin();
  const agora = new Date().toISOString();

  const novaEntrada: PunishmentHistoryEntry = {
    id: `hist-${Date.now()}`,
    tipo: "BANIMENTO",
    motivo: `${motivo.trim()} (Registro preservado por Soft Delete — Art. 15 Marco Civil da Internet).`,
    data: agora,
    autor: ADMIN_DEMO_EMAIL,
  };

  const atualizada = lista.map((prod) =>
    prod.id === produtorId
      ? {
          ...prod,
          estado: "BANIDO" as const,
          motivoPunicao: motivo.trim(),
          prazoSuspensao: undefined,
          suspensoEm: agora,
          suspensoAte: null,
          contestacaoPendente: false,
          historicoPunicoes: [novaEntrada, ...prod.historicoPunicoes],
        }
      : prod
  );

  salvarProdutoresAdmin(atualizada);

  // Soft Delete de todos os anúncios do produtor banido (ocultos do público, preservados para auditoria)
  const anuncios = obterTodosAnunciosRaw();
  let alterouAnuncios = false;
  const anunciosAtualizados = anuncios.map((ad) => {
    if (ad.vendedorId === produtorId && ad.status !== "BLOQUEADO_MODERACAO") {
      alterouAnuncios = true;
      return {
        ...ad,
        status: "BLOQUEADO_MODERACAO" as const,
        motivoModeracao: `Conta do vendedor banida em definitivo: ${motivo.trim()}`,
        moderadoEm: agora,
      };
    }
    return ad;
  });
  if (alterouAnuncios) {
    salvarTodosAnunciosRaw(anunciosAtualizados);
  }

  const session = getSession();
  if (session && session.conta.id === produtorId) {
    updateSession({ vendedorEstado: "BANIDO" });
  }

  return atualizada;
}

export function rejeitarContestacaoAdmin(
  produtorId: string,
  respostaAdmin: string
): ProducerGovernanceRecord[] {
  const lista = listarProdutoresAdmin();
  const agora = new Date().toISOString();

  const novaEntrada: PunishmentHistoryEntry = {
    id: `hist-${Date.now()}`,
    tipo: "CONTESTACAO_NEGADA",
    motivo: `Recurso indeferido: ${respostaAdmin.trim()}`,
    data: agora,
    autor: ADMIN_DEMO_EMAIL,
  };

  const atualizada = lista.map((prod) =>
    prod.id === produtorId
      ? {
          ...prod,
          contestacaoPendente: false,
          contestacao: prod.contestacao
            ? {
                ...prod.contestacao,
                status: "NEGADA" as const,
                respostaAdmin: respostaAdmin.trim(),
                analisadoEm: agora,
              }
            : undefined,
          historicoPunicoes: [novaEntrada, ...prod.historicoPunicoes],
        }
      : prod
  );

  salvarProdutoresAdmin(atualizada);
  return atualizada;
}

export function submeterContestacaoProdutor(
  produtorId: string,
  textoDefesa: string,
  documentoAnexoNome?: string
): ProducerGovernanceRecord | null {
  const lista = listarProdutoresAdmin();
  const agora = new Date().toISOString();
  let registroAtualizado: ProducerGovernanceRecord | null = null;

  const atualizada = lista.map((prod) => {
    if (prod.id !== produtorId) return prod;
    const atualizado: ProducerGovernanceRecord = {
      ...prod,
      contestacaoPendente: true,
      contestacao: {
        textoDefesa: textoDefesa.trim(),
        documentoAnexoNome: documentoAnexoNome?.trim() || undefined,
        enviadoEm: agora,
        status: "PENDENTE",
      },
    };
    registroAtualizado = atualizado;
    return atualizado;
  });

  salvarProdutoresAdmin(atualizada);
  return registroAtualizado;
}

export function atualizarAuditoriaProdutorAdmin(
  produtorId: string,
  revisado: boolean,
  observacoes?: string
): ProducerGovernanceRecord[] {
  const lista = listarProdutoresAdmin();
  const agora = new Date().toISOString();
  const atualizada = lista.map((p) => {
    if (p.id === produtorId) {
      return {
        ...p,
        revisadoPeloAdmin: revisado,
        auditadoEm: revisado ? agora : undefined,
        auditadoPor: revisado ? "Auditor de Governança SafraDireta" : undefined,
        observacoesAuditoria: observacoes !== undefined ? observacoes.trim() : p.observacoesAuditoria,
      };
    }
    return p;
  });
  salvarProdutoresAdmin(atualizada);
  return atualizada;
}

export function salvarObservacoesAuditoriaAdmin(
  produtorId: string,
  observacoes: string
): ProducerGovernanceRecord[] {
  const lista = listarProdutoresAdmin();
  const atualizada = lista.map((p) => {
    if (p.id === produtorId) {
      return {
        ...p,
        observacoesAuditoria: observacoes.trim(),
      };
    }
    return p;
  });
  salvarProdutoresAdmin(atualizada);
  return atualizada;
}

// ---------------------------------------------------------------------------
// Auditoria e Conformidade de Documentos do Produtor (PF)
// ---------------------------------------------------------------------------

export function obterStatusDocumentosProdutor(
  produtor: ProducerGovernanceRecord
): {
  rgFrente: ProducerDocMetadata;
  rgVerso: ProducerDocMetadata;
  car: ProducerDocMetadata;
} {
  const agora = produtor.dataEntrada || new Date().toISOString();
  const defaultStatus: "VALIDADO" | "EM_REANALISE" | "RECUSADO" =
    produtor.revisadoPeloAdmin ? "VALIDADO" : "EM_REANALISE";

  let frontName = "Documento_Identidade_Frente.jpg";
  let backName = "Documento_Identidade_Verso.jpg";
  let carName = "Recibo_Inscricao_CAR.pdf";

  try {
    const raw = localStorage.getItem(`safradireta_mock_profile:${produtor.id}`);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.documents?.cpfFrontFileName) frontName = p.documents.cpfFrontFileName;
      if (p.documents?.cpfBackFileName) backName = p.documents.cpfBackFileName;
      if (p.documents?.carFileName) carName = p.documents.carFileName;
    }
  } catch {
    /* ignore */
  }

  const statusExistente = produtor.documentosStatus || {};

  return {
    rgFrente: statusExistente.rgFrente || {
      nome: frontName,
      status: defaultStatus,
      atualizadoEm: agora,
      tamanhoFormatado: "1.1 MB",
    },
    rgVerso: statusExistente.rgVerso || {
      nome: backName,
      status: defaultStatus,
      atualizadoEm: agora,
      tamanhoFormatado: "1.0 MB",
    },
    car: statusExistente.car || {
      nome: carName,
      status: defaultStatus,
      atualizadoEm: agora,
      tamanhoFormatado: "2.4 MB",
    },
  };
}

export function homologarDocumentoProdutorAdmin(
  produtorId: string,
  tipoDoc: "rgFrente" | "rgVerso" | "car"
): ProducerGovernanceRecord[] {
  const lista = listarProdutoresAdmin();
  const agora = new Date().toISOString();

  const atualizada = lista.map((p) => {
    if (p.id === produtorId) {
      const statusMap = obterStatusDocumentosProdutor(p);
      statusMap[tipoDoc] = {
        ...statusMap[tipoDoc],
        status: "VALIDADO",
        motivoRecusa: undefined,
        isNovaVersao: false,
        atualizadoEm: agora,
      };

      return {
        ...p,
        documentosStatus: statusMap,
      };
    }
    return p;
  });

  salvarProdutoresAdmin(atualizada);
  return atualizada;
}

export function recusarDocumentoProdutorAdmin(
  produtorId: string,
  tipoDoc: "rgFrente" | "rgVerso" | "car",
  motivo: string,
  suspenderConta: boolean
): ProducerGovernanceRecord[] {
  const lista = listarProdutoresAdmin();
  const agora = new Date().toISOString();

  const atualizada = lista.map((p) => {
    if (p.id === produtorId) {
      const statusMap = obterStatusDocumentosProdutor(p);
      statusMap[tipoDoc] = {
        ...statusMap[tipoDoc],
        status: "RECUSADO",
        motivoRecusa: motivo.trim(),
        isNovaVersao: false,
        atualizadoEm: agora,
      };

      const docLabel =
        tipoDoc === "rgFrente"
          ? "RG/CNH (Frente)"
          : tipoDoc === "rgVerso"
          ? "RG/CNH (Verso)"
          : "CAR / Comprovante Rural";

      let novoEstado = p.estado;
      let novoMotivoPunicao = p.motivoPunicao;
      let historicoAtualizado = p.historicoPunicoes;

      if (suspenderConta) {
        novoEstado = "SUSPENSO";
        novoMotivoPunicao = `Documento ${docLabel} recusado pela auditoria: ${motivo.trim()}`;
        const novaEntrada: PunishmentHistoryEntry = {
          id: `pun-recusa-${Date.now()}`,
          tipo: "SUSPENSAO",
          motivo: novoMotivoPunicao,
          prazoDias: "INDETERMINADO",
          suspensoAte: null,
          data: agora,
          autor: "Auditor de Governança SafraDireta",
        };
        historicoAtualizado = [novaEntrada, ...p.historicoPunicoes];

        // Pausa todos os anúncios ativos deste vendedor
        const todosAnuncios = obterTodosAnunciosRaw();
        let houveMudancaAnuncios = false;
        const anunciosAtualizados = todosAnuncios.map((a) => {
          if (a.vendedorId === produtorId && a.status === "ATIVO") {
            houveMudancaAnuncios = true;
            return {
              ...a,
              status: "PAUSADO_MODERACAO" as const,
              motivoModeracao: `Conta preventivamente suspensa por pendência documental (${docLabel}): ${motivo.trim()}`,
              moderadoEm: agora,
            };
          }
          return a;
        });
        if (houveMudancaAnuncios) {
          salvarTodosAnunciosRaw(anunciosAtualizados);
        }

        // Se o usuário logado for o produtor suspenso, atualiza a sessão
        const session = getSession();
        if (session && session.conta.id === produtorId) {
          updateSession({ vendedorEstado: "SUSPENSO" });
        }
      }

      return {
        ...p,
        estado: novoEstado,
        motivoPunicao: novoMotivoPunicao,
        documentosStatus: statusMap,
        historicoPunicoes: historicoAtualizado,
      };
    }
    return p;
  });

  salvarProdutoresAdmin(atualizada);
  return atualizada;
}

export function substituirDocumentoProdutor(
  produtorId: string,
  tipoDoc: "rgFrente" | "rgVerso" | "car",
  novoNome: string,
  tamanhoFormatado?: string
): ProducerGovernanceRecord[] {
  const lista = listarProdutoresAdmin();
  const agora = new Date().toISOString();

  const atualizada = lista.map((p) => {
    if (p.id === produtorId) {
      const statusMap = obterStatusDocumentosProdutor(p);
      statusMap[tipoDoc] = {
        nome: novoNome,
        status: "EM_REANALISE",
        motivoRecusa: undefined,
        isNovaVersao: true,
        atualizadoEm: agora,
        tamanhoFormatado: tamanhoFormatado || "Arquivo digital",
      };

      // Sincroniza o mock_profile
      try {
        const key = `safradireta_mock_profile:${produtorId}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const prof = JSON.parse(raw);
          if (!prof.documents) prof.documents = {};
          if (tipoDoc === "rgFrente") {
            prof.documents.cpfFrontFileName = novoNome;
          } else if (tipoDoc === "rgVerso") {
            prof.documents.cpfBackFileName = novoNome;
          } else if (tipoDoc === "car") {
            prof.documents.carFileName = novoNome;
            prof.documents.hasCarDocument = true;
          }
          localStorage.setItem(key, JSON.stringify(prof));
        }
      } catch {
        /* ignore */
      }

      return {
        ...p,
        documentosStatus: statusMap,
      };
    }
    return p;
  });

  salvarProdutoresAdmin(atualizada);
  return atualizada;
}

export interface ProducerFullProfileData {
  id: string;
  tipoDocumento: "CPF" | "CNPJ";
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  avatarUrl?: string;
  dataEntrada: string;
  estado: ProducerAccountState;
  revisadoPeloAdmin: boolean;
  auditadoEm?: string;
  auditadoPor?: string;
  observacoesAuditoria?: string;
  farmName: string;
  bio?: string;
  endereco: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade: string;
    uf: string;
  };
  hasOwnTransport: boolean;
  categories: string[];
  totalAnuncios: number;
  anunciosAtivos: number;
  anunciosPausados: number;
  anunciosBloqueados: number;
  isPJ: boolean;
  pjEmpresaId?: string;
  representante?: {
    nome: string;
    cpf: string;
    vinculo: string;
  };
  documentosStatus?: {
    rgFrente?: ProducerDocMetadata;
    rgVerso?: ProducerDocMetadata;
    car?: ProducerDocMetadata;
  };
}

export function obterFichaCompletaProdutor(produtorId: string): ProducerFullProfileData | null {
  const produtores = listarProdutoresAdmin();
  const prod = produtores.find((p) => p.id === produtorId);
  if (!prod) return null;

  const perfis = carregarTodosPerfisLocais();
  const profile = perfis.get(prod.id);
  const known = resolverDadosConta(prod.id, prod.email, prod.nome);
  const anuncios = obterTodosAnunciosRaw().filter((a) => a.vendedorId === prod.id);

  const isPJ = prod.tipoDocumento === "CNPJ" || known?.tipo === "PJ" || profile?.account?.tipo === "PJ";
  const empresaPJ = isPJ ? obterEmpresaPorIdOuCnpj(prod.id) || obterEmpresaPorIdOuCnpj(prod.documento) : null;

  const totalAnuncios = anuncios.length;
  const anunciosAtivos = anuncios.filter((a) => a.status === "ATIVO").length;
  const anunciosPausados = anuncios.filter((a) => a.status === "PAUSADO_MODERACAO").length;
  const anunciosBloqueados = anuncios.filter((a) => a.status === "BLOQUEADO_MODERACAO").length;

  const rawPhone =
    profile?.seller?.publicPhone ||
    profile?.account?.telefone ||
    empresaPJ?.telefone ||
    known?.pjData?.telefone ||
    "Não informado";

  const cleanPhone = rawPhone !== "Não informado" ? formatPhoneDisplay(rawPhone) : "Não informado";

  const categories =
    profile?.seller?.categories && profile.seller.categories.length > 0
      ? profile.seller.categories
      : (Array.from(
          new Set(
            anuncios
              .map((a) => {
                if (a.categoria === "ANIMAL") return a.especie;
                if (a.categoria === "GRAOS") return a.cultura;
                return "Geral";
              })
              .filter(Boolean)
          )
        ) as string[]);

  const endereco = {
    cep: formatCepDisplay(profile?.address?.cep || empresaPJ?.endereco?.cep || known?.pjData?.endereco?.cep),
    logradouro: profile?.address?.logradouro || empresaPJ?.endereco?.logradouro || known?.pjData?.endereco?.logradouro || "—",
    numero: profile?.address?.numero || empresaPJ?.endereco?.numero || known?.pjData?.endereco?.numero || "S/N",
    complemento: profile?.address?.complemento || empresaPJ?.endereco?.complemento || known?.pjData?.endereco?.complemento,
    bairro: profile?.address?.bairro || empresaPJ?.endereco?.bairro || known?.pjData?.endereco?.bairro || "—",
    cidade: prod.cidade,
    uf: prod.uf,
  };

  const rawRep = empresaPJ?.representante || known?.pjData?.representante || profile?.representative;
  const representante =
    rawRep && rawRep.nome
      ? {
          nome: rawRep.nome,
          cpf: rawRep.cpf ? formatDigitsCpf(rawRep.cpf) : "—",
          vinculo: rawRep.vinculo || "Representante Legal",
        }
      : undefined;

  return {
    id: prod.id,
    tipoDocumento: prod.tipoDocumento,
    nome: prod.nome,
    documento: prod.documento,
    email: prod.email,
    telefone: cleanPhone,
    avatarUrl: profile?.account?.avatarUrl,
    dataEntrada: prod.dataEntrada,
    estado: prod.estado,
    revisadoPeloAdmin: Boolean(prod.revisadoPeloAdmin),
    auditadoEm: prod.auditadoEm,
    auditadoPor: prod.auditadoPor,
    observacoesAuditoria: prod.observacoesAuditoria,
    farmName: prod.farmName,
    bio:
      profile?.seller?.bio ||
      (isPJ
        ? "Conta corporativa agropecuária cadastrada no SafraDireta."
        : "Produtor rural atuante no marketplace SafraDireta."),
    endereco,
    hasOwnTransport: Boolean(profile?.seller?.hasOwnTransport),
    categories: categories.length > 0 ? categories : ["Geral", "Agro"],
    totalAnuncios,
    anunciosAtivos,
    anunciosPausados,
    anunciosBloqueados,
    isPJ,
    pjEmpresaId: empresaPJ?.id,
    representante,
    documentosStatus: prod.documentosStatus,
  };
}
