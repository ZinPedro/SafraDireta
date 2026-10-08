import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import { AccountTab } from "./components/AccountTab";
import { PublicPreviewTab } from "./components/PublicPreviewTab";
import { SellerTab } from "./components/SellerTab";
import { loadUserProfile, updateUserProfile } from "./profile";
import type { LoadUserProfile, UpdateUserProfile, UserProfileData } from "./profile";
import "../registration/RegistrationPage.css";
import "../corporate-registration/CorporateRegistrationPage.css";
import "../seller-upgrade/SellerUpgradePage.css";
import "./ProfilePage.css";

type TabId = "conta" | "produtor" | "previa";

export function ProfilePage({ onOpenDialog, onLoad = loadUserProfile, onUpdate = updateUserProfile }: {
  onOpenDialog: OpenDevelopmentDialog;
  onLoad?: LoadUserProfile;
  onUpdate?: UpdateUserProfile;
}) {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ conta: null, produtor: null, previa: null });

  const token = session?.token;
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    onLoad().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setProfile(result.profile);
        setState("ready");
      } else {
        setErrorMessage(result.message);
        setState("error");
      }
    });
    return () => { cancelled = true; };
  }, [token, onLoad, reloadKey]);

  function retry() {
    setState("loading");
    setReloadKey((k) => k + 1);
  }

  if (!session) {
    return (
      <section className="container profile profile--gate" aria-labelledby="profile-title">
        <p className="eyebrow">Perfil</p>
        <h1 id="profile-title">Entre para acessar seu perfil</h1>
        <p>Seus dados cadastrais ficam disponíveis depois do login.</p>
        <button type="button" className="button registration__submit profile__gate-button" onClick={() => onOpenDialog("login")}>Entrar</button>
        <Link to={routes.home} className="corporate__secondary">Voltar ao início</Link>
      </section>
    );
  }

  const isSeller = session.vendedorEstado === "HABILITADO";
  const tabs: { id: TabId; label: string }[] = isSeller && profile?.seller
    ? [{ id: "conta", label: "Minha conta" }, { id: "produtor", label: "Perfil de produtor" }, { id: "previa", label: "Prévia pública" }]
    : [{ id: "conta", label: "Minha conta" }];
  const requested = searchParams.get("aba");
  const active: TabId = tabs.some((t) => t.id === requested) ? (requested as TabId) : "conta";

  function selectTab(id: TabId, focus = false) {
    const next = new URLSearchParams(searchParams);
    if (id === "conta") next.delete("aba"); else next.set("aba", id);
    setSearchParams(next, { replace: true });
    if (focus) requestAnimationFrame(() => tabRefs.current[id]?.focus());
  }

  function handleTabKeys(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === active);
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    selectTab(tabs[(keys[event.key] + tabs.length) % tabs.length].id, true);
  }

  const account = profile?.account;
  const displayName = account?.nome ?? session.conta.nome;

  return (
    <section className="container profile" aria-labelledby="profile-title">
      <header className="profile__header">
        <Avatar url={session.avatarUrl} name={displayName} size={64} />
        <div>
          <p className="eyebrow">Perfil</p>
          <h1 id="profile-title">{displayName}</h1>
          <span className={`profile__badge ${isSeller ? "profile__badge--seller" : ""}`}>
            {session.conta.tipo === "PJ" ? "Conta corporativa" : isSeller ? <><Icon name="leaf" /> Vendedor habilitado</> : "Comprador"}
          </span>
        </div>
      </header>

      {state === "loading" && <p role="status" className="profile__status">Carregando seus dados…</p>}
      {state === "error" && (
        <div className="registration__feedback registration__feedback--error" role="alert">
          <p>{errorMessage}</p>
          <button type="button" className="registration__text-button" onClick={retry}>Tentar novamente</button>
        </div>
      )}

      {state === "ready" && profile && (
        <>
          {tabs.length > 1 && (
            <div className="profile__tabs" role="tablist" aria-label="Seções do perfil" onKeyDown={handleTabKeys}>
              {tabs.map((tab) => (
                <button
                  key={tab.id} type="button" role="tab" id={`profile-tab-${tab.id}`}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  aria-selected={active === tab.id} aria-controls={`profile-panel-${tab.id}`}
                  tabIndex={active === tab.id ? 0 : -1} onClick={() => selectTab(tab.id)}
                >{tab.label}</button>
              ))}
            </div>
          )}
          <div className="profile__panel" role={tabs.length > 1 ? "tabpanel" : undefined} id={`profile-panel-${active}`}
            aria-labelledby={tabs.length > 1 ? `profile-tab-${active}` : undefined}>
            {active === "conta" && <AccountTab profile={profile} onSave={onUpdate} onSaved={setProfile} />}
            {active === "produtor" && profile.seller && <SellerTab seller={profile.seller} onSave={onUpdate} onSaved={setProfile} />}
            {active === "previa" && <PublicPreviewTab profile={profile} />}
          </div>
        </>
      )}
    </section>
  );
}
