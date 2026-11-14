import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import { obterAnuncioPorId } from "../ads/adsStorage";
import defaultFarmImage from "../../assets/images/farm-landscape.jpeg";
import harvestSunsetImage from "../../assets/images/harvest-sunset.jpeg";
import {
  criarOuEnviarPrimeiraMensagem,
  enviarMensagem,
  listarChatsUsuario,
  marcarMensagensComoLidas,
  obterAvatarUsuario,
  obterChatPorAnuncioEComprador,
  obterChatPorId,
  simularRespostaVendedor,
} from "./chatStorage";
import type { ChatDraft, ChatRoom } from "./chat.types";
import "./chat.css";

interface NegotiationsPageProps {
  onOpenDialog?: OpenDevelopmentDialog;
}

export function NegotiationsPage({ onOpenDialog }: NegotiationsPageProps) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { chatId, anuncioId } = useParams<{ chatId?: string; anuncioId?: string }>();

  const [chats, setChats] = useState<ChatRoom[]>(() =>
    session?.conta?.id ? listarChatsUsuario(session.conta.id) : []
  );
  const [prevUserId, setPrevUserId] = useState(session?.conta?.id);
  if (session?.conta?.id !== prevUserId) {
    setPrevUserId(session?.conta?.id);
    setChats(session?.conta?.id ? listarChatsUsuario(session.conta.id) : []);
  }

  const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
  const [draft, setDraft] = useState<ChatDraft | null>(null);
  const [loadingAd, setLoadingAd] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);
  const [novoTexto, setNovoTexto] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleUpdate = () => {
      if (session?.conta?.id) {
        setChats(listarChatsUsuario(session.conta.id));
      } else {
        setChats([]);
      }
    };
    window.addEventListener("safra:chat-updated", handleUpdate);
    return () => window.removeEventListener("safra:chat-updated", handleUpdate);
  }, [session?.conta?.id]);

  // Sincroniza chat ativo ou modo rascunho com base nos parâmetros de rota
  useEffect(() => {
    if (!session?.conta?.id) return;
    const userId = session.conta.id;
    const userName = session.conta.nome;
    let isMounted = true;

    // Cenário 1: Navegação por anúncio (/negociacoes/anuncio/:anuncioId)
    if (anuncioId) {
      // Verifica se já existe conversa ativa para esse lote e comprador
      const existente = obterChatPorAnuncioEComprador(anuncioId, userId);
      if (existente) {
        queueMicrotask(() => {
          if (!isMounted) return;
          setActiveChat(existente);
          setDraft(null);
          marcarMensagensComoLidas(existente.id, userId);
        });
        return;
      }

      // Se não existe, entra no modo rascunho (Lazy Creation - US-028)
      queueMicrotask(() => {
        if (!isMounted) return;
        setLoadingAd(true);
        setAdError(null);
      });
      obterAnuncioPorId(anuncioId)
        .then((ad) => {
          if (!isMounted) return;
          if (!ad) {
            setAdError("Lote não encontrado no Mercado.");
            setDraft(null);
            return;
          }

          if (ad.vendedorId === userId) {
            setAdError("Você é o proprietário deste lote. Não é possível iniciar negociação consigo mesmo.");
            setDraft(null);
            return;
          }

          setDraft({
            isDraft: true,
            anuncio: ad,
            compradorId: userId,
            compradorNome: userName,
            compradorAvatar: session.avatarUrl || obterAvatarUsuario(userId),
            vendedorId: ad.vendedorId,
            vendedorNome: ad.vendedorNome || "Produtor Rural",
            vendedorAvatar: ad.vendedorAvatar || obterAvatarUsuario(ad.vendedorId),
          });
          setActiveChat(null);
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error("Erro ao carregar anúncio para conversa:", err);
          setAdError("Erro ao carregar detalhes do anúncio.");
        })
        .finally(() => {
          if (isMounted) setLoadingAd(false);
        });
      return;
    }

    // Cenário 2: Navegação por ID de chat específico (/negociacoes/:chatId)
    if (chatId) {
      const chat = obterChatPorId(chatId);
      queueMicrotask(() => {
        if (!isMounted) return;
        if (chat && (chat.compradorId === userId || chat.vendedorId === userId)) {
          setActiveChat(chat);
          setDraft(null);
          marcarMensagensComoLidas(chat.id, userId);
        } else {
          setActiveChat(null);
          setDraft(null);
        }
      });
      return;
    }

    // Cenário 3: Rota base (/negociacoes)
    queueMicrotask(() => {
      if (!isMounted) return;
      setDraft(null);
      const lista = listarChatsUsuario(userId);
      if (lista.length > 0) {
        setActiveChat(lista[0]);
        marcarMensagensComoLidas(lista[0].id, userId);
      } else {
        setActiveChat(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [anuncioId, chatId, session?.conta?.id, session?.conta?.nome]);

  // Scroll automático apenas dentro da caixa de mensagens do chat (sem deslocar o scroll da janela principal)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [activeChat?.mensagens, draft]);

  // Envio de mensagem (trata tanto o modo rascunho quanto chat existente)
  const handleEnviarMensagem = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const textoLimpo = novoTexto.trim();
    if (!textoLimpo || !session?.conta?.id || isSending) return;

    setIsSending(true);

    try {
      const userAvatar = session.avatarUrl || (session.conta?.id ? obterAvatarUsuario(session.conta.id) : undefined);

      // Se for modo rascunho: instancia a sala no storage apenas agora!
      if (draft) {
        const { chat } = criarOuEnviarPrimeiraMensagem({
          anuncio: draft.anuncio,
          compradorId: session.conta.id,
          compradorNome: session.conta.nome,
          compradorAvatar: userAvatar,
          texto: textoLimpo,
        });

        setDraft(null);
        setActiveChat(chat);
        setNovoTexto("");
        navigate(`/negociacoes/${chat.id}`, { replace: true });
        return;
      }

      // Se for chat já existente
      if (activeChat) {
        enviarMensagem(
          activeChat.id,
          session.conta.id,
          session.conta.nome,
          textoLimpo,
          userAvatar
        );

        // Atualiza chat ativo localmente
        const atualizado = obterChatPorId(activeChat.id);
        if (atualizado) {
          setActiveChat(atualizado);
        }
        setNovoTexto("");
      }
    } finally {
      setIsSending(false);
      setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 50);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnviarMensagem();
    }
  };

  // Simulação de resposta para demonstração e testes do badge
  const handleSimularResposta = () => {
    if (!activeChat) return;
    simularRespostaVendedor(activeChat.id);
    const atualizado = obterChatPorId(activeChat.id);
    if (atualizado) setActiveChat(atualizado);
  };

  // Estado não autenticado
  if (!session) {
    return (
      <div className="chat-page">
        <div className="container chat-page__unauthenticated">
          <div className="chat-unauth-box">
            <div className="chat-unauth-icon" aria-hidden="true">
              <Icon name="chat" />
            </div>
            <h1>Negociações e Mensagens</h1>
            <p>
              Entre na sua conta para conversar com produtores rurais, tirar dúvidas sobre especificações técnicas e negociar lotes diretamente pelo SafraDireta.
            </p>
            <div className="chat-unauth-actions">
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

  const userId = session.conta.id;

  // Renderização contextual do anúncio associado (seja rascunho ou chat existente)
  const loteContexto = draft
    ? {
        id: draft.anuncio.id,
        titulo: draft.anuncio.titulo,
        precoTotal: draft.anuncio.precoTotal,
        cidade: draft.anuncio.cidade,
        uf: draft.anuncio.uf,
        imagem:
          draft.anuncio.imagemUrl ||
          (draft.anuncio.fotos && draft.anuncio.fotos.length > 0 ? draft.anuncio.fotos[0] : undefined),
        categoria: draft.anuncio.categoria,
        contraparteNome: draft.vendedorNome,
        contraparteFarm: draft.anuncio.farmName,
        isComprador: true,
      }
    : activeChat
    ? {
        id: activeChat.anuncioId,
        titulo: activeChat.anuncioTitulo,
        precoTotal: activeChat.anuncioPrecoTotal,
        cidade: activeChat.anuncioCidade,
        uf: activeChat.anuncioUf,
        imagem: activeChat.anuncioImagem,
        categoria: activeChat.anuncioCategoria,
        contraparteNome:
          activeChat.compradorId === userId ? activeChat.vendedorNome : activeChat.compradorNome,
        contraparteFarm:
          activeChat.compradorId === userId ? activeChat.vendedorFarmName : undefined,
        isComprador: activeChat.compradorId === userId,
      }
    : null;

  return (
    <div className="chat-page">
      <div className="container chat-page__container">
        {/* Breadcrumb */}
        <nav className="chat-breadcrumb" aria-label="Navegação estrutural">
          <Link to={routes.home}>Início</Link>
          <span aria-hidden="true">/</span>
          <Link to={routes.market}>Mercado</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Minhas Negociações</span>
        </nav>

        <div className="chat-layout">
          {/* Coluna Esquerda: Lista de Conversas (Master) */}
          <aside className="chat-sidebar" aria-label="Lista de Negociações">
            <div className="chat-sidebar__header">
              <div className="chat-sidebar__title-wrap">
                <Icon name="chat" />
                <h2>Negociações</h2>
              </div>
              <span className="chat-sidebar__count">{chats.length}</span>
            </div>

            {chats.length === 0 && !draft ? (
              <div className="chat-sidebar__empty">
                <p>Nenhuma conversa ativa no momento.</p>
                <Link to={routes.market} className="button button--outline button--small">
                  Ver Lotes no Mercado
                </Link>
              </div>
            ) : (
              <ul className="chat-conversation-list" role="list">
                {/* Item em Rascunho se ativo */}
                {draft && (
                  <li className="chat-conversation-item chat-conversation-item--active chat-conversation-item--draft">
                    <div className="chat-item__thumb">
                      <img
                        src={loteContexto?.imagem || (draft.anuncio.categoria === "ANIMAL" ? defaultFarmImage : harvestSunsetImage)}
                        alt=""
                      />
                    </div>
                    <div className="chat-item__content">
                      <div className="chat-item__top">
                        <strong className="chat-item__title">{draft.anuncio.titulo}</strong>
                        <span className="chat-item__draft-badge">Nova</span>
                      </div>
                      <p className="chat-item__snippet">Rascunho: envie a primeira mensagem...</p>
                    </div>
                  </li>
                )}

                {/* Lista de salas salvas */}
                {chats.map((chat) => {
                  const isActive = activeChat?.id === chat.id && !draft;
                  const contraparte = chat.compradorId === userId ? chat.vendedorNome : chat.compradorNome;
                  const naoLidas = chat.mensagens.filter((m) => m.remetenteId !== userId && !m.lida).length;

                  return (
                    <li key={chat.id}>
                      <button
                        type="button"
                        className={`chat-conversation-item ${isActive ? "chat-conversation-item--active" : ""}`}
                        onClick={() => {
                          setDraft(null);
                          setActiveChat(chat);
                          marcarMensagensComoLidas(chat.id, userId);
                          navigate(`/negociacoes/${chat.id}`);
                        }}
                      >
                        <div className="chat-item__thumb">
                          <img
                            src={chat.anuncioImagem || (chat.anuncioCategoria === "ANIMAL" ? defaultFarmImage : harvestSunsetImage)}
                            alt=""
                          />
                        </div>
                        <div className="chat-item__content">
                          <div className="chat-item__top">
                            <strong className="chat-item__title">{chat.anuncioTitulo}</strong>
                            <span className="chat-item__time">
                              {chat.ultimaMensagemEm
                                ? new Date(chat.ultimaMensagemEm).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                          </div>
                          <div className="chat-item__sub">
                            <span className="chat-item__participant">
                              {chat.compradorId === userId ? "Vendedor: " : "Comprador: "}
                              {contraparte}
                            </span>
                            {naoLidas > 0 && <span className="chat-item__badge">{naoLidas}</span>}
                          </div>
                          <p className="chat-item__snippet">{chat.ultimaMensagem || "Conversa iniciada"}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Coluna Direita: Painel de Chat (Detail) */}
          <main className="chat-main" aria-label="Conversa Selecionada">
            {loadingAd ? (
              <div className="chat-state-box">
                <Icon name="clock" className="chat-spinner" />
                <p>Carregando informações do lote...</p>
              </div>
            ) : adError ? (
              <div className="chat-state-box chat-state-box--error">
                <Icon name="alert" />
                <h3>Aviso</h3>
                <p>{adError}</p>
                <Link to={routes.market} className="button button--primary button--small">
                  Voltar ao Mercado
                </Link>
              </div>
            ) : loteContexto ? (
              <>
                {/* Mini-Card Contextual Fixo no Topo do Chat (US-028) */}
                <header className="chat-context-card">
                  <div className="chat-context-card__media">
                    <img
                      src={
                        loteContexto.imagem ||
                        (loteContexto.categoria === "ANIMAL" ? defaultFarmImage : harvestSunsetImage)
                      }
                      alt={`Imagem do lote ${loteContexto.titulo}`}
                    />
                  </div>
                  <div className="chat-context-card__info">
                    <div className="chat-context-card__heading">
                      <span className="chat-context-card__eyebrow">
                        {loteContexto.categoria === "ANIMAL" ? "Pecuária de Corte" : "Produção Agrícola"}
                      </span>
                      <h1 className="chat-context-card__title">{loteContexto.titulo}</h1>
                    </div>
                    <div className="chat-context-card__meta">
                      <span className="chat-context-card__price">
                        {loteContexto.precoTotal.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                      <span className="chat-context-card__location">
                        <Icon name="location" /> {loteContexto.cidade}, {loteContexto.uf}
                      </span>
                      <span className="chat-context-card__partner">
                        <Icon name="user" /> {loteContexto.isComprador ? "Vendedor: " : "Comprador: "}
                        <strong>{loteContexto.contraparteNome}</strong>
                        {loteContexto.contraparteFarm ? ` (${loteContexto.contraparteFarm})` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="chat-context-card__actions">
                    <Link
                      to={routes.adDetail(loteContexto.id)}
                      className="button button--outline button--small"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir detalhes técnicos do anúncio em nova aba"
                    >
                      Ficha do Lote ↗
                    </Link>
                  </div>
                </header>

                {/* Banner de Boas Práticas e Segurança nas Negociações */}
                <div className="chat-safety-banner" role="note">
                  <Icon name="shield" />
                  <span>
                    <strong>Negociação Segura:</strong> Esclareça especificações técnicas, frete e laudos diretamente pelo chat. Pagamentos e acordos fora do fluxo oficial ocorrem sob responsabilidade das partes.
                  </span>
                </div>

                {/* Thread de Mensagens */}
                <div ref={messagesContainerRef} className="chat-messages-area" role="log" aria-live="polite">
                  {draft ? (
                    // Placeholder amigável de incentivo para Modo Rascunho
                    <div className="chat-draft-prompt">
                      <div className="chat-draft-prompt__icon" aria-hidden="true">
                        <Icon name="chat" />
                      </div>
                      <h2>Inicie a negociação deste lote</h2>
                      <p>
                        Envie uma mensagem para <strong>{loteContexto.contraparteNome}</strong> com sua proposta, dúvida de logística ou solicitação de visita à propriedade.
                      </p>
                      <div className="chat-draft-tips">
                        <span>💡 Sugestões de mensagem rápida:</span>
                        <div className="chat-draft-chips">
                          <button
                            type="button"
                            className="chat-chip"
                            onClick={() => setNovoTexto("Olá! Tenho interesse no lote. Gostaria de saber mais sobre a logística de retirada.")}
                          >
                            &ldquo;Tenho interesse no lote. Como funciona a retirada?&rdquo;
                          </button>
                          <button
                            type="button"
                            className="chat-chip"
                            onClick={() => setNovoTexto("Olá! O lote ainda está disponível para visita ou carregamento esta semana?")}
                          >
                            &ldquo;O lote está disponível para visita esta semana?&rdquo;
                          </button>
                          <button
                            type="button"
                            className="chat-chip"
                            onClick={() => setNovoTexto("Olá! Gostaria de confirmar se os laudos e pesagens foram aferidos recentemente.")}
                          >
                            &ldquo;Os laudos técnicos e pesagens foram aferidos recentemente?&rdquo;
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : activeChat && activeChat.mensagens.length > 0 ? (
                    <div className="chat-bubbles-list">
                      {activeChat.mensagens.map((msg) => {
                        const isMe = msg.remetenteId === userId;
                        const hora = new Date(msg.criadoEm).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <div
                            key={msg.id}
                            className={`chat-bubble-row ${isMe ? "chat-bubble-row--me" : "chat-bubble-row--other"}`}
                          >
                            {!isMe && (
                              <div className="chat-bubble-avatar">
                                <Avatar
                                  name={msg.remetenteNome}
                                  url={
                                    msg.remetenteAvatar ||
                                    obterAvatarUsuario(msg.remetenteId) ||
                                    (activeChat?.compradorId === msg.remetenteId
                                      ? activeChat?.compradorAvatar
                                      : activeChat?.vendedorAvatar)
                                  }
                                  size={32}
                                />
                              </div>
                            )}
                            <div className="chat-bubble">
                              <span className="chat-bubble__sender">{isMe ? "Você" : msg.remetenteNome}</span>
                              <p className="chat-bubble__text">{msg.texto}</p>
                              <div className="chat-bubble__meta">
                                <span className="chat-bubble__time">{hora}</span>
                                {isMe && (
                                  <span className="chat-bubble__status" title={msg.lida ? "Lida" : "Enviada"}>
                                    <Icon name="check" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="chat-empty-thread">
                      <p>Nenhuma mensagem nesta conversa ainda.</p>
                    </div>
                  )}
                </div>

                {/* Caixa de Digitação */}
                <footer className="chat-input-bar">
                  <form onSubmit={handleEnviarMensagem} className="chat-form">
                    <textarea
                      ref={textareaRef}
                      className="chat-textarea"
                      placeholder="Digite sua mensagem sobre este lote... (Pressione Enter para enviar)"
                      value={novoTexto}
                      onChange={(e) => setNovoTexto(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={2}
                      maxLength={1500}
                      aria-label="Campo de mensagem"
                    />
                    <div className="chat-form-actions">
                      {activeChat && (
                        <button
                          type="button"
                          className="button button--secondary button--small chat-sim-btn"
                          onClick={handleSimularResposta}
                          title="Simular resposta do vendedor para testar o recebimento e o badge de notificações"
                        >
                          Simular Resposta
                        </button>
                      )}
                      <button
                        type="submit"
                        className="button button--primary button--large chat-send-btn"
                        disabled={!novoTexto.trim() || isSending}
                        aria-label="Enviar mensagem"
                      >
                        <span>Enviar</span>
                        <Icon name="arrow" />
                      </button>
                    </div>
                  </form>
                </footer>
              </>
            ) : (
              // Empty State quando nenhum chat foi selecionado
              <div className="chat-state-box">
                <Icon name="chat" />
                <h3>Selecione uma negociação</h3>
                <p>Escolha uma conversa na barra lateral ou explore o Mercado para negociar lotes com produtores.</p>
                <Link to={routes.market} className="button button--primary">
                  Ir para o Mercado
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
