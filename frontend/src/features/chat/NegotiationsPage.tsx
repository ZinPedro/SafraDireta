import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent } from "react";
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
  CHATS_STORAGE_KEY,
  criarOuEnviarPrimeiraMensagem,
  enviarMensagem,
  formatarTamanhoArquivo,
  listarChatsUsuario,
  marcarMensagensComoLidas,
  MAX_CHAT_ATTACHMENTS_PER_MESSAGE,
  obterAnexosMensagem,
  obterAvatarUsuario,
  obterChatPorAnuncioEComprador,
  obterChatPorId,
  processarArquivosAnexoChat,
  simularRespostaVendedor,
} from "./chatStorage";
import type { ChatAttachment, ChatDraft, ChatRoom } from "./chat.types";
import "./chat.css";

interface NegotiationsPageProps {
  onOpenDialog?: OpenDevelopmentDialog;
}

type PreviewModalState =
  | { kind: "IMAGE_GALLERY"; items: ChatAttachment[]; index: number }
  | { kind: "PDF"; item: ChatAttachment }
  | null;

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
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [previewModal, setPreviewModal] = useState<PreviewModalState>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const handleUpdate = () => {
      if (!session?.conta?.id) {
        setChats([]);
        setActiveChat(null);
        return;
      }
      const userId = session.conta.id;
      setChats(listarChatsUsuario(userId));
      setActiveChat((prevActive) => {
        if (!prevActive) return prevActive;
        const atualizado = obterChatPorId(prevActive.id);
        if (!atualizado) return prevActive;
        if (
          atualizado.compradorId === userId ||
          atualizado.vendedorId === userId
        ) {
          return atualizado;
        }
        return prevActive;
      });
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === CHATS_STORAGE_KEY) {
        handleUpdate();
      }
    };

    window.addEventListener("safra:chat-updated", handleUpdate);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("safra:chat-updated", handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
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
          marcarMensagensComoLidas(existente.id, userId);
          const fresh = obterChatPorId(existente.id) || existente;
          setActiveChat(fresh);
          setDraft(null);
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
          marcarMensagensComoLidas(chat.id, userId);
          const fresh = obterChatPorId(chat.id) || chat;
          setActiveChat(fresh);
          setDraft(null);
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
        marcarMensagensComoLidas(lista[0].id, userId);
        const fresh = obterChatPorId(lista[0].id) || lista[0];
        setActiveChat(fresh);
      } else {
        setActiveChat(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [anuncioId, chatId, session?.conta?.id, session?.conta?.nome, session?.avatarUrl]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Scroll automático apenas dentro da caixa de mensagens do chat (sem deslocar o scroll da janela principal)
  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.mensagens, draft, pendingAttachments.length]);

  // Atalhos de teclado do modal (Esc para fechar; setas para navegar na galeria)
  useEffect(() => {
    if (!previewModal) return;
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewModal(null);
      } else if (previewModal.kind === "IMAGE_GALLERY" && previewModal.items.length > 1) {
        if (e.key === "ArrowRight") {
          setPreviewModal((prev) =>
            prev && prev.kind === "IMAGE_GALLERY"
              ? { ...prev, index: (prev.index + 1) % prev.items.length }
              : prev
          );
        } else if (e.key === "ArrowLeft") {
          setPreviewModal((prev) =>
            prev && prev.kind === "IMAGE_GALLERY"
              ? { ...prev, index: (prev.index - 1 + prev.items.length) % prev.items.length }
              : prev
          );
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [previewModal]);

  const handleProcessarArquivos = async (files: File[]) => {
    if (files.length === 0) return;
    setAttachmentError(null);
    setIsProcessingFile(true);
    try {
      const { anexos, erros } = await processarArquivosAnexoChat(files, pendingAttachments.length);
      if (anexos.length > 0) {
        setPendingAttachments((prev) =>
          [...prev, ...anexos].slice(0, MAX_CHAT_ATTACHMENTS_PER_MESSAGE)
        );
        setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 50);
      }
      if (erros.length > 0) {
        setAttachmentError(erros.join(" • "));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível anexar os arquivos.";
      setAttachmentError(msg);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (files.length === 0) return;
    void handleProcessarArquivos(files);
  };

  const handleDragEnter = (e: DragEvent<HTMLElement>) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: DragEvent<HTMLElement>) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    if (files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    void handleProcessarArquivos(files);
  };

  // Envio de mensagem (trata tanto o modo rascunho quanto chat existente, com ou sem anexos)
  const handleEnviarMensagem = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const textoLimpo = novoTexto.trim();
    if (
      (!textoLimpo && pendingAttachments.length === 0) ||
      !session?.conta?.id ||
      isSending ||
      isProcessingFile
    ) {
      return;
    }

    setIsSending(true);

    try {
      const userAvatar = session.avatarUrl || (session.conta?.id ? obterAvatarUsuario(session.conta.id) : undefined);
      const anexosParaEnviar = pendingAttachments.length > 0 ? pendingAttachments : undefined;

      // Se for modo rascunho: instancia a sala no storage apenas agora!
      if (draft) {
        const { chat } = criarOuEnviarPrimeiraMensagem({
          anuncio: draft.anuncio,
          compradorId: session.conta.id,
          compradorNome: session.conta.nome,
          compradorAvatar: userAvatar,
          texto: textoLimpo,
          anexos: anexosParaEnviar,
        });

        setDraft(null);
        setActiveChat(chat);
        setNovoTexto("");
        setPendingAttachments([]);
        setAttachmentError(null);
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
          userAvatar,
          anexosParaEnviar
        );

        // Atualiza chat ativo localmente
        const atualizado = obterChatPorId(activeChat.id);
        if (atualizado) {
          setActiveChat(atualizado);
        }
        setNovoTexto("");
        setPendingAttachments([]);
        setAttachmentError(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar mensagem.";
      setAttachmentError(msg);
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
                          if (chat.id !== activeChat?.id) {
                            setPendingAttachments([]);
                            setAttachmentError(null);
                          }
                          setDraft(null);
                          marcarMensagensComoLidas(chat.id, userId);
                          const fresh = obterChatPorId(chat.id) || chat;
                          setActiveChat(fresh);
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
          <main
            className={`chat-main ${isDraggingFile && loteContexto ? "chat-main--dragging" : ""}`}
            aria-label="Conversa Selecionada"
            onDragEnter={loteContexto ? handleDragEnter : undefined}
            onDragOver={loteContexto ? handleDragOver : undefined}
            onDragLeave={loteContexto ? handleDragLeave : undefined}
            onDrop={loteContexto ? handleDrop : undefined}
          >
            {isDraggingFile && loteContexto && (
              <div className="chat-drop-overlay" aria-hidden="true">
                <div className="chat-drop-overlay__box">
                  <Icon name="upload" />
                  <p>Solte os arquivos aqui para anexar à conversa</p>
                  <span>
                    Até {MAX_CHAT_ATTACHMENTS_PER_MESSAGE} arquivos (JPEG, PNG, WEBP ou PDF até 10 MB)
                  </span>
                </div>
              </div>
            )}
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
                        const anexosMsg = obterAnexosMensagem(msg);
                        const imagensMsg = anexosMsg.filter((a) => a.tipo === "IMAGEM");
                        const pdfsMsg = anexosMsg.filter((a) => a.tipo === "DOCUMENTO_PDF");

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

                              {imagensMsg.length === 1 && (
                                <button
                                  type="button"
                                  className="chat-attachment-image-btn"
                                  onClick={() =>
                                    setPreviewModal({
                                      kind: "IMAGE_GALLERY",
                                      items: imagensMsg,
                                      index: 0,
                                    })
                                  }
                                  title={`Ampliar imagem ${imagensMsg[0].nome}`}
                                  aria-label={`Ampliar imagem ${imagensMsg[0].nome}`}
                                >
                                  <img
                                    src={imagensMsg[0].url}
                                    alt={imagensMsg[0].nome}
                                    className="chat-attachment-image"
                                    onLoad={scrollToBottom}
                                  />
                                </button>
                              )}

                              {imagensMsg.length > 1 && (
                                <div className="chat-attachment-gallery">
                                  {imagensMsg.map((img, idx) => (
                                    <button
                                      key={`${msg.id}_img_${idx}`}
                                      type="button"
                                      className="chat-attachment-gallery__item"
                                      onClick={() =>
                                        setPreviewModal({
                                          kind: "IMAGE_GALLERY",
                                          items: imagensMsg,
                                          index: idx,
                                        })
                                      }
                                      title={`Ampliar imagem ${img.nome}`}
                                      aria-label={`Ampliar imagem ${img.nome} (${idx + 1} de ${imagensMsg.length})`}
                                    >
                                      <img
                                        src={img.url}
                                        alt={img.nome}
                                        className="chat-attachment-gallery__img"
                                        onLoad={scrollToBottom}
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}

                              {pdfsMsg.length > 0 && (
                                <div className="chat-attachment-pdf-list">
                                  {pdfsMsg.map((pdf, idx) => (
                                    <div key={`${msg.id}_pdf_${idx}`} className="chat-attachment-pdf">
                                      <div className="chat-attachment-pdf__header">
                                        <div className="chat-attachment-pdf__icon" aria-hidden="true">
                                          <Icon name="file" />
                                          <span>PDF</span>
                                        </div>
                                        <div className="chat-attachment-pdf__info">
                                          <strong className="chat-attachment-pdf__name" title={pdf.nome}>
                                            {pdf.nome}
                                          </strong>
                                          <span className="chat-attachment-pdf__size">
                                            {formatarTamanhoArquivo(pdf.tamanhoBytes)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="chat-attachment-pdf__actions">
                                        <button
                                          type="button"
                                          className="chat-attachment-pdf__btn chat-attachment-pdf__btn--view"
                                          onClick={() => setPreviewModal({ kind: "PDF", item: pdf })}
                                        >
                                          <Icon name="eye" />
                                          <span>Visualizar</span>
                                        </button>
                                        <a
                                          href={pdf.url}
                                          download={pdf.nome}
                                          className="chat-attachment-pdf__btn chat-attachment-pdf__btn--download"
                                        >
                                          <Icon name="download" />
                                          <span>Baixar</span>
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {msg.texto && <p className="chat-bubble__text">{msg.texto}</p>}

                              <div className="chat-bubble__meta">
                                <span className="chat-bubble__time">{hora}</span>
                                {isMe && (
                                  <span
                                    className={`chat-bubble__status ${
                                      msg.lida
                                        ? "chat-bubble__status--read"
                                        : "chat-bubble__status--sent"
                                    }`}
                                    title={msg.lida ? "Lida pelo destinatário" : "Enviada"}
                                    aria-label={msg.lida ? "Lida" : "Enviada"}
                                  >
                                    <Icon name={msg.lida ? "checkCheck" : "check"} />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="chat-empty-thread">
                      <p>Nenhuma mensagem nesta conversa ainda.</p>
                    </div>
                  )}
                </div>

                {/* Caixa de Digitação */}
                <footer className="chat-input-bar">
                  {attachmentError && (
                    <div className="chat-attachment-error" role="alert">
                      <Icon name="alert" />
                      <span>{attachmentError}</span>
                      <button
                        type="button"
                        className="chat-attachment-error__close"
                        onClick={() => setAttachmentError(null)}
                        aria-label="Fechar aviso de arquivo"
                      >
                        <Icon name="close" />
                      </button>
                    </div>
                  )}

                  {pendingAttachments.length > 0 && (
                    <div
                      className="chat-attachment-preview-wrap"
                      role="region"
                      aria-label="Arquivos selecionados para envio"
                    >
                      <div className="chat-attachment-preview-header">
                        <span>
                          Anexos selecionados ({pendingAttachments.length}/{MAX_CHAT_ATTACHMENTS_PER_MESSAGE})
                        </span>
                        {pendingAttachments.length > 1 && (
                          <button
                            type="button"
                            className="chat-attachment-preview-clear"
                            onClick={() => setPendingAttachments([])}
                          >
                            Remover todos
                          </button>
                        )}
                      </div>
                      <div className="chat-attachment-preview-list">
                        {pendingAttachments.map((anexo, index) => (
                          <div key={`${anexo.nome}_${index}`} className="chat-attachment-preview">
                            {anexo.tipo === "IMAGEM" ? (
                              <div className="chat-attachment-preview__media">
                                <img src={anexo.url} alt={anexo.nome} />
                              </div>
                            ) : (
                              <div className="chat-attachment-preview__pdf-icon" aria-hidden="true">
                                <Icon name="file" />
                                <span>PDF</span>
                              </div>
                            )}
                            <div className="chat-attachment-preview__info">
                              <strong className="chat-attachment-preview__name" title={anexo.nome}>
                                {anexo.nome}
                              </strong>
                              <span className="chat-attachment-preview__size">
                                {formatarTamanhoArquivo(anexo.tamanhoBytes)}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="chat-attachment-preview__remove"
                              onClick={() =>
                                setPendingAttachments((prev) => prev.filter((_, idx) => idx !== index))
                              }
                              aria-label={`Remover anexo ${anexo.nome}`}
                              title="Remover anexo"
                            >
                              <Icon name="close" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleEnviarMensagem} className="chat-form">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                      className="sr-only"
                      onChange={handleFileInputChange}
                      aria-label="Selecionar imagens ou PDFs"
                    />
                    <div className="chat-input-row">
                      <button
                        type="button"
                        className="chat-attach-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={
                          isProcessingFile ||
                          isSending ||
                          pendingAttachments.length >= MAX_CHAT_ATTACHMENTS_PER_MESSAGE
                        }
                        title={
                          pendingAttachments.length >= MAX_CHAT_ATTACHMENTS_PER_MESSAGE
                            ? `Limite de ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} anexos por mensagem atingido`
                            : `Anexar até ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} arquivos (JPEG, PNG, WEBP ou PDF até 10 MB)`
                        }
                        aria-label="Anexar arquivos"
                      >
                        <Icon name="paperclip" />
                      </button>
                      <textarea
                        ref={textareaRef}
                        className="chat-textarea"
                        placeholder={
                          isProcessingFile
                            ? "Processando arquivos..."
                            : "Digite sua mensagem sobre este lote... (Pressione Enter para enviar)"
                        }
                        value={novoTexto}
                        onChange={(e) => setNovoTexto(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={2}
                        maxLength={1500}
                        aria-label="Campo de mensagem"
                      />
                    </div>
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
                        disabled={
                          (!novoTexto.trim() && pendingAttachments.length === 0) ||
                          isSending ||
                          isProcessingFile
                        }
                        aria-label="Enviar mensagem"
                      >
                        <span>{isProcessingFile ? "Processando..." : "Enviar"}</span>
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

      {/* Modal Lightbox de Imagem / Galeria (US-030) */}
      {previewModal && previewModal.kind === "IMAGE_GALLERY" && (() => {
        const atual = previewModal.items[previewModal.index];
        if (!atual) return null;
        const temMultiplas = previewModal.items.length > 1;
        return (
          <div
            className="chat-modal-backdrop chat-modal-backdrop--dark"
            role="dialog"
            aria-modal="true"
            aria-label={`Visualização da imagem ${atual.nome}`}
            onClick={() => setPreviewModal(null)}
          >
            <div className="chat-lightbox" onClick={(e) => e.stopPropagation()}>
              <div className="chat-lightbox__bar">
                <span className="chat-lightbox__title">
                  {temMultiplas ? `(${previewModal.index + 1}/${previewModal.items.length}) ` : ""}
                  {atual.nome}
                </span>
                <div className="chat-lightbox__actions">
                  {temMultiplas && (
                    <>
                      <button
                        type="button"
                        className="chat-lightbox__btn"
                        onClick={() =>
                          setPreviewModal((prev) =>
                            prev && prev.kind === "IMAGE_GALLERY"
                              ? {
                                  ...prev,
                                  index: (prev.index - 1 + prev.items.length) % prev.items.length,
                                }
                              : prev
                          )
                        }
                        aria-label="Imagem anterior"
                        title="Anterior (←)"
                      >
                        <Icon name="back" />
                      </button>
                      <button
                        type="button"
                        className="chat-lightbox__btn"
                        onClick={() =>
                          setPreviewModal((prev) =>
                            prev && prev.kind === "IMAGE_GALLERY"
                              ? { ...prev, index: (prev.index + 1) % prev.items.length }
                              : prev
                          )
                        }
                        aria-label="Próxima imagem"
                        title="Próxima (→)"
                      >
                        <Icon name="arrow" />
                      </button>
                    </>
                  )}
                  <a
                    href={atual.url}
                    download={atual.nome}
                    className="chat-lightbox__btn"
                    title="Baixar imagem"
                    aria-label="Baixar imagem"
                  >
                    <Icon name="download" />
                  </a>
                  <button
                    type="button"
                    className="chat-lightbox__btn"
                    onClick={() => setPreviewModal(null)}
                    aria-label="Fechar visualização"
                    title="Fechar (Esc)"
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </div>
              <div className="chat-lightbox__stage">
                <img src={atual.url} alt={atual.nome} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Visualizador Nativo de PDF (US-030) */}
      {previewModal && previewModal.kind === "PDF" && (
        <div
          className="chat-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização do documento ${previewModal.item.nome}`}
          onClick={() => setPreviewModal(null)}
        >
          <div className="chat-pdf-modal" onClick={(e) => e.stopPropagation()}>
            <header className="chat-pdf-modal__header">
              <div className="chat-pdf-modal__title-wrap">
                <Icon name="file" />
                <div>
                  <h3>{previewModal.item.nome}</h3>
                  <span>{formatarTamanhoArquivo(previewModal.item.tamanhoBytes)}</span>
                </div>
              </div>
              <div className="chat-pdf-modal__actions">
                <a
                  href={previewModal.item.url}
                  download={previewModal.item.nome}
                  className="button button--outline button--small"
                >
                  <Icon name="download" />
                  <span>Baixar</span>
                </a>
                <button
                  type="button"
                  className="chat-pdf-modal__close"
                  onClick={() => setPreviewModal(null)}
                  aria-label="Fechar visualizador de PDF"
                  title="Fechar (Esc)"
                >
                  <Icon name="close" />
                </button>
              </div>
            </header>
            <div className="chat-pdf-modal__body">
              <iframe
                src={previewModal.item.url}
                title={previewModal.item.nome}
                className="chat-pdf-modal__iframe"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
