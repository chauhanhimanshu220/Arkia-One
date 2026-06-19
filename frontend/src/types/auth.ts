import type { UserRole } from "./roles";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
  organization: string;
  profilePhotoUrl?: string | null;
  account_type?: "super_admin" | "workspace_user";
  access_level?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}
