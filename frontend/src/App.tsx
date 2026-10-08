import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { RegistrationPage } from "./features/registration/RegistrationPage";
import { CorporateRegistrationPage } from "./features/corporate-registration/CorporateRegistrationPage";
import { SellerUpgradePage } from "./features/seller-upgrade/SellerUpgradePage";
import { LoginDialog } from "./features/login/LoginDialog";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { DevelopmentDialog } from "./components/DevelopmentDialog";
import { HomePage } from "./pages/HomePage";
import { DevelopmentPage } from "./pages/DevelopmentPage";
import { routes } from "./data/site";
import type { DevelopmentFeature } from "./data/site";
import "./App.css";

const pageTitles: Record<string, string> = {
  [routes.registration]: "Crie sua conta | SafraDireta",
  [routes.corporateRegistration]: "Cadastro Corporativo | SafraDireta",
  [routes.sellerUpgrade]: "Habilitar vendedor | SafraDireta",
  [routes.home]: "SafraDireta — Do campo à negociação",
  [routes.market]: "Mercado | SafraDireta",
  [routes.producers]: "Produtores | SafraDireta",
  [routes.guide]: "Guia do usuário | SafraDireta",
};

function Site() {
  const [dialogFeature, setDialogFeature] = useState<DevelopmentFeature | null>(
    null,
  );
  const location = useLocation();
  const navigate = useNavigate();
  const isRegistrationPage =
    location.pathname === routes.registration ||
    location.pathname === routes.corporateRegistration ||
    location.pathname === routes.sellerUpgrade;

  function openFeature(feature: DevelopmentFeature) {
    if (feature === "registration" || feature === "sellerRegistration") {
      navigate(routes.registration + (feature === "sellerRegistration" ? "?intencao=produtor" : ""), {
        state: { from: location.pathname },
      });
      return;
    }
    setDialogFeature(feature);
  }
  const mainRef = useRef<HTMLElement>(null);
  const previousLocationKey = useRef(location.key);

  useEffect(() => {
    document.title =
      pageTitles[location.pathname] ?? "Página não encontrada | SafraDireta";
    if (previousLocationKey.current !== location.key) {
      window.scrollTo({ top: 0, behavior: "instant" });
      mainRef.current?.focus({ preventScroll: true });
      previousLocationKey.current = location.key;
    }
  }, [location.pathname, location.key]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      {!isRegistrationPage && <Header key={location.pathname} onOpenDialog={openFeature} />}
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        <Routes>
          <Route path={routes.registration} element={<RegistrationPage onOpenDialog={openFeature} />} />
          <Route path={routes.sellerUpgrade} element={<SellerUpgradePage />} />
          <Route path={routes.corporateRegistration} element={<CorporateRegistrationPage onOpenDialog={openFeature} />} />
          <Route
            path={routes.home}
            element={<HomePage onOpenDialog={openFeature} />}
          />
          <Route
            path={routes.market}
            element={
              <DevelopmentPage
                title="Um mercado cheio de possibilidades."
                description="Estamos preparando o espaço onde você encontrará todos os lotes. Em breve, novas ofertas vão conectar o campo a bons negócios."
                onOpenDialog={openFeature}
              />
            }
          />
          <Route
            path={routes.producers}
            element={
              <DevelopmentPage
                title="Conheça quem está por trás da safra."
                description="Os perfis de produtores ainda estão em desenvolvimento. Em breve, você poderá conhecer suas histórias, regiões e produtos."
                onOpenDialog={openFeature}
              />
            }
          />
          <Route
            path={routes.guide}
            element={
              <DevelopmentPage
                title="Seu caminho pelo SafraDireta."
                description="Estamos preparando um guia para ajudar você a criar sua conta, explorar o mercado e dar os próximos passos."
                onOpenDialog={openFeature}
              />
            }
          />
          <Route
            path="*"
            element={
              <DevelopmentPage
                title="Este caminho ainda não foi plantado."
                description="Não encontramos a página que você procurou. Volte ao início para continuar explorando o SafraDireta."
                onOpenDialog={openFeature}
                notFound
              />
            }
          />
        </Routes>
      </main>
      {!isRegistrationPage && <Footer onOpenDialog={openFeature} />}
      {dialogFeature === "login" && <LoginDialog
        onClose={() => setDialogFeature(null)}
        onPreview={() => {
          setDialogFeature(null);
          navigate(routes.market);
        }}
        onRegister={() => {
          setDialogFeature(null);
          if (!isRegistrationPage) openFeature("registration");
        }}
      />}
      <DevelopmentDialog
        feature={dialogFeature === "login" ? null : dialogFeature}
        onClose={() => setDialogFeature(null)}
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Site />
    </BrowserRouter>
  );
}
