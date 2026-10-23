import { useEffect, useState } from "react";
import { obterDocumentosPJDoIndexedDB } from "../../corporate-registration/corporateDocsStorage";
import { obterDocumentosProdutorDoIndexedDB } from "../../seller-upgrade/producerDocsStorage";

export interface ViewUserDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  fileName: string;
  cnpjClean?: string;
  docKind: "CONTRATO" | "CNPJ" | "REP_FRENTE" | "REP_VERSO" | "RG_FRENTE" | "RG_VERSO" | "CAR";
  isPf?: boolean;
  userId?: string;
  pfDocKey?: "rgFrente" | "rgVerso" | "car";
  onOpenReplaceModal?: () => void;
  empresaInfo?: {
    razaoSocial: string;
    cnpj: string;
    representante?: {
      nome: string;
      cpf: string;
      vinculo: string;
    };
    endereco?: {
      logradouro: string;
      numero: string;
      cidade: string;
      uf: string;
    };
  };
}

export function ViewUserDocumentModal({
  isOpen,
  onClose,
  documentTitle,
  fileName,
  cnpjClean,
  docKind,
  isPf,
  userId,
  pfDocKey,
  onOpenReplaceModal,
  empresaInfo: _empresaInfo,
}: ViewUserDocumentModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobObj, setBlobObj] = useState<Blob | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    let urlCriada: string | null = null;

    if (isPf && userId) {
      obterDocumentosProdutorDoIndexedDB(userId).then((stored) => {
        if (!isMounted) return;
        if (!stored) {
          setBlobUrl(null);
          setBlobObj(null);
          return;
        }

        let alvoBlob: Blob | undefined;
        let alvoNome = "";

        if (pfDocKey === "rgFrente" || docKind === "RG_FRENTE") {
          alvoBlob = stored.rgFrenteBlob;
          alvoNome = stored.rgFrenteNome || fileName;
        } else if (pfDocKey === "rgVerso" || docKind === "RG_VERSO") {
          alvoBlob = stored.rgVersoBlob;
          alvoNome = stored.rgVersoNome || fileName;
        } else if (pfDocKey === "car" || docKind === "CAR") {
          alvoBlob = stored.carBlob;
          alvoNome = stored.carNome || fileName;
        }

        if (alvoBlob) {
          urlCriada = URL.createObjectURL(alvoBlob);
          setBlobUrl(urlCriada);
          setBlobObj(alvoBlob);
          setIsPdf(
            alvoBlob.type === "application/pdf" ||
            alvoNome.toLowerCase().endsWith(".pdf")
          );
        } else {
          setBlobUrl(null);
          setBlobObj(null);
          setIsPdf(fileName.toLowerCase().endsWith(".pdf"));
        }
      });
    } else if (cnpjClean) {
      obterDocumentosPJDoIndexedDB(cnpjClean).then((stored) => {
        if (!isMounted) return;
        if (!stored) {
          setBlobUrl(null);
          setBlobObj(null);
          return;
        }

        let alvoBlob: Blob | undefined;
        let alvoNome = "";

        if (docKind === "CONTRATO") {
          alvoBlob = stored.contratoSocialBlob;
          alvoNome = stored.contratoSocialNome || fileName;
        } else if (docKind === "CNPJ") {
          alvoBlob = stored.cartaoCnpjBlob;
          alvoNome = stored.cartaoCnpjNome || fileName;
        } else if (docKind === "REP_FRENTE") {
          alvoBlob = stored.docRepFrenteBlob;
          alvoNome = stored.docRepFrenteNome || fileName;
        } else if (docKind === "REP_VERSO") {
          alvoBlob = stored.docRepVersoBlob;
          alvoNome = stored.docRepVersoNome || fileName;
        }

        if (alvoBlob) {
          urlCriada = URL.createObjectURL(alvoBlob);
          setBlobUrl(urlCriada);
          setBlobObj(alvoBlob);
          setIsPdf(
            alvoBlob.type === "application/pdf" ||
            alvoNome.toLowerCase().endsWith(".pdf")
          );
        } else {
          setBlobUrl(null);
          setBlobObj(null);
          setIsPdf(fileName.toLowerCase().endsWith(".pdf"));
        }
      });
    }

    return () => {
      isMounted = false;
      if (urlCriada) URL.revokeObjectURL(urlCriada);
    };
  }, [isOpen, cnpjClean, isPf, userId, pfDocKey, docKind, fileName]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (blobUrl && blobObj) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || "documento";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-card admin-dossier-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "880px", width: "95vw" }}
      >
        <div className="admin-dossier-header">
          <div>
            <div className="admin-dossier-header__badge-row">
              <span className="admin-tag">Visualizador de Documento</span>
              {blobUrl ? (
                <span className="admin-real-badge">● Arquivo Real (IndexedDB)</span>
              ) : (
                <span className="admin-tag">Documento Cadastrado</span>
              )}
            </div>
            <h3 style={{ margin: "0.25rem 0 0" }}>{documentTitle}</h3>
            <p className="admin-dossier-header__subtitle">
              Arquivo: <strong>{fileName}</strong>
            </p>
          </div>

          <div className="admin-dossier-tools">
            {!isPdf && (
              <>
                <button
                  type="button"
                  className="button button--secondary button--small admin-tool-btn"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(1))))}
                  title="Diminuir Zoom"
                >
                  🔍 -
                </button>
                <button
                  type="button"
                  className="button button--secondary button--small admin-tool-btn"
                  onClick={() => { setZoom(1); setRotation(0); }}
                  title="Tamanho Normal"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  className="button button--secondary button--small admin-tool-btn"
                  onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.2).toFixed(1))))}
                  title="Aumentar Zoom"
                >
                  🔍 +
                </button>
                <button
                  type="button"
                  className="button button--secondary button--small admin-tool-btn"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
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
            >
              ⬇️ Baixar Cópia
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={onClose}
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Viewport de visualização */}
        <div className="admin-dossier-viewport" style={{ maxHeight: "70vh", overflow: "auto" }}>
          {blobUrl ? (
            isPdf ? (
              <iframe
                src={blobUrl}
                title={documentTitle}
                className="admin-doc-real-iframe"
                width="100%"
                height="560px"
              />
            ) : (
              <div
                className="admin-doc-real-img-container"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease",
                }}
              >
                <img
                  src={blobUrl}
                  alt={documentTitle}
                  className="admin-doc-real-img"
                />
              </div>
            )
          ) : (
            <div className="admin-doc-error-card">
              <span className="admin-doc-error-icon">⚠️</span>
              <h4>Arquivo Binário Não Localizado</h4>
              <p>
                O arquivo digital deste documento (<code>{fileName}</code>) não foi localizado no seu armazenamento local.
                Envie uma nova cópia digital para manter seus dados cadastrais devidamente regularizados.
              </p>
              <div className="admin-doc-error-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={onClose}
                >
                  Fechar
                </button>
                {onOpenReplaceModal && (
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => {
                      onClose();
                      onOpenReplaceModal();
                    }}
                  >
                    📤 Enviar Nova Cópia
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="admin-dossier-footer">
          <button type="button" className="button button--secondary" onClick={onClose}>
            Fechar
          </button>
          {blobUrl && (
            <button type="button" className="button button--outline" onClick={handleDownload}>
              ⬇️ Baixar Cópia do Arquivo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
