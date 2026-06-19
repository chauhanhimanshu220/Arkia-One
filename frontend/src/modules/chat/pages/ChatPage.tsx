import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { ChatAvatar } from "../components/ChatAvatar";
import { useChat } from "../context/ChatContext";
import { useChatMessages } from "../hooks/useChatMessages";
import { chatApi } from "../services/chatApi";
import type { ChatAttachment, ChatContact, ChatMessage, ChatParticipant, ChatPresence, ChatThread } from "../types/chat.types";

const formatThreadTime = (value: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatMessageTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const dedupeContacts = (contacts: ChatContact[]) => {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    if (seen.has(contact.userId)) {
      return false;
    }

    seen.add(contact.userId);
    return true;
  });
};

const getThreadPreview = (thread: ChatThread) => {
  if (thread.lastMessageType === "System") {
    return thread.lastMessageText ?? "System update";
  }

  if (thread.lastMessageText) {
    return thread.lastMessageSenderName
      ? `${thread.lastMessageSenderName}: ${thread.lastMessageText}`
      : thread.lastMessageText;
  }

  return "No messages yet";
};

const getPresenceLabel = (thread: ChatThread) => {
  if (thread.threadType === "Direct") {
    return "Online";
  }

  return `${thread.participantCount} ${thread.participantCount === 1 ? "member" : "members"}`;
};

const getThreadMeta = (thread: ChatThread) => {
  switch (thread.threadType) {
    case "Direct":
      return "Direct message";
    case "ProjectGroup":
      return "Project group";
    case "TeamGroup":
      return "Team group";
    case "RoleGroup":
      return "Role group";
    default:
      return "Broadcast";
  }
};

const renderMessageBubble = (
  message: ChatMessage,
  actions: {
    onReply: (message: ChatMessage) => void;
    onEdit: (message: ChatMessage) => void;
    onDelete: (message: ChatMessage) => void;
    onReact: (message: ChatMessage, emoji: string) => void;
    onPin: (message: ChatMessage) => void;
  },
  showAvatarAndName: boolean = true
) => {
  if (message.messageType === "System") {
    return (
      <div key={message.id} className="my-4 flex justify-center">
        <div className="rounded-full bg-zinc-100/80 px-4 py-1.5 text-[11px] font-medium text-zinc-500 backdrop-blur-sm dark:bg-zinc-800/50 dark:text-zinc-400">
          {message.messageText}
        </div>
      </div>
    );
  }

  return (
    <div key={message.id} className={`group flex w-full ${message.isOwnMessage ? "justify-end" : "justify-start"} ${showAvatarAndName ? "mt-4" : "mt-1"}`}>
      <div className={`relative flex max-w-[85%] md:max-w-[70%] ${message.isOwnMessage ? "flex-row-reverse" : "flex-row"} gap-2`}>
        {!message.isOwnMessage && showAvatarAndName ? (
          <div className="mt-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            {message.senderName?.[0]?.toUpperCase()}
          </div>
        ) : !message.isOwnMessage ? (
           <div className="w-7 shrink-0" />
        ) : null}
        
        <div
          className={`relative rounded-[20px] px-4 py-2.5 text-[15px] leading-relaxed shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-all ${
            message.isOwnMessage
              ? "bg-zinc-900 text-white dark:bg-zinc-900 dark:text-zinc-100 rounded-br-[4px]"
              : "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 rounded-bl-[4px] border border-zinc-100 dark:border-zinc-800/50"
          }`}
        >
          {!message.isOwnMessage && showAvatarAndName ? (
            <p className="mb-1 text-[12px] font-semibold text-zinc-800 dark:text-zinc-300">{message.senderName}</p>
          ) : null}
          {message.isPinned ? <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-amber-500 uppercase tracking-wide"><Icon name="map-pin" className="h-3 w-3" /> Pinned</p> : null}
          {message.replyPreviewText ? (
            <div className="mb-2 rounded-xl bg-black/5 border-l-2 border-zinc-400 px-3 py-2 text-xs opacity-90 dark:bg-white/5 dark:border-zinc-500">
              <span className="block text-[10px] font-semibold opacity-70 mb-0.5">Replied to</span>
              {message.replyPreviewText}
            </div>
          ) : null}
          
          <div className="whitespace-pre-wrap break-words">{message.messageText}</div>
          
          {message.attachments.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {message.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-xs font-medium hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                >
                  <Icon name="file-spreadsheet" className="h-4 w-4 opacity-70" />
                  <span className="truncate">{attachment.originalFileName}</span>
                </a>
              ))}
            </div>
          ) : null}
          
          {message.reactions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => actions.onReact(message, reaction.emoji)}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-transform hover:scale-105 ${reaction.reactedByCurrentUser ? "bg-zinc-200/50 dark:bg-white/20 border border-zinc-300 dark:border-white/10" : "bg-black/5 dark:bg-white/5 border border-transparent hover:bg-black/10 dark:hover:bg-white/10"}`}
                >
                  <span>{reaction.emoji}</span> <span>{reaction.count}</span>
                </button>
              ))}
            </div>
          ) : null}
          
          <div className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] font-medium opacity-60 ${message.isOwnMessage ? "text-white" : "text-zinc-500 dark:text-zinc-400"}`}>
            <span>{formatMessageTime(message.createdAtUtc)}</span>
            {message.editedAtUtc ? <span>(edited)</span> : null}
            {message.isOwnMessage ? (
              <span className="ml-0.5 uppercase tracking-wide opacity-80">{message.messageStatus}</span>
            ) : null}
          </div>
        </div>

        <div className={`absolute top-1/2 -translate-y-1/2 flex opacity-0 shadow-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl p-1 gap-1 transition-all group-hover:opacity-100 ${message.isOwnMessage ? "right-full mr-2" : "left-full ml-2"}`}>
           <button title="React" onClick={() => actions.onReact(message, "+1")} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"><Icon name="user-circle" className="h-4 w-4" /></button>
           <button title="Reply" onClick={() => actions.onReply(message)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"><Icon name="chevron-left" className="h-4 w-4" /></button>
           <button title={message.isPinned ? "Unpin" : "Pin"} onClick={() => actions.onPin(message)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"><Icon name="map-pin" className="h-4 w-4" /></button>
           {message.isOwnMessage ? <button title="Edit" onClick={() => actions.onEdit(message)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"><Icon name="edit" className="h-4 w-4" /></button> : null}
           {message.isOwnMessage ? <button title="Delete" onClick={() => actions.onDelete(message)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 transition-colors"><Icon name="trash" className="h-4 w-4" /></button> : null}
        </div>
      </div>
    </div>
  );
};

const findOtherParticipants = (participants: ChatParticipant[]) => participants.filter((participant) => !participant.isCurrentUser);

export const ChatPage = () => {
  const navigate = useNavigate();
  const { threads, threadsLoading, contacts, reloadThreads, startDirectChat } = useChat();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [presence, setPresence] = useState<ChatPresence[]>([]);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  const activeThreadId = searchParams.get("threadId");

  const searchableContacts = useMemo(
    () =>
      dedupeContacts([
        ...contacts.projectMembers,
        ...contacts.teamMembers,
        ...contacts.hierarchyMembers,
        ...contacts.supportMembers,
        ...contacts.directoryMembers,
      ]),
    [contacts.directoryMembers, contacts.hierarchyMembers, contacts.projectMembers, contacts.supportMembers, contacts.teamMembers],
  );

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      if (!deferredSearch) {
        return true;
      }

      const otherParticipantNames = findOtherParticipants(thread.participants).map((participant) => participant.fullName);
      return [
        thread.name,
        thread.description,
        thread.lastMessageText,
        thread.lastMessageSenderName,
        thread.departmentName,
        ...otherParticipantNames,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(deferredSearch);
    });
  }, [deferredSearch, threads]);

  const matchingContacts = useMemo(() => {
    if (!deferredSearch) {
      return [];
    }

    const existingDirectContactIds = new Set(
      threads
        .filter((thread) => thread.threadType === "Direct")
        .flatMap((thread) => findOtherParticipants(thread.participants).map((participant) => participant.userId)),
    );

    return searchableContacts
      .filter((contact) =>
        [contact.fullName, contact.role, contact.department, contact.contextLabel]
          .join(" ")
          .toLowerCase()
          .includes(deferredSearch),
      )
      .filter((contact) => !existingDirectContactIds.has(contact.userId))
      .slice(0, 8);
  }, [deferredSearch, searchableContacts, threads]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? filteredThreads[0] ?? null,
    [activeThreadId, filteredThreads, threads],
  );

  const {
    messages,
    loading: messagesLoading,
    sending,
    error: messageError,
    reloadMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    pinMessage,
  } = useChatMessages(activeThread?.id ?? null, () => reloadThreads(false));

  useEffect(() => {
    if (!activeThreadId && filteredThreads[0]) {
      startTransition(() => {
        setSearchParams({ threadId: filteredThreads[0].id }, { replace: true });
      });
    }
  }, [activeThreadId, filteredThreads, setSearchParams]);

  useEffect(() => {
    if (!activeThread) {
      return;
    }

    messageInputRef.current?.focus();
    setMobileListOpen(false);
    setReplyTo(null);
    setPendingAttachments([]);
  }, [activeThread?.id]);

  useEffect(() => {
    if (!activeThread) {
      return;
    }

    const timer = setTimeout(() => {
      void chatApi.updatePresence({
        presenceStatus: "Online",
        activeThreadId: activeThread.id,
        isTyping: Boolean(draftMessage.trim()),
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [activeThread?.id, draftMessage]);

  useEffect(() => {
    if (!activeThread) {
      setPresence([]);
      return;
    }

    let active = true;
    const loadPresence = async () => {
      try {
        const data = await chatApi.getPresence(activeThread.id);
        if (active) {
          setPresence(data);
        }
      } catch {
        if (active) {
          setPresence([]);
        }
      }
    };

    void loadPresence();
    const timer = window.setInterval(() => void loadPresence(), 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeThread?.id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectThread = (threadId: string) => {
    startTransition(() => {
      setSearchParams({ threadId }, { replace: true });
    });
  };

  const handleStartDirectChat = async (userId: string) => {
    const thread = await startDirectChat(userId);
    if (!thread) {
      return;
    }

    await reloadThreads();
    selectThread(thread.id);
  };

  const handleSend = async () => {
    const text = draftMessage.trim();
    if ((!text && pendingAttachments.length === 0) || !activeThread) {
      return;
    }

    const attachmentIds = pendingAttachments.map((attachment) => attachment.id);
    const message = await sendMessage(text || (attachmentIds.length > 0 ? "Attachment" : ""), replyTo?.id, attachmentIds);
    if (!message) {
      return;
    }

    setDraftMessage("");
    setReplyTo(null);
    setPendingAttachments([]);
    await reloadThreads(false);
    messageInputRef.current?.focus();
  };

  const handleAttachmentUpload = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setUploadingAttachment(true);
    try {
      const attachment = await chatApi.uploadAttachment(file);
      setPendingAttachments((current) => [...current, attachment]);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleEditMessage = async (message: ChatMessage) => {
    const nextText = window.prompt("Edit message", message.messageText);
    if (nextText === null || !nextText.trim()) {
      return;
    }

    await editMessage(message.id, nextText.trim());
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!window.confirm("Delete this message for everyone?")) {
      return;
    }

    await deleteMessage(message.id);
  };

  const handleThreadPreference = async (action: "pin" | "mute" | "archive" | "leave") => {
    if (!activeThread) {
      return;
    }

    if (action === "pin") {
      await chatApi.pinThread(activeThread.id, !activeThread.isPinned);
    } else if (action === "mute") {
      await chatApi.muteThread(activeThread.id, !activeThread.isMuted);
    } else if (action === "archive") {
      if (!window.confirm("Archive this conversation for all participants?")) {
        return;
      }
      await chatApi.archiveThread(activeThread.id);
    } else {
      if (!window.confirm("Leave this conversation?")) {
        return;
      }
      await chatApi.leaveThread(activeThread.id);
    }

    await reloadThreads();
  };

  const handleComposerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void handleSend();
  };

  const showSidebarOnMobile = !activeThread || mobileListOpen;
  const currentParticipantId = activeThread?.participants.find((participant) => participant.isCurrentUser)?.userId;
  const activePresenceCount = presence.filter((item) => item.presenceStatus !== "Offline").length;
  const typingCount = presence.filter((item) => item.isTyping && item.userId !== currentParticipantId).length;

  return (
    <section className="h-[calc(100vh-8.75rem)] min-h-[620px] w-full overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-full min-h-0">
        <aside
          className={`${
            showSidebarOnMobile ? "flex" : "hidden"
          } w-full min-w-0 flex-col bg-zinc-50 border-r border-zinc-200 dark:border-zinc-800 md:flex md:w-[320px] md:min-w-[320px] md:max-w-[320px] dark:bg-zinc-950`}
        >
          <div className="border-b border-zinc-200/60 px-4 py-5 dark:border-zinc-800/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-[17px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Chats</h1>
                <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">{threads.length} conversations</p>
              </div>
              <button
                type="button"
                onClick={() => void reloadThreads()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
                aria-label="Refresh chats"
              >
                <Icon name="refresh-cw" className="h-[15px] w-[15px]" />
              </button>
            </div>

            <label className="mt-5 flex items-center gap-2.5 rounded-[16px] border border-zinc-200/80 bg-zinc-100/50 px-3.5 py-2.5 transition-colors focus-within:border-zinc-300 focus-within:bg-white dark:border-white/5 dark:bg-black/20 dark:focus-within:border-white/10 dark:focus-within:bg-black/40">
              <Icon name="search" className="h-[15px] w-[15px] text-zinc-400 dark:text-zinc-500" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search chats"
                className="w-full bg-transparent text-[13px] text-zinc-900 outline-none placeholder:text-zinc-500 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {threadsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-zinc-200/60 bg-white p-3 dark:border-white/5 dark:bg-white/5">
                    <div className="flex animate-pulse items-center gap-3">
                      <div className="h-[42px] w-[42px] rounded-full bg-zinc-200 dark:bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/2 rounded-full bg-zinc-200 dark:bg-white/10" />
                        <div className="h-2.5 w-3/4 rounded-full bg-zinc-200 dark:bg-white/10" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {filteredThreads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => selectThread(thread.id)}
                    className={`group relative mb-1.5 flex w-full items-center gap-3 rounded-[18px] p-2.5 text-left transition-all ${
                      activeThread?.id === thread.id
                        ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200 dark:bg-white/[0.04] dark:ring-white/10"
                        : "hover:bg-zinc-100/50 dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    {activeThread?.id === thread.id && (
                      <div className="absolute -left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-zinc-900 dark:bg-white"></div>
                    )}
                    <div className="shrink-0 relative">
                      <div className="overflow-hidden rounded-[14px] border border-black/5 dark:border-white/5">
                        <ChatAvatar name={thread.name} photoUrl={thread.photoUrl} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={`truncate text-[13px] font-bold ${activeThread?.id === thread.id ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"}`}>{thread.name}</p>
                        <span
                          className={`shrink-0 text-[10px] font-medium tracking-wide ${
                            activeThread?.id === thread.id ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        >
                          {formatThreadTime(thread.lastMessageAtUtc)}
                        </span>
                      </div>
                      <p
                        className={`truncate text-[12px] ${
                          activeThread?.id === thread.id ? "text-zinc-600 font-medium dark:text-zinc-300" : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {getThreadPreview(thread)}
                      </p>
                    </div>
                    {thread.unreadCount > 0 ? (
                      <span
                        className={`inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold shadow-sm ${
                          activeThread?.id === thread.id
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                            : "bg-rose-500 text-white"
                        }`}
                      >
                        {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
                      </span>
                    ) : null}
                  </button>
                ))}

                {matchingContacts.length > 0 ? (
                  <div className="pt-3">
                    <p className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Start new chat</p>
                    {matchingContacts.map((contact) => (
                      <button
                        key={contact.userId}
                        type="button"
                        onClick={() => {
                          void handleStartDirectChat(contact.userId);
                        }}
                        className="mb-1 flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-zinc-900 transition hover:border-zinc-200 hover:bg-white dark:text-zinc-100 dark:hover:border-zinc-800 dark:hover:bg-zinc-950"
                      >
                        <ChatAvatar name={contact.fullName} photoUrl={contact.profilePhotoUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{contact.fullName}</p>
                          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {contact.role} · {contact.department}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                {filteredThreads.length === 0 && matchingContacts.length === 0 ? (
                  <div className="flex h-full min-h-[220px] items-center justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No chats found.
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>

        <div
          className={`${
            showSidebarOnMobile ? "hidden" : "flex"
          } min-w-0 min-h-0 flex-1 flex-col border-l border-zinc-200 bg-white md:flex dark:border-zinc-800 dark:bg-zinc-950`}
        >
          {activeThread ? (
            <>
              <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-4 md:px-6 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setMobileListOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 md:hidden dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                  aria-label="Open chat list"
                >
                  <Icon name="menu" className="h-4 w-4" />
                </button>
                <ChatAvatar name={activeThread.name} photoUrl={activeThread.photoUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                    {activeThread.name}
                    {activeThread.threadType === "Direct" && <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950 shadow-sm animate-pulse" title="Online" />}
                  </h2>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                    {activeThread.threadType !== "Direct" && (
                      <span className="flex items-center gap-1.5"><Icon name="team" className="h-3.5 w-3.5" /> {getPresenceLabel(activeThread)}</span>
                    )}
                    <span className="flex items-center gap-1.5"><Icon name="departments" className="h-3.5 w-3.5" /> {getThreadMeta(activeThread)}</span>
                    {activePresenceCount > 0 ? <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> {activePresenceCount} active</span> : null}
                    {typingCount > 0 ? <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400"><span className="flex gap-0.5"><span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{animationDelay: '0ms'}}></span><span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{animationDelay: '150ms'}}></span><span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{animationDelay: '300ms'}}></span></span> typing</span> : null}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="relative group">
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      aria-label="Options"
                    >
                      <span className="flex flex-col gap-[3px]">
                        <span className="h-[3px] w-[3px] rounded-full bg-current"></span>
                        <span className="h-[3px] w-[3px] rounded-full bg-current"></span>
                        <span className="h-[3px] w-[3px] rounded-full bg-current"></span>
                      </span>
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-40 origin-top-right rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg opacity-0 invisible transition-all group-hover:opacity-100 group-hover:visible dark:border-zinc-800 dark:bg-zinc-950 z-50">
                      <button type="button" onClick={() => void handleThreadPreference("pin")} className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors">
                        {activeThread.isPinned ? "Unpin chat" : "Pin chat"}
                      </button>
                      <button type="button" onClick={() => void handleThreadPreference("mute")} className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors">
                        {activeThread.isMuted ? "Unmute chat" : "Mute chat"}
                      </button>
                      {activeThread.threadType !== "Direct" ? (
                        <button type="button" onClick={() => void handleThreadPreference("leave")} className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-500 dark:hover:bg-rose-500/10 transition-colors">
                          Leave chat
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/dashboard")}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    aria-label="Close chat"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50/70 px-4 py-5 md:px-6 dark:bg-zinc-950">
                {messageError ? (
                  <div className="mx-auto mb-4 flex w-full max-w-4xl items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    <span>{messageError}</span>
                    <button type="button" onClick={() => void reloadMessages()} className="font-semibold underline-offset-4 hover:underline">
                      Retry
                    </button>
                  </div>
                ) : null}
                {messagesLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">Loading messages...</div>
                ) : messages.length > 0 ? (
                  <div className="mx-auto flex w-full max-w-4xl flex-col pb-4">
                    {messages.map((message, index) => {
                      const prevMessage = messages[index - 1];
                      const isConsecutive = prevMessage && prevMessage.senderName === message.senderName && (new Date(message.createdAtUtc).getTime() - new Date(prevMessage.createdAtUtc).getTime() < 5 * 60 * 1000);
                      const showDateSeparator = !prevMessage || new Date(message.createdAtUtc).toDateString() !== new Date(prevMessage.createdAtUtc).toDateString();
                      
                      return (
                        <div key={message.id} className="flex flex-col w-full">
                          {showDateSeparator && (
                            <div className="my-6 flex items-center justify-center relative">
                               <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div></div>
                               <div className="relative flex justify-center"><span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">{new Date(message.createdAtUtc).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span></div>
                            </div>
                          )}
                          {renderMessageBubble(message, {
                            onReply: setReplyTo,
                            onEdit: handleEditMessage,
                            onDelete: handleDeleteMessage,
                            onReact: (target, emoji) => void toggleReaction(target.id, emoji),
                            onPin: (target) => void pinMessage(target.id, !target.isPinned),
                          }, !isConsecutive)}
                        </div>
                      );
                    })}
                    <div ref={messageEndRef} />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                    No messages yet. Start typing to begin the conversation.
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-200 bg-white px-4 py-4 md:px-6 dark:border-zinc-800 dark:bg-zinc-950">
                {replyTo ? (
                  <div className="mx-auto mb-3 flex w-full max-w-4xl items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                    <span className="truncate">Replying to: {replyTo.messageText}</span>
                    <button type="button" onClick={() => setReplyTo(null)} className="font-semibold">Cancel</button>
                  </div>
                ) : null}
                {pendingAttachments.length > 0 ? (
                  <div className="mx-auto mb-3 flex w-full max-w-4xl flex-wrap gap-2">
                    {pendingAttachments.map((attachment) => (
                      <span key={attachment.id} className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                        {attachment.originalFileName}
                      </span>
                    ))}
                  </div>
                ) : null}
                <form onSubmit={handleComposerSubmit} className="mx-auto flex w-full max-w-4xl items-end gap-3">
                  <div className="flex shrink-0 items-center gap-1 pb-1">
                    <button type="button" title="Mention User" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors">
                      <Icon name="user-circle" className="h-[22px] w-[22px]" />
                    </button>
                    <label title="Attach File" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors">
                      {uploadingAttachment ? <span className="flex gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"></span><span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce delay-75"></span><span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce delay-150"></span></span> : <Icon name="paperclip" className="h-[22px] w-[22px]" />}
                      <input type="file" className="hidden" onChange={(event) => void handleAttachmentUpload(event.target.files?.[0])} />
                    </label>
                  </div>

                  <div className="flex flex-1 items-end gap-2 rounded-[28px] border border-zinc-200 bg-white pl-5 pr-1.5 py-1.5 shadow-sm focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-100/50 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-600 dark:focus-within:ring-zinc-800/50 transition-all">
                    <textarea
                      ref={messageInputRef}
                      rows={1}
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder="Message..."
                      className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent px-0 py-2 text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 outline-none dark:text-zinc-100 self-center"
                    />
                    <button
                      type="submit"
                      disabled={(!draftMessage.trim() && pendingAttachments.length === 0) || sending}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-all hover:bg-zinc-800 hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 self-end"
                    >
                      <Icon name="send" className="h-4 w-4 ml-0.5" />
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-sm text-zinc-500 dark:text-zinc-400">
              Select a chat to start messaging
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
