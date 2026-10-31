import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { ADMIN_SECRET_SLUG, routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import farmImage from "../../assets/images/farm-landscape.jpeg";
import { liberarAnuncioModeracao, pausarAnuncioModeracao } from "../admin/adminStorage";
import "../admin/admin.css";
import { formatPhone, phoneDigits } from "../profile/profile";
import {
  AD_DOCUMENT_LABELS,
  AD_DOCUMENT_SHORT_LABELS,
  COFFEE_SCREEN_LABELS,
  GRAIN_CROP_LABELS,
  GRAIN_PACKAGING_LABELS,
  PURPOSE_LABELS,
  SPECIES_LABELS,
  formatarTamanhoArquivo,
  obterTagsAnuncio,
  obterYoutubeEmbedUrl,
} from "./ads.types";
import type {
  AdDocumentAccessRequest,
  AdDocumentItem,
  DocumentAccessStatus,
  EncerramentoAnuncioPayload,
  MarketplaceAd,
} from "./ads.types";
import {
  alternarStatusAnuncio,
  encerrarAnuncio,
  obterAnuncioPorId,
  obterPerfilProdutorPublico,
  obterSolicitacaoComprador,
  listarSolicitacoesAnuncio,
  responderSolicitacaoAcesso,
} from "./adsStorage";
import type { PublicProducerProfile } from "./adsStorage";
import { ViewAdDocumentModal } from "./ViewAdDocumentModal";
import { RequestAdAccessModal } from "./RequestAdAccessModal";
import { CloseAdModal } from "./CloseAdModal";
import "./ads.css";

interface AdDetailPageProps {
  onOpenDialog?: OpenDevelopmentDialog;
}

export function AdDetailPage({ onOpenDialog }: AdDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toastMessage = (location.state as { toastMessage?: string } | null)?.toastMessage;
  const { session } = useAuth();
  const [anuncio, setAnuncio] = useState<MarketplaceAd | null>(null);
  const [producerProfile, setProducerProfile] = useState<PublicProducerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<number | "video">(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isReactivating, setIsReactivating] = useState(false);
  const [activeToast, setActiveToast] = useState<string | null>(toastMessage || null);
  const [showAdminPauseModal, setShowAdminPauseModal] = useState(false);
  const [adminPauseReason, setAdminPauseReason] = useState("");
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  // Estados de Documentos e Data Room (US-013)
  const [selectedDocToView, setSelectedDocToView] = useState<AdDocumentItem | null>(null);
  const [isViewDocModalOpen, setIsViewDocModalOpen] = useState(false);
  const [isRequestAccessModalOpen, setIsRequestAccessModalOpen] = useState(false);
  const [buyerRequest, setBuyerRequest] = useState<AdDocumentAccessRequest | null>(null);
  const [sellerRequests, setSellerRequests] = useState<AdDocumentAccessRequest[]>([]);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [docFeedbackToast, setDocFeedbackToast] = useState<string | null>(null);

  const fotos = anuncio?.fotos && anuncio.fotos.length > 0 ? anuncio.fotos : [anuncio?.imagemUrl || ""];

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsLightboxOpen(false);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isLightboxOpen, fotos.length]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    obterAnuncioPorId(id)
      .then((resultado) => {
        if (!isMounted) return;
        setAnuncio(resultado);
        if (resultado) {
          obterPerfilProdutorPublico(resultado.vendedorId).then((perfil) => {
            if (isMounted) setProducerProfile(perfil);
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  async function handleReativarAnuncio() {
    if (!anuncio || !session) return;
    try {
      setIsReactivating(true);
      const atualizado = await alternarStatusAnuncio(anuncio.id, "ATIVO", session);
      setAnuncio(atualizado);
      setActiveToast("Anúncio reativado com sucesso! O lote já está visível novamente no Mercado.");
    } catch (err) {
      console.error("Erro ao reativar anúncio:", err);
      alert("Não foi possível reativar o anúncio. Tente novamente.");
    } finally {
      setIsReactivating(false);
    }
  }

  async function handleConfirmarEncerramento(payload: EncerramentoAnuncioPayload) {
    if (!anuncio || !session) return;
    try {
      const atualizado = await encerrarAnuncio(anuncio.id, payload, session);
      setAnuncio(atualizado);
      setIsCloseModalOpen(false);
      setActiveToast(
        payload.tipo === "VENDIDO"
          ? "Lote finalizado com sucesso! Marcado como Comercializado / Vendido."
          : "Lote finalizado com sucesso! Marcado como Cancelado / Retirado."
      );
      recarregarSolicitacoes();
    } catch (err) {
      console.error("Erro ao encerrar anúncio:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Não foi possível encerrar a disponibilidade do anúncio."
      );
    }
  }

  function handleAdminConfirmPause(e: FormEvent) {
    e.preventDefault();
    if (!anuncio || adminPauseReason.trim().length < 10) return;
    const lista = pausarAnuncioModeracao(anuncio.id, adminPauseReason);
    const atualizado = lista.find((a) => a.id === anuncio.id) || null;
    if (atualizado) setAnuncio(atualizado);
    setShowAdminPauseModal(false);
    setAdminPauseReason("");
    setActiveToast("Lote pausado preventivamente por Moderação Administrativa.");
  }

  function handleAdminReleaseAd() {
    if (!anuncio) return;
    const lista = liberarAnuncioModeracao(anuncio.id);
    const atualizado = lista.find((a) => a.id === anuncio.id) || null;
    if (atualizado) setAnuncio(atualizado);
    setActiveToast("Lote liberado pela Moderação e republicado no Mercado!");
  }

  const recarregarSolicitacoes = () => {
    if (!anuncio?.id || !session) return;
    if (session.conta.id === anuncio.vendedorId) {
      void listarSolicitacoesAnuncio(anuncio.id).then(setSellerRequests);
    } else {
      void obterSolicitacaoComprador(anuncio.id, session.conta.id).then(setBuyerRequest);
    }
  };

  useEffect(() => {
    if (!anuncio?.id || !session) return;
    let isMounted = true;
    const adId = anuncio.id;
    const userId = session.conta.id;
    const isOwnerUser = userId === anuncio.vendedorId;

    if (isOwnerUser) {
      void listarSolicitacoesAnuncio(adId).then((reqs) => {
        if (isMounted) setSellerRequests(reqs);
      });
    } else {
      void obterSolicitacaoComprador(adId, userId).then((req) => {
        if (isMounted) setBuyerRequest(req);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [anuncio?.id, anuncio?.vendedorId, session]);

  const handleResponderSolicitacao = async (
    solicitacaoId: string,
    novoStatus: DocumentAccessStatus
  ) => {
    try {
      setIsProcessingRequest(true);
      const atualizada = await responderSolicitacaoAcesso(solicitacaoId, novoStatus);
      setSellerRequests((prev) =>
        prev.map((r) => (r.id === solicitacaoId ? atualizada : r))
      );
      setDocFeedbackToast(
        novoStatus === "APROVADO"
          ? "Acesso concedido com sucesso para este comprador! Todos os documentos do lote foram liberados."
          : novoStatus === "RECUSADO"
          ? "Solicitação recusada. O comprador não terá acesso aos documentos."
          : "Acesso revogado com sucesso. O comprador não poderá mais visualizar os documentos."
      );
    } catch (err) {
      console.error("Erro ao responder solicitação:", err);
    } finally {
      setIsProcessingRequest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="ad-detail-page">
        <div className="container">
          <div className="ad-loading-box">
            <Icon name="clock" className="ad-loading-spinner" />
            <p>Carregando ficha técnica do lote...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!anuncio) {
    return (
      <div className="ad-detail-page">
        <div className="container">
          <div className="ad-not-found">
            <h2>Lote não encontrado</h2>
            <p>O anúncio solicitado pode ter sido encerrado ou o identificador está incorreto.</p>
            <Link to={routes.market} className="button button--primary">
              Voltar ao Mercado
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = Boolean(session && session.conta.id === anuncio.vendedorId);
  const isAdmin = session?.conta.tipo === "ADMIN";
  const isApprovedBuyer = Boolean(buyerRequest && buyerRequest.status === "APROVADO");
  const hasUnlockedAccess = Boolean(isOwner || isAdmin || isApprovedBuyer);
  const isClosed = anuncio.status === "VENDIDO" || anuncio.status === "CANCELADO";
  const [tag1, tag2] = obterTagsAnuncio(anuncio);

  const hasVideo = Boolean(anuncio.video?.url);

  return (
    <div className="ad-detail-page">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="ad-breadcrumb" aria-label="Navegação estrutural">
          <Link to={routes.home}>Início</Link>
          <span aria-hidden="true">/</span>
          <Link to={routes.market}>Mercado</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{anuncio.titulo}</span>
        </nav>

        {activeToast && (
          <div className="ad-alert ad-alert--success ad-alert--toast" role="status">
            <Icon name="leaf" />
            <span>{activeToast}</span>
            <button
              type="button"
              className="ad-alert__close"
              onClick={() => setActiveToast(null)}
              aria-label="Fechar notificação"
            >
              <Icon name="close" />
            </button>
          </div>
        )}

        {/* Banner de Lote Encerrado (US-016) */}
        {isClosed && (
          <div
            className={`ad-alert ${anuncio.status === "VENDIDO" ? "ad-alert--success" : "ad-alert--paused"}`}
            role="status"
          >
            <div className="ad-alert__content">
              <Icon name={anuncio.status === "VENDIDO" ? "check" : "box"} />
              <div>
                <strong>
                  {anuncio.status === "VENDIDO"
                    ? "📦 Lote Comercializado / Vendido"
                    : "📦 Lote Cancelado / Retirado"}
                </strong>
                <p>
                  {anuncio.encerradoEm
                    ? `Finalizado em ${new Date(anuncio.encerradoEm).toLocaleDateString("pt-BR")}`
                    : "Finalizado pelo produtor rural."}
                  {anuncio.motivoEncerramento ? ` · Motivo: ${anuncio.motivoEncerramento}` : ""}
                </p>
                {isOwner && anuncio.observacoesEncerramento && (
                  <p
                    className="ad-alert__internal-notes"
                    style={{
                      marginTop: "0.35rem",
                      fontStyle: "italic",
                      fontSize: "0.875rem",
                    }}
                  >
                    Nota interna da fazenda: &ldquo;{anuncio.observacoesEncerramento}&rdquo;
                  </p>
                )}
                {!isOwner && (
                  <p>
                    Este lote foi formalmente finalizado pelo produtor rural e não aceita novos contatos comerciais nem pedidos de documentos.
                  </p>
                )}
              </div>
            </div>
            {!isOwner && (
              <Link to={routes.market} className="button button--primary button--small">
                Explorar Outros Lotes no Mercado
              </Link>
            )}
          </div>
        )}

        {/* Banner de Aviso de Anúncio Pausado / Moderado (US-015 + Governança) */}
        {anuncio.status === "BLOQUEADO_MODERACAO" && (
          <div className="ad-alert ad-alert--error" role="alert">
            <div className="ad-alert__content">
              <Icon name="ban" />
              <div>
                <strong>🚫 Anúncio Bloqueado em Definitivo pela Governança</strong>
                <p>
                  {anuncio.motivoModeracao ||
                    "Este lote foi removido em definitivo do catálogo público por violação aos Termos de Uso e preservado apenas para fins de auditoria."}
                </p>
              </div>
            </div>
          </div>
        )}

        {anuncio.status === "PAUSADO_MODERACAO" && (
          <div className="ad-alert ad-alert--paused" role="status">
            <div className="ad-alert__content">
              <Icon name="alert" />
              <div>
                <strong>⏸ Lote Pausado pela Moderação Administrativa</strong>
                <p>
                  {anuncio.motivoModeracao ||
                    "Este anúncio foi pausado preventivamente para adequação cadastral."}
                </p>
              </div>
            </div>
            {isOwner && (
              <Link
                to={`/anuncios/${anuncio.id}/editar`}
                className="button button--primary button--small"
              >
                <Icon name="edit" /> Corrigir e Enviar para Revisão
              </Link>
            )}
          </div>
        )}

        {anuncio.status === "EM_REVISAO" && (
          <div className="ad-alert ad-alert--paused" role="status">
            <div className="ad-alert__content">
              <Icon name="clock" />
              <div>
                <strong>⏳ Anúncio Corrigido — Aguardando Liberação da Moderação</strong>
                <p>
                  As alterações realizadas pelo produtor foram registradas e aguardam conferência da
                  Governança para retornar ao Mercado.
                </p>
              </div>
            </div>
          </div>
        )}

        {anuncio.status === "PAUSADO" && (
          isOwner ? (
            <div className="ad-alert ad-alert--paused" role="status">
              <div className="ad-alert__content">
                <Icon name="pause" />
                <div>
                  <strong>Este anúncio está pausado</strong>
                  <p>O lote está temporariamente oculto do catálogo do Mercado e da sua vitrine pública.</p>
                </div>
              </div>
              <button
                type="button"
                className="button button--primary button--small"
                onClick={handleReativarAnuncio}
                disabled={isReactivating}
              >
                <Icon name="play" /> {isReactivating ? "Reativando..." : "Reativar Anúncio Agora"}
              </button>
            </div>
          ) : (
            <div className="ad-alert ad-alert--paused" role="status">
              <div className="ad-alert__content">
                <Icon name="pause" />
                <div>
                  <strong>Lote Temporariamente Indisponível</strong>
                  <p>Este lote está temporariamente indisponível ou em fase de negociação pelo produtor.</p>
                </div>
              </div>
              <Link to={routes.market} className="button button--outline button--small">
                Ver Mercado
              </Link>
            </div>
          )
        )}

        {/* Layout Principal da Ficha Técnica */}
        <div className="ad-detail-layout">
          {/* Coluna Esquerda: Fotos e Dados Técnicos */}
          <div className="ad-detail-main">
            {/* Galeria de Mídia Interativa (US-012) */}
            <div className="ad-gallery-container">
              <div className="ad-gallery-stage">
                {selectedMedia === "video" && anuncio.video ? (
                  anuncio.video.tipo === "YOUTUBE" ? (
                    obterYoutubeEmbedUrl(anuncio.video.url) ? (
                      <iframe
                        src={obterYoutubeEmbedUrl(anuncio.video.url)!}
                        title={`Vídeo demonstrativo - ${anuncio.titulo}`}
                        className="ad-gallery-stage__video-iframe"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="ad-gallery-stage__fallback">
                        <Icon name="video" />
                        <p>URL de vídeo do YouTube inválida ou não suportada.</p>
                      </div>
                    )
                  ) : (
                    <video
                      src={anuncio.video.url}
                      controls
                      playsInline
                      className="ad-gallery-stage__video-player"
                    >
                      Seu navegador não suporta a reprodução deste vídeo.
                    </video>
                  )
                ) : (
                  <>
                    <img
                      src={fotos[typeof selectedMedia === "number" ? selectedMedia : 0] || anuncio.imagemUrl}
                      alt={anuncio.titulo}
                      className="ad-gallery-stage__img"
                      onClick={() => openLightbox(typeof selectedMedia === "number" ? selectedMedia : 0)}
                      role="button"
                      tabIndex={0}
                      title="Clique para ampliar a foto em tela cheia"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openLightbox(typeof selectedMedia === "number" ? selectedMedia : 0);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="ad-gallery-stage__btn-zoom"
                      onClick={() => openLightbox(typeof selectedMedia === "number" ? selectedMedia : 0)}
                      title="Ampliar foto em tela cheia"
                      aria-label="Ampliar foto em tela cheia"
                    >
                      <Icon name="search" />
                      <span>Ampliar</span>
                    </button>

                    <div className="ad-detail-banner__overlay">
                      <span className="ad-badge ad-badge--category">{tag1}</span>
                      <span className="ad-badge ad-badge--category">{tag2}</span>
                    </div>

                    <div className="ad-gallery-stage__counter">
                      <Icon name="camera" /> {(typeof selectedMedia === "number" ? selectedMedia : 0) + 1} / {fotos.length}
                    </div>
                  </>
                )}
              </div>

              {/* Faixa de Miniaturas (se houver mais de 1 foto ou houver vídeo) */}
              {(fotos.length > 1 || hasVideo) && (
                <div className="ad-gallery-strip" aria-label="Miniaturas de mídia do anúncio">
                  {fotos.map((foto, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`ad-gallery-strip__item ${selectedMedia === idx ? "ad-gallery-strip__item--active" : ""}`}
                      onClick={() => setSelectedMedia(idx)}
                      aria-label={`Ver foto ${idx + 1}`}
                    >
                      <img src={foto} alt="" />
                      {idx === 0 && <span className="ad-gallery-strip__badge">Capa</span>}
                    </button>
                  ))}

                  {hasVideo && (
                    <button
                      type="button"
                      className={`ad-gallery-strip__item ad-gallery-strip__item--video ${selectedMedia === "video" ? "ad-gallery-strip__item--active" : ""}`}
                      onClick={() => setSelectedMedia("video")}
                      aria-label="Assistir ao vídeo demonstrativo"
                    >
                      <div className="ad-gallery-strip__video-thumb">
                        <Icon name="play" />
                        <span>Vídeo</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Cabeçalho da Oferta */}
            <div className="ad-detail-header-card">
              <div className="ad-detail-meta">
                <span className="ad-detail-date">
                  Publicado em {new Date(anuncio.criadoEm).toLocaleDateString("pt-BR")}
                  {anuncio.atualizadoEm && (
                    <span className="ad-detail-date-updated">
                      {" "}(Atualizado em {new Date(anuncio.atualizadoEm).toLocaleDateString("pt-BR")})
                    </span>
                  )}
                </span>
                <span className="ad-detail-location">
                  <Icon name="location" /> {anuncio.cidade}, {anuncio.uf}
                </span>
              </div>
              <h1 className="ad-detail-title">{anuncio.titulo}</h1>
            </div>

            {/* Ficha Técnica Polimórfica (Pecuária vs. Grãos e Café) */}
            {anuncio.categoria === "GRAOS" ? (
              <>
                {/* 1. Quadro de Volume e Carga */}
                <section className="ad-detail-section" aria-labelledby="heading-volume-carga">
                  <h2 id="heading-volume-carga" className="ad-detail-section__title">
                    <Icon name="box" /> Volume e Carga da Safra
                  </h2>
                  <div className="ad-spec-grid">
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Cultura Principal</span>
                      <strong className="ad-spec-val">
                        {anuncio.cultura === "OUTRO"
                          ? `Outro (${anuncio.culturaPersonalizada || anuncio.tagSecundaria})`
                          : GRAIN_CROP_LABELS[anuncio.cultura]}
                      </strong>
                    </div>
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Tipo / Classificação Comercial</span>
                      <strong className="ad-spec-val">{anuncio.subtipo}</strong>
                    </div>
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Safra de Colheita</span>
                      <strong className="ad-spec-val">Safra {anuncio.safra}</strong>
                    </div>
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Armazenamento / Embalagem</span>
                      <strong className="ad-spec-val">
                        {GRAIN_PACKAGING_LABELS[anuncio.embalagem]}
                      </strong>
                    </div>
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Volume em Sacas (60 kg)</span>
                      <strong className="ad-spec-val">
                        {anuncio.quantidadeSacas.toLocaleString("pt-BR")} sacas
                      </strong>
                    </div>
                    <div className="ad-spec-card ad-spec-card--highlight">
                      <span className="ad-spec-label">Peso Total da Carga</span>
                      <strong className="ad-spec-val">
                        {anuncio.pesoTotalToneladas.toLocaleString("pt-BR")} ton (
                        {anuncio.pesoTotalKg.toLocaleString("pt-BR")} kg)
                      </strong>
                    </div>
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Local de Retirada / Armazém</span>
                      <strong className="ad-spec-val">
                        {anuncio.cidade} / {anuncio.uf}
                      </strong>
                    </div>
                  </div>
                </section>

                {/* 2. Quadro de Laudo Técnico e Qualidade Física */}
                <section className="ad-detail-section" aria-labelledby="heading-laudo-tecnico">
                  <h2 id="heading-laudo-tecnico" className="ad-detail-section__title">
                    <Icon name="leaf" /> Laudo Técnico e Qualidade Agronômica
                  </h2>
                  <div className="ad-spec-grid">
                    {/* Umidade: sempre informada */}
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Umidade Estimada</span>
                      <strong className="ad-spec-val">
                        {anuncio.umidadePercentual
                          ? `${anuncio.umidadePercentual}%`
                          : "Padrão comercial"}
                      </strong>
                    </div>

                    {/* Especificações de Café */}
                    {anuncio.cultura === "CAFE" && anuncio.laudoTecnico?.cafePeneira && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Peneira Predominante</span>
                        <strong className="ad-spec-val">
                          {COFFEE_SCREEN_LABELS[anuncio.laudoTecnico.cafePeneira]}
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "CAFE" && anuncio.laudoTecnico?.cafeCatacaoDefeitos && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Catação / Defeitos</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.cafeCatacaoDefeitos}
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "CAFE" && typeof anuncio.laudoTecnico?.cafePontuacaoSca === "number" && (
                      <div className="ad-spec-card ad-spec-card--highlight">
                        <span className="ad-spec-label">Pontuação SCA (Especial)</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.cafePontuacaoSca} pts
                        </strong>
                      </div>
                    )}

                    {/* Especificações de Soja */}
                    {anuncio.cultura === "SOJA" && typeof anuncio.laudoTecnico?.sojaImpurezasPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Impurezas e Matérias Estranhas</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.sojaImpurezasPct}%
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "SOJA" && typeof anuncio.laudoTecnico?.sojaAvariadosPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Grãos Avariados Totais</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.sojaAvariadosPct}%
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "SOJA" && typeof anuncio.laudoTecnico?.sojaQuebradosPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Grãos Quebrados</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.sojaQuebradosPct}%
                        </strong>
                      </div>
                    )}

                    {/* Especificações de Milho */}
                    {anuncio.cultura === "MILHO" && typeof anuncio.laudoTecnico?.milhoImpurezasPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Impurezas e Fragmentos</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.milhoImpurezasPct}%
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "MILHO" && typeof anuncio.laudoTecnico?.milhoArdidosPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Grãos Ardidos</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.milhoArdidosPct}%
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "MILHO" && typeof anuncio.laudoTecnico?.milhoQuebradosPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Grãos Quebrados</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.milhoQuebradosPct}%
                        </strong>
                      </div>
                    )}

                    {/* Especificações de Trigo */}
                    {anuncio.cultura === "TRIGO" && typeof anuncio.laudoTecnico?.trigoPhKgHl === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">PH / Peso Hectolítrico</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.trigoPhKgHl} kg/hL
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "TRIGO" && typeof anuncio.laudoTecnico?.trigoForcaGlutenW === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Força de Glúten (W)</span>
                        <strong className="ad-spec-val">
                          W {anuncio.laudoTecnico.trigoForcaGlutenW}
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "TRIGO" && typeof anuncio.laudoTecnico?.trigoFallingNumberSeg === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Falling Number (FN)</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.trigoFallingNumberSeg} s
                        </strong>
                      </div>
                    )}

                    {/* Especificações de Outro */}
                    {anuncio.cultura === "OUTRO" && anuncio.laudoTecnico?.outroObservacoesLaudo && (
                      <div className="ad-spec-card ad-spec-card--wide">
                        <span className="ad-spec-label">Observações Técnicas do Laudo</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.outroObservacoesLaudo}
                        </strong>
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <section className="ad-detail-section" aria-labelledby="heading-zootecnica">
                <h2 id="heading-zootecnica" className="ad-detail-section__title">
                  <Icon name="leaf" /> Ficha Zootécnica do Lote
                </h2>
                <div className="ad-spec-grid">
                  <div className="ad-spec-card">
                    <span className="ad-spec-label">Espécie</span>
                    <strong className="ad-spec-val">{SPECIES_LABELS[anuncio.especie]}</strong>
                  </div>
                  <div className="ad-spec-card">
                    <span className="ad-spec-label">Raça / Cruzamento</span>
                    <strong className="ad-spec-val">{anuncio.raca}</strong>
                  </div>
                  <div className="ad-spec-card">
                    <span className="ad-spec-label">Quantidade</span>
                    <strong className="ad-spec-val">{anuncio.quantidadeCabecas} cabeças</strong>
                  </div>
                  <div className="ad-spec-card">
                    <span className="ad-spec-label">Finalidade</span>
                    <strong className="ad-spec-val">{PURPOSE_LABELS[anuncio.finalidade]}</strong>
                  </div>
                  <div className="ad-spec-card">
                    <span className="ad-spec-label">Era / Idade</span>
                    <strong className="ad-spec-val">
                      {anuncio.idadeMeses ? `${anuncio.idadeMeses} meses` : "Não informada"}
                    </strong>
                  </div>
                  <div className="ad-spec-card">
                    <span className="ad-spec-label">Peso Médio Estimado</span>
                    <strong className="ad-spec-val">
                      {anuncio.pesoMedioArroba} @ ({anuncio.pesoMedioKg} kg)
                    </strong>
                  </div>
                  <div className="ad-spec-card ad-spec-card--highlight">
                    <span className="ad-spec-label">Peso Total da Carga</span>
                    <strong className="ad-spec-val">
                      {anuncio.pesoTotalArroba.toLocaleString("pt-BR")} @ (
                      {anuncio.pesoTotalKg.toLocaleString("pt-BR")} kg)
                    </strong>
                  </div>
                  <div className="ad-spec-card">
                    <span className="ad-spec-label">Local de Retirada</span>
                    <strong className="ad-spec-val">
                      {anuncio.cidade} / {anuncio.uf}
                    </strong>
                  </div>
                </div>
              </section>
            )}

            {/* Descrição e Manejo / Qualidade */}
            {anuncio.descricao && (
              <section className="ad-detail-section" aria-labelledby="heading-manejo">
                <h2 id="heading-manejo" className="ad-detail-section__title">
                  <Icon name="box" />{" "}
                  {anuncio.categoria === "GRAOS"
                    ? "Descrição da Qualidade e Lote Agrícola"
                    : "Descrição e Manejo da Boiada"}
                </h2>
                <div className="ad-detail-description">
                  <p>{anuncio.descricao}</p>
                </div>
              </section>
            )}

            {/* Seção de Documentação Comprobatória (Data Room Agro - US-013) */}
            {((anuncio.documentos && anuncio.documentos.length > 0) || isOwner) && (
              <section className="ad-detail-section ad-doc-section" aria-labelledby="heading-documentacao">
                <div className="ad-doc-section-header">
                  <div>
                    <h2 id="heading-documentacao" className="ad-detail-section__title">
                      <Icon name="file" /> Documentação Comprobatória do Lote
                    </h2>
                    <p className="ad-detail-section__subtitle">
                      Laudos sanitários, registros e guias oficiais com custódia segura no Data Room SafraDireta.
                    </p>
                  </div>
                  {anuncio.documentos && anuncio.documentos.length > 0 && (
                    <span className="ad-doc-count-badge">
                      {anuncio.documentos.length} documento(s)
                    </span>
                  )}
                </div>

                {docFeedbackToast && (
                  <div className="ad-alert ad-alert--success" role="status" style={{ marginBottom: "1rem" }}>
                    <Icon name="check" />
                    <span>{docFeedbackToast}</span>
                    <button
                      type="button"
                      className="ad-alert__close"
                      onClick={() => setDocFeedbackToast(null)}
                      aria-label="Fechar alerta"
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                )}

                {/* Banner de Estado do Acesso */}
                {hasUnlockedAccess ? (
                  <div className={`ad-doc-banner ${isOwner ? "ad-doc-banner--owner" : isAdmin ? "ad-doc-banner--admin" : "ad-doc-banner--approved"}`}>
                    <div className="ad-doc-banner__icon">
                      <Icon name={isAdmin ? "shield" : "unlock"} />
                    </div>
                    <div className="ad-doc-banner__text">
                      <strong>
                        {isOwner
                          ? "Painel do Vendedor: Documentação Liberada"
                          : isAdmin
                          ? "Auditoria Administrativa: Acesso Geral Liberado"
                          : "Acesso Autorizado pelo Produtor Rural"}
                      </strong>
                      <p>
                        {isOwner
                          ? "Você tem acesso total aos documentos anexados. Gerencie as solicitações de compradores interessados no painel abaixo."
                          : isAdmin
                          ? "Você possui credenciais administrativas de governança e pode auditar os laudos deste anúncio."
                          : "Sua solicitação de interesse foi aceita pelo produtor. Você pode visualizar os arquivos completos no leitor integrado."}
                      </p>
                    </div>
                  </div>
                ) : buyerRequest?.status === "PENDENTE" ? (
                  <div className="ad-doc-banner ad-doc-banner--pending">
                    <div className="ad-doc-banner__icon">
                      <Icon name="clock" />
                    </div>
                    <div className="ad-doc-banner__text">
                      <strong>Solicitação de Acesso em Análise</strong>
                      <p>
                        Seu pedido foi enviado ao produtor em{" "}
                        {new Date(buyerRequest.solicitadoEm).toLocaleDateString("pt-BR")}. Assim que o vendedor
                        aprovar, os arquivos serão destravados imediatamente nesta página.
                      </p>
                      <div className="ad-doc-banner__quote">
                        Sua mensagem: &ldquo;{buyerRequest.mensagem}&rdquo;
                      </div>
                    </div>
                  </div>
                ) : buyerRequest?.status === "RECUSADO" ? (
                  <div className="ad-doc-banner ad-doc-banner--refused">
                    <div className="ad-doc-banner__icon">
                      <Icon name="ban" />
                    </div>
                    <div className="ad-doc-banner__text">
                      <strong>Acesso Não Autorizado pelo Vendedor</strong>
                      <p>
                        O produtor optou por não disponibilizar os arquivos para esta solicitação. Caso deseje, envie uma nova mensagem detalhando seu interesse comercial.
                      </p>
                      <button
                        type="button"
                        className="button button--secondary button--small"
                        style={{ marginTop: "0.5rem" }}
                        onClick={() => setIsRequestAccessModalOpen(true)}
                      >
                        Enviar Nova Solicitação
                      </button>
                    </div>
                  </div>
                ) : buyerRequest?.status === "REVOGADO" ? (
                  <div className="ad-doc-banner ad-doc-banner--revoked">
                    <div className="ad-doc-banner__icon">
                      <Icon name="lock" />
                    </div>
                    <div className="ad-doc-banner__text">
                      <strong>Permissão de Acesso Revogada</strong>
                      <p>
                        O acesso aos documentos deste lote foi suspenso pelo produtor rural. Para retomar as negociações, envie uma nova solicitação.
                      </p>
                      <button
                        type="button"
                        className="button button--secondary button--small"
                        style={{ marginTop: "0.5rem" }}
                        onClick={() => setIsRequestAccessModalOpen(true)}
                      >
                        Solicitar Reabertura de Acesso
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ad-doc-banner ad-doc-banner--locked">
                    <div className="ad-doc-banner__icon">
                      <Icon name="lock" />
                    </div>
                    <div className="ad-doc-banner__text">
                      <strong>Documentação Protegida (Data Room Agro)</strong>
                      <p>
                        Por motivos de privacidade fiscal e sanitária do produtor, a visualização dos laudos oficiais requer solicitação prévia com identificação do comprador e interesse comercial no lote.
                      </p>
                      <div style={{ marginTop: "0.5rem" }}>
                        {session ? (
                          <button
                            type="button"
                            className="button button--primary button--small"
                            onClick={() => setIsRequestAccessModalOpen(true)}
                          >
                            <Icon name="lock" /> Solicitar Acesso aos Documentos
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button button--outline button--small"
                            onClick={() => onOpenDialog?.("login")}
                          >
                            <Icon name="lock" /> Fazer Login para Solicitar Acesso
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Grade de Documentos */}
                {anuncio.documentos && anuncio.documentos.length > 0 ? (
                  <div className="ad-doc-grid">
                    {anuncio.documentos.map((doc) => {
                      const isPdfFile =
                        doc.mimeType === "application/pdf" ||
                        doc.nomeArquivo.toLowerCase().endsWith(".pdf");
                      return (
                        <div
                          key={doc.id}
                          className={`ad-doc-card ${hasUnlockedAccess ? "ad-doc-card--unlocked" : "ad-doc-card--locked"}`}
                        >
                          <div className="ad-doc-card__header">
                            <span
                              className={`ad-doc-card__type-badge ${isPdfFile ? "ad-doc-card__type-badge--pdf" : "ad-doc-card__type-badge--img"}`}
                            >
                              {AD_DOCUMENT_SHORT_LABELS[doc.tipo] || doc.tipo}
                            </span>
                            <span
                              className={`ad-doc-card__lock-icon ${hasUnlockedAccess ? "ad-doc-card__lock-icon--unlocked" : ""}`}
                              title={hasUnlockedAccess ? "Documento desbloqueado" : "Documento protegido"}
                            >
                              <Icon name={hasUnlockedAccess ? "unlock" : "lock"} />
                            </span>
                          </div>

                          <div className="ad-doc-card__body">
                            <h4 className="ad-doc-card__title">
                              {AD_DOCUMENT_LABELS[doc.tipo] || doc.tipo}
                            </h4>
                            <p className="ad-doc-card__filename" title={doc.nomeArquivo}>
                              {doc.nomeArquivo}
                            </p>
                            <span className="ad-doc-card__size">
                              {formatarTamanhoArquivo(doc.tamanhoBytes)}
                            </span>
                          </div>

                          <div className="ad-doc-card__footer">
                            {hasUnlockedAccess ? (
                              <button
                                type="button"
                                className="button button--primary button--small button--full"
                                onClick={() => {
                                  setSelectedDocToView(doc);
                                  setIsViewDocModalOpen(true);
                                }}
                              >
                                <Icon name="eye" /> Visualizar Documento
                              </button>
                            ) : isClosed ? (
                              <button
                                type="button"
                                className="button button--outline button--small button--full"
                                disabled
                                title="Lote fora de mercado. Solicitações de documentos encerradas."
                              >
                                <Icon name="lock" /> Lote Encerrado
                              </button>
                            ) : session ? (
                              <button
                                type="button"
                                className="button button--outline button--small button--full"
                                onClick={() => setIsRequestAccessModalOpen(true)}
                                disabled={buyerRequest?.status === "PENDENTE"}
                              >
                                {buyerRequest?.status === "PENDENTE" ? (
                                  <>
                                    <Icon name="clock" /> Aguardando Liberação
                                  </>
                                ) : (
                                  <>
                                    <Icon name="lock" /> Solicitar Acesso
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="button button--outline button--small button--full"
                                onClick={() => onOpenDialog?.("login")}
                              >
                                <Icon name="lock" /> Entrar para Solicitar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Vendedor sem documentos anexados */
                  <div className="ad-doc-empty-seller">
                    <div className="ad-doc-empty-seller__icon">
                      <Icon name="file" />
                    </div>
                    <h4>Nenhum documento anexado a este lote</h4>
                    <p>
                      Lotes com Guia de Trânsito Animal (GTA), laudos sanitários e certificados geram mais confiança e fecham negócios mais rápido.
                    </p>
                    {!isClosed && (
                      <Link
                        to={`/anuncios/${anuncio.id}/editar`}
                        className="button button--primary button--small"
                      >
                        <Icon name="edit" /> Editar Anúncio para Anexar Documentos
                      </Link>
                    )}
                  </div>
                )}

                {/* PAINEL DO VENDEDOR: Solicitações de Acesso ao Lote */}
                {isOwner && (
                  <div className="ad-doc-seller-panel">
                    <div className="ad-doc-seller-panel__header">
                      <div>
                        <h3 className="ad-doc-seller-panel__title">
                          <Icon name="user" /> Solicitações de Acesso ao Lote ({sellerRequests.length})
                        </h3>
                        <p className="ad-doc-seller-panel__subtitle">
                          Avalie os compradores interessados e autorize a liberação de todos os documentos do anúncio de uma só vez.
                        </p>
                      </div>
                    </div>

                    {sellerRequests.length === 0 ? (
                      <div className="ad-doc-seller-panel__empty">
                        <Icon name="clock" />
                        <p>Nenhum comprador solicitou acesso aos documentos deste lote até o momento.</p>
                      </div>
                    ) : (
                      <div className="ad-doc-requests-list">
                        {sellerRequests.map((req) => (
                          <div
                            key={req.id}
                            className={`ad-doc-request-card ad-doc-request-card--${req.status.toLowerCase()}`}
                          >
                            <div className="ad-doc-request-card__header">
                              <div className="ad-doc-request-card__buyer">
                                <Avatar name={req.compradorNome} size={36} />
                                <div>
                                  <strong>{req.compradorNome}</strong>
                                  <span className="ad-doc-request-card__buyer-tag">
                                    {req.compradorTipo === "PJ" ? "Empresa / PJ" : "Pessoa Física"}
                                    {req.compradorCidadeUf ? ` · ${req.compradorCidadeUf}` : ""}
                                  </span>
                                </div>
                              </div>

                              <div className="ad-doc-request-card__status-wrap">
                                <span className={`ad-doc-status-badge ad-doc-status-badge--${req.status.toLowerCase()}`}>
                                  {req.status === "PENDENTE" && "⏳ Pendente"}
                                  {req.status === "APROVADO" && "✅ Acesso Liberado"}
                                  {req.status === "RECUSADO" && "❌ Recusado"}
                                  {req.status === "REVOGADO" && "🚫 Revogado"}
                                  {req.status === "CANCELADO" && "⏹ Finalizado"}
                                </span>
                                <span className="ad-doc-request-card__date">
                                  {new Date(req.solicitadoEm).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>

                            <div className="ad-doc-request-card__message">
                              <span className="ad-doc-request-card__message-label">
                                Justificativa Comercial:
                              </span>
                              <p className="ad-doc-request-card__message-text">
                                &ldquo;{req.mensagem}&rdquo;
                              </p>
                              {req.motivoRecusa && (
                                <p className="ad-doc-request-card__refusal-reason">
                                  Motivo: <em>{req.motivoRecusa}</em>
                                </p>
                              )}
                            </div>

                            <div className="ad-doc-request-card__actions">
                              {!isClosed && req.status === "PENDENTE" && (
                                <>
                                  <button
                                    type="button"
                                    className="button button--primary button--small"
                                    onClick={() => handleResponderSolicitacao(req.id, "APROVADO")}
                                    disabled={isProcessingRequest}
                                  >
                                    <Icon name="check" /> Autorizar Acesso ao Lote
                                  </button>
                                  <button
                                    type="button"
                                    className="button button--secondary button--small"
                                    onClick={() => handleResponderSolicitacao(req.id, "RECUSADO")}
                                    disabled={isProcessingRequest}
                                  >
                                    <Icon name="close" /> Recusar
                                  </button>
                                </>
                              )}

                              {!isClosed && req.status === "APROVADO" && (
                                <button
                                  type="button"
                                  className="button button--secondary button--small ad-btn-revoke"
                                  onClick={() => handleResponderSolicitacao(req.id, "REVOGADO")}
                                  disabled={isProcessingRequest}
                                  title="Interromper acesso deste comprador aos documentos"
                                >
                                  <Icon name="lock" /> Revogar Acesso
                                </button>
                              )}

                              {!isClosed && (req.status === "RECUSADO" || req.status === "REVOGADO") && (
                                <button
                                  type="button"
                                  className="button button--secondary button--small"
                                  onClick={() => handleResponderSolicitacao(req.id, "APROVADO")}
                                  disabled={isProcessingRequest}
                                >
                                  <Icon name="check" /> Reautorizar Acesso
                                </button>
                              )}

                              {isClosed && (
                                <span className="ad-doc-request-card__closed-notice">
                                  {req.status === "CANCELADO"
                                    ? req.motivoRecusa || "Solicitação finalizada com o encerramento do lote."
                                    : "Acesso a documentos expirado com o encerramento do lote."}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Coluna Direita: Preço, Produtor e Ação Comercial */}
          <aside className="ad-detail-sidebar">
            {/* Card de Preço */}
            <div className="ad-sidebar-card ad-sidebar-card--price">
              <span className="ad-sidebar-price-label">Preço Total do Lote</span>
              <div className="ad-sidebar-price-val">
                {anuncio.precoTotal.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>
              <p className="ad-sidebar-price-hint">Venda do lote completo no MVP</p>

              {anuncio.categoria === "GRAOS" ? (
                <div className="ad-sidebar-subprices">
                  <div className="ad-sidebar-subprice-item">
                    <span>Valor por saca (60 kg)</span>
                    <strong>
                      {anuncio.precoPorSaca.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </div>
                  <div className="ad-sidebar-subprice-item">
                    <span>Valor por tonelada</span>
                    <strong>
                      {anuncio.precoPorTonelada.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="ad-sidebar-subprices">
                  <div className="ad-sidebar-subprice-item">
                    <span>Valor por cabeça</span>
                    <strong>
                      {anuncio.precoPorCabeca.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </div>
                  <div className="ad-sidebar-subprice-item">
                    <span>Valor por arroba (@)</span>
                    <strong>
                      {anuncio.precoPorArroba.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              {isOwner ? (
                <div className="ad-owner-box">
                  {anuncio.status === "VENDIDO" ? (
                    <div className="ad-owner-badge ad-owner-badge--active">
                      <Icon name="check" /> Seu Lote Comercializado
                    </div>
                  ) : anuncio.status === "CANCELADO" ? (
                    <div className="ad-owner-badge ad-owner-badge--closed">
                      <Icon name="close" /> Seu Lote Cancelado / Retirado
                    </div>
                  ) : anuncio.status === "PAUSADO" ? (
                    <div className="ad-owner-badge ad-owner-badge--paused">
                      <Icon name="pause" /> Seu Lote Pausado no Mercado
                    </div>
                  ) : anuncio.status === "PAUSADO_MODERACAO" ? (
                    <div className="ad-owner-badge ad-owner-badge--paused">
                      <Icon name="pause" /> Seu Lote Pausado pela Moderação
                    </div>
                  ) : anuncio.status === "EM_REVISAO" ? (
                    <div className="ad-owner-badge ad-owner-badge--paused">
                      <Icon name="clock" /> Seu Lote em Revisão
                    </div>
                  ) : anuncio.status === "BLOQUEADO_MODERACAO" ? (
                    <div className="ad-owner-badge ad-owner-badge--closed">
                      <Icon name="ban" /> Seu Lote Bloqueado
                    </div>
                  ) : (
                    <div className="ad-owner-badge ad-owner-badge--active">
                      <Icon name="check" /> Seu Lote Ativo no Mercado
                    </div>
                  )}

                  {isClosed ? (
                    <>
                      <div className="ad-owner-closed-note">
                        🔒 Edição bloqueada para lotes encerrados
                      </div>
                      <button
                        type="button"
                        className="button button--primary button--full"
                        title="Usar este lote encerrado como modelo para um novo anúncio"
                        onClick={() => navigate(`/anunciar?copiarDe=${anuncio.id}`)}
                      >
                        <Icon name="copy" /> Usar como Modelo para Novo Lote
                      </button>
                    </>
                  ) : anuncio.status === "PAUSADO" ? (
                    <>
                      <button
                        type="button"
                        className="button button--primary button--full"
                        onClick={handleReativarAnuncio}
                        disabled={isReactivating}
                      >
                        <Icon name="play" /> {isReactivating ? "Reativando..." : "Reativar Anúncio Agora"}
                      </button>
                      <Link
                        to={`/anuncios/${anuncio.id}/editar`}
                        className="button button--secondary button--full ad-owner-edit-btn"
                      >
                        <Icon name="edit" /> Editar Informações
                      </Link>
                      <button
                        type="button"
                        className="button button--outline button--full ad-owner-close-btn"
                        onClick={() => setIsCloseModalOpen(true)}
                        title="Encerrar disponibilidade comercial deste lote"
                      >
                        <Icon name="box" /> Encerrar Disponibilidade
                      </button>
                      <button
                        type="button"
                        className="button button--secondary button--full"
                        title="Usar informações técnicas deste lote como modelo para um novo anúncio"
                        onClick={() => navigate(`/anunciar?copiarDe=${anuncio.id}`)}
                      >
                        <Icon name="copy" /> Usar como Modelo para Novo Lote
                      </button>
                    </>
                  ) : anuncio.status === "ATIVO" ? (
                    <>
                      <Link
                        to={`/anuncios/${anuncio.id}/editar`}
                        className="button button--primary button--full ad-owner-edit-btn"
                      >
                        <Icon name="edit" /> Editar Informações do Lote
                      </Link>
                      <button
                        type="button"
                        className="button button--outline button--full ad-owner-close-btn"
                        onClick={() => setIsCloseModalOpen(true)}
                        title="Encerrar disponibilidade comercial deste lote"
                      >
                        <Icon name="box" /> Encerrar Disponibilidade
                      </button>
                      <button
                        type="button"
                        className="button button--secondary button--full"
                        title="Usar informações técnicas deste lote como modelo para um novo anúncio"
                        onClick={() => navigate(`/anunciar?copiarDe=${anuncio.id}`)}
                      >
                        <Icon name="copy" /> Usar como Modelo para Novo Lote
                      </button>
                    </>
                  ) : (
                    <>
                      {anuncio.status !== "BLOQUEADO_MODERACAO" ? (
                        <>
                          <Link
                            to={`/anuncios/${anuncio.id}/editar`}
                            className="button button--primary button--full ad-owner-edit-btn"
                          >
                            <Icon name="edit" /> Editar Informações do Lote
                          </Link>
                          <button
                            type="button"
                            className="button button--secondary button--full"
                            title="Usar informações técnicas deste lote como modelo para um novo anúncio"
                            onClick={() => navigate(`/anunciar?copiarDe=${anuncio.id}`)}
                          >
                            <Icon name="copy" /> Usar como Modelo para Novo Lote
                          </button>
                        </>
                      ) : (
                        <div className="ad-owner-closed-note">
                          🚫 Anúncio bloqueado pela moderação
                        </div>
                      )}
                    </>
                  )}

                  <Link to={routes.myAds} className="ad-owner-box__link">
                    ← Gerenciar em Meus Anúncios
                  </Link>
                </div>
              ) : isClosed ? (
                <div className="ad-buyer-closed-box">
                  <div className="ad-buyer-closed-icon" aria-hidden="true">
                    <Icon name="box" />
                  </div>
                  <h3>Lote Fora de Mercado</h3>
                  <p>
                    Este lote foi formalmente finalizado pelo produtor rural (
                    {anuncio.status === "VENDIDO" ? "comercializado" : "retirado"}
                    ) e não aceita novos contatos comerciais.
                  </p>
                  <Link to={routes.market} className="button button--primary button--full">
                    Explorar outros lotes no Mercado
                  </Link>
                </div>
              ) : anuncio.status !== "ATIVO" ? (
                <div className="ad-buyer-paused-box">
                  <div className="ad-buyer-paused-icon" aria-hidden="true">
                    <Icon name="pause" />
                  </div>
                  <h3>Lote Temporariamente Indisponível</h3>
                  <p>Este lote está temporariamente indisponível ou em fase de negociação/revisão.</p>
                  <Link to={routes.market} className="button button--primary button--full">
                    Explorar outros lotes no Mercado
                  </Link>
                </div>
              ) : (
                <div className="ad-buyer-actions">
                  {contactSuccess ? (
                    <div className="ad-alert ad-alert--success">
                      Interesse registrado com sucesso! Em breve o vendedor entrará em contato.
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button button--primary button--large button--full"
                      onClick={() => setContactSuccess(true)}
                    >
                      Tenho Interesse neste Lote
                    </button>
                  )}
                  {producerProfile?.publicPhone && (
                    <a
                      href={`tel:${phoneDigits(producerProfile.publicPhone)}`}
                      className="button button--outline button--full ad-producer-phone-link"
                    >
                      <Icon name="phone" /> Contato: {formatPhone(phoneDigits(producerProfile.publicPhone))}
                    </a>
                  )}
                  <Link to={routes.market} className="button button--outline button--full">
                    Voltar ao Mercado
                  </Link>
                </div>
              )}

              {/* Painel de Auditoria Administrativa (Exclusivo para Sessão ADMIN) */}
              {isAdmin && (
                <div className="ad-admin-audit-panel" role="region" aria-label="Painel de Auditoria do Lote">
                  <div className="ad-admin-audit-panel__header">
                    <span>🛡️</span>
                    <span>Auditoria Interna — Governança</span>
                  </div>
                  <ul className="ad-admin-audit-panel__meta">
                    <li>
                      <strong>ID do Lote:</strong> <code>{anuncio.id}</code>
                    </li>
                    <li>
                      <strong>ID do Vendedor:</strong> <code>{anuncio.vendedorId}</code>
                    </li>
                    <li>
                      <strong>Timestamp de Criação:</strong>{" "}
                      <code>{new Date(anuncio.criadoEm).toLocaleString("pt-BR")}</code>
                    </li>
                    <li>
                      <strong>Status Interno:</strong> <code>{anuncio.status}</code>
                    </li>
                  </ul>
                  <div className="ad-admin-audit-panel__actions">
                    {anuncio.status !== "PAUSADO_MODERACAO" && (
                      <button
                        type="button"
                        className="button button--outline button--small button--full"
                        onClick={() => {
                          setAdminPauseReason(anuncio.motivoModeracao || "");
                          setShowAdminPauseModal(true);
                        }}
                      >
                        ⏸ Pausar este Lote por Moderação
                      </button>
                    )}
                    {(anuncio.status === "PAUSADO_MODERACAO" ||
                      anuncio.status === "EM_REVISAO" ||
                      anuncio.status === "BLOQUEADO_MODERACAO") && (
                      <button
                        type="button"
                        className="button button--primary button--small button--full"
                        onClick={handleAdminReleaseAd}
                      >
                        ✅ Liberar Anúncio para o Mercado
                      </button>
                    )}
                    <Link
                      to={ADMIN_SECRET_SLUG}
                      className="button button--ghost button--small button--full"
                    >
                      Ir ao Painel de Gestão ↗
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Card Clicável do Produtor / Fazenda */}
            <Link
              to={`/produtor/${anuncio.vendedorId}`}
              className="ad-sidebar-card ad-sidebar-card--producer-preview"
              aria-label={`Ver perfil público e vitrine de ${producerProfile?.farmName || anuncio.farmName}`}
            >
              <div className="ad-producer-preview-banner">
                <img src={producerProfile?.bannerUrl || farmImage} alt="" width="380" height="120" />
              </div>

              <div className="ad-producer-preview-body">
                <div className="ad-producer-preview-head">
                  <Avatar
                    url={producerProfile?.avatarUrl || anuncio.vendedorAvatar}
                    name={anuncio.vendedorNome}
                    size={64}
                    className="ad-producer-preview-avatar"
                  />
                  <div className="ad-producer-preview-titles">
                    <h3 className="ad-producer-preview-name">
                      {producerProfile?.farmName || anuncio.farmName}
                    </h3>
                    <p className="ad-producer-preview-owner">Produtor: {anuncio.vendedorNome}</p>
                  </div>
                </div>

                <div className="ad-producer-preview-meta">
                  <span className="ad-producer-preview-location">
                    <Icon name="location" />{" "}
                    {producerProfile?.city && producerProfile?.state
                      ? `${producerProfile.city} — ${producerProfile.state}`
                      : `${anuncio.cidade} — ${anuncio.uf}`}
                  </span>
                </div>

                <p className="ad-producer-preview-bio">
                  {producerProfile?.bio ||
                    "Produtor rural habilitado no SafraDireta, dedicado à produção agropecuária de alta qualidade."}
                </p>

                <div className="ad-producer-preview-cta">
                  <span>Ver perfil completo do produtor</span>
                  <span aria-hidden="true" className="ad-producer-preview-arrow">→</span>
                </div>
              </div>
            </Link>
          </aside>
        </div>
      </div>

      {/* Modal de Pausa por Moderação Administrativa */}
      {showAdminPauseModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAdminPauseModal(false)}
        >
          <form
            className="modal-card admin-modal-card"
            onSubmit={handleAdminConfirmPause}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-card__header">
              <h3>⏸ Pausar Lote por Moderação Administrativa</h3>
            </div>
            <p className="modal-card__body">
              O anúncio <strong>{anuncio.titulo}</strong> deixará de aparecer no Mercado público e o
              vendedor receberá a justificativa abaixo para corrigir o lote.
            </p>
            <div className="field">
              <label htmlFor="audit-pause-reason">Justificativa da Moderação (Obrigatória)</label>
              <textarea
                id="audit-pause-reason"
                rows={4}
                value={adminPauseReason}
                onChange={(e) => setAdminPauseReason(e.target.value)}
                placeholder="Informe o ajuste técnico ou documental necessário..."
                required
              />
            </div>
            <div className="modal-card__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setShowAdminPauseModal(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={adminPauseReason.trim().length < 10}
              >
                Confirmar Pausa Moderada
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Visualizador Ampliado de Imagem / Lightbox (US-012) */}
      {isLightboxOpen && (
        <div
          className="ad-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Visualizador ampliado de imagens"
        >
          {/* Cabeçalho do Lightbox */}
          <div className="ad-lightbox__header">
            <div className="ad-lightbox__info">
              <h3 className="ad-lightbox__title">{anuncio.titulo}</h3>
              <span className="ad-lightbox__counter">
                Foto {lightboxIndex + 1} de {fotos.length}
              </span>
            </div>
            <button
              type="button"
              className="ad-lightbox__close"
              onClick={() => setIsLightboxOpen(false)}
              title="Fechar visualizador (Esc)"
              aria-label="Fechar visualizador"
            >
              <Icon name="close" />
            </button>
          </div>

          {/* Palco Central do Lightbox */}
          <div
            className="ad-lightbox__body"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsLightboxOpen(false);
              }
            }}
          >
            {fotos.length > 1 && (
              <button
                type="button"
                className="ad-lightbox__nav ad-lightbox__nav--prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
                }}
                title="Foto anterior (Seta para a esquerda)"
                aria-label="Foto anterior"
              >
                <Icon name="back" />
              </button>
            )}

            <div className="ad-lightbox__image-container">
              <img
                src={fotos[lightboxIndex]}
                alt={`${anuncio.titulo} — Foto ${lightboxIndex + 1} de ${fotos.length}`}
                className="ad-lightbox__image"
              />
            </div>

            {fotos.length > 1 && (
              <button
                type="button"
                className="ad-lightbox__nav ad-lightbox__nav--next"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
                }}
                title="Próxima foto (Seta para a direita)"
                aria-label="Próxima foto"
              >
                <Icon name="arrow" />
              </button>
            )}
          </div>

          {/* Faixa de Miniaturas no Rodapé do Lightbox */}
          {fotos.length > 1 && (
            <div className="ad-lightbox__footer">
              <div className="ad-lightbox__thumbs">
                {fotos.map((foto, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`ad-lightbox__thumb ${idx === lightboxIndex ? "ad-lightbox__thumb--active" : ""}`}
                    onClick={() => setLightboxIndex(idx)}
                    aria-label={`Ver foto ${idx + 1}`}
                  >
                    <img src={foto} alt="" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Visualização de Documento do Lote (US-013) */}
      {selectedDocToView && anuncio && (
        <ViewAdDocumentModal
          isOpen={isViewDocModalOpen}
          onClose={() => {
            setIsViewDocModalOpen(false);
            setSelectedDocToView(null);
          }}
          documentos={anuncio.documentos && anuncio.documentos.length > 0 ? anuncio.documentos : [selectedDocToView]}
          documentoInicialId={selectedDocToView.id}
          anuncio={anuncio}
        />
      )}

      {/* Modal de Solicitação de Acesso aos Documentos (US-013) */}
      {anuncio && (
        <RequestAdAccessModal
          isOpen={isRequestAccessModalOpen}
          onClose={() => setIsRequestAccessModalOpen(false)}
          anuncio={anuncio}
          onSuccess={() => {
            recarregarSolicitacoes();
            setDocFeedbackToast(
              "Solicitação de acesso enviada ao produtor com sucesso! Você será notificado assim que for avaliada."
            );
          }}
        />
      )}

      {/* Modal de Encerramento do Lote (US-016) */}
      {isCloseModalOpen && anuncio && (
        <CloseAdModal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          anuncio={anuncio}
          onConfirm={handleConfirmarEncerramento}
        />
      )}
    </div>
  );
}
