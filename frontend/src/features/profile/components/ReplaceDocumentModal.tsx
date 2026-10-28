import { useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { Icon } from "../../../components/Icon";
import { formatFileSize, validateFile } from "../../seller-upgrade/sellerUpgrade";
import { substituirDocumentoPJNoIndexedDB } from "../../corporate-registration/corporateDocsStorage";
import { substituirDocumentoProdutorNoIndexedDB } from "../../seller-upgrade/producerDocsStorage";
import { substituirDocumentoEmpresa, substituirDocumentoProdutor } from "../../admin/adminStorage";

export interface ReplaceDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  currentFileName: string;
  currentDocKind: "CONTRATO" | "CNPJ" | "REP_FRENTE" | "REP_VERSO" | "RG_FRENTE" | "RG_VERSO" | "CAR";
  tipoDocKey?: "contratoSocial" | "cartaoCnpj" | "docRepresentanteFrente" | "docRepresentanteVerso";
  cnpjClean?: string;
  empresaId?: string;
  isPf?: boolean;
  userId?: string;
  pfDocKey?: "rgFrente" | "rgVerso" | "car";
  onSuccess: (novoNome: string) => void;
}

export function ReplaceDocumentModal({
  isOpen,
  onClose,
  documentTitle,
  currentFileName,
  currentDocKind,
  tipoDocKey,
  cnpjClean,
  empresaId,
  isPf,
  userId,
  pfDocKey,
  onSuccess,
}: ReplaceDocumentModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChosen = (file: File) => {
    const err = validateFile(file);
    if (err) {
      setErrorMsg(err);
      setSelectedFile(null);
      return;
    }
    setErrorMsg(null);
    setSelectedFile(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileChosen(f);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileChosen(f);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg("Selecione um arquivo válido para substituir o documento.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isPf && userId && pfDocKey) {
        // 1. Salva arquivo binário no IndexedDB de Produtores
        await substituirDocumentoProdutorNoIndexedDB(userId, pfDocKey, selectedFile);

        // 2. Registra metadados e move status para EM_REANALISE
        const tamanhoFmt = formatFileSize(selectedFile.size);
        substituirDocumentoProdutor(userId, pfDocKey, selectedFile.name, tamanhoFmt);

        onSuccess(selectedFile.name);
        onClose();
      } else if (cnpjClean && empresaId && tipoDocKey) {
        // 1. Salva arquivo binário no IndexedDB de PJ
        await substituirDocumentoPJNoIndexedDB(cnpjClean, currentDocKind as any, selectedFile);

        // 2. Registra metadados e move status para EM_REANALISE
        const tamanhoFmt = formatFileSize(selectedFile.size);
        substituirDocumentoEmpresa(empresaId, tipoDocKey, selectedFile.name, tamanhoFmt);

        onSuccess(selectedFile.name);
        onClose();
      } else {
        throw new Error("Parâmetros insuficientes para substituição");
      }
    } catch (err) {
      console.error("Erro ao substituir documento:", err);
      setErrorMsg("Ocorreu um erro ao salvar o novo documento. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        className="modal-card profile-replace-doc-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{ maxWidth: "560px" }}
      >
        <div className="modal-card__header">
          <div>
            <span className="admin-tag">Atualização de Dossiê</span>
            <h3>Substituir Documento</h3>
            <p className="corporate__hint" style={{ marginTop: "0.25rem" }}>
              {documentTitle}
            </p>
          </div>
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="profile-replace-doc-current">
          <Icon name="file" />
          <div>
            <strong>Arquivo cadastrado atualmente:</strong>
            <p>{currentFileName}</p>
          </div>
        </div>

        <div
          className={`profile-doc-dropzone ${isDragging ? "is-dragging" : ""} ${
            selectedFile ? "has-file" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="replace-doc-input"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleInputChange}
          />

          {selectedFile ? (
            <div className="profile-doc-dropzone__selected">
              <Icon name="check" />
              <div>
                <strong>{selectedFile.name}</strong>
                <p>{formatFileSize(selectedFile.size)}</p>
              </div>
              <label htmlFor="replace-doc-input" className="button button--outline button--small">
                Trocar arquivo
              </label>
            </div>
          ) : (
            <label htmlFor="replace-doc-input" className="profile-doc-dropzone__label">
              <span className="profile-doc-dropzone__icon">📁</span>
              <strong>Arraste o novo documento ou clique para selecionar</strong>
              <p>Formatos aceitos: PDF, JPG ou PNG (máximo 10 MB)</p>
            </label>
          )}
        </div>

        {errorMsg && (
          <p className="registration-field__error" role="alert" style={{ marginTop: "0.5rem" }}>
            {errorMsg}
          </p>
        )}

        <div className="profile-doc-notice">
          <Icon name="alert" />
          <p>
            <strong>Continuidade Operacional:</strong> A substituição enviará este arquivo para
            reanálise da equipe de governança. As compras e vendas da sua empresa continuarão
            ativas normalmente enquanto a nova versão é auditada.
          </p>
        </div>

        <div className="modal-card__actions" style={{ marginTop: "1.25rem" }}>
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={!selectedFile || isSubmitting}
          >
            {isSubmitting ? "Enviando arquivo…" : "Confirmar e Enviar para Reanálise"}
          </button>
        </div>
      </form>
    </div>
  );
}
