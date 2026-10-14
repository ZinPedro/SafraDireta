import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import farmLandscapeImage from "../../../assets/images/farm-landscape.jpeg";
import harvestSunsetImage from "../../../assets/images/harvest-sunset.jpeg";
import registrationLandscapeImage from "../../../assets/images/registration-landscape.jpeg";
import { Icon } from "../../../components/Icon";
import { formatPhone, phoneDigits, sellerCategories, SELLER_BIO_LIMIT, toPhoneApi, ufs, validateSellerProfile } from "../profile";
import type { ProfileUpdateResult, SellerCategory, UpdateUserProfile, UserProfileData } from "../profile";

type Seller = NonNullable<UserProfileData["seller"]>;

interface BannerCropState {
  rawUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  cropY: number; // 0 (topo) a 100 (base)
}

export function SellerTab({ seller, onSave, onSaved }: {
  seller: Seller;
  onSave: UpdateUserProfile;
  onSaved: (profile: UserProfileData) => void;
}) {
  const [values, setValues] = useState(() => ({
    farmName: seller.farmName, bio: seller.bio, city: seller.city, state: seller.state,
    publicPhone: formatPhone(phoneDigits(seller.publicPhone)),
    categories: seller.categories as SellerCategory[],
    transport: seller.hasOwnTransport ? "own" : "buyer",
    bannerUrl: seller.bannerUrl || "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cropModal, setCropModal] = useState<BannerCropState | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const pendingRef = useRef(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startY: number; startCropY: number; containerHeight: number } | null>(null);

  useEffect(() => {
    if (!cropModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCropModal(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cropModal]);

  async function handleBannerFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setBannerError("Formato de imagem inválido. Use JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBannerError("A imagem selecionada excede o limite de 5MB.");
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const rawUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          setCropModal({
            rawUrl,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            cropY: 50,
          });
        };
        img.onerror = () => {
          setBannerError("Não foi possível carregar a imagem selecionada.");
        };
        img.src = rawUrl;
      };
      reader.onerror = () => {
        setBannerError("Erro ao ler o arquivo de imagem.");
      };
      reader.readAsDataURL(file);
    } catch {
      setBannerError("Não foi possível processar a imagem do banner.");
    } finally {
      if (bannerInputRef.current) {
        bannerInputRef.current.value = "";
      }
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropModal) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      startY: e.clientY,
      startCropY: cropModal.cropY,
      containerHeight: rect.height,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !cropModal) return;
    const ratio = cropModal.naturalWidth / cropModal.naturalHeight;
    if (ratio > 3.5) return;
    const hPct = (ratio / 3.5) * 100;
    const excessPct = 100 - hPct;
    const travelPx = dragRef.current.containerHeight * (excessPct / 100);
    if (travelPx <= 0) return;
    const deltaY = e.clientY - dragRef.current.startY;
    const deltaPct = (deltaY / travelPx) * 100;
    const nextVal = Math.max(0, Math.min(100, Math.round(dragRef.current.startCropY + deltaPct)));
    setCropModal((prev) => (prev ? { ...prev, cropY: nextVal } : null));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
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

  async function handleConfirmCrop() {
    if (!cropModal) return;
    setIsCropping(true);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Erro ao carregar"));
        img.src = cropModal.rawUrl;
      });

      const targetRatio = 3.5;
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;

      let cropW: number;
      let cropH: number;
      let cropX = 0;
      let cropY = 0;

      if (natW / natH <= targetRatio) {
        cropW = natW;
        cropH = natW / targetRatio;
        cropX = 0;
        const maxOffsetY = natH - cropH;
        cropY = (cropModal.cropY / 100) * maxOffsetY;
      } else {
        cropH = natH;
        cropW = natH * targetRatio;
        cropX = (natW - cropW) / 2;
        cropY = 0;
      }

      const outW = Math.min(1400, Math.round(cropW));
      const outH = Math.round(outW / targetRatio);

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Contexto 2D indisponível");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

      const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
      update("bannerUrl", croppedDataUrl);
      setCropModal(null);
    } catch {
      setBannerError("Não foi possível processar o enquadramento da imagem.");
    } finally {
      setIsCropping(false);
    }
  }

  function clear(name: string) {
    setErrors((c) => {
      if (!c[name]) return c;
      const { [name]: _removed, ...rest } = c;
      return rest;
    });
    setFeedback(null);
  }

  function update<K extends keyof typeof values>(name: K, value: (typeof values)[K]) {
    setValues((c) => ({ ...c, [name]: value }));
    clear(name === "transport" ? "transport" : name);
  }

  function toggle(category: SellerCategory) {
    update("categories", values.categories.includes(category)
      ? values.categories.filter((c) => c !== category)
      : [...values.categories, category]);
  }

  function focusFirst(next: Record<string, string>) {
    const key = Object.keys(next)[0];
    requestAnimationFrame(() => {
      const el = key === "categories"
        ? document.querySelector<HTMLElement>("input[name='categories']")
        : document.getElementById(`seller-profile-${key}`);
      el?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const next = validateSellerProfile({ ...values, state: values.state });
    setErrors(next);
    if (Object.keys(next).length) {
      setFeedback(null);
      focusFirst(next);
      return;
    }
    pendingRef.current = true;
    setSaving(true);
    setFeedback(null);
    let result: ProfileUpdateResult;
    try {
      result = await onSave({
        seller: {
          isHabilitado: true,
          farmName: values.farmName.trim().replace(/\s+/g, " "),
          bio: values.bio.trim(),
          city: values.city.trim(),
          state: values.state,
          publicPhone: toPhoneApi(values.publicPhone),
          categories: values.categories,
          hasOwnTransport: values.transport === "own",
          bannerUrl: values.bannerUrl || undefined,
        },
      });
    } catch {
      result = { ok: false, reason: "unavailable", message: "Não foi possível concluir a solicitação. Tente novamente." };
    }
    pendingRef.current = false;
    setSaving(false);
    if (result.ok) {
      setFeedback({ kind: "ok", text: result.message });
      onSaved(result.updatedProfile);
    } else {
      setFeedback({ kind: "error", text: result.message });
      if (result.errors && Object.keys(result.errors).length) {
        setErrors(result.errors);
        focusFirst(result.errors);
      }
    }
  }

  const ctl = (name: string) => ({
    id: `seller-profile-${name}`, name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `seller-profile-${name}-error` : undefined,
  });
  const err = (name: string) => errors[name] && <p className="registration-field__error" id={`seller-profile-${name}-error`}>{errors[name]}</p>;

  return (
    <>
      <form noValidate onSubmit={handleSubmit} aria-busy={saving} className="profile__form">
      <fieldset className="registration__fields" disabled={saving}>
        <legend className="sr-only">Vitrine pública do produtor. Campos com asterisco são obrigatórios.</legend>
        <p className="corporate__hint">Estas informações aparecem publicamente para os compradores. O endereço físico exato e o telefone privado da conta não são exibidos.</p>

        <div className="seller-banner-uploader">
          <label className="seller-banner-uploader__label">Foto de Capa da Fazenda (Banner)</label>
          <div className="seller-banner-uploader__preview-wrap">
            <img
              src={values.bannerUrl || farmLandscapeImage}
              alt="Capa da fazenda"
              className="seller-banner-uploader__img"
            />
            <button
              type="button"
              className="seller-banner-uploader__btn-trigger"
              onClick={() => bannerInputRef.current?.click()}
              title="Trocar imagem de capa"
            >
              <Icon name="camera" />
              <span>Alterar Foto de Capa</span>
            </button>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleBannerFileChange}
            />
          </div>

          <div className="seller-banner-uploader__presets">
            <span className="seller-banner-uploader__presets-title">Ou selecione uma paisagem rural:</span>
            <div className="seller-banner-uploader__preset-buttons">
              <button
                type="button"
                className={`seller-banner-uploader__preset-btn ${values.bannerUrl === farmLandscapeImage || !values.bannerUrl ? "seller-banner-uploader__preset-btn--active" : ""}`}
                onClick={() => update("bannerUrl", farmLandscapeImage)}
              >
                Pasto Verde
              </button>
              <button
                type="button"
                className={`seller-banner-uploader__preset-btn ${values.bannerUrl === harvestSunsetImage ? "seller-banner-uploader__preset-btn--active" : ""}`}
                onClick={() => update("bannerUrl", harvestSunsetImage)}
              >
                Colheita / Pôr do Sol
              </button>
              <button
                type="button"
                className={`seller-banner-uploader__preset-btn ${values.bannerUrl === registrationLandscapeImage ? "seller-banner-uploader__preset-btn--active" : ""}`}
                onClick={() => update("bannerUrl", registrationLandscapeImage)}
              >
                Lavoura Aberta
              </button>
            </div>
          </div>
          {bannerError && <p className="registration-field__error">{bannerError}</p>}
        </div>

        <div className="registration-field">
          <label htmlFor="seller-profile-farmName">Nome da propriedade / fazenda <span aria-hidden="true">*</span></label>
          <input {...ctl("farmName")} type="text" maxLength={150} autoComplete="off" value={values.farmName} onChange={(e) => update("farmName", e.target.value)} />
          {err("farmName")}
        </div>
        <div className="registration-field">
          <label htmlFor="seller-profile-bio">Sobre o produtor</label>
          <textarea {...ctl("bio")} rows={5} maxLength={SELLER_BIO_LIMIT} value={values.bio}
            placeholder="Conte sobre a tradição da colheita, manejo, certificações e histórico da produção."
            onChange={(e) => update("bio", e.target.value)} />
          <p className="corporate__hint" aria-live="polite">{values.bio.length}/{SELLER_BIO_LIMIT} caracteres</p>
          {err("bio")}
        </div>
        <div className="corporate__row">
          <div className="registration-field">
            <label htmlFor="seller-profile-city">Cidade <span aria-hidden="true">*</span></label>
            <input {...ctl("city")} type="text" maxLength={80} autoComplete="off" value={values.city} onChange={(e) => update("city", e.target.value)} />
            {err("city")}
          </div>
          <div className="registration-field">
            <label htmlFor="seller-profile-state">UF <span aria-hidden="true">*</span></label>
            <select {...ctl("state")} value={values.state} onChange={(e) => update("state", e.target.value)}>
              <option value="">UF</option>
              {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {err("state")}
          </div>
        </div>
        <div className="registration-field">
          <label htmlFor="seller-profile-publicPhone">Telefone comercial público (WhatsApp)</label>
          <input {...ctl("publicPhone")} type="tel" maxLength={15} autoComplete="off" placeholder="(19) 99999-9999"
            value={values.publicPhone} onChange={(e) => update("publicPhone", formatPhone(e.target.value))} aria-describedby={errors.publicPhone ? "seller-profile-publicPhone-error" : "seller-profile-publicPhone-hint"} />
          <p className="corporate__hint" id="seller-profile-publicPhone-hint">Separado do telefone privado de recuperação da conta.</p>
          {err("publicPhone")}
        </div>

        <fieldset className="seller-upgrade__group" aria-describedby={errors.categories ? "seller-profile-categories-error" : undefined}>
          <legend className="seller-upgrade__section">Culturas atendidas</legend>
          <div className="seller-upgrade__chips">
            {sellerCategories.map((c) => (
              <label key={c.value} className="seller-upgrade__chip">
                <input type="checkbox" name="categories" value={c.value} checked={values.categories.includes(c.value)}
                  aria-invalid={Boolean(errors.categories)} onChange={() => toggle(c.value)} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          {err("categories")}
        </fieldset>

        <fieldset className="seller-upgrade__group">
          <legend className="seller-upgrade__section">Logística operacional</legend>
          {([["own", "Possuo transporte próprio para entrega da carga"], ["buyer", "Frete por conta do comprador / transportadora terceirizada"]] as const).map(([value, label]) => (
            <label key={value} className="seller-upgrade__radio">
              <input type="radio" name="transport" value={value} checked={values.transport === value} onChange={() => update("transport", value)} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <button className="button registration__submit" type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar vitrine"}
        </button>
      </fieldset>
      <div aria-live="polite" aria-atomic="true">
        {feedback && <p className={`registration__feedback ${feedback.kind === "error" ? "registration__feedback--error" : ""}`}>{feedback.text}</p>}
      </div>
    </form>

    {cropModal && (
      <div
        className="banner-cropper-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="banner-cropper-title"
      >
        <div className="banner-cropper-modal">
          <div className="banner-cropper-modal__header">
            <div className="banner-cropper-modal__title-group">
              <h3 id="banner-cropper-title">Enquadrar Foto de Capa</h3>
              <p>
                Ajuste a janela panorâmica para valorizar os melhores detalhes da sua propriedade.
              </p>
            </div>
            <button
              type="button"
              className="banner-cropper-modal__close-btn"
              onClick={() => setCropModal(null)}
              aria-label="Fechar (Esc)"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="banner-cropper-modal__body">
            {/* Preview com máscara de sombra */}
            <div className="banner-cropper__preview-container">
              <div
                className={`banner-cropper__preview ${isDragging ? "banner-cropper__preview--dragging" : ""}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                title="Clique e arraste verticalmente para ajustar o corte"
              >
                <img
                  src={cropModal.rawUrl}
                  alt="Pré-visualização para enquadramento"
                  className="banner-cropper__img"
                />
                {/* Janela útil do banner (proporção ~3.5:1) */}
                {(() => {
                  const ratio = cropModal.naturalWidth / cropModal.naturalHeight;
                  if (ratio <= 3.5) {
                    const hPct = (ratio / 3.5) * 100;
                    const excessPct = 100 - hPct;
                    const topPct = (cropModal.cropY / 100) * excessPct;
                    return (
                      <div
                        className="banner-cropper__window"
                        style={{
                          top: `${topPct}%`,
                          height: `${hPct}%`,
                          left: 0,
                          right: 0,
                        }}
                      >
                        <span className="banner-cropper__window-badge">
                          Janela Panorâmica (~3.5:1)
                        </span>
                      </div>
                    );
                  }
                  const wPct = (3.5 / ratio) * 100;
                  const excessPct = 100 - wPct;
                  const leftPct = excessPct / 2;
                  return (
                    <div
                      className="banner-cropper__window"
                      style={{
                        top: 0,
                        bottom: 0,
                        left: `${leftPct}%`,
                        width: `${wPct}%`,
                      }}
                    >
                      <span className="banner-cropper__window-badge">
                        Janela Panorâmica (~3.5:1)
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Slider de ajuste vertical */}
            <div className="banner-cropper__slider-box">
              <div className="banner-cropper__slider-header">
                <label htmlFor="banner-crop-range" className="banner-cropper__slider-label">
                  Ajustar enquadramento vertical (0% a 100%)
                </label>
                <span className="banner-cropper__slider-value">{cropModal.cropY}%</span>
              </div>
              <input
                id="banner-crop-range"
                type="range"
                min="0"
                max="100"
                value={cropModal.cropY}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCropModal((prev) => (prev ? { ...prev, cropY: val } : null));
                }}
                className="banner-cropper__range-input"
              />
              <div className="banner-cropper__slider-hints">
                <span>0% (Topo)</span>
                <span>50% (Centro)</span>
                <span>100% (Base)</span>
              </div>
              <p className="banner-cropper__helper-text">
                Dica: você também pode clicar e arrastar a imagem verticalmente com o mouse ou toque.
              </p>
            </div>
          </div>

          <div className="banner-cropper-modal__footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setCropModal(null)}
              disabled={isCropping}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={handleConfirmCrop}
              disabled={isCropping}
            >
              {isCropping ? "Processando…" : "Confirmar Enquadramento"}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
