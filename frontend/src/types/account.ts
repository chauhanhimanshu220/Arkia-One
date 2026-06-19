import type { EmployeeGender, WorkLocation } from "./employee";
import type { UserRole } from "./roles";

export interface MyAccountProfile {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  mobileNumber: string;
  dateOfBirth: string | null;
  gender: EmployeeGender;
  profilePhotoUrl: string | null;
  department: string;
  designation: string;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  businessUnit: string;
  workLocation: WorkLocation;
  organizationName: string;
  role: UserRole;
  roles: UserRole[];
  status: string;
  passwordChangedAtUtc: string | null;
  updatedAtUtc: string;
}

export interface UpdateMyAccountProfilePayload {
  fullName: string;
  mobileNumber: string;
  dateOfBirth: string | null;
  gender: EmployeeGender;
}

export interface ChangeMyPasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
