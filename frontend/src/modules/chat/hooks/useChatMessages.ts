import { useEffect, useState } from "react";
import { chatApi } from "../services/chatApi";
import type { ChatMessage } from "../types/chat.types";

export const useChatMessages = (threadId: string | null, onRead?: () => Promise<void> | void) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = async () => {
    if (!threadId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await chatApi.getMessages(threadId);
      setMessages(data);
      await chatApi.markThreadRead(threadId);
      await onRead?.();
    } catch (error) {
      setMessages([]);
      setError(error instanceof Error ? error.message : "Unable to load messages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMessages();
  }, [threadId]);

  const replaceMessage = (message: ChatMessage) => {
    setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
  };

  const sendMessage = async (messageText: string, replyToMessageId?: string | null, attachmentIds?: string[]) => {
    if (!threadId) {
      return null;
    }

    setSending(true);
    setError(null);
    try {
      const message = await chatApi.sendMessage(threadId, messageText, replyToMessageId, attachmentIds);
      setMessages((current) => [...current, message]);
      return message;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to send the message.");
      return null;
    } finally {
      setSending(false);
    }
  };

  const editMessage = async (messageId: string, messageText: string) => {
    setError(null);
    try {
      const message = await chatApi.editMessage(messageId, messageText);
      replaceMessage(message);
      return message;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to edit the message.");
      return null;
    }
  };

  const deleteMessage = async (messageId: string) => {
    setError(null);
    try {
      await chatApi.deleteMessage(messageId);
      setMessages((current) => current.filter((item) => item.id !== messageId));
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to delete the message.");
      return false;
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    setError(null);
    try {
      const message = await chatApi.toggleReaction(messageId, emoji);
      replaceMessage(message);
      return message;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update reaction.");
      return null;
    }
  };

  const pinMessage = async (messageId: string, pinned: boolean) => {
    setError(null);
    try {
      await chatApi.pinMessage(messageId, pinned);
      setMessages((current) => current.map((item) => (item.id === messageId ? { ...item, isPinned: pinned } : item)));
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update pinned message.");
      return false;
    }
  };

  return {
    messages,
    loading,
    sending,
    error,
    reloadMessages: loadMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    pinMessage,
  };
};
