import type { Project } from "../types/project";
import { getCurrentAdminContext } from "./adminContext";
import { apiRequest, ApiError } from "./http";

const isGuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

const PROJECTS_STORAGE_KEY = "project-management-records";

// localStorage is a READ CACHE only — all writes always go to the backend.
const normalizeProject = (
  project: Omit<Project, "budget" | "adminId" | "adminName" | "clientBusinessUnit" | "projectLead" | "deliveryModel" | "priority" | "isBillable"> & {
    budget?: number | null;
    adminId?: string | null;
    adminName?: string | null;
    clientBusinessUnit?: string | null;
    projectLead?: string | null;
    deliveryModel?: string | null;
    priority?: Project["priority"] | null;
    isBillable?: boolean | null;
  },
): Project => ({
  ...project,
  adminId: project.adminId ?? "00000000-0000-0000-0000-000000000000",
  adminName: project.adminName ?? "",
  clientBusinessUnit: project.clientBusinessUnit ?? "",
  projectLead: project.projectLead ?? project.managerName,
  deliveryModel: project.deliveryModel ?? "Dedicated Squad",
  priority: project.priority ?? "Medium",
  isBillable: project.isBillable ?? Boolean(project.clientBusinessUnit?.trim() && !project.deliveryModel?.toLowerCase().includes("internal")),
  budget: Number(project.budget ?? 0),
});

const getStoredProjects = (): Project[] => {
  const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<
      Omit<Project, "budget" | "adminId" | "adminName"> & {
        budget?: number | null;
        adminId?: string | null;
        adminName?: string | null;
      }
    >;
    if (!Array.isArray(parsed) || !parsed.every((project) => project && typeof project.id === "string" && isGuid(project.id))) {
      return [];
    }
    return parsed.map(normalizeProject);
  } catch {
    return [];
  }
};

const setStoredProjects = (projects: Project[]) => {
  window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
};

/** Maps a raw backend response to a frontend Project. */
const mapApiProject = (project: {
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
  isBillable?: boolean | null;
  priority: Project["priority"];
  status: Project["status"];
  startDate: string;
  endDate: string;
  createdAtUtc: string;
}): Project => ({
  id: project.id,
  name: project.name,
  code: project.code,
  description: project.description,
  clientBusinessUnit: project.clientBusinessUnit,
  department: project.department,
  adminId: project.adminId,
  adminName: project.adminName,
  managerId: project.managerId,
  managerName: project.managerName,
  projectLead: project.projectLead,
  deliveryModel: project.deliveryModel,
  teamMemberIds: project.teamMemberIds,
  teamMemberNames: project.teamMemberNames,
  teamSize: project.teamSize,
  budget: Number(project.budget ?? 0),
  isBillable: project.isBillable ?? Boolean(project.clientBusinessUnit?.trim() && !project.deliveryModel?.toLowerCase().includes("internal")),
  priority: project.priority,
  status: project.status,
  startDate: project.startDate,
  endDate: project.endDate,
  createdAt: project.createdAtUtc,
});

type ApiProjectResponse = Parameters<typeof mapApiProject>[0];

export const projectService = {
  /** Fetches projects from the backend; falls back to localStorage cache if offline. */
  async getProjects() {
    try {
      const projects = await apiRequest<ApiProjectResponse[]>("/Projects");
      const mapped = projects.map(mapApiProject);
      setStoredProjects(mapped);
      return mapped;
    } catch {
      return getStoredProjects();
    }
  },

  /** Creates a project on the backend. Throws on failure — no silent local save. */
  async addProject(project: Omit<Project, "id" | "createdAt" | "adminId" | "adminName">) {
    const adminContext = getCurrentAdminContext();
    const created = await apiRequest<ApiProjectResponse>("/Projects", {
      method: "POST",
      body: JSON.stringify({
        name: project.name,
        code: project.code,
        description: project.description,
        clientBusinessUnit: project.clientBusinessUnit,
        department: project.department,
        adminId: adminContext.adminId,
        adminName: adminContext.adminName,
        managerId: project.managerId,
        managerName: project.managerName,
        projectLead: project.projectLead,
        deliveryModel: project.deliveryModel,
        teamMemberIds: project.teamMemberIds,
        teamMemberNames: project.teamMemberNames,
        teamSize: project.teamSize,
        budget: project.budget,
        priority: project.priority,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        isBillable: project.isBillable,
      }),
    });
    const mapped = mapApiProject(created);
    setStoredProjects([mapped, ...getStoredProjects()]);
    return mapped;
  },

  /** Updates a project on the backend. Throws on failure — no silent local save. */
  async updateProject(id: string, project: Omit<Project, "id" | "createdAt" | "adminId" | "adminName">) {
    const adminContext = getCurrentAdminContext();
    const updatedProject = await apiRequest<ApiProjectResponse>(`/Projects/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: project.name,
        code: project.code,
        description: project.description,
        clientBusinessUnit: project.clientBusinessUnit,
        department: project.department,
        adminId: adminContext.adminId,
        adminName: adminContext.adminName,
        managerId: project.managerId,
        managerName: project.managerName,
        projectLead: project.projectLead,
        deliveryModel: project.deliveryModel,
        teamMemberIds: project.teamMemberIds,
        teamMemberNames: project.teamMemberNames,
        teamSize: project.teamSize,
        budget: project.budget,
        priority: project.priority,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        isBillable: project.isBillable,
      }),
    });
    const mapped = mapApiProject(updatedProject);
    setStoredProjects(getStoredProjects().map((item) => (item.id === id ? mapped : item)));
    return mapped;
  },

  /** Deletes a project on the backend. Throws on failure — no silent local delete. */
  async deleteProject(id: string) {
    await apiRequest<void>(`/Projects/${id}`, { method: "DELETE" });
    setStoredProjects(getStoredProjects().filter((item) => item.id !== id));
  },
};

export { ApiError };
