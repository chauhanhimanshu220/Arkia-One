export type ProjectStatus = "Active" | "Completed" | "Pending" | "On Hold";
export type ProjectPriority = "Low" | "Medium" | "High" | "Critical";

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string;
  clientBusinessUnit: string;
  department: string;
  adminId: string;
  adminName: string;
  managerId: string;
  managerName: string;
  projectLead: string;
  deliveryModel: string;
  teamMemberIds: string[];
  teamMemberNames: string[];
  teamSize: number;
  budget: number;
  isBillable: boolean;
  priority: ProjectPriority;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
}
