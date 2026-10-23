import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../context/authContext";
import { clearSession } from "../../context/session";
import { routes } from "../../data/site";
import { obterFotoCapa } from "../ads/ads.types";
import type { MarketplaceAd } from "../ads/ads.types";
import { obterDocumentosPJDoIndexedDB } from "../corporate-registration/corporateDocsStorage";
import { obterDocumentosProdutorDoIndexedDB } from "../seller-upgrade/producerDocsStorage";
import {
  ADMIN_DEMO_EMAIL,
  ADMIN_DEMO_PASS,
  ADMIN_DEMO_PIN,
  type CorporateVerificationRecord,
  type CorporateVerificationState,
  type ProducerDocMetadata,
  type ProducerGovernanceRecord,
  type SuspensionDurationDays,
  aprovarEmpresaAdmin,
  autenticarAdmin,
  atualizarAuditoriaProdutorAdmin,
  banirProdutorAdmin,
  bloquearAnuncioDefinitivo,
  homologarDocumentoIndividualAdmin,
  homologarDocumentoProdutorAdmin,
  homologarTrocaRepresentanteAdmin,
  indeferirTrocaRepresentanteAdmin,
  liberarAnuncioModeracao,
  listarEmpresasAdmin,
  listarProdutoresAdmin,
  listarTodosAnunciosAdmin,
  listarTodosAnunciosAdminAsync,
  obterEmpresaPorIdOuCnpj,
  obterFichaCompletaProdutor,
  obterStatusDocumentosEmpresa,
  obterStatusDocumentosProdutor,
  pausarAnuncioModeracao,
  reativarProdutorAdmin,
  recusarDocumentoIndividualAdmin,
  recusarDocumentoProdutorAdmin,
  recusarEmpresaAdmin,
  rejeitarContestacaoAdmin,
  salvarObservacoesAuditoriaAdmin,
  suspenderProdutorAdmin,
} from "./adminStorage";
import "./admin.css";

type AdminTab = "EMPRESAS" | "ANUNCIOS" | "PRODUTORES";
type ProducerFilter =
  | "TODOS"
  | "PENDENTE_AUDITORIA"
  | "REANALISE_DOCS"
  | "AUDITADO"
  | "HABILITADO"
  | "SUSPENSO"
  | "BANIDO"
  | "COM_CONTESTACAO";
type ProducerTypeFilter = "TODOS" | "PF" | "PJ";
type AdFilter = "TODOS" | "ATIVO" | "PAUSADO_MODERACAO" | "EM_REVISAO" | "BLOQUEADO_MODERACAO";
type CompanyFilter = "TODAS" | CorporateVerificationState | "REANALISE_DOCS" | "TROCA_REP";
type DossierDocKind = "CONTRATO" | "CNPJ" | "REP_FRENTE" | "REP_VERSO";
type PfDossierDocKind = "RG_FRENTE" | "RG_VERSO" | "CAR";

function formatDateTimeBR(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateShortBR(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getRemainingDaysBadge(suspensoAte?: string | null): string {
  if (!suspensoAte) return "Prazo indeterminado";
  const diffMs = new Date(suspensoAte).getTime() - Date.now();
  if (diffMs <= 0) return "Prazo expirado";
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return `Restam ${dias} ${dias === 1 ? "dia" : "dias"} (até ${formatDateShortBR(suspensoAte)})`;
}

export function AdminDashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const isAdminAuthenticated = session?.conta.tipo === "ADMIN";

  // Estado do Login Administrativo
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Estado das Abas e Listas
  const [activeTab, setActiveTab] = useState<AdminTab>("EMPRESAS");
  const [empresas, setEmpresas] = useState<CorporateVerificationRecord[]>(() =>
    listarEmpresasAdmin()
  );
  const [anuncios, setAnuncios] = useState<MarketplaceAd[]>(() => listarTodosAnunciosAdmin());
  const [produtores, setProdutores] = useState<ProducerGovernanceRecord[]>(() =>
    listarProdutoresAdmin()
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Carrega e hidrata mídias reais do IndexedDB (fotos de capa e anexos dos lotes)
  useEffect(() => {
    let ativo = true;
    listarTodosAnunciosAdminAsync().then((lista) => {
      if (ativo && lista && lista.length > 0) {
        setAnuncios(lista);
      }
    });
    return () => {
      ativo = false;
    };
  }, [activeTab]);

  // Filtros
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>("TODAS");
  const [adFilter, setAdFilter] = useState<AdFilter>("TODOS");
  const [adSearch, setAdSearch] = useState("");
  const [producerFilter, setProducerFilter] = useState<ProducerFilter>("TODOS");
  const [producerTypeFilter, setProducerTypeFilter] = useState<ProducerTypeFilter>("TODOS");

  // Modais de Ação
  const [rejectCompanyTarget, setRejectCompanyTarget] =
    useState<CorporateVerificationRecord | null>(null);
  const [rejectCompanyReason, setRejectCompanyReason] = useState("");

  // Modal de Ficha Cadastral e Auditoria (Aba 3)
  const [inspectProducerTarget, setInspectProducerTarget] =
    useState<ProducerGovernanceRecord | null>(null);
  const [auditNotesDraft, setAuditNotesDraft] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Dossiê Documental Unificado com Abas para Produtores PF (Aba 3)
  const [pfDossierModal, setPfDossierModal] = useState<{
    produtor: ProducerGovernanceRecord;
    activeDoc: PfDossierDocKind;
  } | null>(null);
  const [pfDocUrls, setPfDocUrls] = useState<Record<string, string>>({});
  const [pfDocZoom, setPfDocZoom] = useState(1);
  const [pfDocRotation, setPfDocRotation] = useState(0);

  const [rejectProducerDocModal, setRejectProducerDocModal] = useState<{
    produtorId: string;
    produtorNome: string;
    tipoDoc: "rgFrente" | "rgVerso" | "car";
    docTitle: string;
    fileName: string;
  } | null>(null);
  const [rejectProducerDocReason, setRejectProducerDocReason] = useState("");
  const [rejectProducerDocSuspend, setRejectProducerDocSuspend] = useState(false);

  const pfProdutorId = pfDossierModal?.produtor.id;

  // Carrega os arquivos binários reais do IndexedDB quando o modal de dossiê do produtor abrir
  useEffect(() => {
    if (!pfProdutorId) return;

    let isMounted = true;
    let createdUrls: Record<string, string> = {};

    obterDocumentosProdutorDoIndexedDB(pfProdutorId).then((stored) => {
      if (!isMounted) return;
      if (!stored) {
        setPfDocUrls({});
        return;
      }

      const urls: Record<string, string> = {};
      if (stored.rgFrenteBlob) urls.RG_FRENTE = URL.createObjectURL(stored.rgFrenteBlob);
      if (stored.rgVersoBlob) urls.RG_VERSO = URL.createObjectURL(stored.rgVersoBlob);
      if (stored.carBlob) urls.CAR = URL.createObjectURL(stored.carBlob);

      createdUrls = urls;
      setPfDocUrls(urls);
    });

    return () => {
      isMounted = false;
      Object.values(createdUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pfProdutorId]);

  const [dossierModal, setDossierModal] = useState<{
    empresa: CorporateVerificationRecord;
    activeDoc: DossierDocKind;
  } | null>(null);

  const [realDocUrls, setRealDocUrls] = useState<Record<string, string>>({});
  const [docZoom, setDocZoom] = useState(1);
  const [docRotation, setDocRotation] = useState(0);

  const dossierCnpj = dossierModal?.empresa.cnpj;

  // Carrega os arquivos binários reais do IndexedDB quando o modal de dossiê abrir
  useEffect(() => {
    if (!dossierCnpj) return;

    let isMounted = true;
    let createdUrls: Record<string, string> = {};

    obterDocumentosPJDoIndexedDB(dossierCnpj).then((stored) => {
      if (!isMounted) return;
      if (!stored) {
        setRealDocUrls({});
        return;
      }
      const urls: Record<string, string> = {};
      if (stored.contratoSocialBlob) urls.CONTRATO = URL.createObjectURL(stored.contratoSocialBlob);
      if (stored.cartaoCnpjBlob) urls.CNPJ = URL.createObjectURL(stored.cartaoCnpjBlob);
      if (stored.docRepFrenteBlob) urls.REP_FRENTE = URL.createObjectURL(stored.docRepFrenteBlob);
      if (stored.docRepVersoBlob) urls.REP_VERSO = URL.createObjectURL(stored.docRepVersoBlob);
      createdUrls = urls;
      setRealDocUrls(urls);
    });

    return () => {
      isMounted = false;
      Object.values(createdUrls).forEach(URL.revokeObjectURL);
    };
  }, [dossierCnpj]);

  // Modal de Auditoria de Troca de Representante Legal
  const [auditRepModal, setAuditRepModal] = useState<CorporateVerificationRecord | null>(null);
  const [auditRepDocKind, setAuditRepDocKind] = useState<"PODERES" | "FRENTE" | "VERSO">("PODERES");
  const [auditRepUrls, setAuditRepUrls] = useState<Record<string, string>>({});
  const [repDecisionReason, setRepDecisionReason] = useState("");
  const [showRejectRepPrompt, setShowRejectRepPrompt] = useState(false);

  // Modal de Recusa de Documento Individual
  const [rejectDocPrompt, setRejectDocPrompt] = useState<{
    empresaId: string;
    tipoDoc: "contratoSocial" | "cartaoCnpj" | "docRepresentanteFrente" | "docRepresentanteVerso";
    docLabel: string;
  } | null>(null);
  const [rejectDocReason, setRejectDocReason] = useState("");

  const auditRepCnpj = auditRepModal?.cnpj;
  useEffect(() => {
    if (!auditRepCnpj) return;
    let isMounted = true;
    let createdUrls: Record<string, string> = {};

    obterDocumentosPJDoIndexedDB(auditRepCnpj).then((stored) => {
      if (!isMounted) return;
      if (!stored) {
        setAuditRepUrls({});
        return;
      }
      const urls: Record<string, string> = {};
      if (stored.novoRepFrenteBlob) urls.FRENTE = URL.createObjectURL(stored.novoRepFrenteBlob);
      if (stored.novoRepVersoBlob) urls.VERSO = URL.createObjectURL(stored.novoRepVersoBlob);
      if (stored.comprovacaoPoderesBlob) urls.PODERES = URL.createObjectURL(stored.comprovacaoPoderesBlob);
      createdUrls = urls;
      setAuditRepUrls(urls);
    });

    return () => {
      isMounted = false;
      Object.values(createdUrls).forEach(URL.revokeObjectURL);
    };
  }, [auditRepCnpj]);

  const [adModerationModal, setAdModerationModal] = useState<{
    ad: MarketplaceAd;
    mode: "PAUSE" | "BLOCK";
  } | null>(null);
  const [adModerationReason, setAdModerationReason] = useState("");

  const [suspendProducerTarget, setSuspendProducerTarget] =
    useState<ProducerGovernanceRecord | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDuration, setSuspendDuration] = useState<SuspensionDurationDays>(15);

  const [banProducerTarget, setBanProducerTarget] = useState<ProducerGovernanceRecord | null>(null);
  const [banReason, setBanReason] = useState("");

  const [appealEvalTarget, setAppealEvalTarget] = useState<ProducerGovernanceRecord | null>(null);
  const [appealAdminReply, setAppealAdminReply] = useState("");

  const [historyTarget, setHistoryTarget] = useState<ProducerGovernanceRecord | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 5000);
  };

  const refreshAllData = () => {
    setEmpresas(listarEmpresasAdmin());
    setAnuncios(listarTodosAnunciosAdmin());
    listarTodosAnunciosAdminAsync().then(setAnuncios);
    setProdutores(listarProdutoresAdmin());
  };

  // ---------------------------------------------------------------------------
  // Handlers de Autenticação
  // ---------------------------------------------------------------------------
  const handleAdminLogin = (e: FormEvent) => {
    e.preventDefault();
    const res = autenticarAdmin(loginEmail, loginPass, loginPin);
    if (!res.ok) {
      setLoginError(res.erro);
      return;
    }
    setLoginError(null);
    refreshAllData();
  };

  const handleFillDemoCredentials = () => {
    setLoginEmail(ADMIN_DEMO_EMAIL);
    setLoginPass(ADMIN_DEMO_PASS);
    setLoginPin(ADMIN_DEMO_PIN);
    setLoginError(null);
  };

  const handleAdminLogout = () => {
    clearSession();
    navigate(routes.home);
  };

  // ---------------------------------------------------------------------------
  // Contadores e Listas Filtradas
  // ---------------------------------------------------------------------------
  const kpis = useMemo(() => {
    const pjPendentes = empresas.filter((e) => e.estado === "EM_ANALISE").length;
    const pjReanaliseDocs = empresas.filter((e) => {
      const status = e.documentosStatus;
      if (!status) return false;
      return Object.values(status).some((doc) => doc.status === "EM_REANALISE" || doc.isNovaVersao);
    }).length;
    const pjTrocaRep = empresas.filter(
      (e) => e.solicitacaoTrocaRepresentante && e.solicitacaoTrocaRepresentante.status === "PENDENTE"
    ).length;
    const lotesEmRevisao = anuncios.filter((a) => a.status === "EM_REVISAO").length;
    const lotesModerados = anuncios.filter(
      (a) => a.status === "PAUSADO_MODERACAO" || a.status === "EM_REVISAO"
    ).length;
    const produtoresRestritos = produtores.filter(
      (p) => p.estado === "SUSPENSO" || p.estado === "BANIDO"
    ).length;
    const contestacoesAbertas = produtores.filter((p) => p.contestacaoPendente).length;
    return {
      pjPendentes,
      pjReanaliseDocs,
      pjTrocaRep,
      lotesEmRevisao,
      lotesModerados,
      produtoresRestritos,
      contestacoesAbertas,
    };
  }, [empresas, anuncios, produtores]);

  const empresasFiltradas = useMemo(() => {
    if (companyFilter === "TODAS") return empresas;
    if (companyFilter === "REANALISE_DOCS") {
      return empresas.filter((e) => {
        const status = e.documentosStatus;
        if (!status) return false;
        return Object.values(status).some((doc) => doc.status === "EM_REANALISE" || doc.isNovaVersao);
      });
    }
    if (companyFilter === "TROCA_REP") {
      return empresas.filter(
        (e) => e.solicitacaoTrocaRepresentante && e.solicitacaoTrocaRepresentante.status === "PENDENTE"
      );
    }
    return empresas.filter((e) => e.estado === companyFilter);
  }, [empresas, companyFilter]);

  const anunciosFiltrados = useMemo(() => {
    return anuncios.filter((ad) => {
      if (adFilter !== "TODOS" && ad.status !== adFilter) return false;
      if (adSearch.trim()) {
        const q = adSearch.trim().toLowerCase();
        const matchTitle = ad.titulo.toLowerCase().includes(q);
        const matchId = ad.id.toLowerCase().includes(q);
        const matchSeller =
          ad.vendedorNome.toLowerCase().includes(q) || ad.farmName.toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchSeller) return false;
      }
      return true;
    });
  }, [anuncios, adFilter, adSearch]);

  const produtoresFiltrados = useMemo(() => {
    return produtores.filter((p) => {
      // 1. Filtro por Tipo de Entidade
      if (producerTypeFilter === "PF" && p.tipoDocumento !== "CPF") return false;
      if (producerTypeFilter === "PJ" && p.tipoDocumento !== "CNPJ") return false;

      // 2. Filtro Operacional / Auditoria
      if (producerFilter === "TODOS") return true;
      if (producerFilter === "PENDENTE_AUDITORIA") return !p.revisadoPeloAdmin;
      if (producerFilter === "REANALISE_DOCS") {
        if (!p.documentosStatus) return false;
        return Object.values(p.documentosStatus).some((d) => d?.status === "EM_REANALISE");
      }
      if (producerFilter === "AUDITADO") return Boolean(p.revisadoPeloAdmin);
      if (producerFilter === "COM_CONTESTACAO") return Boolean(p.contestacaoPendente);
      return p.estado === producerFilter;
    });
  }, [produtores, producerFilter, producerTypeFilter]);

  // ---------------------------------------------------------------------------
  // Handlers Aba 1: Empresas PJ
  // ---------------------------------------------------------------------------
  const handleApproveCompany = (emp: CorporateVerificationRecord) => {
    const novaLista = aprovarEmpresaAdmin(emp.id);
    setEmpresas(novaLista);
    showToast(`Empresa "${emp.razaoSocial}" aprovada e habilitada com sucesso.`);
  };

  const handleConfirmRejectCompany = (e: FormEvent) => {
    e.preventDefault();
    if (!rejectCompanyTarget || rejectCompanyReason.trim().length < 10) return;
    const novaLista = recusarEmpresaAdmin(rejectCompanyTarget.id, rejectCompanyReason);
    setEmpresas(novaLista);
    showToast(`Cadastro corporativo de "${rejectCompanyTarget.razaoSocial}" recusado.`);
    setRejectCompanyTarget(null);
    setRejectCompanyReason("");
  };

  const handleHomologarDoc = (empresaId: string, docKind: DossierDocKind) => {
    const docMap: Record<DossierDocKind, "contratoSocial" | "cartaoCnpj" | "docRepresentanteFrente" | "docRepresentanteVerso"> = {
      CONTRATO: "contratoSocial",
      CNPJ: "cartaoCnpj",
      REP_FRENTE: "docRepresentanteFrente",
      REP_VERSO: "docRepresentanteVerso",
    };
    const tipoKey = docMap[docKind];
    const novaLista = homologarDocumentoIndividualAdmin(empresaId, tipoKey);
    setEmpresas(novaLista);
    if (dossierModal && dossierModal.empresa.id === empresaId) {
      const empAtual = novaLista.find((e) => e.id === empresaId);
      if (empAtual) setDossierModal({ ...dossierModal, empresa: empAtual });
    }
    showToast("Documento homologado com sucesso.");
  };

  const handleConfirmRecusarDoc = (e: FormEvent) => {
    e.preventDefault();
    if (!rejectDocPrompt || rejectDocReason.trim().length < 5) return;
    const novaLista = recusarDocumentoIndividualAdmin(
      rejectDocPrompt.empresaId,
      rejectDocPrompt.tipoDoc,
      rejectDocReason
    );
    setEmpresas(novaLista);
    if (dossierModal && dossierModal.empresa.id === rejectDocPrompt.empresaId) {
      const empAtual = novaLista.find((e) => e.id === rejectDocPrompt.empresaId);
      if (empAtual) setDossierModal({ ...dossierModal, empresa: empAtual });
    }
    showToast("Recusa do documento registrada com sucesso.");
    setRejectDocPrompt(null);
    setRejectDocReason("");
  };

  const handleHomologarTrocaRep = (empresaId: string, parecer?: string) => {
    const novaLista = homologarTrocaRepresentanteAdmin(empresaId, parecer);
    setEmpresas(novaLista);
    showToast("Troca de representante legal homologada com sucesso.");
    setAuditRepModal(null);
    setShowRejectRepPrompt(false);
    setRepDecisionReason("");
  };

  const handleConfirmIndeferirTrocaRep = (e: FormEvent) => {
    e.preventDefault();
    if (!auditRepModal || repDecisionReason.trim().length < 10) return;
    const novaLista = indeferirTrocaRepresentanteAdmin(auditRepModal.id, repDecisionReason);
    setEmpresas(novaLista);
    showToast("Solicitação de troca de representante indeferida.");
    setAuditRepModal(null);
    setShowRejectRepPrompt(false);
    setRepDecisionReason("");
  };

  // ---------------------------------------------------------------------------
  // Handlers Aba 2: Moderação de Anúncios
  // ---------------------------------------------------------------------------
  const handleReleaseAd = (ad: MarketplaceAd) => {
    const produtor = produtores.find((p) => p.id === ad.vendedorId);
    if (produtor && (produtor.estado === "SUSPENSO" || produtor.estado === "BANIDO")) {
      showToast(
        `Não é possível publicar este lote: a conta do vendedor "${produtor.nome}" está ${
          produtor.estado === "SUSPENSO" ? "SUSPENSA" : "BANIDA"
        }. Reative o produtor na Aba 3 antes de liberar seus anúncios.`
      );
      return;
    }

    const novaLista = liberarAnuncioModeracao(ad.id);
    setAnuncios((prev) => {
      const mediaMap = new Map(
        prev.map((a) => [a.id, { fotos: a.fotos, imagemUrl: a.imagemUrl, video: a.video }])
      );
      return novaLista.map((item) => {
        const cached = mediaMap.get(item.id);
        return cached ? { ...item, ...cached } : item;
      });
    });
    listarTodosAnunciosAdminAsync().then(setAnuncios);
    showToast(`Lote "${ad.titulo}" liberado e republicado no Mercado.`);
  };

  const handleConfirmAdModeration = (e: FormEvent) => {
    e.preventDefault();
    if (!adModerationModal || adModerationReason.trim().length < 10) return;
    const { ad, mode } = adModerationModal;
    if (mode === "PAUSE") {
      const novaLista = pausarAnuncioModeracao(ad.id, adModerationReason);
      setAnuncios((prev) => {
        const mediaMap = new Map(
          prev.map((a) => [a.id, { fotos: a.fotos, imagemUrl: a.imagemUrl, video: a.video }])
        );
        return novaLista.map((item) => {
          const cached = mediaMap.get(item.id);
          return cached ? { ...item, ...cached } : item;
        });
      });
      listarTodosAnunciosAdminAsync().then(setAnuncios);
      showToast(`Anúncio "${ad.titulo}" pausado preventivamente pela Moderação.`);
    } else {
      const novaLista = bloquearAnuncioDefinitivo(ad.id, adModerationReason);
      setAnuncios((prev) => {
        const mediaMap = new Map(
          prev.map((a) => [a.id, { fotos: a.fotos, imagemUrl: a.imagemUrl, video: a.video }])
        );
        return novaLista.map((item) => {
          const cached = mediaMap.get(item.id);
          return cached ? { ...item, ...cached } : item;
        });
      });
      listarTodosAnunciosAdminAsync().then(setAnuncios);
      showToast(`Anúncio "${ad.titulo}" bloqueado em definitivo (Soft Delete).`);
    }
    setAdModerationModal(null);
    setAdModerationReason("");
  };

  // ---------------------------------------------------------------------------
  // Handlers Aba 3: Governança de Produtores
  // ---------------------------------------------------------------------------
  const handleConfirmSuspendProducer = (e: FormEvent) => {
    e.preventDefault();
    if (!suspendProducerTarget || suspendReason.trim().length < 10) return;
    const novaLista = suspenderProdutorAdmin(
      suspendProducerTarget.id,
      suspendReason,
      suspendDuration
    );
    setProdutores(novaLista);
    const adsAtualizados = listarTodosAnunciosAdmin();
    setAnuncios((prev) => {
      const mediaMap = new Map(
        prev.map((a) => [a.id, { fotos: a.fotos, imagemUrl: a.imagemUrl, video: a.video }])
      );
      return adsAtualizados.map((item) => {
        const cached = mediaMap.get(item.id);
        return cached ? { ...item, ...cached } : item;
      });
    });
    listarTodosAnunciosAdminAsync().then(setAnuncios);
    showToast(
      `Produtor "${suspendProducerTarget.nome}" suspenso (${
        suspendDuration === "INDETERMINADO" ? "prazo indeterminado" : `${suspendDuration} dias`
      }). Seus lotes ativos foram retirados do Mercado.`
    );
    setSuspendProducerTarget(null);
    setSuspendReason("");
  };

  const handleReactivateProducerImmediate = (prod: ProducerGovernanceRecord) => {
    const novaLista = reativarProdutorAdmin(
      prod.id,
      "Reativação imediata executada pelo Auditor de Governança."
    );
    setProdutores(novaLista);
    const adsAtualizados = listarTodosAnunciosAdmin();
    setAnuncios((prev) => {
      const mediaMap = new Map(
        prev.map((a) => [a.id, { fotos: a.fotos, imagemUrl: a.imagemUrl, video: a.video }])
      );
      return adsAtualizados.map((item) => {
        const cached = mediaMap.get(item.id);
        return cached ? { ...item, ...cached } : item;
      });
    });
    listarTodosAnunciosAdminAsync().then(setAnuncios);
    showToast(`Conta do produtor "${prod.nome}" e seus anúncios foram reativados imediatamente.`);
  };

  const handleConfirmBanProducer = (e: FormEvent) => {
    e.preventDefault();
    if (!banProducerTarget || banReason.trim().length < 10) return;
    const novaLista = banirProdutorAdmin(banProducerTarget.id, banReason);
    setProdutores(novaLista);
    const adsAtualizados = listarTodosAnunciosAdmin();
    setAnuncios((prev) => {
      const mediaMap = new Map(
        prev.map((a) => [a.id, { fotos: a.fotos, imagemUrl: a.imagemUrl, video: a.video }])
      );
      return adsAtualizados.map((item) => {
        const cached = mediaMap.get(item.id);
        return cached ? { ...item, ...cached } : item;
      });
    });
    listarTodosAnunciosAdminAsync().then(setAnuncios);
    showToast(
      `Produtor "${banProducerTarget.nome}" banido em definitivo. Registros preservados por Soft Delete.`
    );
    setBanProducerTarget(null);
    setBanReason("");
  };

  const handleAcceptAppeal = () => {
    if (!appealEvalTarget) return;
    const parecer =
      appealAdminReply.trim() ||
      "Defesa técnica acolhida pela Governança. Conta de vendedor reativada.";
    const novaLista = reativarProdutorAdmin(appealEvalTarget.id, parecer);
    setProdutores(novaLista);
    const adsAtualizados = listarTodosAnunciosAdmin();
    setAnuncios((prev) => {
      const mediaMap = new Map(
        prev.map((a) => [a.id, { fotos: a.fotos, imagemUrl: a.imagemUrl, video: a.video }])
      );
      return adsAtualizados.map((item) => {
        const cached = mediaMap.get(item.id);
        return cached ? { ...item, ...cached } : item;
      });
    });
    listarTodosAnunciosAdminAsync().then(setAnuncios);
    showToast(`Contestação aceita! O produtor "${appealEvalTarget.nome}" e seus anúncios foram reativados.`);
    setAppealEvalTarget(null);
    setAppealAdminReply("");
  };

  const handleRejectAppeal = () => {
    if (!appealEvalTarget) return;
    const parecer =
      appealAdminReply.trim() ||
      "Documentação insuficiente para reverter a medida disciplinar vigente.";
    const novaLista = rejeitarContestacaoAdmin(appealEvalTarget.id, parecer);
    setProdutores(novaLista);
    showToast(`Contestação indeferida. A suspensão de "${appealEvalTarget.nome}" foi mantida.`);
    setAppealEvalTarget(null);
    setAppealAdminReply("");
  };

  const handleToggleAuditoria = (produtorId: string, revisadoAtual: boolean) => {
    const novoStatus = !revisadoAtual;
    const novaLista = atualizarAuditoriaProdutorAdmin(produtorId, novoStatus, auditNotesDraft);
    setProdutores(novaLista);
    const prodAtualizado = novaLista.find((p) => p.id === produtorId);
    if (prodAtualizado && inspectProducerTarget?.id === produtorId) {
      setInspectProducerTarget(prodAtualizado);
    }
    showToast(
      novoStatus
        ? "Produtor marcado como REVISADO pelo Admin com sucesso."
        : "Checagem de auditoria do produtor desmarcada (voltando para PENDENTE)."
    );
  };

  const handleSalvarNotasAuditoria = (produtorId: string) => {
    setIsSavingNotes(true);
    const novaLista = salvarObservacoesAuditoriaAdmin(produtorId, auditNotesDraft);
    setProdutores(novaLista);
    const prodAtualizado = novaLista.find((p) => p.id === produtorId);
    if (prodAtualizado && inspectProducerTarget?.id === produtorId) {
      setInspectProducerTarget(prodAtualizado);
    }
    setTimeout(() => {
      setIsSavingNotes(false);
      showToast("Notas de auditoria interna salvas com sucesso.");
    }, 250);
  };

  const handleHomologarDocumentoProdutor = (
    produtorId: string,
    tipoDoc: "rgFrente" | "rgVerso" | "car"
  ) => {
    const novaLista = homologarDocumentoProdutorAdmin(produtorId, tipoDoc);
    setProdutores(novaLista);
    const prodAtualizado = novaLista.find((p) => p.id === produtorId);
    if (prodAtualizado && inspectProducerTarget?.id === produtorId) {
      setInspectProducerTarget(prodAtualizado);
    }
    if (prodAtualizado && pfDossierModal?.produtor.id === produtorId) {
      setPfDossierModal((prev) => (prev ? { ...prev, produtor: prodAtualizado } : null));
    }
    showToast("Documento oficial validado com sucesso.");
  };

  const handleConfirmarRecusaDocumentoProdutor = () => {
    if (!rejectProducerDocModal || !rejectProducerDocReason.trim()) return;
    const { produtorId, tipoDoc } = rejectProducerDocModal;
    const novaLista = recusarDocumentoProdutorAdmin(
      produtorId,
      tipoDoc,
      rejectProducerDocReason,
      rejectProducerDocSuspend
    );
    setProdutores(novaLista);
    const prodAtualizado = novaLista.find((p) => p.id === produtorId);
    if (prodAtualizado && inspectProducerTarget?.id === produtorId) {
      setInspectProducerTarget(prodAtualizado);
    }
    if (prodAtualizado && pfDossierModal?.produtor.id === produtorId) {
      setPfDossierModal((prev) => (prev ? { ...prev, produtor: prodAtualizado } : null));
    }
    if (rejectProducerDocSuspend) {
      const adsAtualizados = listarTodosAnunciosAdmin();
      setAnuncios((prev) => {
        const mediaMap = new Map(
          prev.map((a) => [a.id, { fotos: a.fotos, imagemUrl: a.imagemUrl, video: a.video }])
        );
        return adsAtualizados.map((item) => {
          const cached = mediaMap.get(item.id);
          return cached ? { ...item, ...cached } : item;
        });
      });
      listarTodosAnunciosAdminAsync().then(setAnuncios);
    }
    showToast(
      rejectProducerDocSuspend
        ? "Documento recusado e vendedor suspenso preventivamente."
        : "Documento recusado com solicitação de reenvio."
    );
    setRejectProducerDocModal(null);
    setRejectProducerDocReason("");
    setRejectProducerDocSuspend(false);
  };

  // ===========================================================================
  // RENDER 1: TELA DE LOGIN ADMINISTRATIVO (SLUG SECRETO)
  // ===========================================================================
  if (!isAdminAuthenticated) {
    return (
      <main className="admin-login-shell">
        <div className="admin-login-card">
          <div className="admin-login-card__header">
            <span className="admin-login-card__badge">
              🛡️ ACESSO RESTRITO • BACKOFFICE SAFRADIRETA
            </span>
            <h1>Portal de Governança e Moderação</h1>
            <p>
              Ambiente exclusivo para auditores credenciados. Todas as operações são registradas em
              trilha de auditoria.
            </p>
          </div>

          <div className="admin-login-demo-box">
            <div>
              <strong>Credenciais de Homologação / Avaliação:</strong>
              <p>
                E-mail: <code>{ADMIN_DEMO_EMAIL}</code> · Senha: <code>{ADMIN_DEMO_PASS}</code> ·
                PIN: <code>{ADMIN_DEMO_PIN}</code>
              </p>
            </div>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={handleFillDemoCredentials}
            >
              Preencher Credenciais
            </button>
          </div>

          <form onSubmit={handleAdminLogin} className="admin-login-form" noValidate>
            <div className="field">
              <label htmlFor="admin-email">E-mail Corporativo do Auditor</label>
              <input
                id="admin-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@safradireta.com.br"
                autoComplete="username"
                required
              />
            </div>

            <div className="admin-login-form__row">
              <div className="field">
                <label htmlFor="admin-pass">Senha Administrativa</label>
                <input
                  id="admin-pass"
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="admin-pin">PIN Operacional (6 dígitos)</label>
                <input
                  id="admin-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  placeholder="984021"
                  required
                />
              </div>
            </div>

            {loginError && (
              <div className="admin-login-error" role="alert">
                <Icon name="alert" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="admin-login-form__actions">
              <Link to={routes.home} className="button button--ghost">
                Voltar ao Site Público
              </Link>
              <button type="submit" className="button button--primary">
                Autenticar no Backoffice
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  // ===========================================================================
  // RENDER 2: PAINEL DE GESTÃO E GOVERNANÇA (AUTENTICADO COMO ADMIN)
  // ===========================================================================
  return (
    <div className="admin-dashboard-shell">
      {/* Topbar Exclusiva do Backoffice */}
      <header className="admin-topbar">
        <div className="container admin-topbar__inner">
          <div className="admin-topbar__brand">
            <span className="admin-topbar__shield" aria-hidden="true">
              🛡️
            </span>
            <div>
              <span className="admin-topbar__eyebrow">SafraDireta • Backoffice & Compliance</span>
              <h1 className="admin-topbar__title">Painel Administrativo e Governança</h1>
            </div>
          </div>

          <div className="admin-topbar__actions">
            <Link to={routes.market} className="button button--secondary button--small">
              🌾 Navegar no Mercado como Auditor ↗
            </Link>
            <button
              type="button"
              onClick={handleAdminLogout}
              className="button button--ghost button--small admin-topbar__logout"
            >
              Encerrar Sessão Admin
            </button>
          </div>
        </div>
      </header>

      <main className="container admin-main">
        {toastMessage && (
          <div className="admin-toast" role="status">
            <Icon name="check" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* KPIs de Governança */}
        <section className="admin-kpi-grid" aria-label="Indicadores de Governança">
          <article className="admin-kpi-card" onClick={() => setActiveTab("EMPRESAS")}>
            <span className="admin-kpi-card__label">Validação de Empresas (PJ)</span>
            <strong className="admin-kpi-card__value">{kpis.pjPendentes}</strong>
            <span className="admin-kpi-card__hint">Dossiês aguardando parecer</span>
          </article>

          <article className="admin-kpi-card" onClick={() => setActiveTab("ANUNCIOS")}>
            <span className="admin-kpi-card__label">Lotes sob Moderação / Revisão</span>
            <strong className="admin-kpi-card__value">{kpis.lotesModerados}</strong>
            <span className="admin-kpi-card__hint">
              {kpis.lotesEmRevisao} corrigido(s) aguardando liberação
            </span>
          </article>

          <article className="admin-kpi-card" onClick={() => setActiveTab("PRODUTORES")}>
            <span className="admin-kpi-card__label">Produtores com Restrição</span>
            <strong className="admin-kpi-card__value">{kpis.produtoresRestritos}</strong>
            <span className="admin-kpi-card__hint">Contas suspensas ou banidas</span>
          </article>

          <article
            className={`admin-kpi-card ${
              kpis.contestacoesAbertas > 0 ? "admin-kpi-card--alert" : ""
            }`}
            onClick={() => {
              setActiveTab("PRODUTORES");
              setProducerFilter("COM_CONTESTACAO");
            }}
          >
            <span className="admin-kpi-card__label">Direito de Resposta (Recursos)</span>
            <strong className="admin-kpi-card__value">{kpis.contestacoesAbertas}</strong>
            <span className="admin-kpi-card__hint">Contestações abertas para julgamento</span>
          </article>
        </section>

        {/* Barra de Abas Principais */}
        <nav className="admin-tabs" aria-label="Módulos do Backoffice">
          <button
            type="button"
            className={`admin-tabs__btn ${activeTab === "EMPRESAS" ? "is-active" : ""}`}
            onClick={() => setActiveTab("EMPRESAS")}
          >
            <span>🏢 1. Validação de Empresas (PJ)</span>
            {kpis.pjPendentes > 0 && (
              <span className="admin-tabs__badge">{kpis.pjPendentes}</span>
            )}
          </button>

          <button
            type="button"
            className={`admin-tabs__btn ${activeTab === "ANUNCIOS" ? "is-active" : ""}`}
            onClick={() => setActiveTab("ANUNCIOS")}
          >
            <span>📦 2. Moderação de Anúncios e Lotes</span>
            {kpis.lotesEmRevisao > 0 && (
              <span className="admin-tabs__badge">{kpis.lotesEmRevisao}</span>
            )}
          </button>

          <button
            type="button"
            className={`admin-tabs__btn ${activeTab === "PRODUTORES" ? "is-active" : ""}`}
            onClick={() => setActiveTab("PRODUTORES")}
          >
            <span>🌾 3. Governança de Produtores</span>
            {kpis.contestacoesAbertas > 0 && (
              <span className="admin-tabs__badge admin-tabs__badge--warning">
                {kpis.contestacoesAbertas} recurso(s)
              </span>
            )}
          </button>
        </nav>

        {/* ================================================================= */}
        {/* ABA 1: VALIDAÇÃO DE EMPRESAS (CONTAS PJ)                          */}
        {/* ================================================================= */}
        {activeTab === "EMPRESAS" && (
          <section className="admin-panel-section" aria-label="Validação de Empresas">
            <div className="admin-panel-header">
              <div>
                <h2>Fila de Validação Documental — Pessoas Jurídicas (PJ)</h2>
                <p>
                  Verifique a autenticidade do Contrato Social, Cartão CNPJ e documento do
                  Representante Legal antes de liberar a operação comercial da empresa.
                </p>
              </div>

              <div className="admin-filter-pills" role="tablist">
                {(
                  [
                    { id: "TODAS", label: `Todas (${empresas.length})` },
                    {
                      id: "EM_ANALISE",
                      label: `⏳ Em Análise (${
                        empresas.filter((e) => e.estado === "EM_ANALISE").length
                      })`,
                    },
                    {
                      id: "REANALISE_DOCS",
                      label: `📄 Docs em Reanálise (${kpis.pjReanaliseDocs})`,
                    },
                    {
                      id: "TROCA_REP",
                      label: `🔄 Troca de Representante (${kpis.pjTrocaRep})`,
                    },
                    {
                      id: "APROVADA",
                      label: `✅ Aprovadas (${
                        empresas.filter((e) => e.estado === "APROVADA").length
                      })`,
                    },
                    {
                      id: "REJEITADA",
                      label: `❌ Recusadas (${
                        empresas.filter((e) => e.estado === "REJEITADA").length
                      })`,
                    },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    className={`admin-pill ${companyFilter === pill.id ? "is-active" : ""}`}
                    onClick={() => setCompanyFilter(pill.id)}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-pj-list">
              {empresasFiltradas.length === 0 ? (
                <div className="admin-empty-state">
                  <p>Nenhuma empresa cadastrada ou em análise no momento.</p>
                </div>
              ) : (
                empresasFiltradas.map((emp) => {
                  const docStatus = obterStatusDocumentosEmpresa(emp);
                  const hasDocReanalise = Object.values(docStatus).some((d) => Boolean(d.isNovaVersao));
                  const hasTrocaPendente =
                    emp.solicitacaoTrocaRepresentante &&
                    emp.solicitacaoTrocaRepresentante.status === "PENDENTE";

                  return (
                    <article key={emp.id} className="admin-pj-card">
                      <div className="admin-pj-card__top">
                        <div>
                          <div className="admin-pj-card__title-row">
                            <h3>{emp.razaoSocial}</h3>
                            {emp.nomeFantasia && (
                              <span className="admin-pj-card__fantasy">({emp.nomeFantasia})</span>
                            )}
                            {emp.naturezaJuridica && (
                              <span className="admin-tag">{emp.naturezaJuridica}</span>
                            )}
                          </div>
                          <p className="admin-pj-card__meta">
                            <strong>CNPJ:</strong> {emp.cnpj} · <strong>E-mail:</strong> {emp.email} ·{" "}
                            <strong>Telefone:</strong> {emp.telefone} · <strong>Protocolado em:</strong>{" "}
                            {formatDateTimeBR(emp.submetidoEm)}
                          </p>
                        </div>

                        <div className="admin-pj-card__badges">
                          {hasTrocaPendente && (
                            <span className="admin-badge admin-badge--warning">
                              🔄 Troca de Representante
                            </span>
                          )}
                          {hasDocReanalise && (
                            <span className="admin-badge admin-badge--warning">
                              📄 Doc em Reanálise
                            </span>
                          )}
                          <span
                            className={`admin-badge ${
                              emp.estado === "EM_ANALISE"
                                ? "admin-badge--warning"
                                : emp.estado === "APROVADA"
                                ? "admin-badge--success"
                                : "admin-badge--danger"
                            }`}
                          >
                            {emp.estado === "EM_ANALISE"
                              ? "⏳ Em Análise Documental"
                              : emp.estado === "APROVADA"
                              ? "✅ Empresa Aprovada"
                              : "❌ Cadastro Recusado"}
                          </span>
                        </div>
                      </div>

                      <div className="admin-pj-card__grid">
                        <div className="admin-pj-card__box">
                          <h4>👤 Representante Legal</h4>
                          <p>
                            <strong>Nome:</strong> {emp.representante.nome}
                          </p>
                          <p>
                            <strong>CPF:</strong> {emp.representante.cpf}
                          </p>
                          <p>
                            <strong>Vínculo Societário:</strong> {emp.representante.vinculo}
                          </p>

                          {hasTrocaPendente && (
                            <div className="admin-pj-card__rep-alert">
                              <strong>⚠️ Pedido de Troca Pendente:</strong>
                              <p>
                                {emp.solicitacaoTrocaRepresentante?.novoRepresentante.nome} (
                                {emp.solicitacaoTrocaRepresentante?.novoRepresentante.vinculo})
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="admin-pj-card__box">
                          <h4>📍 Endereço da Sede</h4>
                          <p>
                            {emp.endereco.logradouro}, {emp.endereco.numero}
                            {emp.endereco.complemento ? ` — ${emp.endereco.complemento}` : ""}
                          </p>
                          <p>
                            {emp.endereco.bairro} · {emp.endereco.cidade}/{emp.endereco.uf} · CEP{" "}
                            {emp.endereco.cep}
                          </p>
                        </div>

                        <div className="admin-pj-card__box">
                          <h4>📎 Dossiê de Documentos Anexados</h4>
                          <div className="admin-doc-links">
                            <button
                              type="button"
                              className="admin-doc-link"
                              title={emp.documentos.contratoSocialNome}
                              onClick={() => {
                                setDossierModal({ empresa: emp, activeDoc: "CONTRATO" });
                                setDocZoom(1);
                                setDocRotation(0);
                              }}
                            >
                              <Icon name="file" />
                              <span>{emp.documentos.contratoSocialNome}</span>
                              {docStatus.contratoSocial.status === "EM_REANALISE" && (
                                <span className="admin-doc-tag-warning">
                                  {docStatus.contratoSocial.isNovaVersao ? "🔄 Reanálise" : "⏳ Pendente"}
                                </span>
                              )}
                              {docStatus.contratoSocial.status === "RECUSADO" && (
                                <span className="admin-doc-tag-danger">❌ Recusado</span>
                              )}
                            </button>

                            <button
                              type="button"
                              className="admin-doc-link"
                              title={emp.documentos.cartaoCnpjNome}
                              onClick={() => {
                                setDossierModal({ empresa: emp, activeDoc: "CNPJ" });
                                setDocZoom(1);
                                setDocRotation(0);
                              }}
                            >
                              <Icon name="file" />
                              <span>{emp.documentos.cartaoCnpjNome}</span>
                              {docStatus.cartaoCnpj.status === "EM_REANALISE" && (
                                <span className="admin-doc-tag-warning">
                                  {docStatus.cartaoCnpj.isNovaVersao ? "🔄 Reanálise" : "⏳ Pendente"}
                                </span>
                              )}
                              {docStatus.cartaoCnpj.status === "RECUSADO" && (
                                <span className="admin-doc-tag-danger">❌ Recusado</span>
                              )}
                            </button>

                            <button
                              type="button"
                              className="admin-doc-link"
                              title={`Identidade do Representante (${emp.documentos.docRepresentanteFrente})`}
                              onClick={() => {
                                setDossierModal({ empresa: emp, activeDoc: "REP_FRENTE" });
                                setDocZoom(1);
                                setDocRotation(0);
                              }}
                            >
                              <Icon name="user" />
                              <span>
                                Identidade ({emp.documentos.docRepresentanteFrente})
                              </span>
                              {docStatus.docRepresentanteFrente.status === "EM_REANALISE" && (
                                <span className="admin-doc-tag-warning">
                                  {docStatus.docRepresentanteFrente.isNovaVersao ? "🔄 Reanálise" : "⏳ Pendente"}
                                </span>
                              )}
                              {docStatus.docRepresentanteFrente.status === "RECUSADO" && (
                                <span className="admin-doc-tag-danger">❌ Recusado</span>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {emp.motivoRejeicao && (
                        <div className="admin-pj-card__rejection">
                          <strong>Parecer de Recusa Registrado:</strong> {emp.motivoRejeicao}
                        </div>
                      )}

                      <div className="admin-pj-card__actions">
                        {hasTrocaPendente && (
                          <button
                            type="button"
                            className="button button--secondary button--small admin-btn-highlight"
                            onClick={() => {
                              setAuditRepModal(emp);
                              setAuditRepDocKind("PODERES");
                            }}
                          >
                            🔄 Auditar Troca de Representante
                          </button>
                        )}
                        {emp.estado !== "APROVADA" && (
                          <button
                            type="button"
                            className="button button--primary button--small"
                            onClick={() => handleApproveCompany(emp)}
                          >
                            ✅ Aprovar Empresa
                          </button>
                        )}
                        {emp.estado !== "REJEITADA" && (
                          <button
                            type="button"
                            className="button button--outline button--small admin-btn-danger"
                            onClick={() => {
                              setRejectCompanyTarget(emp);
                              setRejectCompanyReason(emp.motivoRejeicao || "");
                            }}
                          >
                            ❌ Recusar Empresa
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* ABA 2: MODERAÇÃO DE ANÚNCIOS E LOTES                              */}
        {/* ================================================================= */}
        {activeTab === "ANUNCIOS" && (
          <section className="admin-panel-section" aria-label="Moderação de Anúncios">
            <div className="admin-panel-header">
              <div>
                <h2>Moderação de Lotes e Anúncios do Mercado</h2>
                <p>
                  Audite anúncios publicados, aplique pausa impositiva para correção de dados ou
                  libere lotes que já foram retificados pelos vendedores.
                </p>
              </div>

              <div className="admin-search-bar">
                <Icon name="search" />
                <input
                  type="search"
                  value={adSearch}
                  onChange={(e) => setAdSearch(e.target.value)}
                  placeholder="Buscar por título, ID do lote ou fazenda..."
                />
              </div>
            </div>

            <div className="admin-filter-pills" role="tablist" style={{ marginBottom: "1.25rem" }}>
              {(
                [
                  { id: "TODOS", label: `Todos (${anuncios.length})` },
                  {
                    id: "ATIVO",
                    label: `● Ativos (${anuncios.filter((a) => a.status === "ATIVO").length})`,
                  },
                  {
                    id: "PAUSADO_MODERACAO",
                    label: `⏸ Pausados Moderação (${
                      anuncios.filter((a) => a.status === "PAUSADO_MODERACAO").length
                    })`,
                  },
                  {
                    id: "EM_REVISAO",
                    label: `⏳ Em Revisão (${
                      anuncios.filter((a) => a.status === "EM_REVISAO").length
                    })`,
                  },
                  {
                    id: "BLOQUEADO_MODERACAO",
                    label: `🚫 Bloqueados (${
                      anuncios.filter((a) => a.status === "BLOQUEADO_MODERACAO").length
                    })`,
                  },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  className={`admin-pill ${adFilter === pill.id ? "is-active" : ""}`}
                  onClick={() => setAdFilter(pill.id)}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="admin-ads-list">
              {anunciosFiltrados.length === 0 ? (
                <div className="admin-empty-state">
                  <p>Nenhum anúncio encontrado para este filtro.</p>
                </div>
              ) : (
                anunciosFiltrados.map((ad) => {
                const cover = obterFotoCapa(ad);
                return (
                  <article key={ad.id} className="admin-ad-row">
                    <img src={cover} alt={ad.titulo} className="admin-ad-row__thumb" loading="lazy" />

                    <div className="admin-ad-row__body">
                      <div className="admin-ad-row__top">
                        <span className="admin-tag">
                          {ad.categoria === "GRAOS" ? "🌾 Grãos / Café" : "🐂 Pecuária"}
                        </span>
                        <code className="admin-code-id">ID: {ad.id}</code>
                        <span
                          className={`admin-badge ${
                            ad.status === "ATIVO"
                              ? "admin-badge--success"
                              : ad.status === "EM_REVISAO"
                              ? "admin-badge--info"
                              : ad.status === "PAUSADO_MODERACAO"
                              ? "admin-badge--warning"
                              : ad.status === "BLOQUEADO_MODERACAO"
                              ? "admin-badge--danger"
                              : "admin-badge--neutral"
                          }`}
                        >
                          {ad.status === "ATIVO"
                            ? "● Ativo no Mercado"
                            : ad.status === "PAUSADO"
                            ? "⏸ Pausado pelo Vendedor"
                            : ad.status === "PAUSADO_MODERACAO"
                            ? "⏸ Pausado pela Moderação"
                            : ad.status === "EM_REVISAO"
                            ? "⏳ Corrigido — Aguardando Liberação"
                            : "🚫 Bloqueado (Soft Delete)"}
                        </span>
                      </div>

                      <h3 className="admin-ad-row__title">{ad.titulo}</h3>

                      <p className="admin-ad-row__meta">
                        <strong>Fazenda:</strong> {ad.farmName} ({ad.vendedorNome}) ·{" "}
                        <strong>Local:</strong> {ad.cidade}/{ad.uf} ·{" "}
                        <strong>Valor Total:</strong>{" "}
                        {ad.precoTotal.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </p>

                      {ad.motivoModeracao && (
                        <div className="admin-ad-row__reason">
                          <strong>Apontamento da Moderação:</strong> {ad.motivoModeracao}
                        </div>
                      )}
                    </div>

                    <div className="admin-ad-row__actions">
                      <Link
                        to={`/anuncios/${ad.id}`}
                        className="button button--ghost button--small"
                      >
                        👁️ Auditar Ficha
                      </Link>

                      {(ad.status === "EM_REVISAO" ||
                        ad.status === "PAUSADO_MODERACAO" ||
                        ad.status === "BLOQUEADO_MODERACAO") && (
                        <button
                          type="button"
                          className="button button--primary button--small"
                          onClick={() => handleReleaseAd(ad)}
                        >
                          ✅ Liberar Anúncio
                        </button>
                      )}

                      {ad.status !== "PAUSADO_MODERACAO" &&
                        ad.status !== "BLOQUEADO_MODERACAO" && (
                          <button
                            type="button"
                            className="button button--outline button--small"
                            onClick={() => {
                              setAdModerationModal({ ad, mode: "PAUSE" });
                              setAdModerationReason(ad.motivoModeracao || "");
                            }}
                          >
                            ⏸ Pausar por Moderação
                          </button>
                        )}

                      {ad.status !== "BLOQUEADO_MODERACAO" && (
                        <button
                          type="button"
                          className="button button--outline button--small admin-btn-danger"
                          onClick={() => {
                            setAdModerationModal({ ad, mode: "BLOCK" });
                            setAdModerationReason("");
                          }}
                        >
                          🚫 Bloquear em Definitivo
                        </button>
                      )}
                    </div>
                  </article>
                );
              }))}
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* ABA 3: GOVERNANÇA DE PRODUTORES E VENDEDORES                      */}
        {/* ================================================================= */}
        {activeTab === "PRODUTORES" && (
          <section className="admin-panel-section" aria-label="Governança de Produtores">
            <div className="admin-panel-header">
              <div>
                <h2>Governança de Produtores e Vendedores</h2>
                <p>
                  Gerencie a esteira de auditoria interna cadastral, aplique medidas disciplinares
                  preventivas ou analise contestações com ampla defesa.
                </p>
              </div>
            </div>

            {/* Seletor de Tipo de Entidade (Superior) */}
            <div className="admin-producer-type-bar" role="tablist" aria-label="Segmento de vendedor">
              <button
                type="button"
                className={`admin-type-btn ${producerTypeFilter === "TODOS" ? "is-active" : ""}`}
                onClick={() => setProducerTypeFilter("TODOS")}
              >
                Todos os Vendedores ({produtores.length})
              </button>
              <button
                type="button"
                className={`admin-type-btn ${producerTypeFilter === "PF" ? "is-active" : ""}`}
                onClick={() => setProducerTypeFilter("PF")}
              >
                🌾 Produtores PF ({produtores.filter((p) => p.tipoDocumento === "CPF").length})
              </button>
              <button
                type="button"
                className={`admin-type-btn ${producerTypeFilter === "PJ" ? "is-active" : ""}`}
                onClick={() => setProducerTypeFilter("PJ")}
              >
                🏢 Empresas PJ ({produtores.filter((p) => p.tipoDocumento === "CNPJ").length})
              </button>
            </div>

            {/* Pílulas de Filtro Rápido e Fila de Auditoria */}
            {(() => {
              const baseProdutores =
                producerTypeFilter === "TODOS"
                  ? produtores
                  : producerTypeFilter === "PF"
                  ? produtores.filter((p) => p.tipoDocumento === "CPF")
                  : produtores.filter((p) => p.tipoDocumento === "CNPJ");

              const pills = [
                { id: "TODOS" as const, label: `Todos (${baseProdutores.length})` },
                {
                  id: "PENDENTE_AUDITORIA" as const,
                  label: `🔍 Pendentes de Checagem (${
                    baseProdutores.filter((p) => !p.revisadoPeloAdmin).length
                  })`,
                },
                {
                  id: "REANALISE_DOCS" as const,
                  label: `🔄 Reanálise de Documentos (${
                    baseProdutores.filter((p) => {
                      if (!p.documentosStatus) return false;
                      return Object.values(p.documentosStatus).some(
                        (d) => d?.status === "EM_REANALISE"
                      );
                    }).length
                  })`,
                },
                {
                  id: "AUDITADO" as const,
                  label: `👁️ Já Checados (${
                    baseProdutores.filter((p) => Boolean(p.revisadoPeloAdmin)).length
                  })`,
                },
                {
                  id: "HABILITADO" as const,
                  label: `● Ativos (${
                    baseProdutores.filter((p) => p.estado === "HABILITADO").length
                  })`,
                },
                {
                  id: "SUSPENSO" as const,
                  label: `⏸ Suspensos (${
                    baseProdutores.filter((p) => p.estado === "SUSPENSO").length
                  })`,
                },
                {
                  id: "BANIDO" as const,
                  label: `🚫 Banidos (${
                    baseProdutores.filter((p) => p.estado === "BANIDO").length
                  })`,
                },
                {
                  id: "COM_CONTESTACAO" as const,
                  label: `⚠️ Com Contestação (${
                    baseProdutores.filter((p) => p.contestacaoPendente).length
                  })`,
                },
              ];

              return (
                <div className="admin-filter-pills" role="tablist" style={{ marginBottom: "1.25rem" }}>
                  {pills.map((pill) => (
                    <button
                      key={pill.id}
                      type="button"
                      className={`admin-pill ${producerFilter === pill.id ? "is-active" : ""}`}
                      onClick={() => setProducerFilter(pill.id)}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              );
            })()}

            <div className="admin-table-wrapper">
              <table className="admin-producers-table">
                <thead>
                  <tr>
                    <th>Produtor / Fazenda</th>
                    <th>CPF / CNPJ</th>
                    <th>Localização</th>
                    <th>Entrada</th>
                    <th>Status da Conta</th>
                    <th>Ações de Governança</th>
                  </tr>
                </thead>
                <tbody>
                  {produtoresFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-empty-row">
                        Nenhum produtor ou vendedor encontrado para este filtro.
                      </td>
                    </tr>
                  ) : (
                    produtoresFiltrados.map((prod) => (
                      <tr key={prod.id}>
                      <td>
                        <div className="admin-producer-cell">
                          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.35rem" }}>
                            <strong>{prod.nome}</strong>
                            {prod.revisadoPeloAdmin ? (
                              <span
                                className="admin-audit-badge admin-audit-badge--checked"
                                title={`Revisado por ${prod.auditadoPor || "Auditor"} em ${formatDateShortBR(prod.auditadoEm)}`}
                              >
                                👁️ Revisado
                              </span>
                            ) : (
                              <span
                                className="admin-audit-badge admin-audit-badge--pending"
                                title="Pendente de triagem e checagem cadastral do auditor"
                              >
                                🔍 Pendente
                              </span>
                            )}
                          </div>
                          <span>{prod.farmName}</span>
                          <small>{prod.email}</small>
                        </div>
                      </td>
                      <td>
                        <span className="admin-tag">{prod.tipoDocumento}</span>{" "}
                        <code>{prod.documento}</code>
                      </td>
                      <td>
                        {prod.cidade}/{prod.uf}
                      </td>
                      <td>{formatDateShortBR(prod.dataEntrada)}</td>
                      <td>
                        <div className="admin-producer-status-col">
                          <span
                            className={`admin-badge ${
                              prod.estado === "HABILITADO"
                                ? "admin-badge--success"
                                : prod.estado === "SUSPENSO"
                                ? "admin-badge--warning"
                                : "admin-badge--danger"
                            }`}
                          >
                            {prod.estado === "HABILITADO"
                              ? "● Habilitado"
                              : prod.estado === "SUSPENSO"
                              ? "⏸ Suspenso"
                              : "🚫 Banido"}
                          </span>

                          {prod.estado === "SUSPENSO" && (
                            <small className="admin-producer-countdown">
                              {getRemainingDaysBadge(prod.suspensoAte)}
                            </small>
                          )}

                          {prod.contestacaoPendente && (
                            <button
                              type="button"
                              className="admin-appeal-alert-pill"
                              onClick={() => {
                                setAppealEvalTarget(prod);
                                setAppealAdminReply("");
                              }}
                            >
                              ⚠️ Contestação Aberta (Avaliar)
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="admin-producer-actions">
                          <button
                            type="button"
                            className="button button--secondary button--small admin-btn-inspect"
                            onClick={() => {
                              setInspectProducerTarget(prod);
                              setAuditNotesDraft(prod.observacoesAuditoria || "");
                            }}
                          >
                            👁️ Consultar Ficha
                          </button>

                          {/* Condicional estrita de botões conforme Status */}
                          {prod.estado === "HABILITADO" && (
                            <>
                              <button
                                type="button"
                                className="button button--outline button--small"
                                onClick={() => {
                                  setSuspendProducerTarget(prod);
                                  setSuspendReason("");
                                  setSuspendDuration(15);
                                }}
                              >
                                ⏸ Suspender Vendedor
                              </button>
                              <button
                                type="button"
                                className="button button--outline button--small admin-btn-danger"
                                onClick={() => {
                                  setBanProducerTarget(prod);
                                  setBanReason("");
                                }}
                              >
                                🚫 Banir
                              </button>
                            </>
                          )}

                          {prod.estado === "SUSPENSO" && (
                            <>
                              <button
                                type="button"
                                className="button button--primary button--small"
                                onClick={() => handleReactivateProducerImmediate(prod)}
                              >
                                ▶ Reativar Imediatamente
                              </button>
                              <button
                                type="button"
                                className="button button--outline button--small admin-btn-danger"
                                onClick={() => {
                                  setBanProducerTarget(prod);
                                  setBanReason("");
                                }}
                              >
                                🚫 Banir
                              </button>
                            </>
                          )}

                          {prod.estado === "BANIDO" && (
                            <button
                              type="button"
                              className="button button--secondary button--small"
                              onClick={() => setHistoryTarget(prod)}
                            >
                              📄 Ver Histórico da Punição
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* =================================================================== */}
      {/* MODAL 1: VISUALIZADOR DE DOSSIÊ DOCUMENTAL PJ (LEITOR REAL + DEMO)  */}
      {/* =================================================================== */}
      {dossierModal && (() => {
        const { empresa, activeDoc } = dossierModal;
        const docMap: Record<
          DossierDocKind,
          "contratoSocial" | "cartaoCnpj" | "docRepresentanteFrente" | "docRepresentanteVerso"
        > = {
          CONTRATO: "contratoSocial",
          CNPJ: "cartaoCnpj",
          REP_FRENTE: "docRepresentanteFrente",
          REP_VERSO: "docRepresentanteVerso",
        };
        const docStatus = obterStatusDocumentosEmpresa(empresa);
        const currentMeta = docStatus[docMap[activeDoc]];

        const docs = [
          { id: "CONTRATO" as DossierDocKind, label: "Contrato / Estatuto", file: empresa.documentos.contratoSocialNome, icon: "file" as const },
          { id: "CNPJ" as DossierDocKind, label: "Cartão CNPJ", file: empresa.documentos.cartaoCnpjNome, icon: "file" as const },
          { id: "REP_FRENTE" as DossierDocKind, label: "Identidade (Frente)", file: empresa.documentos.docRepresentanteFrente, icon: "user" as const },
          { id: "REP_VERSO" as DossierDocKind, label: "Identidade (Verso)", file: empresa.documentos.docRepresentanteVerso, icon: "user" as const },
        ];
        const currentDoc = docs.find((d) => d.id === activeDoc) || docs[0];
        const realFileUrl = realDocUrls[activeDoc];
        const isPdf = currentDoc.file.toLowerCase().endsWith(".pdf");

        const handleDownload = () => {
          if (realFileUrl) {
            const a = document.createElement("a");
            a.href = realFileUrl;
            a.download = currentDoc.file;
            a.click();
          } else {
            const blob = new Blob(
              [
                `SafraDireta - Cópia Autenticada\nArquivo: ${currentDoc.file}\nEmpresa: ${empresa.razaoSocial}\nCNPJ: ${empresa.cnpj}`,
              ],
              { type: "text/plain;charset=utf-8" }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = currentDoc.file;
            a.click();
            URL.revokeObjectURL(url);
          }
        };

        return (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dossier-modal-title"
            onClick={() => setDossierModal(null)}
          >
            <div
              className="modal-card admin-modal-card admin-dossier-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="admin-dossier-header">
                <div>
                  <span className="admin-tag">INSPEÇÃO DOCUMENTAL • COMPLIANCE B2B</span>
                  <h3 id="dossier-modal-title">Dossiê: {empresa.razaoSocial}</h3>
                  <p className="admin-dossier-meta">
                    <strong>CNPJ:</strong> {empresa.cnpj} · <strong>Responsável:</strong>{" "}
                    {empresa.representante.nome} ({empresa.representante.vinculo})
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setDossierModal(null)}
                  aria-label="Fechar modal"
                >
                  <Icon name="close" />
                </button>
              </div>

              {/* Abas */}
              <div className="admin-dossier-tabs" role="tablist">
                {docs.map((doc) => {
                  const meta = docStatus[docMap[doc.id]];
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      className={`admin-dossier-tab ${doc.id === activeDoc ? "is-active" : ""}`}
                      onClick={() => {
                        setDossierModal((prev) => (prev ? { ...prev, activeDoc: doc.id } : null));
                        setDocZoom(1);
                        setDocRotation(0);
                      }}
                      role="tab"
                      aria-selected={doc.id === activeDoc}
                    >
                      <Icon name={doc.icon} />
                      <span>{doc.label}</span>
                      {meta.status === "EM_REANALISE" && (
                        <span className="admin-doc-tag-warning">
                          {meta.isNovaVersao ? "🔄 Reanálise" : "⏳ Pendente"}
                        </span>
                      )}
                      {meta.status === "RECUSADO" && (
                        <span className="admin-doc-tag-danger">❌</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Toolbar */}
              <div className="admin-dossier-toolbar">
                <div className="admin-dossier-toolbar__left">
                  <span className="admin-doc-badge">{isPdf ? "PDF" : "IMAGEM"}</span>
                  <code className="admin-doc-filename">{currentDoc.file}</code>
                  {realFileUrl && (
                    <span className="admin-real-badge">● Arquivo Real (IndexedDB)</span>
                  )}
                  {currentMeta.status === "VALIDADO" && (
                    <span className="admin-badge admin-badge--success">✅ Homologado</span>
                  )}
                  {currentMeta.status === "EM_REANALISE" && (
                    <span className="admin-badge admin-badge--warning">
                      {currentMeta.isNovaVersao
                        ? "🔄 Nova Versão em Reanálise"
                        : "⏳ Aguardando Homologação"}
                    </span>
                  )}
                  {currentMeta.status === "RECUSADO" && (
                    <span className="admin-badge admin-badge--danger">❌ Recusado</span>
                  )}
                </div>

                <div className="admin-dossier-toolbar__right">
                  {(currentMeta.status === "EM_REANALISE" || currentMeta.isNovaVersao) && (
                    <div style={{ display: "flex", gap: "0.4rem", marginRight: "0.5rem" }}>
                      <button
                        type="button"
                        className="button button--primary button--small"
                        onClick={() => handleHomologarDoc(empresa.id, activeDoc)}
                      >
                        ✅ Homologar Doc
                      </button>
                      <button
                        type="button"
                        className="button button--outline button--small admin-btn-danger"
                        onClick={() => {
                          setRejectDocPrompt({
                            empresaId: empresa.id,
                            tipoDoc: docMap[activeDoc],
                            docLabel: currentDoc.label,
                          });
                          setRejectDocReason("");
                        }}
                      >
                        ❌ Recusar Doc
                      </button>
                    </div>
                  )}

                  {(!realFileUrl || !isPdf) && (
                    <>
                      <button
                        type="button"
                        className="button button--secondary button--small admin-tool-btn"
                        onClick={() =>
                          setDocZoom((z) => Math.max(0.6, Number((z - 0.2).toFixed(1))))
                        }
                        disabled={docZoom <= 0.6}
                        title="Diminuir zoom"
                      >
                        🔍 −
                      </button>
                      <span className="admin-tool-zoom">{Math.round(docZoom * 100)}%</span>
                      <button
                        type="button"
                        className="button button--secondary button--small admin-tool-btn"
                        onClick={() =>
                          setDocZoom((z) => Math.min(2.5, Number((z + 0.2).toFixed(1))))
                        }
                        disabled={docZoom >= 2.5}
                        title="Aumentar zoom"
                      >
                        🔍 +
                      </button>
                      <button
                        type="button"
                        className="button button--secondary button--small admin-tool-btn"
                        onClick={() => setDocRotation((r) => (r + 90) % 360)}
                        title="Girar 90 graus"
                      >
                        🔄 Girar
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="button button--outline button--small admin-download-btn"
                    onClick={handleDownload}
                    title="Baixar arquivo"
                  >
                    ⬇️ Baixar Cópia
                  </button>
                </div>
              </div>

              {currentMeta.status === "RECUSADO" && currentMeta.motivoRecusa && (
                <div className="admin-doc-refusal-alert">
                  <strong>⚠️ Parecer de Recusa Registrado para este Documento:</strong>
                  <p>{currentMeta.motivoRecusa}</p>
                </div>
              )}

              {/* Viewport */}
              <div className="admin-dossier-viewport">
                {realFileUrl ? (
                  isPdf ? (
                    <iframe
                      src={realFileUrl}
                      title={currentDoc.label}
                      className="admin-doc-real-iframe"
                      width="100%"
                      height="560px"
                    />
                  ) : (
                    <div
                      className="admin-doc-real-img-container"
                      style={{
                        transform: `scale(${docZoom}) rotate(${docRotation}deg)`,
                        transformOrigin: "center center",
                        transition: "transform 0.15s ease",
                      }}
                    >
                      <img
                        src={realFileUrl}
                        alt={currentDoc.label}
                        className="admin-doc-real-img"
                      />
                    </div>
                  )
                ) : (
                  <div className="admin-doc-error-card">
                    <span className="admin-doc-error-icon">⚠️</span>
                    <h4>Arquivo Binário Não Localizado</h4>
                    <p>
                      O arquivo deste documento (<code>{currentDoc.file}</code>) não foi localizado no armazenamento local (IndexedDB).
                      Para garantir a conformidade cadastral e evitar documentos simulados, recuse o documento solicitando o reenvio pelo representante.
                    </p>
                    <div className="admin-doc-error-actions">
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => setDossierModal(null)}
                      >
                        Fechar Visualizador
                      </button>
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => {
                          setRejectDocPrompt({
                            empresaId: empresa.id,
                            tipoDoc: docMap[activeDoc],
                            docLabel: currentDoc.label,
                          });
                          setRejectDocReason("");
                        }}
                      >
                        ✕ Recusar Documento e Solicitar Reenvio
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé de Ações */}
              <div className="admin-dossier-footer">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setDossierModal(null)}
                >
                  Fechar Visualizador
                </button>
                <div className="admin-dossier-footer__actions">
                  {empresa.estado !== "REJEITADA" && (
                    <button
                      type="button"
                      className="button button--outline admin-btn-danger"
                      onClick={() => {
                        const target = empresa;
                        setDossierModal(null);
                        setRejectCompanyTarget(target);
                        setRejectCompanyReason(target.motivoRejeicao || "");
                      }}
                    >
                      ❌ Recusar Empresa
                    </button>
                  )}
                  {empresa.estado !== "APROVADA" && (
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => {
                        handleApproveCompany(empresa);
                        setDossierModal(null);
                      }}
                    >
                      ✅ Aprovar Empresa
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =================================================================== */}
      {/* MODAL 2: RECUSAR EMPRESA PJ                                         */}
      {/* =================================================================== */}
      {rejectCompanyTarget && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setRejectCompanyTarget(null)}
        >
          <form
            className="modal-card admin-modal-card"
            onSubmit={handleConfirmRejectCompany}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-card__header">
              <h3>❌ Recusar Cadastro Corporativo</h3>
            </div>
            <p className="modal-card__body">
              Informe o motivo técnico ou documental para recusar a empresa{" "}
              <strong>{rejectCompanyTarget.razaoSocial}</strong>:
            </p>
            <div className="field">
              <label htmlFor="reject-company-reason">Motivo da Recusa (Obrigatório)</label>
              <textarea
                id="reject-company-reason"
                rows={4}
                value={rejectCompanyReason}
                onChange={(e) => setRejectCompanyReason(e.target.value)}
                placeholder="Ex: Contrato social ilegível ou ausência de procuração do representante legal..."
                required
              />
            </div>
            <div className="modal-card__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setRejectCompanyTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button button--primary admin-btn-danger-solid"
                disabled={rejectCompanyReason.trim().length < 10}
              >
                Confirmar Recusa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2.1: RECUSAR DOCUMENTO INDIVIDUAL                             */}
      {/* =================================================================== */}
      {rejectDocPrompt && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setRejectDocPrompt(null)}
        >
          <form
            className="modal-card admin-modal-card"
            onSubmit={handleConfirmRecusarDoc}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "560px" }}
          >
            <div className="modal-card__header">
              <h3>❌ Recusar Documento: {rejectDocPrompt.docLabel}</h3>
            </div>
            <p className="modal-card__body">
              Informe o parecer técnico para recusa deste documento. A justificativa ficará
              visível para a empresa no perfil para reenvio do arquivo corrigido:
            </p>
            <div className="field">
              <label htmlFor="reject-doc-reason">Motivo da Recusa (Obrigatório)</label>
              <textarea
                id="reject-doc-reason"
                rows={4}
                value={rejectDocReason}
                onChange={(e) => setRejectDocReason(e.target.value)}
                placeholder="Ex: Documento com resolução ilegível, corte de assinaturas ou certidão vencida..."
                required
                autoFocus
              />
            </div>
            <div className="modal-card__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setRejectDocPrompt(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button button--primary admin-btn-danger-solid"
                disabled={rejectDocReason.trim().length < 5}
              >
                Confirmar Recusa do Documento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2.2: AUDITORIA DE TROCA DE REPRESENTANTE LEGAL                */}
      {/* =================================================================== */}
      {auditRepModal && auditRepModal.solicitacaoTrocaRepresentante && (() => {
        const req = auditRepModal.solicitacaoTrocaRepresentante;
        const realFileUrl = auditRepUrls[auditRepDocKind];
        const docNames = {
          PODERES: req.documentos.comprovacaoPoderesNome,
          FRENTE: req.documentos.docFrenteNome,
          VERSO: req.documentos.docVersoNome,
        };
        const currentFileName = docNames[auditRepDocKind];
        const isPdf = currentFileName.toLowerCase().endsWith(".pdf");

        const handleDownloadAuditDoc = () => {
          if (realFileUrl) {
            const a = document.createElement("a");
            a.href = realFileUrl;
            a.download = currentFileName;
            a.click();
          } else {
            const blob = new Blob(
              [
                `SafraDireta - Auditoria de Troca de Representante\nArquivo: ${currentFileName}\nEmpresa: ${auditRepModal.razaoSocial}\nCNPJ: ${auditRepModal.cnpj}\nNovo Representante: ${req.novoRepresentante.nome}`,
              ],
              { type: "text/plain;charset=utf-8" }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = currentFileName;
            a.click();
            URL.revokeObjectURL(url);
          }
        };

        return (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              setAuditRepModal(null);
              setShowRejectRepPrompt(false);
            }}
          >
            <div
              className="modal-card admin-modal-card admin-dossier-modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "940px", width: "95vw" }}
            >
              {/* Header */}
              <div className="admin-dossier-header">
                <div>
                  <div className="admin-dossier-header__badge-row">
                    <span className="admin-tag">GOVERNANÇA • AUDITORIA DE REPRESENTAÇÃO</span>
                    <span className="admin-badge admin-badge--warning">
                      ⏳ Homologação Solicitada
                    </span>
                  </div>
                  <h3>Troca de Representante: {auditRepModal.razaoSocial}</h3>
                  <p className="admin-dossier-meta">
                    <strong>CNPJ:</strong> {auditRepModal.cnpj} · <strong>Protocolado em:</strong>{" "}
                    {formatDateTimeBR(req.solicitadoEm)}
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    setAuditRepModal(null);
                    setShowRejectRepPrompt(false);
                  }}
                  aria-label="Fechar"
                >
                  <Icon name="close" />
                </button>
              </div>

              {/* Comparativo Lado a Lado */}
              <div className="admin-rep-comparison">
                <div className="admin-rep-box admin-rep-box--current">
                  <h4>👤 Representante Atual (Vigente)</h4>
                  <p>
                    <strong>Nome:</strong> {req.representanteAtual.nome}
                  </p>
                  <p>
                    <strong>CPF:</strong> {req.representanteAtual.cpf}
                  </p>
                  <p>
                    <strong>Vínculo Societário:</strong> {req.representanteAtual.vinculo}
                  </p>
                  <span className="admin-badge">Vigente no Cadastro</span>
                </div>

                <div className="admin-rep-comparison__arrow">➔</div>

                <div className="admin-rep-box admin-rep-box--proposed">
                  <h4>👤 Novo Representante Indicado</h4>
                  <p>
                    <strong>Nome:</strong> {req.novoRepresentante.nome}
                  </p>
                  <p>
                    <strong>CPF:</strong> {req.novoRepresentante.cpf}
                  </p>
                  <p>
                    <strong>Vínculo Societário:</strong> {req.novoRepresentante.vinculo}
                  </p>
                  <span className="admin-badge admin-badge--warning">
                    Aguardando Homologação
                  </span>
                </div>
              </div>

              {/* Abas de Inspeção dos Documentos do Novo Representante */}
              <div className="admin-dossier-tabs" role="tablist">
                <button
                  type="button"
                  className={`admin-dossier-tab ${
                    auditRepDocKind === "PODERES" ? "is-active" : ""
                  }`}
                  onClick={() => setAuditRepDocKind("PODERES")}
                >
                  <Icon name="file" />
                  <span>📜 Comprovação de Poderes ({req.documentos.comprovacaoPoderesNome})</span>
                </button>

                <button
                  type="button"
                  className={`admin-dossier-tab ${
                    auditRepDocKind === "FRENTE" ? "is-active" : ""
                  }`}
                  onClick={() => setAuditRepDocKind("FRENTE")}
                >
                  <Icon name="user" />
                  <span>🪪 CNH/RG Frente ({req.documentos.docFrenteNome})</span>
                </button>

                <button
                  type="button"
                  className={`admin-dossier-tab ${
                    auditRepDocKind === "VERSO" ? "is-active" : ""
                  }`}
                  onClick={() => setAuditRepDocKind("VERSO")}
                >
                  <Icon name="user" />
                  <span>🪪 CNH/RG Verso ({req.documentos.docVersoNome})</span>
                </button>
              </div>

              {/* Toolbar */}
              <div className="admin-dossier-toolbar">
                <div className="admin-dossier-toolbar__left">
                  <span className="admin-doc-badge">{isPdf ? "PDF" : "IMAGEM"}</span>
                  <code className="admin-doc-filename">{currentFileName}</code>
                  {realFileUrl ? (
                    <span className="admin-real-badge">● Arquivo Real (IndexedDB)</span>
                  ) : (
                    <span className="admin-tag">Documento de Teste</span>
                  )}
                </div>

                <div className="admin-dossier-toolbar__right">
                  <button
                    type="button"
                    className="button button--outline button--small admin-download-btn"
                    onClick={handleDownloadAuditDoc}
                  >
                    ⬇️ Baixar Cópia
                  </button>
                </div>
              </div>

              {/* Viewport */}
              <div className="admin-dossier-viewport" style={{ maxHeight: "440px" }}>
                {realFileUrl ? (
                  isPdf ? (
                    <iframe
                      src={realFileUrl}
                      title={currentFileName}
                      className="admin-doc-real-iframe"
                      width="100%"
                      height="440px"
                    />
                  ) : (
                    <div className="admin-doc-real-img-container">
                      <img
                        src={realFileUrl}
                        alt={currentFileName}
                        className="admin-doc-real-img"
                      />
                    </div>
                  )
                ) : (
                  <div className="admin-doc-error-card">
                    <span className="admin-doc-error-icon">⚠️</span>
                    <h4>Arquivo Binário Não Localizado</h4>
                    <p>
                      O arquivo comprobatório (<code>{currentFileName}</code>) não foi localizado no armazenamento local (IndexedDB).
                    </p>
                    <div className="admin-doc-error-actions">
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => {
                          setAuditRepModal(null);
                          setShowRejectRepPrompt(false);
                        }}
                      >
                        Fechar
                      </button>
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => setShowRejectRepPrompt(true)}
                      >
                        ✕ Indeferir Solicitação de Troca
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Formulário de Indeferimento caso ativado */}
              {showRejectRepPrompt ? (
                <form
                  onSubmit={handleConfirmIndeferirTrocaRep}
                  style={{
                    padding: "1rem 1.5rem",
                    background: "#fef2f2",
                    borderTop: "1px solid #fecaca",
                  }}
                >
                  <label
                    htmlFor="indeferir-rep-reason"
                    style={{
                      fontWeight: 600,
                      color: "#991b1b",
                      display: "block",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Motivo do Indeferimento (Mínimo 10 caracteres):
                  </label>
                  <textarea
                    id="indeferir-rep-reason"
                    rows={3}
                    value={repDecisionReason}
                    onChange={(e) => setRepDecisionReason(e.target.value)}
                    placeholder="Ex: A ata de eleição anexada está com mandato vencido ou sem carimbo de arquivamento da junta..."
                    required
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "6px",
                      border: "1px solid #f87171",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "0.5rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => setShowRejectRepPrompt(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="button button--primary button--small admin-btn-danger-solid"
                      disabled={repDecisionReason.trim().length < 10}
                    >
                      Confirmar Indeferimento
                    </button>
                  </div>
                </form>
              ) : (
                /* Rodapé com Ações do Auditor */
                <div className="admin-dossier-footer">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => {
                      setAuditRepModal(null);
                      setShowRejectRepPrompt(false);
                    }}
                  >
                    Fechar
                  </button>

                  <div className="admin-dossier-footer__actions">
                    <button
                      type="button"
                      className="button button--outline admin-btn-danger"
                      onClick={() => setShowRejectRepPrompt(true)}
                    >
                      ❌ Indeferir Troca
                    </button>
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => handleHomologarTrocaRep(auditRepModal.id)}
                    >
                      ✅ Homologar Novo Representante
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {adModerationModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setAdModerationModal(null)}
        >
          <form
            className="modal-card admin-modal-card"
            onSubmit={handleConfirmAdModeration}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-card__header">
              <h3>
                {adModerationModal.mode === "PAUSE"
                  ? "⏸ Pausar Lote por Moderação"
                  : "🚫 Bloquear Anúncio em Definitivo"}
              </h3>
            </div>
            <p className="modal-card__body">
              {adModerationModal.mode === "PAUSE" ? (
                <>
                  O lote <strong>{adModerationModal.ad.titulo}</strong> sairá imediatamente do
                  Mercado público. O produtor verá o motivo abaixo e poderá editar o anúncio para
                  solicitar nova revisão.
                </>
              ) : (
                <>
                  O lote <strong>{adModerationModal.ad.titulo}</strong> será ocultado em definitivo (
                  <em>Soft Delete</em>) e preservado apenas para auditoria interna.
                </>
              )}
            </p>
            <div className="field">
              <label htmlFor="ad-mod-reason">Justificativa da Moderação (Obrigatória)</label>
              <textarea
                id="ad-mod-reason"
                rows={4}
                value={adModerationReason}
                onChange={(e) => setAdModerationReason(e.target.value)}
                placeholder="Ex: Favor anexar foto legível do laudo de umidade / corrigir peso médio por cabeça..."
                required
              />
            </div>
            <div className="modal-card__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setAdModerationModal(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={adModerationReason.trim().length < 10}
              >
                {adModerationModal.mode === "PAUSE"
                  ? "Confirmar Pausa Moderada"
                  : "Confirmar Bloqueio Definitivo"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: SUSPENDER PRODUTOR TEMPORARIAMENTE (7, 15, 30, INDETERM.)  */}
      {/* =================================================================== */}
      {suspendProducerTarget && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setSuspendProducerTarget(null)}
        >
          <form
            className="modal-card admin-modal-card"
            onSubmit={handleConfirmSuspendProducer}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-card__header">
              <h3>⏸ Suspender Vendedor Temporariamente</h3>
            </div>
            <p className="modal-card__body">
              Ao suspender <strong>{suspendProducerTarget.nome}</strong> (
              {suspendProducerTarget.farmName}), todos os seus lotes ativos serão despublicados
              preventivamente e ele terá direito de apresentar defesa.
            </p>

            <div className="field">
              <label>Prazo de Duração da Suspensão</label>
              <div className="admin-duration-selector">
                {(
                  [
                    { value: 7, label: "7 dias" },
                    { value: 15, label: "15 dias" },
                    { value: 30, label: "30 dias" },
                    { value: "INDETERMINADO", label: "Indeterminado" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    className={`admin-duration-pill ${
                      suspendDuration === opt.value ? "is-active" : ""
                    }`}
                    onClick={() => setSuspendDuration(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="suspend-producer-reason">
                Motivo da Suspensão (Obrigatório — mínimo 10 caracteres)
              </label>
              <textarea
                id="suspend-producer-reason"
                rows={4}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Descreva a infração contratual, divergência de pesagem ou pendência sanitária..."
                required
              />
            </div>

            <div className="modal-card__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setSuspendProducerTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={suspendReason.trim().length < 10}
              >
                Aplicar Suspensão
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 5: BANIR PRODUTOR EM DEFINITIVO                               */}
      {/* =================================================================== */}
      {banProducerTarget && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setBanProducerTarget(null)}
        >
          <form
            className="modal-card admin-modal-card"
            onSubmit={handleConfirmBanProducer}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-card__header">
              <h3>🚫 Banir Produtor em Definitivo</h3>
            </div>
            <p className="modal-card__body">
              Atenção: O banimento de <strong>{banProducerTarget.nome}</strong> bloqueia
              permanentemente a conta e aplica <em>Soft Delete</em> em todos os seus anúncios para
              preservação probatória (Art. 15, Marco Civil da Internet).
            </p>
            <div className="field">
              <label htmlFor="ban-producer-reason">
                Fundamentação do Banimento Definitivo (Obrigatória)
              </label>
              <textarea
                id="ban-producer-reason"
                rows={4}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Descreva a fraude documental ou violação grave apurada..."
                required
              />
            </div>
            <div className="modal-card__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setBanProducerTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button button--primary admin-btn-danger-solid"
                disabled={banReason.trim().length < 10}
              >
                Confirmar Banimento Definitivo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 6: AVALIAR CONTESTAÇÃO / DIREITO DE RESPOSTA                  */}
      {/* =================================================================== */}
      {appealEvalTarget && appealEvalTarget.contestacao && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setAppealEvalTarget(null)}
        >
          <div className="modal-card admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <h3>⚖️ Julgamento de Contestação — {appealEvalTarget.nome}</h3>
            </div>

            <div className="admin-appeal-eval-box">
              <p>
                <strong>Punido originalmente por:</strong> {appealEvalTarget.motivoPunicao}
              </p>
              <hr />
              <p>
                <strong>Defesa enviada pelo Produtor em:</strong>{" "}
                {formatDateTimeBR(appealEvalTarget.contestacao.enviadoEm)}
              </p>
              <blockquote className="admin-appeal-quote">
                "{appealEvalTarget.contestacao.textoDefesa}"
              </blockquote>
              {appealEvalTarget.contestacao.documentoAnexoNome && (
                <p className="admin-appeal-attachment">
                  <Icon name="file" /> Documento anexado:{" "}
                  <strong>{appealEvalTarget.contestacao.documentoAnexoNome}</strong>
                </p>
              )}
            </div>

            <div className="field" style={{ marginTop: "1rem" }}>
              <label htmlFor="admin-appeal-reply">Parecer do Auditor (Opcional)</label>
              <textarea
                id="admin-appeal-reply"
                rows={3}
                value={appealAdminReply}
                onChange={(e) => setAppealAdminReply(e.target.value)}
                placeholder="Registre a fundamentação para aceitar ou indeferir o recurso..."
              />
            </div>

            <div className="modal-card__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setAppealEvalTarget(null)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="button button--outline admin-btn-danger"
                onClick={handleRejectAppeal}
              >
                Manter Suspensão
              </button>
              <button type="button" className="button button--primary" onClick={handleAcceptAppeal}>
                Aceitar e Reativar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 7: HISTÓRICO DA PUNIÇÃO (SOMENTE LEITURA PARA BANIDOS)        */}
      {/* =================================================================== */}
      {historyTarget && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setHistoryTarget(null)}
        >
          <div className="modal-card admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <h3>📄 Histórico Disciplinar e Trilha de Auditoria</h3>
            </div>
            <p className="modal-card__body">
              <strong>Produtor / Razão:</strong> {historyTarget.nome} ({historyTarget.farmName}) ·{" "}
              <strong>Documento:</strong> {historyTarget.documento}
            </p>

            <div className="admin-history-timeline">
              {historyTarget.historicoPunicoes.map((item) => (
                <div key={item.id} className="admin-history-item">
                  <div className="admin-history-item__top">
                    <span className="admin-tag">{item.tipo}</span>
                    <small>{formatDateTimeBR(item.data)}</small>
                  </div>
                  <p>{item.motivo}</p>
                  <small>Responsável: {item.autor}</small>
                </div>
              ))}
            </div>

            <div className="modal-card__actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => setHistoryTarget(null)}
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 8: FICHA CADASTRAL E AUDITORIA INTERNA DE PRODUTOR / VENDEDOR */}
      {/* =================================================================== */}
      {inspectProducerTarget && (() => {
        const ficha = obterFichaCompletaProdutor(inspectProducerTarget.id);
        if (!ficha) return null;

        const initials =
          ficha.nome
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "SD";

        return (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="producer-profile-modal-title"
            onClick={() => setInspectProducerTarget(null)}
          >
            <div
              className="modal-card admin-modal-card admin-profile-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="admin-profile-header">
                <div className="admin-profile-header__identity">
                  {ficha.avatarUrl ? (
                    <img
                      src={ficha.avatarUrl}
                      alt={ficha.nome}
                      className="admin-profile-avatar"
                    />
                  ) : (
                    <div className="admin-profile-avatar">{initials}</div>
                  )}
                  <div className="admin-profile-title">
                    <h3 id="producer-profile-modal-title">{ficha.nome}</h3>
                    <p>{ficha.farmName}</p>
                  </div>
                </div>

                <div className="admin-profile-header__badges">
                  <span className="admin-tag">{ficha.tipoDocumento}</span>
                  <span
                    className={`admin-badge ${
                      ficha.estado === "HABILITADO"
                        ? "admin-badge--success"
                        : ficha.estado === "SUSPENSO"
                        ? "admin-badge--warning"
                        : "admin-badge--danger"
                    }`}
                  >
                    {ficha.estado === "HABILITADO"
                      ? "● Habilitado"
                      : ficha.estado === "SUSPENSO"
                      ? "⏸ Suspenso"
                      : "🚫 Banido"}
                  </span>
                  <span
                    className={`admin-audit-badge ${
                      ficha.revisadoPeloAdmin
                        ? "admin-audit-badge--checked"
                        : "admin-audit-badge--pending"
                    }`}
                    style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                  >
                    {ficha.revisadoPeloAdmin ? "👁️ Revisado pelo Admin" : "🔍 Pendente de Checagem"}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setInspectProducerTarget(null)}
                    aria-label="Fechar ficha cadastral"
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </div>

              {/* Grid de Informações */}
              <div className="admin-profile-grid">
                {/* Bloco 1: Identificação Civil & Contato */}
                <div className="admin-profile-box">
                  <h4>👤 Dados Pessoais e Contato</h4>
                  <p>
                    <strong>{ficha.tipoDocumento}:</strong> <code>{ficha.documento}</code>
                  </p>
                  <p>
                    <strong>E-mail:</strong> {ficha.email}
                  </p>
                  <p>
                    <strong>Telefone / WhatsApp:</strong> {ficha.telefone}
                  </p>
                  <p>
                    <strong>Cadastro na Plataforma:</strong> {formatDateTimeBR(ficha.dataEntrada)}
                  </p>
                </div>

                {/* Bloco 2: Propriedade Rural & Logística */}
                <div className="admin-profile-box">
                  <h4>🌾 Propriedade Rural e Logística</h4>
                  <p>
                    <strong>Fazenda:</strong> {ficha.farmName}
                  </p>
                  <p>
                    <strong>Endereço:</strong> {ficha.endereco.logradouro}, {ficha.endereco.numero}
                    {ficha.endereco.complemento ? ` (${ficha.endereco.complemento})` : ""} ·{" "}
                    {ficha.endereco.bairro} · {ficha.endereco.cidade}/{ficha.endereco.uf} · CEP:{" "}
                    {ficha.endereco.cep || "—"}
                  </p>
                  <p>
                    <strong>Transporte Próprio:</strong>{" "}
                    {ficha.hasOwnTransport
                      ? "✅ Sim, possui frota / transporte próprio"
                      : "❌ Não, frete por conta do comprador / transportadora"}
                  </p>
                  {ficha.bio && (
                    <p>
                      <strong>Bio / Atividade:</strong> {ficha.bio}
                    </p>
                  )}
                  <div>
                    <strong>Culturas / Atividades:</strong>
                    <div className="admin-profile-tags">
                      {ficha.categories.map((cat, idx) => (
                        <span key={idx} className="admin-profile-tag">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bloco 3: Documentação Oficial (Isolamento Estrito PJ vs PF) */}
                {ficha.isPJ ? (
                  /* Bloco Exclusivo PJ: Dados do Representante Legal e Atalho do Dossiê PJ */
                  <div
                    className="admin-profile-box"
                    style={{
                      gridColumn: "1 / -1",
                      background: "#f0f7f4",
                      border: "1px solid #cce5d8",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                      }}
                    >
                      <div>
                        <h4 style={{ color: "#166534", margin: "0 0 0.25rem" }}>
                          🏢 Documentação e Representação Legal (Pessoa Jurídica)
                        </h4>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#2d6a4f" }}>
                          A conformidade desta conta é verificada através do Dossiê Documental PJ (Contrato Social, Cartão CNPJ e Identidade do Representante).
                        </p>
                      </div>
                      <button
                        type="button"
                        className="button button--primary button--small"
                        onClick={() => {
                          const emp = obterEmpresaPorIdOuCnpj(ficha.pjEmpresaId || ficha.documento);
                          if (emp) {
                            setDossierModal({ empresa: emp, activeDoc: "CONTRATO" });
                            setDocZoom(1);
                            setDocRotation(0);
                            setInspectProducerTarget(null);
                          } else {
                            showToast("Dossiê documental da empresa não localizado.");
                          }
                        }}
                      >
                        📄 Abrir Dossiê Documental PJ
                      </button>
                    </div>

                    {ficha.representante ? (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          paddingTop: "0.75rem",
                          borderTop: "1px solid #d8eee2",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: "0.5rem",
                          fontSize: "0.85rem",
                        }}
                      >
                        <p style={{ margin: 0 }}>
                          <strong>Representante Legal:</strong> {ficha.representante.nome}
                        </p>
                        <p style={{ margin: 0 }}>
                          <strong>CPF:</strong> {ficha.representante.cpf}
                        </p>
                        <p style={{ margin: 0 }}>
                          <strong>Vínculo Societário:</strong> {ficha.representante.vinculo}
                        </p>
                      </div>
                    ) : (
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                        Dados de representação sincronizados com o cadastro PJ.
                      </p>
                    )}
                  </div>
                ) : (
                  /* Bloco Exclusivo PF: Documentos Oficiais de Verificação (RG/CNH e CAR) */
                  <div className="admin-profile-box" style={{ gridColumn: "1 / -1" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <h4 style={{ margin: 0 }}>
                        🪪 Documentos Oficiais de Identificação e Propriedade (Pessoa Física)
                      </h4>
                      <button
                        type="button"
                        className="button button--primary button--small"
                        onClick={() => {
                          setPfDossierModal({
                            produtor: inspectProducerTarget,
                            activeDoc: "RG_FRENTE",
                          });
                          setPfDocZoom(1);
                          setPfDocRotation(0);
                        }}
                      >
                        📄 Abrir Dossiê Documental do Produtor
                      </button>
                    </div>
                    {(() => {
                      const statusDocs = obterStatusDocumentosProdutor(inspectProducerTarget);
                      const docItems: Array<{
                        tipoDoc: "rgFrente" | "rgVerso" | "car";
                        icon: string;
                        title: string;
                        doc: ProducerDocMetadata;
                        pfDocKind: PfDossierDocKind;
                      }> = [
                        {
                          tipoDoc: "rgFrente",
                          icon: "🪪",
                          title: "Documento de Identidade — Frente (RG / CNH)",
                          doc: statusDocs.rgFrente,
                          pfDocKind: "RG_FRENTE",
                        },
                        {
                          tipoDoc: "rgVerso",
                          icon: "🪪",
                          title: "Documento de Identidade — Verso (RG / CNH)",
                          doc: statusDocs.rgVerso,
                          pfDocKind: "RG_VERSO",
                        },
                        {
                          tipoDoc: "car",
                          icon: "🌾",
                          title: "Comprovante de Propriedade Rural / CAR",
                          doc: statusDocs.car,
                          pfDocKind: "CAR",
                        },
                      ];

                      return (
                        <div
                          className="admin-profile-docs-grid"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: "0.85rem",
                            marginTop: "0.5rem",
                          }}
                        >
                          {docItems.map(({ tipoDoc, icon, title, doc, pfDocKind }) => {
                            const isRecusado = doc.status === "RECUSADO";
                            const isReanalise = doc.status === "EM_REANALISE";

                            return (
                              <div
                                key={tipoDoc}
                                className={`admin-doc-item-card ${
                                  isRecusado ? "is-rejected" : isReanalise ? "is-reanalise" : ""
                                }`}
                              >
                                <div className="admin-doc-item-header">
                                  <span className="admin-doc-item-title">
                                    <span>{icon}</span> {title}
                                  </span>
                                  <span
                                    className={`profile-dossier-badge ${
                                      doc.status === "VALIDADO"
                                        ? "profile-dossier-badge--success"
                                        : isReanalise
                                        ? "profile-dossier-badge--warning"
                                        : "profile-dossier-badge--danger"
                                    }`}
                                    style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                  >
                                    {doc.status === "VALIDADO"
                                      ? "✅ Validado"
                                      : isReanalise
                                      ? "⏳ Em Reanálise"
                                      : "❌ Recusado"}
                                  </span>
                                </div>

                                <div className="admin-doc-item-meta">
                                  <code className="truncate-filename" title={doc.nome}>
                                    {doc.nome}
                                  </code>
                                  <span>· {doc.tamanhoFormatado || "Arquivo digital"}</span>
                                </div>

                                {isRecusado && doc.motivoRecusa && (
                                  <div className="admin-doc-item-rejection">
                                    <strong>Motivo da Recusa:</strong>
                                    <span>{doc.motivoRecusa}</span>
                                  </div>
                                )}

                                <div className="admin-doc-item-actions">
                                  <button
                                    type="button"
                                    className="button button--outline button--small"
                                    onClick={() => {
                                      setPfDossierModal({
                                        produtor: inspectProducerTarget,
                                        activeDoc: pfDocKind,
                                      });
                                      setPfDocZoom(1);
                                      setPfDocRotation(0);
                                    }}
                                  >
                                    <Icon name="eye" /> Visualizar
                                  </button>

                                  {doc.status !== "VALIDADO" && (
                                    <button
                                      type="button"
                                      className="button button--secondary button--small"
                                      onClick={() =>
                                        handleHomologarDocumentoProdutor(
                                          inspectProducerTarget.id,
                                          tipoDoc
                                        )
                                      }
                                    >
                                      ✅ Validar
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    className="button button--danger button--small"
                                    onClick={() => {
                                      setRejectProducerDocModal({
                                        produtorId: inspectProducerTarget.id,
                                        produtorNome: inspectProducerTarget.nome,
                                        tipoDoc,
                                        docTitle: title,
                                        fileName: doc.nome,
                                      });
                                      setRejectProducerDocReason("");
                                      setRejectProducerDocSuspend(false);
                                    }}
                                  >
                                    ✕ Recusar
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Bloco 4: Atividade Comercial no Mercado */}
                <div className="admin-profile-box">
                  <h4>📦 Atividade no Mercado</h4>
                  <div className="admin-profile-stats">
                    <div className="admin-profile-stat-card">
                      <strong>{ficha.totalAnuncios}</strong>
                      <small>Total de Lotes</small>
                    </div>
                    <div className="admin-profile-stat-card">
                      <strong style={{ color: "#166534" }}>{ficha.anunciosAtivos}</strong>
                      <small>● Ativos</small>
                    </div>
                    <div className="admin-profile-stat-card">
                      <strong style={{ color: "#92400e" }}>
                        {ficha.anunciosPausados + ficha.anunciosBloqueados}
                      </strong>
                      <small>⏸ Pausados / Mod.</small>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="button button--outline button--small button--full"
                    onClick={() => {
                      setInspectProducerTarget(null);
                      setActiveTab("ANUNCIOS");
                      setAdSearch(ficha.nome);
                    }}
                  >
                    Ver Lotes deste Vendedor no Mercado ({ficha.totalAnuncios})
                  </button>
                </div>
              </div>

              {/* Bloco 4: Auditoria Interna e Compliance */}
              <div className="admin-audit-box">
                <h4>🛡️ Auditoria Interna de Compliance (Visão Exclusiva do Administrador)</h4>
                <p className="admin-audit-meta">
                  {ficha.revisadoPeloAdmin
                    ? `Auditado e checado em ${formatDateTimeBR(ficha.auditadoEm)} por ${
                        ficha.auditadoPor || "Auditor de Governança SafraDireta"
                      }.`
                    : "⚠️ Produtor pendente de conferência cadastral na fila de triagem."}
                </p>

                <div className="field">
                  <label htmlFor="producer-audit-notes">
                    <strong>Anotações Internas do Auditor (Persistentes):</strong>
                  </label>
                  <textarea
                    id="producer-audit-notes"
                    rows={3}
                    value={auditNotesDraft}
                    onChange={(e) => setAuditNotesDraft(e.target.value)}
                    placeholder="Ex: Inscrição Estadual checada no SINTEGRA, endereço da fazenda validado, telefone confirmado..."
                  />
                </div>

                <div className="admin-audit-box__actions">
                  <button
                    type="button"
                    className="button button--secondary button--small"
                    onClick={() => handleSalvarNotasAuditoria(ficha.id)}
                    disabled={isSavingNotes}
                  >
                    {isSavingNotes ? "Salvando..." : "💾 Salvar Anotações Internas"}
                  </button>

                  <button
                    type="button"
                    className={`button button--small ${
                      ficha.revisadoPeloAdmin ? "button--outline" : "button--primary"
                    }`}
                    onClick={() => handleToggleAuditoria(ficha.id, ficha.revisadoPeloAdmin)}
                  >
                    {ficha.revisadoPeloAdmin
                      ? "↩ Desmarcar Checagem (Voltar para Pendente)"
                      : "👁️ Marcar como Checado / Conforme"}
                  </button>
                </div>
              </div>

              <div className="modal-card__actions" style={{ marginTop: "1rem" }}>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setInspectProducerTarget(null)}
                >
                  Fechar Ficha
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =================================================================== */}
      {/* MODAL 9: DOSSIÊ DOCUMENTAL UNIFICADO COM ABAS DO PRODUTOR (PF/CAR)   */}
      {/* =================================================================== */}
      {pfDossierModal && (() => {
        const { produtor, activeDoc } = pfDossierModal;
        const docMap: Record<PfDossierDocKind, "rgFrente" | "rgVerso" | "car"> = {
          RG_FRENTE: "rgFrente",
          RG_VERSO: "rgVerso",
          CAR: "car",
        };
        const statusDocs = obterStatusDocumentosProdutor(produtor);
        const currentMeta = statusDocs[docMap[activeDoc]];

        const docs = [
          {
            id: "RG_FRENTE" as PfDossierDocKind,
            label: "Identidade (Frente)",
            file: statusDocs.rgFrente.nome,
            icon: "user" as const,
          },
          {
            id: "RG_VERSO" as PfDossierDocKind,
            label: "Identidade (Verso)",
            file: statusDocs.rgVerso.nome,
            icon: "user" as const,
          },
          {
            id: "CAR" as PfDossierDocKind,
            label: "CAR / Matrícula Rural",
            file: statusDocs.car.nome,
            icon: "file" as const,
          },
        ];
        const currentDoc = docs.find((d) => d.id === activeDoc) || docs[0];
        const realFileUrl = pfDocUrls[activeDoc];
        const isPdf = currentDoc.file.toLowerCase().endsWith(".pdf");

        const handleDownloadPfDoc = () => {
          if (realFileUrl) {
            const a = document.createElement("a");
            a.href = realFileUrl;
            a.download = currentDoc.file;
            a.click();
          } else {
            const blob = new Blob(
              [
                `SafraDireta - Cópia Autenticada\nArquivo: ${currentDoc.file}\nProdutor: ${produtor.nome}\nCPF: ${produtor.documento}`,
              ],
              { type: "text/plain;charset=utf-8" }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = currentDoc.file;
            a.click();
            URL.revokeObjectURL(url);
          }
        };

        return (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pf-dossier-modal-title"
            onClick={() => setPfDossierModal(null)}
          >
            <div
              className="modal-card admin-modal-card admin-dossier-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="admin-dossier-header">
                <div>
                  <span className="admin-tag">GOVERNANÇA • DOSSIÊ DOCUMENTAL DO PRODUTOR</span>
                  <h3 id="pf-dossier-modal-title">Dossiê: {produtor.nome}</h3>
                  <p className="admin-dossier-meta">
                    <strong>CPF:</strong> {produtor.documento} · <strong>Propriedade:</strong>{" "}
                    {produtor.farmName} ({produtor.cidade}/{produtor.uf})
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setPfDossierModal(null)}
                  aria-label="Fechar modal"
                >
                  <Icon name="close" />
                </button>
              </div>

              {/* Abas */}
              <div className="admin-dossier-tabs" role="tablist">
                {docs.map((doc) => {
                  const meta = statusDocs[docMap[doc.id]];
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      className={`admin-dossier-tab ${doc.id === activeDoc ? "is-active" : ""}`}
                      onClick={() => {
                        setPfDossierModal((prev) => (prev ? { ...prev, activeDoc: doc.id } : null));
                        setPfDocZoom(1);
                        setPfDocRotation(0);
                      }}
                      role="tab"
                      aria-selected={doc.id === activeDoc}
                    >
                      <Icon name={doc.icon} />
                      <span>{doc.label}</span>
                      {meta.status === "EM_REANALISE" && (
                        <span className="admin-doc-tag-warning">
                          {meta.isNovaVersao ? "🔄 Reanálise" : "⏳ Pendente"}
                        </span>
                      )}
                      {meta.status === "RECUSADO" && (
                        <span className="admin-doc-tag-danger">❌</span>
                      )}
                      {meta.status === "VALIDADO" && (
                        <span className="admin-doc-tag-success" style={{ color: "#166534" }}>✅</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Toolbar */}
              <div className="admin-dossier-toolbar">
                <div className="admin-dossier-toolbar__left">
                  <span className="admin-doc-badge">{isPdf ? "PDF" : "IMAGEM"}</span>
                  <code className="admin-doc-filename truncate-filename" title={currentDoc.file}>
                    {currentDoc.file}
                  </code>
                  {realFileUrl ? (
                    <span className="admin-real-badge">● Arquivo Real (IndexedDB)</span>
                  ) : (
                    <span className="admin-tag" style={{ color: "#b91c1c" }}>
                      Arquivo Ausente
                    </span>
                  )}
                  {currentMeta.status === "VALIDADO" && (
                    <span className="admin-badge admin-badge--success">✅ Homologado</span>
                  )}
                  {currentMeta.status === "EM_REANALISE" && (
                    <span className="admin-badge admin-badge--warning">
                      {currentMeta.isNovaVersao
                        ? "🔄 Nova Versão em Reanálise"
                        : "⏳ Aguardando Homologação"}
                    </span>
                  )}
                  {currentMeta.status === "RECUSADO" && (
                    <span className="admin-badge admin-badge--danger">❌ Recusado</span>
                  )}
                </div>

                <div className="admin-dossier-toolbar__right">
                  <div className="admin-doc-inline-actions">
                    {currentMeta.status !== "VALIDADO" && (
                      <button
                        type="button"
                        className="button button--secondary button--small admin-btn-success"
                        onClick={() => {
                          handleHomologarDocumentoProdutor(produtor.id, docMap[activeDoc]);
                        }}
                      >
                        ✅ Homologar Doc
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button--outline button--small admin-btn-danger"
                      onClick={() => {
                        setRejectProducerDocModal({
                          produtorId: produtor.id,
                          produtorNome: produtor.nome,
                          tipoDoc: docMap[activeDoc],
                          docTitle: currentDoc.label,
                          fileName: currentDoc.file,
                        });
                        setRejectProducerDocReason("");
                        setRejectProducerDocSuspend(false);
                      }}
                    >
                      ❌ Recusar Doc
                    </button>
                  </div>

                  {realFileUrl && !isPdf && (
                    <>
                      <button
                        type="button"
                        className="button button--secondary button--small admin-tool-btn"
                        onClick={() =>
                          setPfDocZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(1))))
                        }
                        disabled={pfDocZoom <= 0.5}
                        title="Diminuir zoom"
                      >
                        🔍 −
                      </button>
                      <span className="admin-tool-zoom">{Math.round(pfDocZoom * 100)}%</span>
                      <button
                        type="button"
                        className="button button--secondary button--small admin-tool-btn"
                        onClick={() =>
                          setPfDocZoom((z) => Math.min(2.5, Number((z + 0.2).toFixed(1))))
                        }
                        disabled={pfDocZoom >= 2.5}
                        title="Aumentar zoom"
                      >
                        🔍 +
                      </button>
                      <button
                        type="button"
                        className="button button--secondary button--small admin-tool-btn"
                        onClick={() => setPfDocRotation((r) => (r + 90) % 360)}
                        title="Girar 90 graus"
                      >
                        🔄 Girar
                      </button>
                    </>
                  )}

                  {realFileUrl && (
                    <button
                      type="button"
                      className="button button--outline button--small admin-download-btn"
                      onClick={handleDownloadPfDoc}
                      title="Baixar arquivo"
                    >
                      ⬇️ Baixar Cópia
                    </button>
                  )}
                </div>
              </div>

              {currentMeta.status === "RECUSADO" && currentMeta.motivoRecusa && (
                <div className="admin-doc-refusal-alert">
                  <strong>⚠️ Parecer de Recusa Registrado para este Documento:</strong>
                  <p>{currentMeta.motivoRecusa}</p>
                </div>
              )}

              {/* Viewport */}
              <div className="admin-dossier-viewport" style={{ maxHeight: "560px" }}>
                {realFileUrl ? (
                  isPdf ? (
                    <iframe
                      src={realFileUrl}
                      title={currentDoc.label}
                      className="admin-doc-real-iframe"
                      width="100%"
                      height="560px"
                    />
                  ) : (
                    <div
                      className="admin-doc-real-img-container"
                      style={{
                        transform: `scale(${pfDocZoom}) rotate(${pfDocRotation}deg)`,
                        transformOrigin: "center center",
                        transition: "transform 0.15s ease",
                      }}
                    >
                      <img
                        src={realFileUrl}
                        alt={currentDoc.label}
                        className="admin-doc-real-img"
                      />
                    </div>
                  )
                ) : (
                  <div className="admin-doc-error-card">
                    <span className="admin-doc-error-icon">⚠️</span>
                    <h4>Arquivo Binário Não Localizado</h4>
                    <p>
                      O arquivo comprobatório (<code>{currentDoc.file}</code>) não foi localizado no armazenamento local (IndexedDB).
                      Para garantir a conformidade cadastral e evitar documentos simulados, recuse o documento solicitando o reenvio pelo produtor.
                    </p>
                    <div className="admin-doc-error-actions">
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => setPfDossierModal(null)}
                      >
                        Fechar Visualizador
                      </button>
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => {
                          setRejectProducerDocModal({
                            produtorId: produtor.id,
                            produtorNome: produtor.nome,
                            tipoDoc: docMap[activeDoc],
                            docTitle: currentDoc.label,
                            fileName: currentDoc.file,
                          });
                          setRejectProducerDocReason("");
                          setRejectProducerDocSuspend(false);
                        }}
                      >
                        ✕ Recusar Documento e Solicitar Reenvio
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé de Ações */}
              <div className="admin-dossier-footer">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setPfDossierModal(null)}
                >
                  Fechar Visualizador
                </button>
                <div className="admin-dossier-footer__actions">
                  <button
                    type="button"
                    className="button button--outline admin-btn-danger"
                    onClick={() => {
                      setRejectProducerDocModal({
                        produtorId: produtor.id,
                        produtorNome: produtor.nome,
                        tipoDoc: docMap[activeDoc],
                        docTitle: currentDoc.label,
                        fileName: currentDoc.file,
                      });
                      setRejectProducerDocReason("");
                      setRejectProducerDocSuspend(false);
                    }}
                  >
                    ❌ Recusar Documento
                  </button>
                  {currentMeta.status !== "VALIDADO" && (
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => {
                        handleHomologarDocumentoProdutor(produtor.id, docMap[activeDoc]);
                      }}
                    >
                      ✅ Homologar Documento
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =================================================================== */}
      {/* MODAL 10: RECUSAR DOCUMENTO DO PRODUTOR (COM OPÇÃO DE SUSPENSÃO)    */}
      {/* =================================================================== */}
      {rejectProducerDocModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setRejectProducerDocModal(null)}
        >
          <form
            className="modal-card admin-modal-card"
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmarRecusaDocumentoProdutor();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
          >
            <div className="modal-card__header">
              <h3>❌ Recusar Documento: {rejectProducerDocModal.docTitle}</h3>
            </div>
            <p className="modal-card__body">
              Produtor: <strong>{rejectProducerDocModal.produtorNome}</strong> · Arquivo:{" "}
              <code className="truncate-filename" title={rejectProducerDocModal.fileName}>{rejectProducerDocModal.fileName}</code>
            </p>

            <div className="field">
              <label style={{ marginBottom: "0.4rem", display: "block" }}>
                <strong>Motivos Frequentes de Recusa (Clique para preencher):</strong>
              </label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.4rem",
                  marginBottom: "0.8rem",
                }}
              >
                {[
                  "Foto borrada / ilegível",
                  "Documento cortado nas bordas / dados ausentes",
                  "Documento vencido ou inválido",
                  "CPF/Nome divergente do titular cadastrado",
                  "Comprovante de CAR inválido ou de outra titularidade",
                ].map((motivo) => (
                  <button
                    key={motivo}
                    type="button"
                    className="button button--outline button--small"
                    style={{ fontSize: "0.8rem", padding: "3px 8px" }}
                    onClick={() => setRejectProducerDocReason(motivo)}
                  >
                    {motivo}
                  </button>
                ))}
              </div>

              <label htmlFor="producer-doc-reject-reason">
                <strong>Justificativa da Recusa (Obrigatória):</strong>
              </label>
              <textarea
                id="producer-doc-reject-reason"
                rows={4}
                value={rejectProducerDocReason}
                onChange={(e) => setRejectProducerDocReason(e.target.value)}
                placeholder="Ex: Foto borrada, dados do verso ilegíveis ou documento cortado. Favor reenviar cópia nítida..."
                required
                autoFocus
              />
            </div>

            <div className="admin-suspension-toggle-card">
              <label htmlFor="reject-producer-suspend-checkbox" className="admin-suspension-checkbox-label">
                <div className="admin-suspension-toggle-card__header">
                  <input
                    type="checkbox"
                    id="reject-producer-suspend-checkbox"
                    checked={rejectProducerDocSuspend}
                    onChange={(e) => setRejectProducerDocSuspend(e.target.checked)}
                    className="admin-suspension-toggle-card__checkbox"
                  />
                  <div className="admin-suspension-toggle-card__icon" aria-hidden="true">
                    ⚠️
                  </div>
                  <div className="admin-suspension-toggle-card__content">
                    <strong className="admin-suspension-toggle-card__title">
                      Suspender preventivamente o vendedor até o reenvio de documento válido
                    </strong>
                    <p className="admin-suspension-toggle-card__description">
                      Se marcado, a conta do vendedor passa para <code>SUSPENSO</code> e todos os seus anúncios ativos no Mercado serão pausados preventivamente até a regularização cadastral.
                    </p>
                  </div>
                </div>
              </label>
            </div>

            <div className="modal-card__actions" style={{ marginTop: "1.2rem" }}>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setRejectProducerDocModal(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button button--primary admin-btn-danger-solid"
                disabled={rejectProducerDocReason.trim().length < 5}
              >
                {rejectProducerDocSuspend
                  ? "Confirmar Recusa e Suspender Vendedor"
                  : "Confirmar Recusa do Documento"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
