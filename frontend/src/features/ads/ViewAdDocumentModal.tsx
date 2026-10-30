import { useEffect, useState } from "react";
import type { AdDocumentItem, MarketplaceAd } from "./ads.types";
import { AD_DOCUMENT_LABELS, formatarTamanhoArquivo } from "./ads.types";
import { obterDocumentoArquivoDoIndexedDB } from "./adsDocumentStorage";
import { Icon } from "../../components/Icon";

export interface ViewAdDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentos?: AdDocumentItem[];
  documentoInicialId?: string;
  /** Compatibilidade com chamada com documento único */
  documento?: AdDocumentItem | null;
  anuncio: MarketplaceAd;
}

export function ViewAdDocumentModal({
  isOpen,
  onClose,
  documentos = [],
  documentoInicialId,
  documento,
  anuncio,
}: ViewAdDocumentModalProps) {
  // Constrói a lista unificada de documentos
  const listaDocumentos =
    documentos && documentos.length > 0
      ? documentos
      : documento
      ? [documento]
      : [];

  const initialTargetId =
    documentoInicialId || documento?.id || listaDocumentos[0]?.id || "";

  const [activeDocId, setActiveDocId] = useState<string>(initialTargetId);
  const [loadedDocId, setLoadedDocId] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [isRealFile, setIsRealFile] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const currentDoc =
    listaDocumentos.find((d) => d.id === activeDocId) ||
    documento ||
    listaDocumentos[0] ||
    null;

  const isLoading = currentDoc ? loadedDocId !== currentDoc.id : false;

  useEffect(() => {
    if (!isOpen || !currentDoc) return;

    let isMounted = true;
    let urlCriada: string | null = null;

    // 1. Tenta carregar o arquivo binário real do IndexedDB
    obterDocumentoArquivoDoIndexedDB(currentDoc.id)
      .then((stored) => {
        if (!isMounted) return;

        if (stored && (stored.url || stored.blob)) {
          urlCriada = stored.url;
          setBlobUrl(urlCriada);
          setIsRealFile(true);
          const checkPdf =
            stored.mimeType === "application/pdf" ||
            stored.nomeArquivo.toLowerCase().endsWith(".pdf") ||
            currentDoc.nomeArquivo.toLowerCase().endsWith(".pdf");
          setIsPdf(checkPdf);
          setLoadedDocId(currentDoc.id);
          return;
        }

        // 2. Se o documento já tem uma URL transitória (blob ou remota)
        if (currentDoc.url) {
          setBlobUrl(currentDoc.url);
          setIsRealFile(true);
          const checkPdf =
            currentDoc.mimeType === "application/pdf" ||
            currentDoc.nomeArquivo.toLowerCase().endsWith(".pdf");
          setIsPdf(checkPdf);
          setLoadedDocId(currentDoc.id);
          return;
        }

        // 3. Fallback: Arquivo não localizado (Zero Documentos Fictícios)
        setBlobUrl(null);
        setIsRealFile(false);
        setIsPdf(false);
        setLoadedDocId(currentDoc.id);
      })
      .catch(() => {
        if (!isMounted) return;
        setBlobUrl(null);
        setIsRealFile(false);
        setIsPdf(false);
        setLoadedDocId(currentDoc.id);
      });

    return () => {
      isMounted = false;
      if (urlCriada && urlCriada.startsWith("blob:")) {
        URL.revokeObjectURL(urlCriada);
      }
    };
  }, [isOpen, currentDoc]);

  if (!isOpen || !currentDoc) return null;

  const docLabel = AD_DOCUMENT_LABELS[currentDoc.tipo] || "Documento do Lote";

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = currentDoc.nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="modal-backdrop ad-doc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ad-doc-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-card ad-doc-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Elegante do Dossiê */}
        <div className="ad-doc-modal-header">
          <div className="ad-doc-modal-header__info">
            <span className="ad-doc-tag">DOCUMENTO DO LOTE • DATA ROOM AGRO</span>
            <h3 id="ad-doc-modal-title" className="ad-doc-modal-title">
              {docLabel}
            </h3>
            <p className="ad-doc-modal-meta">
              Lote: <strong>{anuncio.titulo}</strong> · Produtor:{" "}
              <strong>{anuncio.vendedorNome || anuncio.farmName || "Produtor Rural"}</strong> ·{" "}
              <span>
                {anuncio.cidade}/{anuncio.uf}
              </span>
            </p>
          </div>

          <div className="ad-doc-modal-header__actions">
            {blobUrl && (
              <button
                type="button"
                className="button button--outline button--small ad-doc-download-btn"
                onClick={handleDownload}
                title="Baixar cópia do documento"
              >
                ⬇️ Baixar Cópia
              </button>
            )}

            <button
              type="button"
              className="icon-button ad-doc-modal-close"
              onClick={onClose}
              aria-label="Fechar visualizador"
              title="Fechar visualizador"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        {/* Abas de Navegação entre Documentos do Lote (Se houver mais de 1) */}
        {listaDocumentos.length > 1 && (
          <div className="ad-doc-tabs" role="tablist" aria-label="Documentos do Lote">
            {listaDocumentos.map((doc) => {
              const isActive = doc.id === currentDoc.id;
              const isPdfDoc =
                doc.mimeType === "application/pdf" ||
                doc.nomeArquivo.toLowerCase().endsWith(".pdf");
              return (
                <button
                  key={doc.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`ad-doc-tab ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveDocId(doc.id);
                    setZoom(1);
                    setRotation(0);
                  }}
                  title={doc.nomeArquivo}
                >
                  <Icon name={isPdfDoc ? "file" : "camera"} />
                  <span className="ad-doc-tab__label">
                    {AD_DOCUMENT_LABELS[doc.tipo] || doc.tipo}
                  </span>
                  <small className="ad-doc-tab__filename">({doc.nomeArquivo})</small>
                </button>
              );
            })}
          </div>
        )}

        {/* Barra de Ferramentas (Toolbar) */}
        <div className="ad-doc-toolbar">
          <div className="ad-doc-toolbar__left">
            <span
              className={`ad-doc-badge ${
                isPdf ? "ad-doc-badge--pdf" : "ad-doc-badge--img"
              }`}
            >
              {isPdf ? "PDF" : "IMAGEM"}
            </span>
            <code className="ad-doc-filename" title={currentDoc.nomeArquivo}>
              {currentDoc.nomeArquivo}
            </code>
            <span className="ad-doc-size">
              · {formatarTamanhoArquivo(currentDoc.tamanhoBytes)}
            </span>
            {isRealFile && (
              <span className="ad-doc-real-badge">● Arquivo Original</span>
            )}
          </div>

          {!isPdf && blobUrl && (
            <div
              className="ad-doc-toolbar__right"
              role="group"
              aria-label="Controles de visualização"
            >
              <button
                type="button"
                className="button button--secondary button--small ad-doc-tool-btn"
                onClick={() =>
                  setZoom((z) => Math.max(0.4, Number((z - 0.2).toFixed(1))))
                }
                disabled={zoom <= 0.4}
                title="Diminuir zoom"
              >
                🔍 −
              </button>
              <span className="ad-doc-tool-zoom">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="button button--secondary button--small ad-doc-tool-btn"
                onClick={() =>
                  setZoom((z) => Math.min(2.5, Number((z + 0.2).toFixed(1))))
                }
                disabled={zoom >= 2.5}
                title="Aumentar zoom"
              >
                🔍 +
              </button>
              <button
                type="button"
                className="button button--secondary button--small ad-doc-tool-btn"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Girar 90 graus"
              >
                🔄 Girar
              </button>
            </div>
          )}
        </div>

        {/* Viewport do Documento (Aspecto de Folha Real) */}
        <div className="ad-doc-modal-viewport">
          {isLoading ? (
            <div className="ad-doc-loading">
              <Icon name="clock" className="ad-loading-spinner" />
              <p>Carregando documento do Data Room...</p>
            </div>
          ) : blobUrl ? (
            isPdf ? (
              <iframe
                src={blobUrl}
                title={currentDoc.nomeArquivo}
                className="ad-doc-iframe"
                width="100%"
              />
            ) : (
              <div
                className="ad-doc-image-wrap"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease-out",
                }}
              >
                <img
                  src={blobUrl}
                  alt={currentDoc.nomeArquivo}
                  className="ad-doc-image"
                />
              </div>
            )
          ) : (
            /* Estado de Erro Limpo (Zero Documentos Fictícios) */
            <div className="ad-doc-error-card">
              <span className="ad-doc-error-icon">⚠️</span>
              <h4>Documento temporariamente indisponível para pré-visualização</h4>
              <p>
                O arquivo comprobatório (<code>{currentDoc.nomeArquivo}</code>) não foi
                localizado no armazenamento local seguro (IndexedDB).
              </p>
              <p className="ad-doc-error-hint">
                Caso você seja o anunciante ou necessite deste laudo para negociação, verifique a
                integridade do arquivo ou solicite o reenvio ao produtor.
              </p>
              <div className="ad-doc-error-actions">
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={onClose}
                >
                  Fechar Visualizador
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Segurança e Confidencialidade */}
        <div className="ad-doc-modal-footer">
          <span className="ad-doc-security-status">
            <Icon name="lock" /> Documento verificado no Data Room · Acesso restrito e confidencial
          </span>
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={onClose}
          >
            Fechar Visualizador
          </button>
        </div>
      </div>
    </div>
  );
}
