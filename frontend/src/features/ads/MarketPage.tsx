import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import { Icon } from "../../components/Icon";
import type { AnimalLotAd } from "./ads.types";
import { listarAnunciosMercado } from "./adsStorage";
import "./ads.css";

export function MarketPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [anuncios, setAnuncios] = useState<AnimalLotAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODOS");

  const isSeller = session?.vendedorEstado === "HABILITADO";

  useEffect(() => {
    let isMounted = true;
    listarAnunciosMercado()
      .then((resultado) => {
        if (isMounted) setAnuncios(resultado);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const anunciosFiltrados =
    filtroCategoria === "TODOS"
      ? anuncios
      : anuncios.filter((a) => a.especie === filtroCategoria);

  return (
    <div className="market-page">
      <div className="container">
        {/* Banner / Cabeçalho do Mercado */}
        <header className="market-header">
          <div className="market-header__content">
            <p className="eyebrow">Mercado Agropecuário</p>
            <h1 className="market-title">Lotes e Ofertas Disponíveis</h1>
            <p className="market-subtitle">
              Negociação direta com produtores rurais. Encontre lotes de gado de corte, recria e reprodução.
            </p>
          </div>

          {/* Botão de Anunciar se Vendedor Habilitado */}
          {isSeller && (
            <div className="market-header__seller-action">
              <Link to={routes.createAd} className="button button--primary button--large">
                + Anunciar Lote
              </Link>
            </div>
          )}
        </header>

        {/* Barra de Filtros e Categorias */}
        <div className="market-filter-bar">
          <div className="market-filter-chips" role="radiogroup" aria-label="Filtro de espécies">
            <button
              type="button"
              className={`market-chip ${filtroCategoria === "TODOS" ? "market-chip--active" : ""}`}
              onClick={() => setFiltroCategoria("TODOS")}
            >
              Todos os Lotes ({anuncios.length})
            </button>
            <button
              type="button"
              className={`market-chip ${filtroCategoria === "BOVINO" ? "market-chip--active" : ""}`}
              onClick={() => setFiltroCategoria("BOVINO")}
            >
              Boi Gordo e Bovinos
            </button>
          </div>

          <div className="market-count-label">
            Exibindo <strong>{anunciosFiltrados.length}</strong> {anunciosFiltrados.length === 1 ? "oferta" : "ofertas"}
          </div>
        </div>

        {/* Listagem dos Lotes */}
        {isLoading ? (
          <div className="ad-loading-box" aria-live="polite">
            <Icon name="clock" className="ad-loading-spinner" />
            <p>Carregando ofertas do mercado...</p>
          </div>
        ) : anunciosFiltrados.length === 0 ? (
          <div className="market-empty-box">
            <Icon name="box" />
            <h2>Nenhum lote encontrado nesta categoria</h2>
            <p>Seja o primeiro a anunciar lotes nesta categoria no SafraDireta.</p>
            {isSeller ? (
              <Link to={routes.createAd} className="button button--primary">
                Anunciar Lote Agora
              </Link>
            ) : (
              <Link to={routes.sellerUpgrade} className="button button--outline">
                Habilitar como Produtor
              </Link>
            )}
          </div>
        ) : (
          <div className="market-grid">
            {anunciosFiltrados.map((anuncio) => (
              <article
                key={anuncio.id}
                className="market-card"
                onClick={() => navigate(`/anuncios/${anuncio.id}`)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/anuncios/${anuncio.id}`);
                  }
                }}
              >
                <div className="market-card__thumb">
                  <img src={anuncio.imagemUrl} alt={anuncio.titulo} loading="lazy" />
                  <span className="market-card__tag" title={anuncio.raca}>
                    {anuncio.raca}
                  </span>
                </div>

                <div className="market-card__body">
                  <h2 className="market-card__title">{anuncio.titulo}</h2>
                  <p className="market-card__farm">{anuncio.farmName}</p>

                  <div className="market-card__location">
                    <Icon name="location" />
                    <span>{anuncio.cidade}, {anuncio.uf}</span>
                  </div>

                  <dl className="market-card__specs">
                    <div>
                      <dt>Quantidade</dt>
                      <dd>{anuncio.quantidadeCabecas} cab.</dd>
                    </div>
                    <div>
                      <dt>Média / Cabeça</dt>
                      <dd>{anuncio.pesoMedioArroba} @ ({anuncio.pesoMedioKg} kg)</dd>
                    </div>
                  </dl>

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
                        ({anuncio.precoPorCabeca.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} / cabeça)
                      </span>
                    </div>

                    <span className="market-card__btn-view">
                      Ver Lote <Icon name="arrow" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
