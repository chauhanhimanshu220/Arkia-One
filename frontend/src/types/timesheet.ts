export interface TimesheetRow {
  id: string;
  projectId: string;
  projectName: string;
  taskName: string;
  notes: string;
  notesByDate?: Record<string, string>;
  billable: boolean;
  hours: Record<string, number>;
}

export interface TimesheetWeek {
  id: string;
  weekStart: string;
  adminId: string;
  adminName: string;
  status: "Draft" | "Submitted" | "Manager Approved" | "Approved" | "Rejected";
  managerApprovalStatus: "Pending" | "Approved" | "Rejected";
  adminApprovalStatus: "Pending" | "Approved" | "Rejected";
  approvedBy: string;
  approvalFlowType: string;
  rows: TimesheetRow[];
  updatedAt: string;
}

export interface TimesheetWeekRecord extends TimesheetWeek {
  userId: string;
  weekEnd: string;
  totalHours: number;
}
