import { useState } from "react";
import { Icon } from "../../components/Icon";

export interface LocationMapEmbedProps {
  cidade: string;
  uf: string;
  regiaoAproximada?: string;
  altura?: number | string;
}

export function LocationMapEmbed({
  cidade,
  uf,
  regiaoAproximada,
  altura = 280,
}: LocationMapEmbedProps) {
  const [iframeError, setIframeError] = useState(false);

  const query = encodeURIComponent(`${cidade.trim()}, ${uf.trim()}, Brasil`);
  const mapSrc = `https://maps.google.com/maps?q=${query}&t=&z=10&ie=UTF8&iwloc=&output=embed`;
  const externalMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

  const alturaCss = typeof altura === "number" ? `${altura}px` : altura;

  return (
    <div className="ad-location-embed" style={{ minHeight: alturaCss }}>
      <div className="ad-location-embed__frame-wrap" style={{ height: alturaCss }}>
        {!iframeError ? (
          <iframe
            src={mapSrc}
            title={`Mapa da região aproximada de ${cidade} - ${uf}`}
            className="ad-location-embed__iframe"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            onError={() => setIframeError(true)}
          />
        ) : (
          <div className="ad-location-embed__fallback">
            <Icon name="location" />
            <p>Visualização interativa do mapa indisponível offline.</p>
            <a
              href={externalMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button button--secondary button--small"
            >
              Visualizar {cidade} - {uf} no Google Maps ↗
            </a>
          </div>
        )}
      </div>

      <div className="ad-location-embed__caption">
        <div className="ad-location-embed__caption-info">
          <Icon name="location" />
          <span className="ad-location-embed__city-uf">
            {cidade}, {uf}
          </span>
          {regiaoAproximada && (
            <span className="ad-location-embed__region-badge" title="Polo / Região agrícola">
              {regiaoAproximada}
            </span>
          )}
        </div>

        <a
          href={externalMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ad-location-embed__ext-link"
          title="Abrir localização e traçar rotas no Google Maps (nova aba)"
        >
          Abrir no Google Maps ↗
        </a>
      </div>
    </div>
  );
}
