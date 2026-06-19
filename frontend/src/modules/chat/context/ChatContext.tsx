import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useChatContacts } from "../hooks/useChatContacts";
import { useChatThreads } from "../hooks/useChatThreads";
import { chatApi } from "../services/chatApi";
import type { ChatContactDirectory, ChatThread, CreateGroupChatPayload } from "../types/chat.types";

interface ChatContextValue {
  threads: ChatThread[];
  threadsLoading: boolean;
  contacts: ChatContactDirectory;
  contactsLoading: boolean;
  unreadCount: number;
  reloadThreads: (showLoading?: boolean) => Promise<void>;
  reloadContacts: () => Promise<void>;
  startDirectChat: (userId: string) => Promise<ChatThread | null>;
  createGroupChat: (payload: CreateGroupChatPayload) => Promise<ChatThread | null>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { threads, loading: threadsLoading, reloadThreads } = useChatThreads();
  const { contacts, loading: contactsLoading, reloadContacts } = useChatContacts();

  const unreadCount = useMemo(
    () => threads.reduce((total, thread) => total + thread.unreadCount, 0),
    [threads],
  );

  const startDirectChat = async (userId: string) => {
    try {
      const thread = await chatApi.createDirectThread(userId);
      await reloadThreads();
      return thread;
    } catch {
      return null;
    }
  };

  const createGroupChat = async (payload: CreateGroupChatPayload) => {
    try {
      const thread = await chatApi.createGroupThread(payload);
      await reloadThreads();
      return thread;
    } catch {
      return null;
    }
  };

  const value = useMemo<ChatContextValue>(
    () => ({
      threads,
      threadsLoading,
      contacts,
      contactsLoading,
      unreadCount,
      reloadThreads,
      reloadContacts,
      startDirectChat,
      createGroupChat,
    }),
    [contacts, contactsLoading, reloadContacts, reloadThreads, threads, threadsLoading, unreadCount],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used inside ChatProvider.");
  }

  return context;
};
