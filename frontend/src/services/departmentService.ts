import type { DepartmentDetail, DepartmentPayload, DepartmentSummary } from "../types/department";
import { ApiError, apiRequest } from "./http";

const DEPARTMENTS_STORAGE_KEY = "department-management-records";

const getStoredDepartments = (): DepartmentSummary[] => {
  const raw = window.localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as DepartmentSummary[];
  } catch {
    return [];
  }
};

const setStoredDepartments = (departments: DepartmentSummary[]) => {
  window.localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(departments));
};

export const departmentService = {
  async getDepartments() {
    try {
      const departments = await apiRequest<DepartmentSummary[]>("/Departments");
      setStoredDepartments(departments);
      return departments;
    } catch {
      return getStoredDepartments();
    }
  },

  async getDepartment(id: string) {
    return apiRequest<DepartmentDetail>(`/Departments/${id}`);
  },

  async addDepartment(payload: DepartmentPayload) {
    const created = await apiRequest<DepartmentDetail>("/Departments", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setStoredDepartments([created, ...getStoredDepartments().filter((item) => item.id !== created.id)]);
    return created;
  },

  async updateDepartment(id: string, payload: DepartmentPayload) {
    const updated = await apiRequest<DepartmentDetail>(`/Departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    setStoredDepartments(getStoredDepartments().map((item) => (item.id === id ? updated : item)));
    return updated;
  },

  async activateDepartment(id: string) {
    const updated = await apiRequest<DepartmentDetail>(`/Departments/${id}/activate`, {
      method: "PATCH",
    });

    setStoredDepartments(getStoredDepartments().map((item) => (item.id === id ? updated : item)));
    return updated;
  },

  async deactivateDepartment(id: string) {
    const updated = await apiRequest<DepartmentDetail>(`/Departments/${id}/deactivate`, {
      method: "PATCH",
    });

    setStoredDepartments(getStoredDepartments().map((item) => (item.id === id ? updated : item)));
    return updated;
  },
};

export { ApiError };
