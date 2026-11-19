import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  obterTotalNaoLidas,
} from "./notificationsStorage";
import type { AppNotification } from "./notification.types";
import "./notifications.css";

interface NotificationsPopoverProps {
  onOpenDialog: OpenDevelopmentDialog;
  onNavigate?: () => void;
}

export function NotificationsPopover({
  onOpenDialog,
  onNavigate,
}: NotificationsPopoverProps) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = session?.conta?.id;

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    userId ? listarNotificacoes(userId).slice(0, 6) : []
  );
  const [unreadCount, setUnreadCount] = useState(() =>
    userId ? obterTotalNaoLidas(userId) : 0
  );

  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setNotifications(userId ? listarNotificacoes(userId).slice(0, 6) : []);
    setUnreadCount(userId ? obterTotalNaoLidas(userId) : 0);
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useEffect(() => {
    const sync = () => {
      if (userId) {
        setNotifications(listarNotificacoes(userId).slice(0, 6));
        setUnreadCount(obterTotalNaoLidas(userId));
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    };
    window.addEventListener("safra:notification-updated", sync);
    return () => window.removeEventListener("safra:notification-updated", sync);
  }, [userId]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelectNotification(notif: AppNotification) {
    if (userId) {
      marcarComoLida(notif.id, userId);
    }
    setOpen(false);
    onNavigate?.();
    navigate(notif.linkDestino);
  }

  function handleMarkAllRead() {
    if (!userId) return;
    marcarTodasComoLidas(userId);
  }

  const isNotificationsPage = location.pathname.startsWith(routes.notifications);

  return (
    <div className="notif-popover-wrap" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`site-header__notif-btn ${open || isNotificationsPage ? "site-header__notif-btn--active" : ""}`}
        aria-label={
          unreadCount > 0
            ? `Notificações (${unreadCount} não lidas)`
            : "Notificações"
        }
        title={
          unreadCount > 0
            ? `Notificações (${unreadCount} não lidas)`
            : "Notificações"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Icon name="bell" />
        {unreadCount > 0 && (
          <span className="site-header__notif-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={popoverId}
          className="notif-popover"
          role="dialog"
          aria-label="Notificações recentes"
        >
          <div className="notif-popover__header">
            <h3>Notificações</h3>
            {session && unreadCount > 0 && (
              <button
                type="button"
                className="notif-popover__mark-all"
                onClick={handleMarkAllRead}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {!session ? (
            <div className="notif-popover__empty">
              <Icon name="bell" />
              <p>Entre na sua conta para acompanhar mensagens, documentos e avisos dos seus lotes.</p>
              <button
                type="button"
                className="button button--primary button--small"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                  onOpenDialog("login");
                }}
              >
                Entrar na minha conta
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notif-popover__empty">
              <Icon name="check" />
              <p>Você está em dia! Nenhuma nova notificação por aqui.</p>
            </div>
          ) : (
            <ul className="notif-popover__list" role="list">
              {notifications.map((notif) => (
                <li key={notif.id}>
                  <button
                    type="button"
                    className={`notif-item ${!notif.lida ? "notif-item--unread" : ""}`}
                    onClick={() => handleSelectNotification(notif)}
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

          <div className="notif-popover__footer">
            <Link
              to={routes.notifications}
              className="notif-popover__all-link"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
            >
              Ver todas as notificações →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
