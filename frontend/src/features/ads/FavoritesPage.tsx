import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import { Icon } from "../../components/Icon";
import {
  GRAIN_PACKAGING_LABELS,
  obterFotoCapa,
  obterTagsAnuncio,
} from "./ads.types";
import type { MarketplaceAd } from "./ads.types";
import {
  alternarFavoritoStorage,
  listarAnunciosFavoritados,
} from "./favoritesStorage";
import "./ads.css";

type TabFiltro = "TODOS" | "DISPONIVEIS" | "ENCERRADOS";

interface FavoritesPageProps {
  onOpenDialog?: OpenDevelopmentDialog;
}

export function FavoritesPage({ onOpenDialog }: FavoritesPageProps) {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [favoritos, setFavoritos] = useState<MarketplaceAd[]>([]);
  const [isLoading, setIsLoading] = useState(() => Boolean(session?.conta?.id));
  const [tabAtiva, setTabAtiva] = useState<TabFiltro>("TODOS");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.conta?.id) return;

    let isMounted = true;
    listarAnunciosFavoritados(session.conta.id)
      .then((itens) => {
        if (isMounted) {
          setFavoritos(itens);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar favoritos:", err);
        if (isMounted) setIsLoading(false);
      });

    const handleFavoritosAtualizados = () => {
      if (session?.conta?.id) {
        listarAnunciosFavoritados(session.conta.id).then((itens) => {
          if (isMounted) setFavoritos(itens);
        });
      }
    };

    window.addEventListener("safra:favorites-updated", handleFavoritosAtualizados);
    return () => {
      isMounted = false;
      window.removeEventListener("safra:favorites-updated", handleFavoritosAtualizados);
    };
  }, [session]);

  const handleRemoverFavorito = (e: React.MouseEvent, anuncioId: string, titulo: string) => {
    e.stopPropagation();
    if (!session?.conta?.id) return;

    alternarFavoritoStorage(session.conta.id, anuncioId);
    setFavoritos((atuais) => atuais.filter((a) => a.id !== anuncioId));

    setToastMessage(`"${titulo}" removido dos favoritos.`);
    setTimeout(() => {
      setToastMessage((msg) => (msg?.includes(titulo) ? null : msg));
    }, 3500);
  };

  const disponiveis = favoritos.filter((a) => a.status === "ATIVO");
  const encerrados = favoritos.filter((a) => a.status !== "ATIVO");

  const anunciosExibidos =
    tabAtiva === "DISPONIVEIS"
      ? disponiveis
      : tabAtiva === "ENCERRADOS"
      ? encerrados
      : favoritos;

  // Se o usuário não estiver logado
  if (!session) {
    return (
      <div className="favorites-page container">
        <div className="favorites-header">
          <Link to={routes.market} className="favorites-back-link">
            <Icon name="arrow" /> Voltar ao Mercado
          </Link>
          <h1 className="favorites-title">
            <Icon name="star" /> Meus Lotes Favoritos
          </h1>
          <p className="favorites-subtitle">
            Acompanhe e monitore os lotes agropecuários de seu interesse
          </p>
        </div>

        <div className="favorites-login-card">
          <div className="favorites-login-icon" aria-hidden="true">
            <Icon name="star" />
          </div>
          <h2>Acesse sua conta para ver seus favoritos</h2>
          <p>
            Salve lotes de bois, grãos e café para acompanhar oscilações de preço, comparar cargas e
            negociar diretamente com os produtores quando for o melhor momento.
          </p>
          <div className="favorites-login-actions">
            <button
              type="button"
              className="button button--primary button--large"
              onClick={() => onOpenDialog?.("login")}
            >
              Entrar na Minha Conta
            </button>
            <Link to={routes.market} className="button button--outline button--large">
              Explorar Lotes no Mercado
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="favorites-page container">
      {toastMessage && (
        <div className="favorites-toast" role="status" aria-live="polite">
          <Icon name="check" />
          <span>{toastMessage}</span>
          <button
            type="button"
            className="favorites-toast__close"
            onClick={() => setToastMessage(null)}
            aria-label="Fechar notificação"
          >
            ×
          </button>
        </div>
      )}

      <div className="favorites-header">
        <Link to={routes.market} className="favorites-back-link">
          <Icon name="arrow" /> Voltar ao Mercado
        </Link>
        <div className="favorites-title-row">
          <h1 className="favorites-title">
            <Icon name="star" /> Meus Lotes Favoritos
          </h1>
          <span className="favorites-count-badge">
            {favoritos.length} {favoritos.length === 1 ? "lote salvo" : "lotes salvos"}
          </span>
        </div>
        <p className="favorites-subtitle">
          Gerencie e monitore os lotes de animais e grãos que você selecionou no mercado
        </p>
      </div>

      {/* Abas de Filtragem de Favoritos */}
      <div className="favorites-tabs" role="tablist" aria-label="Filtro de favoritos">
        <button
          type="button"
          role="tab"
          aria-selected={tabAtiva === "TODOS"}
          className={`favorites-tab ${tabAtiva === "TODOS" ? "favorites-tab--active" : ""}`}
          onClick={() => setTabAtiva("TODOS")}
        >
          Todos <span className="favorites-tab__counter">{favoritos.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tabAtiva === "DISPONIVEIS"}
          className={`favorites-tab ${tabAtiva === "DISPONIVEIS" ? "favorites-tab--active" : ""}`}
          onClick={() => setTabAtiva("DISPONIVEIS")}
        >
          Disponíveis <span className="favorites-tab__counter">{disponiveis.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tabAtiva === "ENCERRADOS"}
          className={`favorites-tab ${tabAtiva === "ENCERRADOS" ? "favorites-tab--active" : ""}`}
          onClick={() => setTabAtiva("ENCERRADOS")}
        >
          Encerrados <span className="favorites-tab__counter">{encerrados.length}</span>
        </button>
      </div>

      {/* Carregamento */}
      {isLoading ? (
        <div className="favorites-loading">
          <div className="spinner" />
          <p>Carregando seus lotes favoritos...</p>
        </div>
      ) : anunciosExibidos.length === 0 ? (
        /* Empty State */
        <div className="favorites-empty-card">
          <div className="favorites-empty-icon" aria-hidden="true">
            <Icon name="star" />
          </div>
          <h3>
            {favoritos.length === 0
              ? "Você ainda não salvou nenhum lote"
              : tabAtiva === "DISPONIVEIS"
              ? "Nenhum lote disponível no momento"
              : "Nenhum lote encerrado entre seus favoritos"}
          </h3>
          <p>
            {favoritos.length === 0
              ? "Clique no ícone de estrela nos cards do mercado para salvar lotes de interesse e consultá-los rapidamente aqui."
              : tabAtiva === "DISPONIVEIS"
              ? "Todos os lotes salvos por você já foram comercializados ou pausados pelos produtores."
              : "Nenhum dos lotes salvos por você foi finalizado ou retirado de comercialização."}
          </p>
          <Link to={routes.market} className="button button--primary">
            Explorar Lotes no Mercado
          </Link>
        </div>
      ) : (
        /* Grid de Cards */
        <div className="market-grid">
          {anunciosExibidos.map((anuncio) => {
            const [tag1, tag2] = obterTagsAnuncio(anuncio);
            const isClosed = anuncio.status !== "ATIVO";

            return (
              <article
                key={anuncio.id}
                className={`market-card ${isClosed ? "market-card--closed" : ""}`}
                onClick={isClosed ? undefined : () => navigate(`/anuncios/${anuncio.id}`)}
                tabIndex={isClosed ? -1 : 0}
                onKeyDown={
                  isClosed
                    ? undefined
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/anuncios/${anuncio.id}`);
                        }
                      }
                }
                title={
                  isClosed
                    ? "Lote fora de comercialização. Detalhes indisponíveis."
                    : `Ver detalhes de ${anuncio.titulo}`
                }
              >
                <div className="market-card__thumb">
                  <img src={obterFotoCapa(anuncio)} alt={anuncio.titulo} loading="lazy" />

                  {/* Badge de Status de Encerramento (US-025 / US-016) */}
                  {isClosed && (
                    <span
                      className={`market-card__closed-badge ${
                        anuncio.status === "VENDIDO"
                          ? "market-card__closed-badge--sold"
                          : "market-card__closed-badge--paused"
                      }`}
                    >
                      {anuncio.status === "VENDIDO"
                        ? "Lote Vendido"
                        : anuncio.status === "PAUSADO"
                        ? "Lote Pausado"
                        : "Lote Cancelado"}
                    </span>
                  )}

                  {/* Botão de Desfavoritar (Sempre ativo, mesmo em encerrados) */}
                  <button
                    type="button"
                    className="market-card__fav-btn market-card__fav-btn--active"
                    onClick={(e) => handleRemoverFavorito(e, anuncio.id, anuncio.titulo)}
                    title="Remover dos favoritos"
                    aria-label="Remover dos favoritos"
                    aria-pressed={true}
                  >
                    <Icon name="star" />
                  </button>

                  {!isClosed && anuncio.video?.url && (
                    <span className="market-card__video-badge" title="Contém vídeo demonstrativo">
                      <Icon name="play" /> Vídeo
                    </span>
                  )}

                  <div className="market-card__tags">
                    <span className="market-card__tag market-card__tag--primary" title={tag1}>
                      {tag1}
                    </span>
                    <span className="market-card__tag market-card__tag--secondary" title={tag2}>
                      {tag2}
                    </span>
                  </div>
                </div>

                <div className="market-card__body">
                  <h2 className="market-card__title">{anuncio.titulo}</h2>
                  <p className="market-card__farm">{anuncio.farmName}</p>

                  <div
                    className="market-card__location"
                    title={`${anuncio.cidade} - ${anuncio.uf}${anuncio.regiaoAproximada ? ` (${anuncio.regiaoAproximada})` : ""}`}
                  >
                    <Icon name="location" />
                    <span>
                      {anuncio.cidade}, {anuncio.uf}
                    </span>
                  </div>

                  {anuncio.categoria === "GRAOS" ? (
                    <dl className="market-card__specs">
                      <div>
                        <dt>Volume</dt>
                        <dd>{anuncio.quantidadeSacas.toLocaleString("pt-BR")} sc</dd>
                      </div>
                      <div>
                        <dt>Safra</dt>
                        <dd>{anuncio.safra}</dd>
                      </div>
                      <div>
                        <dt>Embalagem</dt>
                        <dd>{GRAIN_PACKAGING_LABELS[anuncio.embalagem]}</dd>
                      </div>
                    </dl>
                  ) : (
                    <dl className="market-card__specs">
                      <div>
                        <dt>Cabeças</dt>
                        <dd>{anuncio.quantidadeCabecas}</dd>
                      </div>
                      <div>
                        <dt>Peso Médio</dt>
                        <dd>{anuncio.pesoMedioArroba.toLocaleString("pt-BR")} @</dd>
                      </div>
                      <div>
                        <dt>Local</dt>
                        <dd>{anuncio.uf}</dd>
                      </div>
                    </dl>
                  )}

                  <div className="market-card__footer">
                    <div className="market-card__price-box">
                      <span className="market-card__price-label">Preço Total do Lote</span>
                      <strong className="market-card__price-val">
                        {anuncio.precoTotal.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </strong>
                      <span className="market-card__price-sub">
                        {anuncio.categoria === "GRAOS"
                          ? `${anuncio.precoPorSaca.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })} / sc`
                          : `${anuncio.precoPorArroba.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })} / @`}
                      </span>
                    </div>

                    {isClosed ? (
                      <span className="market-card__btn-view market-card__btn-view--disabled">
                        Negociação Encerrada
                      </span>
                    ) : (
                      <span className="market-card__btn-view">Ver Detalhes do Lote →</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
