import { useState } from "react";
import type { AdDocumentItem, AdDocumentType } from "./ads.types";
import {
  AD_DOCUMENT_LABELS,
  ANIMAL_DOCUMENT_TYPES,
  GRAIN_DOCUMENT_TYPES,
  formatarTamanhoArquivo,
} from "./ads.types";
import {
  salvarDocumentoArquivoNoIndexedDB,
  removerDocumentoArquivoDoIndexedDB,
} from "./adsDocumentStorage";
import { Icon } from "../../components/Icon";

export interface AdDocumentsSectionProps {
  documentos: AdDocumentItem[];
  onChangeDocumentos: (novos: AdDocumentItem[]) => void;
  modalidade: "ANIMAL" | "GRAOS";
  anuncioId?: string;
}

function gerarDocId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

export function AdDocumentsSection({
  documentos,
  onChangeDocumentos,
  modalidade,
  anuncioId,
}: AdDocumentsSectionProps) {
  const [tipoDocAnimal, setTipoDocAnimal] = useState<AdDocumentType>("GTA");
  const [tipoDocGraos, setTipoDocGraos] = useState<AdDocumentType>("LAUDO_CLASSIFICACAO");
  const [docError, setDocError] = useState<string | null>(null);
  const [isDocDropOver, setIsDocDropOver] = useState(false);

  const tipoDocSelecionado = modalidade === "ANIMAL" ? tipoDocAnimal : tipoDocGraos;

  function handleTrocarTipoDoc(novoTipo: AdDocumentType) {
    if (modalidade === "ANIMAL") {
      setTipoDocAnimal(novoTipo);
    } else {
      setTipoDocGraos(novoTipo);
    }
  }

  function processarArquivosDocumento(arquivos: FileList | File[]) {
    setDocError(null);
    const lista = Array.from(arquivos);
    if (lista.length === 0) return;

    const vagasRestantes = 5 - documentos.length;
    if (vagasRestantes <= 0) {
      setDocError("O limite máximo de 5 documentos por anúncio já foi atingido.");
      return;
    }

    const arquivosParaProcessar = lista.slice(0, vagasRestantes);
    if (lista.length > vagasRestantes) {
      setDocError(
        `Apenas ${vagasRestantes} documento(s) adicionado(s). Limite de 5 documentos por anúncio atingido.`
      );
    }

    const novosDocs: AdDocumentItem[] = [];
    const itensParaPersistir: Array<{
      docId: string;
      arquivo: File;
      mimeType: string;
    }> = [];
    const formatosValidos = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

    for (const arquivo of arquivosParaProcessar) {
      const isPdfExt = arquivo.name.toLowerCase().endsWith(".pdf");
      const isImgExt = /\.(jpe?g|png|webp)$/i.test(arquivo.name);
      const isFormatOk = formatosValidos.includes(arquivo.type) || isPdfExt || isImgExt;

      if (!isFormatOk) {
        setDocError("Formato não suportado. Envie arquivos PDF, JPEG ou PNG de até 10 MB.");
        continue;
      }

      if (arquivo.size > 10 * 1024 * 1024) {
        setDocError("Arquivo muito grande. O limite máximo por documento é de 10 MB.");
        continue;
      }

      const docId = gerarDocId();
      const mimeType = arquivo.type || (isPdfExt ? "application/pdf" : "image/jpeg");
      let blobUrl: string | undefined = undefined;
      try {
        blobUrl = URL.createObjectURL(arquivo);
      } catch {
        /* fallback seguro */
      }

      const novoItem: AdDocumentItem = {
        id: docId,
        tipo: tipoDocSelecionado,
        nomeArquivo: arquivo.name,
        tamanhoBytes: arquivo.size,
        mimeType,
        url: blobUrl,
        criadoEm: new Date().toISOString(),
      };

      novosDocs.push(novoItem);
      itensParaPersistir.push({ docId, arquivo, mimeType });
    }

    // 1. Atualização SÍNCRONA e IMEDIATA da UI (sem nenhum await antes)
    if (novosDocs.length > 0) {
      onChangeDocumentos([...documentos, ...novosDocs]);
    }

    // 2. Persistência Assíncrona Não-Bloqueante (Background / Best-effort)
    for (const item of itensParaPersistir) {
      void salvarDocumentoArquivoNoIndexedDB(
        item.docId,
        anuncioId || "novo-anuncio",
        item.arquivo,
        item.arquivo.name,
        item.mimeType,
        item.arquivo.size
      ).catch((err) => {
        console.warn("Aviso ao persistir documento no IndexedDB em segundo plano:", err);
      });
    }
  }

  function handleRemoverDocumento(docId: string) {
    const docParaRemover = documentos.find((d) => d.id === docId);
    if (docParaRemover?.url && docParaRemover.url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(docParaRemover.url);
      } catch {
        /* ignore */
      }
    }
    onChangeDocumentos(documentos.filter((d) => d.id !== docId));
    void removerDocumentoArquivoDoIndexedDB(docId).catch(() => {});
  }

  return (
    <section className="ad-form-section" aria-labelledby="section-documentos">
      <div className="ad-section-header-row">
        <div>
          <h2 id="section-documentos" className="ad-form-section__title">
            <Icon name="file" /> 4. Documentação Comprobatória do Lote (Opcional)
          </h2>
          <p className="ad-form-section__subtitle">
            Anexe laudos sanitários, GTA, notas fiscais ou certificados para comprovar a procedência e sanidade do seu lote com custódia segura no Data Room.
          </p>
        </div>
        <span className="ad-media-counter">
          Documentos: {documentos.length}/5
        </span>
      </div>

      <div className="ad-doc-upload-box">
        {documentos.length < 5 ? (
          <>
            <div className="ad-doc-selector-row">
              <div className="form-group" style={{ marginBottom: "0.75rem", flex: 1 }}>
                <label htmlFor="select-tipo-doc" className="form-label">
                  Tipo do Documento a Anexar
                </label>
                <select
                  id="select-tipo-doc"
                  className="form-select"
                  value={tipoDocSelecionado}
                  onChange={(e) => handleTrocarTipoDoc(e.target.value as AdDocumentType)}
                >
                  {modalidade === "ANIMAL"
                    ? ANIMAL_DOCUMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))
                    : GRAIN_DOCUMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                </select>
                <span className="form-field-hint">
                  {modalidade === "ANIMAL"
                    ? ANIMAL_DOCUMENT_TYPES.find((t) => t.value === tipoDocSelecionado)?.descricao
                    : GRAIN_DOCUMENT_TYPES.find((t) => t.value === tipoDocSelecionado)?.descricao}
                </span>
              </div>
            </div>

            {/* Dropzone nativa usando <label htmlFor="ad-doc-file-input"> */}
            <label
              htmlFor="ad-doc-file-input"
              className={`ad-doc-dropzone ${isDocDropOver ? "ad-doc-dropzone--active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDocDropOver(true);
              }}
              onDragLeave={() => setIsDocDropOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDocDropOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  processarArquivosDocumento(Array.from(e.dataTransfer.files));
                }
              }}
            >
              <input
                id="ad-doc-file-input"
                type="file"
                multiple
                accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length > 0) {
                    processarArquivosDocumento(files);
                  }
                  e.target.value = "";
                }}
              />
              <div className="ad-doc-dropzone__content">
                <div className="ad-doc-dropzone__icon">
                  <Icon name="upload" />
                </div>
                <strong className="ad-doc-dropzone__title">
                  Arraste o arquivo ou clique para selecionar
                </strong>
                <span className="ad-doc-dropzone__hint">
                  Formatos aceitos: PDF, JPEG, PNG ou WebP (máx. 10 MB por documento).
                </span>
                <span
                  role="button"
                  className="button button--outline button--small"
                  style={{ marginTop: "0.5rem" }}
                >
                  <Icon name="upload" /> Selecionar Arquivo
                </span>
              </div>
            </label>
          </>
        ) : (
          <div className="ad-doc-limit-box">
            <Icon name="check" />
            <span>Limite máximo de 5 documentos anexados atingido.</span>
          </div>
        )}

        {docError && (
          <p className="ad-field-error" role="alert" style={{ marginTop: "0.5rem" }}>
            {docError}
          </p>
        )}

        {documentos.length > 0 && (
          <div className="ad-doc-list" aria-label="Documentos anexados ao lote">
            <h4 className="ad-doc-list__title">
              Documentos cadastrados ({documentos.length} de 5):
            </h4>
            <ul className="ad-doc-items">
              {documentos.map((doc, index) => {
                const isPdfFile =
                  doc.mimeType === "application/pdf" ||
                  doc.nomeArquivo.toLowerCase().endsWith(".pdf");
                return (
                  <li key={doc.id || index} className="ad-doc-item">
                    <div className="ad-doc-item__icon-wrap">
                      <span
                        className={`ad-doc-type-icon ${
                          isPdfFile ? "ad-doc-type-icon--pdf" : "ad-doc-type-icon--img"
                        }`}
                      >
                        {isPdfFile ? "PDF" : "IMG"}
                      </span>
                    </div>
                    <div className="ad-doc-item__info">
                      <div className="ad-doc-item__badge-row">
                        <span className="ad-doc-badge ad-doc-badge--type">
                          {AD_DOCUMENT_LABELS[doc.tipo] || doc.tipo}
                        </span>
                        <span className="ad-doc-item__size">
                          {formatarTamanhoArquivo(doc.tamanhoBytes)}
                        </span>
                      </div>
                      <strong className="ad-doc-item__name" title={doc.nomeArquivo}>
                        {doc.nomeArquivo}
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="button button--secondary button--small ad-doc-item__btn-remove"
                      onClick={() => handleRemoverDocumento(doc.id)}
                      title={`Remover documento ${doc.nomeArquivo}`}
                    >
                      <Icon name="trash" /> Remover
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="ad-doc-security-note">
          <Icon name="lock" />
          <span>
            <strong>Privacidade Garantida:</strong> Os documentos anexados ficarão protegidos no Data Room. Visitantes no Mercado verão apenas o tipo do documento anexado (🔒) e precisarão solicitar sua autorização com mensagem de interesse comercial para visualizar os arquivos.
          </span>
        </div>
      </div>
    </section>
  );
}
