import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import { AccessRestricted } from "../../components/AccessRestricted";
import { Icon } from "../../components/Icon";
import { GRAIN_PACKAGING_LABELS, obterFotoCapa, obterTagsAnuncio } from "./ads.types";
import type { MarketplaceAd } from "./ads.types";
import { alternarStatusAnuncio, listarMeusAnuncios } from "./adsStorage";
import "./ads.css";

interface MyAdsPageProps {
  onOpenDialog?: OpenDevelopmentDialog;
}

export function MyAdsPage({ onOpenDialog }: MyAdsPageProps) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [anuncios, setAnuncios] = useState<MarketplaceAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "ATIVO" | "PAUSADO">("TODOS");
  const [adToPause, setAdToPause] = useState<MarketplaceAd | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session || session.vendedorEstado !== "HABILITADO") return;

    let isMounted = true;
    listarMeusAnuncios(session.conta.id)
      .then((resultado) => {
        if (isMounted) setAnuncios(resultado);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  // Efeito para fechar o modal com tecla ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && adToPause) {
        setAdToPause(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [adToPause]);

  // Auto-dismiss do toast após 5 segundos
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  async function handleConfirmarPausa() {
    if (!adToPause || !session) return;
    try {
      setIsTogglingStatus(true);
      const atualizado = await alternarStatusAnuncio(adToPause.id, "PAUSADO", session);
      setAnuncios((prev) => prev.map((a) => (a.id === atualizado.id ? atualizado : a)));
      setAdToPause(null);
      setToastMessage("Anúncio pausado com sucesso! O lote não está mais visível no Mercado.");
    } catch (err) {
      console.error("Erro ao pausar anúncio:", err);
      alert("Não foi possível pausar o anúncio. Tente novamente.");
    } finally {
      setIsTogglingStatus(false);
    }
  }

  async function handleReativarAnuncio(id: string) {
    if (!session) return;
    try {
      setIsTogglingStatus(true);
      const atualizado = await alternarStatusAnuncio(id, "ATIVO", session);
      setAnuncios((prev) => prev.map((a) => (a.id === atualizado.id ? atualizado : a)));
      setToastMessage("Anúncio reativado com sucesso! O lote já está visível novamente no Mercado.");
    } catch (err) {
      console.error("Erro ao reativar anúncio:", err);
      alert("Não foi possível reativar o anúncio. Tente novamente.");
    } finally {
      setIsTogglingStatus(false);
    }
  }

  if (!session || session.vendedorEstado !== "HABILITADO") {
    return (
      <AccessRestricted
        title="Área restrita para produtores habilitados"
        description="Acesse o painel dos seus lotes de animais, grãos ou café completando o cadastro de vendedor na sua conta."
        onOpenLogin={() => onOpenDialog?.("login")}
        onOpenRegister={() => onOpenDialog?.("registration")}
      />
    );
  }

  const total = anuncios.length;
  const totalAtivos = anuncios.filter((a) => a.status === "ATIVO").length;
  const totalPausados = anuncios.filter((a) => a.status === "PAUSADO").length;

  const anunciosFiltrados = anuncios.filter((anuncio) => {
    if (filtroStatus === "ATIVO") return anuncio.status === "ATIVO";
    if (filtroStatus === "PAUSADO") return anuncio.status === "PAUSADO";
    return true;
  });

  return (
    <div className="my-ads-page">
      <div className="container">
        {/* Cabeçalho do Painel */}
        <div className="my-ads-header">
          <div>
            <p className="eyebrow">Área do Produtor</p>
            <h1 className="my-ads-title">Meus Anúncios</h1>
            <p className="my-ads-subtitle">
              Acompanhe seus lotes de gado, grãos e café anunciados no mercado.
            </p>
          </div>
          <div className="my-ads-header__actions">
            <Link to={routes.createAd} className="button button--primary">
              + Novo Anúncio
            </Link>
          </div>
        </div>

        {/* Feedback Toast */}
        {toastMessage && (
          <div className="ad-alert ad-alert--success ad-alert--toast" role="status">
            <Icon name="leaf" />
            <span>{toastMessage}</span>
            <button
              type="button"
              className="ad-alert__close"
              onClick={() => setToastMessage(null)}
              aria-label="Fechar notificação"
            >
              <Icon name="close" />
            </button>
          </div>
        )}

        {/* Barra de Abas de Status (US-015) */}
        {!isLoading && total > 0 && (
          <div className="my-ads-tabs" role="tablist" aria-label="Filtrar por status do lote">
            <button
              type="button"
              role="tab"
              aria-selected={filtroStatus === "TODOS"}
              className={`my-ad-tab ${filtroStatus === "TODOS" ? "my-ad-tab--active" : ""}`}
              onClick={() => setFiltroStatus("TODOS")}
            >
              Todos <span className="my-ad-tab__badge">{total}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filtroStatus === "ATIVO"}
              className={`my-ad-tab ${filtroStatus === "ATIVO" ? "my-ad-tab--active" : ""}`}
              onClick={() => setFiltroStatus("ATIVO")}
            >
              Ativos <span className="my-ad-tab__badge">{totalAtivos}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filtroStatus === "PAUSADO"}
              className={`my-ad-tab ${filtroStatus === "PAUSADO" ? "my-ad-tab--active" : ""}`}
              onClick={() => setFiltroStatus("PAUSADO")}
            >
              Pausados <span className="my-ad-tab__badge">{totalPausados}</span>
            </button>
          </div>
        )}

        {/* Listagem ou Empty State */}
        {isLoading ? (
          <div className="ad-loading-box" aria-live="polite">
            <Icon name="clock" className="ad-loading-spinner" />
            <p>Carregando seus anúncios...</p>
          </div>
        ) : total === 0 ? (
          <div className="my-ads-empty">
            <div className="my-ads-empty__icon-wrapper" aria-hidden="true">
              <Icon name="box" className="my-ads-empty__icon" />
            </div>
            <h2>Você ainda não possui anúncios publicados</h2>
            <p>
              Publique seu primeiro lote de boi gordo, grãos ou café e conecte sua produção a compradores, cooperativas e indústrias em todo o Brasil.
            </p>
            <Link to={routes.createAd} className="button button--primary button--large">
              + Criar Primeiro Anúncio
            </Link>
          </div>
        ) : filtroStatus === "PAUSADO" && totalPausados === 0 ? (
          <div className="my-ads-empty my-ads-empty--tab">
            <div className="my-ads-empty__icon-wrapper my-ads-empty__icon-wrapper--leaf" aria-hidden="true">
              <Icon name="leaf" className="my-ads-empty__icon" />
            </div>
            <h2>Nenhum anúncio pausado</h2>
            <p>
              Todos os seus lotes cadastrados estão ativos e visíveis para compradores no Mercado.
            </p>
          </div>
        ) : filtroStatus === "ATIVO" && totalAtivos === 0 ? (
          <div className="my-ads-empty my-ads-empty--tab">
            <div className="my-ads-empty__icon-wrapper my-ads-empty__icon-wrapper--pause" aria-hidden="true">
              <Icon name="pause" className="my-ads-empty__icon" />
            </div>
            <h2>Nenhum anúncio ativo</h2>
            <p>
              Todos os seus lotes cadastrados estão pausados no momento. Você pode reativá-los na aba Pausados.
            </p>
          </div>
        ) : (
          <div className="my-ads-grid">
            {anunciosFiltrados.map((anuncio) => {
              const [tag1, tag2] = obterTagsAnuncio(anuncio);
              const isPaused = anuncio.status === "PAUSADO";

              return (
                <article
                  key={anuncio.id}
                  className={`my-ad-card ${isPaused ? "my-ad-card--paused" : ""}`}
                  onClick={() => navigate(`/anuncios/${anuncio.id}`)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalhes do anúncio ${anuncio.titulo}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/anuncios/${anuncio.id}`);
                    }
                  }}
                >
                  <div className="my-ad-card__thumb">
                    <img src={obterFotoCapa(anuncio)} alt={anuncio.titulo} loading="lazy" />

                    <div className="market-card__tags">
                      <span className="market-card__tag market-card__tag--primary" title={tag1}>
                        {tag1}
                      </span>
                      <span className="market-card__tag market-card__tag--secondary" title={tag2}>
                        {tag2}
                      </span>
                    </div>

                    {/* Coluna vertical de status e vídeo (Topo Direito) */}
                    <div className="my-ad-card__top-badges">
                      {isPaused ? (
                        <span className="my-ad-card__status-badge my-ad-card__status-badge--paused">
                          <Icon name="pause" /> Pausado
                        </span>
                      ) : (
                        <span className="my-ad-card__status-badge my-ad-card__status-badge--active">
                          <span className="status-dot"></span> Ativo
                        </span>
                      )}

                      {anuncio.video?.url && (
                        <span className="market-card__video-badge" title="Contém vídeo demonstrativo">
                          <Icon name="play" /> Vídeo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="my-ad-card__content">
                    <div className="my-ad-card__category-tag">
                      {tag1} · {tag2}
                    </div>
                    <h3 className="my-ad-card__title">{anuncio.titulo}</h3>

                    {anuncio.categoria === "GRAOS" ? (
                      <div className="my-ad-card__metrics">
                        <div>
                          <span className="my-ad-card__metric-label">Volume</span>
                          <strong>
                            {anuncio.quantidadeSacas.toLocaleString("pt-BR")} sc ({anuncio.pesoTotalToneladas} ton)
                          </strong>
                        </div>
                        <div>
                          <span className="my-ad-card__metric-label">Safra / Embalagem</span>
                          <strong>
                            {anuncio.safra} · {GRAIN_PACKAGING_LABELS[anuncio.embalagem]}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <div className="my-ad-card__metrics">
                        <div>
                          <span className="my-ad-card__metric-label">Quantidade</span>
                          <strong>{anuncio.quantidadeCabecas} cabeças</strong>
                        </div>
                        <div>
                          <span className="my-ad-card__metric-label">Média / Cabeça</span>
                          <strong>
                            {anuncio.pesoMedioArroba} @ ({anuncio.pesoMedioKg} kg)
                          </strong>
                        </div>
                      </div>
                    )}

                    <div className="my-ad-card__location">
                      <Icon name="location" />
                      <span>
                        {anuncio.cidade}, {anuncio.uf}
                      </span>
                    </div>

                    <div className="my-ad-card__price">
                      <span className="my-ad-card__price-label">Preço Total do Lote</span>
                      <strong>
                        {anuncio.precoTotal.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </strong>
                      <span className="my-ad-card__price-sub">
                        {anuncio.categoria === "GRAOS"
                          ? `(${anuncio.precoPorSaca.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })} / saca)`
                          : `(${anuncio.precoPorCabeca.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })} / cab.)`}
                      </span>
                    </div>

                    <div className="my-ad-card__footer">
                      <button
                        type="button"
                        className="button button--outline button--small my-ad-card__btn-edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/anuncios/${anuncio.id}/editar`);
                        }}
                      >
                        <Icon name="edit" /> Editar
                      </button>

                      {/* Ação de Pausar / Reativar (US-015) */}
                      {isPaused ? (
                        <button
                          type="button"
                          className="button button--primary button--small my-ad-card__btn-resume"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReativarAnuncio(anuncio.id);
                          }}
                          disabled={isTogglingStatus}
                          title="Reativar exibição do lote no Mercado"
                        >
                          <Icon name="play" /> Reativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button button--outline button--small my-ad-card__btn-pause"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAdToPause(anuncio);
                          }}
                          disabled={isTogglingStatus}
                          title="Pausar exibição do lote no Mercado"
                        >
                          <Icon name="pause" /> Pausar
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Pausa (US-015) */}
      {adToPause && (
        <div
          className="ad-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-modal-title"
          onClick={() => !isTogglingStatus && setAdToPause(null)}
        >
          <div
            className="ad-modal-card ad-modal-card--pause"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ad-modal-icon-wrapper ad-modal-icon-wrapper--amber" aria-hidden="true">
              <Icon name="pause" />
            </div>
            <p className="eyebrow">Gestão de Disponibilidade</p>
            <h2 id="pause-modal-title" className="ad-modal-title">
              Pausar Anúncio do Lote?
            </h2>
            <p className="ad-modal-description">
              Ao pausar este anúncio, o lote deixará de ser exibido imediatamente no Mercado e na vitrine da sua fazenda. Você poderá reativá-lo a qualquer momento sem perder os dados cadastrados.
            </p>

            <div className="ad-modal-target-box">
              <span className="ad-modal-target-label">Lote selecionado:</span>
              <strong className="ad-modal-target-name">{adToPause.titulo}</strong>
            </div>

            <div className="ad-modal-actions">
              <button
                type="button"
                className="button button--outline"
                onClick={() => setAdToPause(null)}
                disabled={isTogglingStatus}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button button--warning"
                onClick={handleConfirmarPausa}
                disabled={isTogglingStatus}
              >
                {isTogglingStatus ? "Pausando..." : "Confirmar Pausa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
