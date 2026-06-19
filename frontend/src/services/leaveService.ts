import type { LeaveRequest, LeaveTypeDefinition } from "../types/leave";
import { getCurrentAdminContext } from "./adminContext";
import { ApiError, apiRequest, apiSupportsPath } from "./http";

const LEAVES_STORAGE_KEY = "leave-management-records";
const LEAVE_TYPES_STORAGE_KEY = "leave-type-records";

const fallbackLeaveTypes: LeaveTypeDefinition[] = [
  {
    id: "casual-leave",
    name: "Casual Leave",
    code: "CL",
    color: "#0ea5e9",
    annualAllocation: 6,
    paid: true,
    approvalRequired: true,
    active: true,
    description: "Short personal leave for planned needs.",
  },
  {
    id: "sick-leave",
    name: "Sick Leave",
    code: "SL",
    color: "#16a34a",
    annualAllocation: 8,
    paid: true,
    approvalRequired: true,
    active: true,
    description: "Use when illness or medical recovery affects availability.",
  },
  {
    id: "earned-leave",
    name: "Earned Leave",
    code: "EL",
    color: "#7c3aed",
    annualAllocation: 12,
    paid: true,
    approvalRequired: true,
    active: true,
    description: "Longer planned leave from accrued entitlement.",
  },
  {
    id: "unpaid-leave",
    name: "Unpaid Leave",
    code: "UL",
    color: "#f59e0b",
    annualAllocation: 0,
    paid: false,
    approvalRequired: true,
    active: true,
    description: "Extended leave outside paid entitlement.",
  },
  {
    id: "work-from-home",
    name: "Work From Home",
    code: "WFH",
    color: "#f43f5e",
    annualAllocation: 24,
    paid: true,
    approvalRequired: false,
    active: true,
    description: "Remote-working days tracked through the same request flow.",
  },
];

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildCodeFromName = (value: string) => {
  const code = value
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 4);

  return code || "LV";
};

const palette = ["#0ea5e9", "#16a34a", "#7c3aed", "#f59e0b", "#f43f5e", "#09090b", "#14b8a6", "#e11d48"];

const getFallbackColor = (value: string) => {
  const hash = Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
};

const normalizeLeaveType = (leaveType: Partial<LeaveTypeDefinition> & Pick<LeaveTypeDefinition, "name">): LeaveTypeDefinition => {
  const id = leaveType.id?.trim() || slugify(leaveType.name);

  return {
    id,
    name: leaveType.name.trim(),
    code: leaveType.code?.trim().toUpperCase() || buildCodeFromName(leaveType.name),
    color: leaveType.color?.trim() || getFallbackColor(leaveType.name),
    annualAllocation: Math.max(Number(leaveType.annualAllocation ?? 0), 0),
    paid: Boolean(leaveType.paid),
    approvalRequired: Boolean(leaveType.approvalRequired),
    active: leaveType.active ?? true,
    description: leaveType.description?.trim() || `Policy rule for ${leaveType.name.trim()}.`,
  };
};

// localStorage is a READ CACHE only — all writes always go to the backend.
const getStoredLeaves = (): LeaveRequest[] => {
  const raw = window.localStorage.getItem(LEAVES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return (JSON.parse(raw) as Array<Partial<LeaveRequest>>).map((leave) => ({
      ...leave,
      adminId: leave.adminId ?? "00000000-0000-0000-0000-000000000000",
      adminName: leave.adminName ?? "",
      managerApprovalStatus: leave.managerApprovalStatus ?? "Pending",
      hrApprovalStatus: leave.hrApprovalStatus ?? "Pending",
      adminApprovalStatus: leave.adminApprovalStatus ?? "Pending",
    })) as LeaveRequest[];
  } catch {
    return [];
  }
};

const setStoredLeaves = (leaves: LeaveRequest[]) => {
  window.localStorage.setItem(LEAVES_STORAGE_KEY, JSON.stringify(leaves));
};

const getStoredLeaveTypes = (): LeaveTypeDefinition[] => {
  const raw = window.localStorage.getItem(LEAVE_TYPES_STORAGE_KEY);
  if (!raw) {
    return fallbackLeaveTypes.map(normalizeLeaveType);
  }

  try {
    const parsed = JSON.parse(raw) as LeaveTypeDefinition[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(normalizeLeaveType) : fallbackLeaveTypes.map(normalizeLeaveType);
  } catch {
    return fallbackLeaveTypes.map(normalizeLeaveType);
  }
};

const setStoredLeaveTypes = (leaveTypes: LeaveTypeDefinition[]) => {
  window.localStorage.setItem(LEAVE_TYPES_STORAGE_KEY, JSON.stringify(leaveTypes.map(normalizeLeaveType)));
};

export type LeavePayload = Omit<LeaveRequest, "id" | "createdAt" | "adminId" | "adminName">;
export type LeaveTypePayload = Omit<LeaveTypeDefinition, "id"> & { id?: string };

export const leaveService = {
  /** Fetches leaves from the backend; falls back to localStorage cache if offline. */
  async getLeaves(filters?: { employeeId?: string; year?: number }) {
    const query = new URLSearchParams();
    if (filters?.employeeId) {
      query.set("employeeId", filters.employeeId);
    }
    if (filters?.year) {
      query.set("year", String(filters.year));
    }
    const path = query.size > 0 ? `/Leaves?${query.toString()}` : "/Leaves";

    try {
      const leaves = await apiRequest<LeaveRequest[]>(path);
      setStoredLeaves(leaves);
      return leaves;
    } catch {
      const cachedLeaves = getStoredLeaves();
      return cachedLeaves.filter((leave) => {
        if (filters?.employeeId && leave.employeeId !== filters.employeeId) {
          return false;
        }
        if (filters?.year) {
          const matchesStartYear = new Date(`${leave.startDate}T00:00:00`).getFullYear() === filters.year;
          const matchesEndYear = new Date(`${leave.endDate}T00:00:00`).getFullYear() === filters.year;
          if (!matchesStartYear && !matchesEndYear) {
            return false;
          }
        }
        return true;
      });
    }
  },

  async getLeaveTypes() {
    const supportsPath = await apiSupportsPath("/api/Leaves/types");
    if (!supportsPath) {
      return getStoredLeaveTypes();
    }

    try {
      const leaveTypes = (await apiRequest<LeaveTypeDefinition[]>("/Leaves/types")).map(normalizeLeaveType);
      const storedLeaveTypes = getStoredLeaveTypes();
      const hasCustomLeaveTypes = window.localStorage.getItem(LEAVE_TYPES_STORAGE_KEY);
      if (!hasCustomLeaveTypes) {
        setStoredLeaveTypes(leaveTypes);
        return leaveTypes;
      }

      return storedLeaveTypes;
    } catch {
      return getStoredLeaveTypes();
    }
  },

  async saveLeaveType(payload: LeaveTypePayload) {
    const normalized = normalizeLeaveType({
      ...payload,
      id: payload.id ?? slugify(payload.name),
      name: payload.name,
    });

    const current = getStoredLeaveTypes();
    const next = current.some((leaveType) => leaveType.id === normalized.id)
      ? current.map((leaveType) => (leaveType.id === normalized.id ? normalized : leaveType))
      : [normalized, ...current];

    setStoredLeaveTypes(next);
    return normalized;
  },

  async deleteLeaveType(id: string) {
    const current = getStoredLeaveTypes();
    const next = current.map((leaveType) => (leaveType.id === id ? { ...leaveType, active: false } : leaveType));
    setStoredLeaveTypes(next);
  },

  /** Creates a leave request on the backend. Throws on failure — no silent local save. */
  async addLeave(payload: LeavePayload) {
    const adminContext = getCurrentAdminContext();
    const created = await apiRequest<LeaveRequest>("/Leaves", {
      method: "POST",
      body: JSON.stringify({ ...payload, ...adminContext }),
    });
    setStoredLeaves([created, ...getStoredLeaves()]);
    return created;
  },

  /** Updates a leave request on the backend. Throws on failure — no silent local save. */
  async updateLeave(id: string, payload: LeavePayload) {
    const adminContext = getCurrentAdminContext();
    const updatedLeave = await apiRequest<LeaveRequest>(`/Leaves/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...payload, ...adminContext }),
    });
    setStoredLeaves(getStoredLeaves().map((leave) => (leave.id === id ? updatedLeave : leave)));
    return updatedLeave;
  },

  /** Deletes a leave request on the backend. Throws on failure — no silent local delete. */
  async deleteLeave(id: string) {
    await apiRequest<void>(`/Leaves/${id}`, { method: "DELETE" });
    setStoredLeaves(getStoredLeaves().filter((leave) => leave.id !== id));
  },
};

export { ApiError };
