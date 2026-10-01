import { Icon } from "./Icon";

export function CategoryPlaceholder({ index }: { index: number }) {
  return (
    <article
      className={`category-card category-card--${index}`}
      aria-label={`Espaço reservado para categoria ${index}`}
    >
      <span className="category-card__number" aria-hidden="true">
        0{index}
      </span>
      <div className="category-card__content">
        <span className="category-card__label">Em breve</span>
        <h3>
          Novos caminhos
          <br />
          para sua safra
        </h3>
        <p>Categoria a definir</p>
      </div>
      <Icon name="leaf" className="category-card__icon" />
    </article>
  );
}

export function OfferPlaceholder({ index }: { index: number }) {
  return (
    <article
      className="offer-card"
      aria-label={`Modelo de oferta ${index}, aguardando informações`}
    >
      <div className="offer-card__top">
        <span className="badge">Em breve</span>
        <Icon name="box" />
      </div>
      <h3>Seu próximo bom negócio</h3>
      <p className="offer-card__producer">Informações do produtor</p>
      <p className="offer-card__location">
        <Icon name="location" />
        Localização a informar
      </p>
      <dl className="offer-card__details">
        <div>
          <dt>Quantidade</dt>
          <dd>A informar</dd>
        </div>
        <div>
          <dt>Preço do lote</dt>
          <dd>A informar</dd>
        </div>
      </dl>
      <button className="button button--pending" type="button" disabled>
        Aguardando informações
      </button>
    </article>
  );
}

export function ProducerPlaceholder({ index }: { index: number }) {
  return (
    <article
      className="producer-card"
      aria-label={`Modelo de perfil de produtor ${index}, aguardando informações`}
    >
      <div className="producer-card__avatar">
        <Icon name="user" />
      </div>
      <div>
        <span className="producer-card__label">Perfil em breve</span>
        <h3>Produtor SafraDireta</h3>
        <p>
          <Icon name="location" />
          Região a informar
        </p>
      </div>
      <div className="producer-card__footer">
        <span>Produção a informar</span>
        <span>Aguardando perfil</span>
      </div>
    </article>
  );
}
