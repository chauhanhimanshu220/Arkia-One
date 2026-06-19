export const USER_ROLES = [
  "Employee",
  "Team Manager",
  "HR Manager",
  "Finance Admin",
  "System Admin",
  "License Owner",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserRoleSource = string | readonly string[] | null | undefined;

const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  employee: "Employee",
  manager: "Team Manager",
  "team manager": "Team Manager",
  hr: "HR Manager",
  "hr manager": "HR Manager",
  "finance admin": "Finance Admin",
  admin: "System Admin",
  "system admin": "System Admin",
  "license owner": "License Owner",
  licensee: "License Owner",
  "license_owner": "License Owner",
};

const parseRoleValues = (value: UserRoleSource): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      // Fall back to legacy separators below.
    }
  }

  if (trimmed.includes("|")) {
    return trimmed.split("|").map((item) => item.trim()).filter(Boolean);
  }

  if (trimmed.includes(",")) {
    return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
  }

  if (trimmed.includes("+")) {
    return trimmed.split("+").map((item) => item.trim()).filter(Boolean);
  }

  return [trimmed];
};

export const tryNormalizeUserRole = (role: string | null | undefined): UserRole | null => {
  const normalized = role?.trim();
  if (!normalized) {
    return null;
  }

  const mapped = LEGACY_ROLE_MAP[normalized.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  return USER_ROLES.find((item) => item.toLowerCase() === normalized.toLowerCase()) ?? null;
};

export const isUserRole = (role: string | null | undefined): role is UserRole =>
  tryNormalizeUserRole(role) !== null;

const normalizeSingleUserRole = (role: string | null | undefined): UserRole => {
  return tryNormalizeUserRole(role) ?? "Employee";
};

export const normalizeUserRoles = (roles: UserRoleSource): UserRole[] => {
  const normalizedRoles = Array.from(
    new Set(parseRoleValues(roles).map((role) => normalizeSingleUserRole(role))),
  ).sort((left, right) => USER_ROLES.indexOf(left) - USER_ROLES.indexOf(right));

  return normalizedRoles.length > 0 ? normalizedRoles : ["Employee"];
};

export const getPrimaryUserRole = (roles: UserRoleSource): UserRole => {
  const normalizedRoles = normalizeUserRoles(roles);
  return normalizedRoles[normalizedRoles.length - 1] ?? "Employee";
};

export const normalizeUserRole = (role: UserRoleSource): UserRole => getPrimaryUserRole(role);

export const hasUserRole = (roles: UserRoleSource, candidateRole: UserRole) =>
  normalizeUserRoles(roles).includes(candidateRole);

export const hasAnyUserRole = (roles: UserRoleSource, candidateRoles: readonly UserRole[]) =>
  candidateRoles.some((candidateRole) => hasUserRole(roles, candidateRole));

export const formatUserRoles = (roles: UserRoleSource, separator = " + ") =>
  normalizeUserRoles(roles).join(separator);

export const isSystemAdmin = (role: UserRoleSource) => hasUserRole(role, "System Admin");

export const isFinanceAdmin = (role: UserRoleSource) => hasUserRole(role, "Finance Admin");

export const isHrManager = (role: UserRoleSource) => hasUserRole(role, "HR Manager");

export const isTeamManager = (role: UserRoleSource) => hasUserRole(role, "Team Manager");

export const isApprovalRole = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["Team Manager", "HR Manager", "System Admin"]);

export const canReviewTimesheets = (role: UserRoleSource) => isApprovalRole(role);

export const canManageOwnTimesheet = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["Employee", "System Admin"]);

export const canSubmitTimesheet = (role: UserRoleSource) => canManageOwnTimesheet(role);

export const canViewTimesheetHistory = (role: UserRoleSource) => canManageOwnTimesheet(role);

export const canViewTeamTimesheets = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["Team Manager", "HR Manager", "Finance Admin", "System Admin"]);

export const canBulkApprove = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["Team Manager", "HR Manager", "System Admin"]);

export const canApplyLeave = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["Employee", "System Admin"]);

export const canApproveLeave = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["Team Manager", "HR Manager", "System Admin"]);

export const canManageLeaveTypes = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["HR Manager", "System Admin"]);

export const canViewLeaveBalance = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["Employee", "Team Manager", "HR Manager", "System Admin"]);

export const canViewOrganizationReports = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["Employee", "Team Manager", "HR Manager", "Finance Admin", "System Admin"]);

export const canViewAdvancedReports = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["Team Manager", "HR Manager", "Finance Admin", "System Admin"]);

export const canLeadProjects = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["System Admin"]);

export const isAdminSeat = (role: UserRoleSource) =>
  hasAnyUserRole(role, ["Finance Admin", "System Admin"]);
