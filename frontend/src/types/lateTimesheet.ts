export type LateTimesheetLineStatus = "Pending" | "Approved" | "Rejected";
export type LateTimesheetOverallStatus = "Pending" | "Approved" | "Rejected" | "In Review";

export interface LateTimesheetTaskOption {
  taskId: string;
  taskTitle: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface LateTimesheetProjectOption {
  projectId: string;
  projectName: string;
  managerId: string;
  managerName: string;
  tasks: LateTimesheetTaskOption[];
}

export interface LateTimesheetDateOption {
  date: string;
  projects: LateTimesheetProjectOption[];
}

export interface LateTimesheetEligibleDate {
  date: string;
  projectCount: number;
  taskCount: number;
}

export interface LateTimesheetRequestLine {
  id: string;
  date: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  managerId: string;
  managerName: string;
  status: LateTimesheetLineStatus;
  decisionNote: string;
  decisionAtUtc: string | null;
  unlockExpiresAtUtc: string | null;
  lastUsedAtUtc: string | null;
}

export interface LateTimesheetRequestRecord {
  id: string;
  userId: string;
  userName: string;
  overallStatus: LateTimesheetOverallStatus;
  reason: string;
  additionalRemarks: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  items: LateTimesheetRequestLine[];
}

export interface LateTimesheetAccessItem {
  requestId: string;
  requestItemId: string;
  date: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  managerId: string;
  managerName: string;
  unlockExpiresAtUtc: string;
}

export interface LateTimesheetAccessRecord {
  weekStart: string;
  weekEnd: string;
  items: LateTimesheetAccessItem[];
}

export interface LateTimesheetCreatePayload {
  userId: string;
  items: Array<{
    date: string;
    projectId: string;
    taskId: string;
  }>;
  reason: string;
  additionalRemarks: string;
}
