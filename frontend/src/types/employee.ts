import type { UserRole } from "./roles";

export type EmployeeRole = UserRole;
export type EmployeeStatus = "Active" | "Inactive";

export type Department = string;

export const EMPLOYEE_GENDERS = ["Male", "Female", "Other", "Prefer not to say"] as const;
export type EmployeeGender = (typeof EMPLOYEE_GENDERS)[number];

export const WORK_LOCATIONS = ["Office", "Remote", "Hybrid"] as const;
export type WorkLocation = (typeof WORK_LOCATIONS)[number];

export const USER_TYPES = ["Internal", "Contractor", "Vendor"] as const;
export type EmployeeUserType = (typeof USER_TYPES)[number];

export interface Employee {
  id: string;
  employeeCode: string;
  userId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  dateOfBirth: string;
  gender: EmployeeGender;
  role: EmployeeRole;
  roles: EmployeeRole[];
  department: Department;
  designation: string;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  businessUnit: string;
  workLocation: WorkLocation;
  status: EmployeeStatus;
  userType: EmployeeUserType;
  profilePhotoUrl: string | null;
  createdAt: string;
}

export interface EmployeeWelcomeEmailStatus {
  wasSent: boolean;
  message: string;
}

export interface EmployeeCreateResult {
  employee: Employee;
  welcomeEmail: EmployeeWelcomeEmailStatus;
}

export interface EmployeeUpsertPayload {
  employeeCode?: string;
  userId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  dateOfBirth: string;
  gender: EmployeeGender;
  role: EmployeeRole;
  roles: EmployeeRole[];
  department: Department;
  designation: string;
  reportingManagerId: string | null;
  businessUnit: string;
  workLocation: WorkLocation;
  status: EmployeeStatus;
  userType: EmployeeUserType;
  password?: string | null;
  profilePhotoDataUrl?: string | null;
  removeProfilePhoto?: boolean;
}
