export interface WorkspaceNotification {
  id: string;
  title: string;
  message: string;
  tone: "amber" | "sky" | "emerald";
}

export const workspaceNotifications: WorkspaceNotification[] = [];
