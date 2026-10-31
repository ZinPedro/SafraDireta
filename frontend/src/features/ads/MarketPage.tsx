import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import { Icon } from "../../components/Icon";
import { GRAIN_PACKAGING_LABELS, obterFotoCapa, obterTagsAnuncio } from "./ads.types";
import type { MarketplaceAd } from "./ads.types";
import { correspondeBuscaAnuncio, listarAnunciosMercado } from "./adsStorage";
import "./ads.css";

export function MarketPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get("q") || "";
  const [searchTerm, setSearchTerm] = useState(urlQuery);
  const [debouncedTerm, setDebouncedTerm] = useState(urlQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [anuncios, setAnuncios] = useState<MarketplaceAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<"TODOS" | "ANIMAL" | "GRAOS">("TODOS");

  const isSeller = session?.vendedorEstado === "HABILITADO";

  // Sincroniza estado se a navegação do navegador alterar a URL (ex: Voltar / Avançar)
  useEffect(() => {
    const handlePopState = () => {
      const q = new URLSearchParams(window.location.search).get("q") || "";
      setSearchTerm(q);
      setDebouncedTerm(q);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Debounce de ~350ms para atualização do filtro e sincronização com URL
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      const trimmed = searchTerm.trim();

      setSearchParams(
        (prevParams) => {
          const currentQ = prevParams.get("q") || "";
          if (currentQ === trimmed) {
            return prevParams; // Não altera se o valor já for igual
          }
          const next = new URLSearchParams(prevParams);
          if (trimmed) {
            next.set("q", trimmed);
          } else {
            next.delete("q");
          }
          return next;
        },
        { replace: true }
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, setSearchParams]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedTerm(searchTerm);
    const currentQ = searchParams.get("q") || "";
    const trimmed = searchTerm.trim();
    if (currentQ !== trimmed) {
      setSearchParams(
        (prevParams) => {
          const next = new URLSearchParams(prevParams);
          if (trimmed) {
            next.set("q", trimmed);
          } else {
            next.delete("q");
          }
          return next;
        },
        { replace: true }
      );
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setDebouncedTerm("");
    setSearchParams(
      (prevParams) => {
        const next = new URLSearchParams(prevParams);
        next.delete("q");
        return next;
      },
      { replace: true }
    );
    searchInputRef.current?.focus();
  };

  const anunciosFiltrados = anuncios.filter((anuncio) => {
    const passaCategoria =
      filtroCategoria === "TODOS" || anuncio.categoria === filtroCategoria;
    const passaBusca = correspondeBuscaAnuncio(anuncio, debouncedTerm);
    return passaCategoria && passaBusca;
  });

  return (
    <div className="market-page">
      <div className="container">
        {/* Banner / Cabeçalho do Mercado */}
        <header className="market-header">
          <div className="market-header__content">
            <p className="eyebrow">Mercado Agropecuário</p>
            <h1 className="market-title">Lotes e Ofertas Disponíveis</h1>
            <p className="market-subtitle">
              Negociação direta com produtores rurais. Encontre lotes de gado de corte, café, soja, milho e trigo.
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

        {/* Barra de Pesquisa por Palavra-Chave (US-020) */}
        <div className="market-search-section">
          <form
            className="market-search-bar"
            role="search"
            onSubmit={handleSubmit}
            aria-label="Buscar anúncios no mercado"
          >
            <div className="market-search-bar__icon" aria-hidden="true">
              <Icon name="search" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="market-search-bar__input"
              placeholder="Buscar por lote, raça, cultura, cidade ou palavra-chave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar anúncios por palavra-chave"
            />
            {searchTerm && (
              <button
                type="button"
                className="market-search-bar__clear"
                onClick={handleClearSearch}
                title="Limpar pesquisa"
                aria-label="Limpar campo de pesquisa"
              >
                <Icon name="close" />
              </button>
            )}
          </form>
        </div>

        {/* Barra de Filtros e Categorias */}
        <div className="market-filter-bar">
          <div className="market-filter-chips" role="radiogroup" aria-label="Filtro de categorias">
            <button
              type="button"
              className={`market-chip ${filtroCategoria === "TODOS" ? "market-chip--active" : ""}`}
              onClick={() => setFiltroCategoria("TODOS")}
            >
              Todos os Lotes ({anuncios.length})
            </button>
            <button
              type="button"
              className={`market-chip ${filtroCategoria === "ANIMAL" ? "market-chip--active" : ""}`}
              onClick={() => setFiltroCategoria("ANIMAL")}
            >
              Boi Gordo
            </button>
            <button
              type="button"
              className={`market-chip ${filtroCategoria === "GRAOS" ? "market-chip--active" : ""}`}
              onClick={() => setFiltroCategoria("GRAOS")}
            >
              Grãos e Café
            </button>
          </div>

          <div className="market-count-label">
            {debouncedTerm.trim() ? (
              <span className="market-count-label__search-wrap">
                <span>
                  Exibindo <strong>{anunciosFiltrados.length}</strong>{" "}
                  {anunciosFiltrados.length === 1 ? "oferta" : "ofertas"} para
                </span>
                <span className="market-search-chip">
                  &ldquo;{debouncedTerm.trim()}&rdquo;
                  <button
                    type="button"
                    className="market-search-chip__btn"
                    onClick={handleClearSearch}
                    title="Remover filtro de busca"
                    aria-label="Remover filtro de busca"
                  >
                    <Icon name="close" />
                  </button>
                </span>
              </span>
            ) : (
              <span>
                Exibindo <strong>{anunciosFiltrados.length}</strong>{" "}
                {anunciosFiltrados.length === 1 ? "oferta" : "ofertas"}
              </span>
            )}
          </div>
        </div>

        {/* Listagem dos Lotes */}
        {isLoading ? (
          <div className="ad-loading-box" aria-live="polite">
            <Icon name="clock" className="ad-loading-spinner" />
            <p>Carregando ofertas do mercado...</p>
          </div>
        ) : anunciosFiltrados.length === 0 ? (
          debouncedTerm.trim() ? (
            <div className="market-empty-box market-empty-box--search" role="status">
              <div className="market-empty-box__icon-wrapper" aria-hidden="true">
                <Icon name="search" />
              </div>
              <h2>Nenhum lote encontrado para &ldquo;{debouncedTerm.trim()}&rdquo;</h2>
              <p>
                Não encontramos ofertas correspondentes à sua pesquisa. Tente palavras-chave mais genéricas, revise a ortografia ou limpe a busca.
              </p>
              <button
                type="button"
                className="button button--primary button--large"
                onClick={handleClearSearch}
              >
                Limpar busca e ver todos os lotes
              </button>
            </div>
          ) : (
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
          )
        ) : (
          <div className="market-grid">
            {anunciosFiltrados.map((anuncio) => {
              const [tag1, tag2] = obterTagsAnuncio(anuncio);
              return (
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
                    <img src={obterFotoCapa(anuncio)} alt={anuncio.titulo} loading="lazy" />
                    {anuncio.video?.url && (
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

                    <div className="market-card__location">
                      <Icon name="location" />
                      <span>
                        {anuncio.cidade}, {anuncio.uf}
                      </span>
                    </div>

                    {anuncio.categoria === "GRAOS" ? (
                      <dl className="market-card__specs">
                        <div>
                          <dt>Volume</dt>
                          <dd>
                            {anuncio.quantidadeSacas.toLocaleString("pt-BR")} sc ({anuncio.pesoTotalToneladas} ton)
                          </dd>
                        </div>
                        <div>
                          <dt>Safra / Embalagem</dt>
                          <dd>
                            {anuncio.safra} · {GRAIN_PACKAGING_LABELS[anuncio.embalagem]}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <dl className="market-card__specs">
                        <div>
                          <dt>Quantidade</dt>
                          <dd>{anuncio.quantidadeCabecas} cab.</dd>
                        </div>
                        <div>
                          <dt>Média / Cabeça</dt>
                          <dd>
                            {anuncio.pesoMedioArroba} @ ({anuncio.pesoMedioKg} kg)
                          </dd>
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
                            ? `(${anuncio.precoPorSaca.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })} / saca 60 kg)`
                            : `(${anuncio.precoPorCabeca.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })} / cabeça)`}
                        </span>
                      </div>

                      <span className="market-card__btn-view">
                        Ver Lote <Icon name="arrow" />
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
