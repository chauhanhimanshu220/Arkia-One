import { apiRequest } from "../../../services/http";
import type { ChatAttachment, ChatContactDirectory, ChatMessage, ChatNotificationPreferences, ChatPresence, ChatThread, CreateGroupChatPayload } from "../types/chat.types";

export const chatApi = {
  async getThreads() {
    return apiRequest<ChatThread[]>("/Chat/threads");
  },

  async getThread(threadId: string) {
    return apiRequest<ChatThread>(`/Chat/threads/${threadId}`);
  },

  async getMessages(threadId: string, take = 80) {
    return apiRequest<ChatMessage[]>(`/Chat/threads/${threadId}/messages?take=${take}`);
  },

  async getContacts() {
    return apiRequest<ChatContactDirectory>("/Chat/contacts");
  },

  async createDirectThread(userId: string) {
    return apiRequest<ChatThread>("/Chat/threads/direct", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  async createGroupThread(payload: CreateGroupChatPayload) {
    return apiRequest<ChatThread>("/Chat/threads/group", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async sendMessage(threadId: string, messageText: string, replyToMessageId?: string | null, attachmentIds?: string[]) {
    return apiRequest<ChatMessage>("/Chat/messages/send", {
      method: "POST",
      body: JSON.stringify({
        threadId,
        messageText,
        messageType: "Text",
        replyToMessageId,
        attachmentIds,
      }),
    });
  },

  async editMessage(messageId: string, messageText: string) {
    return apiRequest<ChatMessage>(`/Chat/messages/${messageId}`, {
      method: "PUT",
      body: JSON.stringify({ messageText }),
    });
  },

  async deleteMessage(messageId: string) {
    return apiRequest<void>(`/Chat/messages/${messageId}`, {
      method: "DELETE",
    });
  },

  async toggleReaction(messageId: string, emoji: string) {
    return apiRequest<ChatMessage>(`/Chat/messages/${messageId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    });
  },

  async pinMessage(messageId: string, pinned: boolean) {
    return apiRequest<void>(`/Chat/messages/${messageId}/pin`, {
      method: pinned ? "POST" : "DELETE",
    });
  },

  async uploadAttachment(file: File) {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<ChatAttachment>("/Chat/attachments", {
      method: "POST",
      body: form,
    });
  },

  async markThreadRead(threadId: string) {
    return apiRequest<void>(`/Chat/threads/${threadId}/read`, {
      method: "POST",
    });
  },

  async pinThread(threadId: string, pinned: boolean) {
    return apiRequest<void>(`/Chat/threads/${threadId}/pin`, {
      method: pinned ? "POST" : "DELETE",
    });
  },

  async muteThread(threadId: string, muted: boolean) {
    return apiRequest<void>(`/Chat/threads/${threadId}/mute`, {
      method: muted ? "POST" : "DELETE",
    });
  },

  async archiveThread(threadId: string) {
    return apiRequest<void>(`/Chat/threads/${threadId}/archive`, {
      method: "POST",
    });
  },

  async leaveThread(threadId: string) {
    return apiRequest<void>(`/Chat/threads/${threadId}/leave`, {
      method: "POST",
    });
  },

  async updateThread(threadId: string, payload: { name?: string; description?: string; photoUrl?: string }) {
    return apiRequest<ChatThread>(`/Chat/threads/${threadId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async updatePresence(payload: { presenceStatus: string; activeThreadId: string | null; isTyping: boolean }) {
    return apiRequest<ChatPresence>("/Chat/presence", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getPresence(threadId: string) {
    return apiRequest<ChatPresence[]>(`/Chat/threads/${threadId}/presence`);
  },

  async getNotificationPreferences() {
    return apiRequest<ChatNotificationPreferences>("/Chat/notifications/preferences");
  },

  async updateNotificationPreferences(payload: ChatNotificationPreferences) {
    return apiRequest<ChatNotificationPreferences>("/Chat/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
};
