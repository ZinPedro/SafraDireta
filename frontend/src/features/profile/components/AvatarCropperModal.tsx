import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Icon } from "../../../components/Icon";

interface AvatarCropperModalProps {
  rawUrl: string;
  onClose: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}

export function AvatarCropperModal({ rawUrl, onClose, onConfirm }: AvatarCropperModalProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  const previewBoxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; initialOffsetX: number; initialOffsetY: number } | null>(null);

  // Carrega as dimensões naturais da imagem
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = rawUrl;
  }, [rawUrl]);

  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isProcessing]);

  // Arrastar / Mover a imagem (Pan)
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (isProcessing) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialOffsetX: offset.x,
      initialOffsetY: offset.y,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !isDragging) return;
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    setOffset({
      x: dragRef.current.initialOffsetX + deltaX,
      y: dragRef.current.initialOffsetY + deltaY,
    });
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      dragRef.current = null;
      setIsDragging(false);
    }
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Renderização final no Canvas 2D
  const handleSave = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Falha ao carregar imagem no canvas"));
        img.src = rawUrl;
      });

      const CANVAS_SIZE = 512;
      const previewBox = previewBoxRef.current;
      const boxW = previewBox?.clientWidth || 300;
      const boxH = previewBox?.clientHeight || 300;
      const canvasScale = CANVAS_SIZE / boxW;

      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Contexto 2D não suportado");

      // 1. Camada de Fundo com Blur (Cobre todo o quadrado 512x512)
      ctx.save();
      const coverScale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
      const coverW = img.naturalWidth * coverScale;
      const coverH = img.naturalHeight * coverScale;
      const coverX = (CANVAS_SIZE - coverW) / 2;
      const coverY = (CANVAS_SIZE - coverH) / 2;

      // Desfoque e leve escurecimento de contraste
      if ("filter" in ctx) {
        ctx.filter = "blur(24px) brightness(0.8)";
      }
      // Desenha com margem extra de 30px para evitar sangramento de bordas no blur
      ctx.drawImage(img, coverX - 30, coverY - 30, coverW + 60, coverH + 60);
      ctx.restore();

      // 2. Camada Frontal Nítida com Zoom e Deslocamento
      ctx.save();
      if ("filter" in ctx) {
        ctx.filter = "none";
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Escala base (contain) para que 100% da imagem caiba no preview com zoom = 1
      const baseScale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
      const renderedW = img.naturalWidth * baseScale * zoom;
      const renderedH = img.naturalHeight * baseScale * zoom;

      const canvasRenderedW = renderedW * canvasScale;
      const canvasRenderedH = renderedH * canvasScale;

      const canvasCenterX = (boxW / 2 + offset.x) * canvasScale;
      const canvasCenterY = (boxH / 2 + offset.y) * canvasScale;

      const drawX = canvasCenterX - canvasRenderedW / 2;
      const drawY = canvasCenterY - canvasRenderedH / 2;

      ctx.drawImage(img, drawX, drawY, canvasRenderedW, canvasRenderedH);
      ctx.restore();

      const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.88);
      onConfirm(croppedDataUrl);
    } catch {
      alert("Erro ao processar a foto de perfil. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="avatar-cropper-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-cropper-title"
    >
      <div className="avatar-cropper-modal">
        {/* Cabeçalho */}
        <div className="avatar-cropper-modal__header">
          <div className="avatar-cropper-modal__title-group">
            <h3 id="avatar-cropper-title">Ajustar Foto de Perfil</h3>
            <p>Posicione e ajuste o zoom para enquadrar perfeitamente o seu avatar.</p>
          </div>
          <button
            type="button"
            className="avatar-cropper-modal__close-btn"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Fechar (Esc)"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Corpo com Preview Interativo */}
        <div className="avatar-cropper-modal__body">
          <div className="avatar-cropper__preview-wrapper">
            <div
              ref={previewBoxRef}
              className={`avatar-cropper__preview-box ${isDragging ? "avatar-cropper__preview-box--dragging" : ""}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              title="Clique e arraste para reposicionar a foto"
            >
              {/* Camada 1: Fundo com Desfoque (Blur) */}
              <div
                className="avatar-cropper__blur-bg"
                style={{ backgroundImage: `url(${rawUrl})` }}
                aria-hidden="true"
              />

              {/* Camada 2: Foto Frontal Nítida */}
              <img
                src={rawUrl}
                alt="Foto para ajuste de perfil"
                className="avatar-cropper__foreground-img"
                style={{
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                  maxWidth: naturalSize.width > naturalSize.height ? "100%" : "none",
                  maxHeight: naturalSize.height >= naturalSize.width ? "100%" : "none",
                }}
                draggable={false}
              />

              {/* Camada 3: Máscara Guia Circular */}
              <div className="avatar-cropper__circle-guide" aria-hidden="true" />
            </div>
            <p className="avatar-cropper__hint-drag">
              💡 Dica: arraste a imagem com o mouse ou toque para centralizar.
            </p>
          </div>

          {/* Controles de Zoom */}
          <div className="avatar-cropper__controls">
            <div className="avatar-cropper__zoom-header">
              <label htmlFor="avatar-zoom-slider" className="avatar-cropper__zoom-label">
                Zoom / Escala
              </label>
              <div className="avatar-cropper__zoom-actions">
                <span className="avatar-cropper__zoom-val">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  className="avatar-cropper__reset-btn"
                  onClick={handleReset}
                  disabled={isProcessing || (zoom === 1 && offset.x === 0 && offset.y === 0)}
                  title="Restaurar zoom e posição inicial"
                >
                  Centralizar
                </button>
              </div>
            </div>

            <div className="avatar-cropper__slider-row">
              <button
                type="button"
                className="avatar-cropper__zoom-btn"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
                disabled={zoom <= 0.5 || isProcessing}
                title="Diminuir zoom (revela fundo desfocado)"
              >
                −
              </button>
              <input
                id="avatar-zoom-slider"
                type="range"
                min="0.5"
                max="2.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="avatar-cropper__range-input"
              />
              <button
                type="button"
                className="avatar-cropper__zoom-btn"
                onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}
                disabled={zoom >= 2.5 || isProcessing}
                title="Aumentar zoom"
              >
                +
              </button>
            </div>
            <div className="avatar-cropper__slider-hints">
              <span>0.5x (Afastado / Blur)</span>
              <span>1.0x (Padrão)</span>
              <span>2.5x (Aproximado)</span>
            </div>
          </div>
        </div>

        {/* Rodapé com Botões */}
        <div className="avatar-cropper-modal__footer">
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={handleSave}
            disabled={isProcessing}
          >
            {isProcessing ? "Salvando..." : "Salvar Foto de Perfil"}
          </button>
        </div>
      </div>
    </div>
  );
}
