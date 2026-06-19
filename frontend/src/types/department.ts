export type DepartmentStatus = "Active" | "Inactive";

export interface DepartmentSummary {
  id: string;
  name: string;
  code: string;
  description: string;
  parentDepartmentId: string | null;
  parentDepartmentName: string | null;
  headEmployeeId: string | null;
  headEmployeeName: string | null;
  emailAlias: string;
  costCenter: string;
  employeeCount: number;
  activeEmployeeCount: number;
  inactiveEmployeeCount: number;
  projectCount: number;
  activeProjectCount: number;
  status: DepartmentStatus;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface DepartmentEmployee {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

export interface DepartmentProject {
  id: string;
  name: string;
  code: string;
  managerName: string;
  status: string;
  endDate: string;
}

export interface DepartmentDetail extends DepartmentSummary {
  employees: DepartmentEmployee[];
  projects: DepartmentProject[];
}

export interface DepartmentPayload {
  name: string;
  code: string;
  description: string;
  parentDepartmentId: string | null;
  headEmployeeId: string | null;
  emailAlias: string;
  costCenter: string;
  status: DepartmentStatus;
}
