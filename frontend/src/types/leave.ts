export type LeaveType = string;

export type LeaveStatus = "Pending" | "Manager Approved" | "HR Approved" | "Approved" | "Rejected";

export interface LeaveTypeDefinition {
  id: string;
  name: LeaveType;
  code: string;
  color: string;
  annualAllocation: number;
  paid: boolean;
  approvalRequired: boolean;
  active: boolean;
  description: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  adminId: string;
  adminName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  managerApprovalStatus: string;
  hrApprovalStatus: string;
  adminApprovalStatus: string;
  approvedBy?: string;
  approvalFlowType?: string;
  createdAt: string;
}
