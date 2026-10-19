import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import farmImage from "../../assets/images/farm-landscape.jpeg";
import { formatPhone, phoneDigits } from "../profile/profile";
import {
  COFFEE_SCREEN_LABELS,
  GRAIN_CROP_LABELS,
  GRAIN_PACKAGING_LABELS,
  PURPOSE_LABELS,
  SPECIES_LABELS,
  obterTagsAnuncio,
  obterYoutubeEmbedUrl,
} from "./ads.types";
import type { MarketplaceAd } from "./ads.types";
import { alternarStatusAnuncio, obterAnuncioPorId, obterPerfilProdutorPublico } from "./adsStorage";
import type { PublicProducerProfile } from "./adsStorage";
import "./ads.css";

export function AdDetailPage() {
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

  const isOwner = session && session.conta.id === anuncio.vendedorId;
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

        {/* Banner de Aviso de Anúncio Pausado (US-015) */}
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
                  </>
                )}

                <div className="ad-detail-banner__overlay">
                  <span className="ad-badge ad-badge--category">{tag1}</span>
                  <span className="ad-badge ad-badge--category">{tag2}</span>
                </div>

                <div className="ad-gallery-stage__counter">
                  {selectedMedia === "video" ? (
                    <>
                      <Icon name="play" /> Vídeo do Lote
                    </>
                  ) : (
                    <>
                      <Icon name="camera" /> {(typeof selectedMedia === "number" ? selectedMedia : 0) + 1} / {fotos.length}
                    </>
                  )}
                </div>
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
                  <div className="ad-owner-badge">
                    <Icon name="user" /> {anuncio.status === "PAUSADO" ? "Seu anúncio (Pausado)" : "Seu anúncio publicado"}
                  </div>
                  {anuncio.status === "PAUSADO" && (
                    <button
                      type="button"
                      className="button button--primary button--full"
                      onClick={handleReativarAnuncio}
                      disabled={isReactivating}
                    >
                      <Icon name="play" /> {isReactivating ? "Reativando..." : "Reativar Anúncio Agora"}
                    </button>
                  )}
                  <Link
                    to={`/anuncios/${anuncio.id}/editar`}
                    className={`button ${anuncio.status === "PAUSADO" ? "button--outline" : "button--primary"} button--full ad-owner-edit-btn`}
                  >
                    <Icon name="edit" /> Editar Informações do Lote
                  </Link>
                  <button
                    type="button"
                    className="button button--outline button--full"
                    onClick={() => navigate(routes.myAds)}
                  >
                    Gerenciar em Meus Anúncios
                  </button>
                </div>
              ) : anuncio.status === "PAUSADO" ? (
                <div className="ad-buyer-paused-box">
                  <div className="ad-buyer-paused-icon" aria-hidden="true">
                    <Icon name="pause" />
                  </div>
                  <h3>Lote Temporariamente Indisponível</h3>
                  <p>Este lote está temporariamente indisponível ou em fase de negociação pelo produtor.</p>
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
    </div>
  );
}
