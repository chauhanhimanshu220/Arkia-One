import {
  EMPLOYEE_GENDERS,
  USER_TYPES,
  WORK_LOCATIONS,
  type EmployeeCreateResult,
  type Employee,
  type EmployeeGender,
  type EmployeeUpsertPayload,
  type EmployeeUserType,
  type WorkLocation,
} from "../types/employee";
import { getPrimaryUserRole, normalizeUserRoles } from "../types/roles";
import { ApiError, apiRequest } from "./http";

const EMPLOYEES_STORAGE_KEY = "employee-management-records";
const EMPLOYEES_STORAGE_VERSION_KEY = `${EMPLOYEES_STORAGE_KEY}:version`;
const EMPLOYEES_STORAGE_VERSION = "2";

const isGuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

const buildFallbackEmployeeCode = (employee: Pick<Employee, "id" | "fullName"> & Partial<Employee>) => {
  const trimmed = employee.employeeCode?.trim();
  if (trimmed) {
    return trimmed;
  }

  const compactId = employee.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `EMP-${compactId || "000001"}`;
};

const normalizeGender = (gender: string | null | undefined): EmployeeGender =>
  EMPLOYEE_GENDERS.find((item) => item.toLowerCase() === gender?.trim().toLowerCase()) ?? "Prefer not to say";

const normalizeWorkLocation = (workLocation: string | null | undefined): WorkLocation =>
  WORK_LOCATIONS.find((item) => item.toLowerCase() === workLocation?.trim().toLowerCase()) ?? "Office";

const normalizeUserType = (userType: string | null | undefined): EmployeeUserType =>
  USER_TYPES.find((item) => item.toLowerCase() === userType?.trim().toLowerCase()) ?? "Internal";

const normalizeEmployee = (employee: Employee): Employee => {
  const roles = normalizeUserRoles(employee.roles ?? employee.role);
  const role = getPrimaryUserRole(roles);
  return {
    ...employee,
    employeeCode: buildFallbackEmployeeCode(employee),
    mobileNumber: employee.mobileNumber?.trim() ?? "",
    dateOfBirth: employee.dateOfBirth?.trim() ?? "",
    gender: normalizeGender(employee.gender),
    role,
    roles,
    designation: employee.designation?.trim() || role,
    reportingManagerId: employee.reportingManagerId ?? null,
    reportingManagerName: employee.reportingManagerName?.trim() || null,
    businessUnit: employee.businessUnit?.trim() || employee.department,
    workLocation: normalizeWorkLocation(employee.workLocation),
    status: employee.status === "Inactive" ? "Inactive" : "Active",
    userType: normalizeUserType(employee.userType),
    profilePhotoUrl: employee.profilePhotoUrl?.trim() || null,
  };
};

// localStorage is used as a READ CACHE only — writes always go to the backend.
const clearStoredEmployees = () => {
  window.localStorage.removeItem(EMPLOYEES_STORAGE_KEY);
  window.localStorage.removeItem(EMPLOYEES_STORAGE_VERSION_KEY);
};

const getStoredEmployees = (): Employee[] => {
  const version = window.localStorage.getItem(EMPLOYEES_STORAGE_VERSION_KEY);
  if (version !== EMPLOYEES_STORAGE_VERSION) {
    clearStoredEmployees();
    return [];
  }

  const raw = window.localStorage.getItem(EMPLOYEES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Employee[];
    if (!Array.isArray(parsed) || !parsed.every((item) => item && typeof item.id === "string" && isGuid(item.id))) {
      clearStoredEmployees();
      return [];
    }
    return parsed.map(normalizeEmployee);
  } catch {
    clearStoredEmployees();
    return [];
  }
};

const setStoredEmployees = (employees: Employee[]) => {
  window.localStorage.setItem(EMPLOYEES_STORAGE_VERSION_KEY, EMPLOYEES_STORAGE_VERSION);
  window.localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(employees.map(normalizeEmployee)));
};

export const employeeApi = {
  /** Always fetches from the backend; uses localStorage as a fallback cache if offline. */
  async getEmployees() {
    try {
      const employees = await apiRequest<Employee[]>("/Employees");
      setStoredEmployees(employees);
      return employees.map(normalizeEmployee);
    } catch {
      // Read-only fallback: return cached data so the UI isn't blank.
      return getStoredEmployees();
    }
  },

  /** Creates an employee on the backend. Throws on any failure — no silent local save. */
  async addEmployee(employee: EmployeeUpsertPayload) {
    const created = await apiRequest<EmployeeCreateResult>("/Employees", {
      method: "POST",
      body: JSON.stringify(employee),
    });
    const normalized = normalizeEmployee(created.employee);
    setStoredEmployees([normalized, ...getStoredEmployees()]);
    return {
      ...created,
      employee: normalized,
    };
  },

  /** Updates an employee on the backend. Throws on any failure — no silent local save. */
  async updateEmployee(id: string, employee: EmployeeUpsertPayload) {
    const updated = await apiRequest<Employee>(`/Employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(employee),
    });
    const normalized = normalizeEmployee(updated);
    setStoredEmployees(getStoredEmployees().map((item) => (item.id === id ? normalized : item)));
    return normalized;
  },

  /** Deletes an employee on the backend. Throws on any failure — no silent local delete. */
  async deleteEmployee(id: string) {
    await apiRequest<void>(`/Employees/${id}`, {
      method: "DELETE",
    });
    setStoredEmployees(getStoredEmployees().filter((item) => item.id !== id));
  },
};

export const systemApi = {
  async purgeAllNonUserData() {
    try {
      await apiRequest<void>("/system/purge-non-user-data", {
        method: "DELETE",
      });
    } catch {
      // Allow proceeding to clean local caches even if offline or backend returns error
    }

    // Clear all localStorage records for non-user data
    const keysToRemove = [
      "timesheet-week-records",
      "leave-management-records",
      "project-management-records",
      "project-task-items",
      "daily-timesheet-records",
      "late-timesheet-request-records",
      "chat-threads-records",
      "chat-messages-records",
      "salary-structures",
    ];

    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  },
};

// Keep ApiError re-export so existing imports don't break.
export { ApiError };
