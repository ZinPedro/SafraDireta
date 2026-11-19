import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import { Icon } from "../../components/Icon";
import {
  formatarTempoRelativo,
  getNotificationIcon,
  getNotificationToneClass,
  listarNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
} from "./notificationsStorage";
import type {
  AppNotification,
  NotificationFilterTab,
} from "./notification.types";
import "./notifications.css";

interface NotificationsPageProps {
  onOpenDialog?: OpenDevelopmentDialog;
}

const FILTER_TABS: { id: NotificationFilterTab; label: string }[] = [
  { id: "TODAS", label: "Todas" },
  { id: "NAO_LIDAS", label: "Não lidas" },
  { id: "NEGOCIACOES", label: "Negociações" },
  { id: "LOTES_DOCUMENTOS", label: "Lotes e Documentos" },
];

export function NotificationsPage({ onOpenDialog }: NotificationsPageProps) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const userId = session?.conta?.id;

  const [activeTab, setActiveTab] = useState<NotificationFilterTab>("TODAS");
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    userId ? listarNotificacoes(userId) : []
  );

  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setNotifications(userId ? listarNotificacoes(userId) : []);
  }

  useEffect(() => {
    const sync = () => {
      if (userId) {
        setNotifications(listarNotificacoes(userId));
      } else {
        setNotifications([]);
      }
    };
    window.addEventListener("safra:notification-updated", sync);
    return () => window.removeEventListener("safra:notification-updated", sync);
  }, [userId]);

  if (!session) {
    return (
      <div className="notif-page">
        <div className="container notif-page__unauth">
          <div className="notif-unauth-box">
            <div className="notif-unauth-icon" aria-hidden="true">
              <Icon name="bell" />
            </div>
            <h1>Central de Notificações</h1>
            <p>
              Entre na sua conta para acompanhar mensagens de negociação, solicitações de documentos e atualizações dos seus lotes favoritados.
            </p>
            <div className="notif-unauth-actions">
              <button
                type="button"
                className="button button--primary button--large"
                onClick={() => onOpenDialog?.("login")}
              >
                Entrar na minha conta
              </button>
              <Link to={routes.market} className="button button--outline button--large">
                Explorar o Mercado
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const unreadTotal = notifications.filter((n) => !n.lida).length;

  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === "NAO_LIDAS") return !notif.lida;
    if (activeTab === "NEGOCIACOES") return notif.tipo === "CHAT_MESSAGE";
    if (activeTab === "LOTES_DOCUMENTOS") {
      return (
        notif.tipo === "DOCUMENT_REQUEST" ||
        notif.tipo === "DOCUMENT_APPROVED" ||
        notif.tipo === "DOCUMENT_REJECTED" ||
        notif.tipo === "FAVORITE_CLOSED" ||
        notif.tipo === "FAVORITE_PAUSED"
      );
    }
    return true;
  });

  function handleOpenNotification(notif: AppNotification) {
    if (userId) {
      marcarComoLida(notif.id, userId);
    }
    navigate(notif.linkDestino);
  }

  return (
    <div className="notif-page">
      <div className="container notif-page__container">
        <nav className="notif-breadcrumb" aria-label="Navegação estrutural">
          <Link to={routes.home}>Início</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Notificações</span>
        </nav>

        <header className="notif-page__header">
          <div>
            <h1>Notificações e Pendências</h1>
            <p>
              {unreadTotal > 0
                ? `Você tem ${unreadTotal} ${unreadTotal === 1 ? "notificação não lida" : "notificações não lidas"}.`
                : "Você está em dia com todas as suas notificações."}
            </p>
          </div>
          {unreadTotal > 0 && userId && (
            <button
              type="button"
              className="button button--outline button--small"
              onClick={() => marcarTodasComoLidas(userId)}
            >
              <Icon name="check" />
              <span>Marcar todas como lidas</span>
            </button>
          )}
        </header>

        <div className="notif-tabs" role="tablist" aria-label="Filtrar notificações">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.id === "NAO_LIDAS"
                ? unreadTotal
                : tab.id === "TODAS"
                ? notifications.length
                : null;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`notif-tab ${isSelected ? "notif-tab--active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
                {count !== null && count > 0 && (
                  <span className="notif-tab__count">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <section className="notif-card" aria-label="Lista de notificações">
          {filteredNotifications.length === 0 ? (
            <div className="notif-page__empty">
              <div className="notif-page__empty-icon" aria-hidden="true">
                <Icon name="bell" />
              </div>
              <h2>Nenhuma notificação encontrada</h2>
              <p>
                {activeTab === "NAO_LIDAS"
                  ? "Você está em dia! Nenhuma notificação não lida por aqui."
                  : "Ainda não há registros nesta categoria. Continue negociando e acompanhando lotes no Mercado."}
              </p>
              <Link to={routes.market} className="button button--primary">
                Explorar o Mercado
              </Link>
            </div>
          ) : (
            <ul className="notif-page__list" role="list">
              {filteredNotifications.map((notif) => (
                <li key={notif.id}>
                  <button
                    type="button"
                    className={`notif-item notif-item--full ${!notif.lida ? "notif-item--unread" : ""}`}
                    onClick={() => handleOpenNotification(notif)}
                  >
                    <span
                      className={`notif-item__icon ${getNotificationToneClass(notif.tipo)}`}
                      aria-hidden="true"
                    >
                      <Icon name={getNotificationIcon(notif.tipo)} />
                    </span>
                    <div className="notif-item__body">
                      <div className="notif-item__top">
                        <strong className="notif-item__title">{notif.titulo}</strong>
                        <span className="notif-item__time">
                          {formatarTempoRelativo(notif.criadoEm)}
                        </span>
                      </div>
                      <p className="notif-item__msg">{notif.mensagem}</p>
                    </div>
                    {!notif.lida && (
                      <span className="notif-item__dot" aria-label="Não lida" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
