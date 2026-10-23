import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { RegistrationPage } from "./features/registration/RegistrationPage";
import { CorporateRegistrationPage } from "./features/corporate-registration/CorporateRegistrationPage";
import { SellerUpgradePage } from "./features/seller-upgrade/SellerUpgradePage";
import { AuthProvider } from "./context/AuthContext";
import { ProfilePage } from "./features/profile/ProfilePage";
import { LoginDialog } from "./features/login/LoginDialog";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { DevelopmentDialog } from "./components/DevelopmentDialog";
import { LegalDialog } from "./components/LegalDialog";
import { HomePage } from "./pages/HomePage";
import { DevelopmentPage } from "./pages/DevelopmentPage";
import { MarketPage } from "./features/ads/MarketPage";
import { AnimalAdCreatePage } from "./features/ads/AnimalAdCreatePage";
import { MyAdsPage } from "./features/ads/MyAdsPage";
import { AdDetailPage } from "./features/ads/AdDetailPage";
import { AdEditPage } from "./features/ads/AdEditPage";
import { PublicProducerProfilePage } from "./features/ads/PublicProducerProfilePage";
import { AdminBar } from "./features/admin/AdminBar";
import { AdminDashboardPage } from "./features/admin/AdminDashboardPage";
import { ADMIN_SECRET_SLUG, routes } from "./data/site";
import type { DevelopmentFeature } from "./data/site";
import "./App.css";

const pageTitles: Record<string, string> = {
  [routes.registration]: "Crie sua conta | SafraDireta",
  [routes.corporateRegistration]: "Cadastro Corporativo | SafraDireta",
  [routes.sellerUpgrade]: "Habilitar vendedor | SafraDireta",
  [routes.profile]: "Meu perfil | SafraDireta",
  [routes.home]: "SafraDireta — Do campo à negociação",
  [routes.market]: "Mercado Agropecuário | SafraDireta",
  [routes.myAds]: "Meus Anúncios | SafraDireta",
  [routes.createAd]: "Cadastrar Lote de Animais | SafraDireta",
  [routes.producers]: "Produtores | SafraDireta",
  [routes.guide]: "Guia do usuário | SafraDireta",
  [ADMIN_SECRET_SLUG]: "Portal de Governança e Moderação | SafraDireta",
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
    location.pathname === routes.sellerUpgrade ||
    location.pathname === ADMIN_SECRET_SLUG;

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
    if (location.pathname.startsWith("/anuncios/") && location.pathname.endsWith("/editar")) {
      document.title = "Editar Anúncio | SafraDireta";
    } else if (location.pathname.startsWith("/anuncios/")) {
      document.title = "Ficha Técnica do Lote | SafraDireta";
    } else if (location.pathname.startsWith("/produtor/")) {
      document.title = "Vitrine do Produtor | SafraDireta";
    } else {
      document.title =
        pageTitles[location.pathname] ?? "Página não encontrada | SafraDireta";
    }
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
      <AdminBar />
      {!isRegistrationPage && <Header key={location.pathname} onOpenDialog={openFeature} />}
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        <Routes>
          <Route path={ADMIN_SECRET_SLUG} element={<AdminDashboardPage />} />
          <Route path={routes.registration} element={<RegistrationPage onOpenDialog={openFeature} />} />
          <Route path={routes.sellerUpgrade} element={<SellerUpgradePage />} />
          <Route path={routes.profile} element={<ProfilePage onOpenDialog={openFeature} />} />
          <Route path={routes.corporateRegistration} element={<CorporateRegistrationPage onOpenDialog={openFeature} />} />
          <Route
            path={routes.home}
            element={<HomePage onOpenDialog={openFeature} />}
          />
          <Route path={routes.market} element={<MarketPage />} />
          <Route path={routes.createAd} element={<AnimalAdCreatePage onOpenDialog={openFeature} />} />
          <Route path={routes.myAds} element={<MyAdsPage onOpenDialog={openFeature} />} />
          <Route path={routes.adEdit} element={<AdEditPage onOpenDialog={openFeature} />} />
          <Route path="/anuncios/:id" element={<AdDetailPage />} />
          <Route path="/produtor/:id" element={<PublicProducerProfilePage />} />
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
      {(dialogFeature === "terms" || dialogFeature === "privacy") && (
        <LegalDialog
          key={dialogFeature}
          initialTab={dialogFeature}
          onClose={() => setDialogFeature(null)}
        />
      )}
      <DevelopmentDialog
        feature={
          dialogFeature === "login" ||
          dialogFeature === "terms" ||
          dialogFeature === "privacy"
            ? null
            : dialogFeature
        }
        onClose={() => setDialogFeature(null)}
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Site />
      </AuthProvider>
    </BrowserRouter>
  );
}
