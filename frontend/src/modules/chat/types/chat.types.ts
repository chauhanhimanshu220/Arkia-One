export type ChatThreadType = "Direct" | "ProjectGroup" | "TeamGroup" | "RoleGroup" | "Broadcast";
export type ChatMessageType = "Text" | "System";
export type ChatMessageStatus = "Sending" | "Sent" | "Delivered" | "Seen" | "Failed";

export interface ChatParticipant {
  userId: string;
  fullName: string;
  role: string;
  department: string;
  profilePhotoUrl: string | null;
  roleInThread: string;
  isCurrentUser: boolean;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderUserId: string | null;
  senderName: string;
  senderRole: string;
  senderProfilePhotoUrl: string | null;
  messageType: ChatMessageType;
  messageText: string;
  messageStatus: ChatMessageStatus;
  replyToMessageId: string | null;
  replyPreviewText: string | null;
  forwardedFromMessageId: string | null;
  createdAtUtc: string;
  editedAtUtc: string | null;
  deliveredAtUtc: string | null;
  seenAtUtc: string | null;
  isPinned: boolean;
  attachments: ChatAttachment[];
  reactions: ChatReactionSummary[];
  mentions: string[];
  isOwnMessage: boolean;
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  originalFileName: string;
  contentType: string;
  fileSizeBytes: number;
  publicUrl: string;
  attachmentType: "Image" | "File";
  scanStatus: "Pending" | "Clean" | "Blocked";
  previewUrl: string | null;
  createdAtUtc: string;
}

export interface ChatReactionSummary {
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
}

export interface ChatThread {
  id: string;
  threadType: ChatThreadType;
  name: string;
  description: string | null;
  projectId: string | null;
  departmentName: string | null;
  photoUrl: string | null;
  participantCount: number;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  lastMessageId: string | null;
  lastMessageText: string | null;
  lastMessageType: ChatMessageType | null;
  lastMessageSenderName: string | null;
  lastMessageAtUtc: string | null;
  participants: ChatParticipant[];
}

export interface ChatContact {
  userId: string;
  fullName: string;
  role: string;
  department: string;
  profilePhotoUrl: string | null;
  contextLabel: string;
}

export interface ChatContactDirectory {
  projectMembers: ChatContact[];
  teamMembers: ChatContact[];
  hierarchyMembers: ChatContact[];
  supportMembers: ChatContact[];
  directoryMembers: ChatContact[];
}

export interface CreateGroupChatPayload {
  name: string;
  threadType: Exclude<ChatThreadType, "Direct" | "ProjectGroup">;
  description?: string;
  participantUserIds: string[];
}

export interface ChatPresence {
  userId: string;
  presenceStatus: "Online" | "Away" | "Busy" | "Offline";
  activeThreadId: string | null;
  isTyping: boolean;
  lastSeenAtUtc: string;
}

export interface ChatNotificationPreferences {
  browserNotificationsEnabled: boolean;
  soundEnabled: boolean;
  emailNotificationsEnabled: boolean;
  mentionNotificationsEnabled: boolean;
  offlineNotificationsEnabled: boolean;
}
