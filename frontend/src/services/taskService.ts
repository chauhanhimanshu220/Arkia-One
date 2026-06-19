import type { DailyTimesheet, DailyTimesheetSavePayload, TaskAssignmentPayload, TaskCreatePayload, TaskItem } from "../types/task";
import { apiRequest, isGuid, ApiError } from "./http";

const TASKS_STORAGE_KEY = "project-task-items";
const DAILY_TIMESHEETS_STORAGE_KEY = "daily-timesheet-records";
const TASK_HOURS_PER_DAY = 9;
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

// ─── localStorage read-cache helpers ────────────────────────────────────────

const getStoredTasks = (): TaskItem[] => {
  const raw = window.localStorage.getItem(TASKS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Array<Partial<TaskItem> & { id: string }>).map(normalizeTask);
  } catch {
    return [];
  }
};

const setStoredTasks = (tasks: TaskItem[]) => {
  window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
};

const getStoredDailyTimesheets = (): DailyTimesheet[] => {
  const raw = window.localStorage.getItem(DAILY_TIMESHEETS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DailyTimesheet[];
  } catch {
    return [];
  }
};

const setStoredDailyTimesheets = (timesheets: DailyTimesheet[]) => {
  window.localStorage.setItem(DAILY_TIMESHEETS_STORAGE_KEY, JSON.stringify(timesheets));
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseDateInputUtc = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
};

const calculateTaskTotalHours = (startDate: string, endDate: string) => {
  const start = parseDateInputUtc(startDate);
  const end = parseDateInputUtc(endDate);
  if (!start || !end) return 0;
  const diffDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return (diffDays >= 0 ? diffDays + 1 : 1) * TASK_HOURS_PER_DAY;
};

const wholeDaysFromHours = (hours: number) => {
  const numeric = Number(hours || 0);
  return Number.isFinite(numeric) && numeric > 0 ? Math.max(1, Math.ceil(numeric / TASK_HOURS_PER_DAY)) : 0;
};

const resolveWholeDays = (value?: number, fallbackHours?: number) => {
  const numeric = Number(value ?? 0);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(1, Math.round(numeric));
  }

  return wholeDaysFromHours(Number(fallbackHours || 0));
};

const normalizeTaskStatus = (status?: string | null) => {
  const normalized = status?.trim().toLowerCase();
  switch (normalized) {
    case "planned":
      return "Planned";
    case "in progress":
      return "In Progress";
    case "on hold":
      return "On Hold";
    case "done":
    case "completed":
    case "approved":
      return "Completed";
    case "rejected":
    case "pending":
    case "to do":
    default:
      return "To Do";
  }
};

const normalizeTask = (task: Partial<TaskItem> & { id: string }): TaskItem => {
  const assignedTo = task.assignedTo && task.assignedTo !== EMPTY_GUID ? task.assignedTo : "";
  const isTaskMaster = Boolean(task.isTaskMaster ?? !assignedTo);
  const title = task.title ?? task.taskName ?? "";
  const startDate = task.startDate ?? "";
  const endDate = task.endDate ?? task.dueDate ?? task.startDate ?? "";
  const rawHours = (() => {
    const numeric = Number(task.totalHours ?? 0);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    return calculateTaskTotalHours(startDate, endDate);
  })();
  const estimatedHours = (() => {
    const numeric = Number(task.estimatedHours ?? 0);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    return isTaskMaster ? rawHours : 0;
  })();
  const assignedHours = (() => {
    const numeric = Number(task.assignedHours ?? 0);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    return isTaskMaster ? 0 : rawHours;
  })();

  return {
    id: task.id,
    taskGroupId: task.taskGroupId ?? task.id,
    projectId: task.projectId ?? "",
    projectName: task.projectName ?? "",
    assignedTo,
    assignedToName: assignedTo ? (task.assignedToName ?? "") : "",
    taskCode: task.taskCode ?? "",
    taskName: task.taskName ?? title,
    title,
    description: task.description ?? "",
    workBreakdown: task.workBreakdown ?? "",
    startDate,
    endDate,
    dueDate: task.dueDate ?? endDate,
    totalHours: rawHours,
    estimatedHours,
    assignedHours,
    plannedDays: resolveWholeDays(task.plannedDays, estimatedHours || rawHours),
    assignedDays: isTaskMaster ? 0 : resolveWholeDays(task.assignedDays, assignedHours || rawHours),
    priority: task.priority ?? "Medium",
    status: normalizeTaskStatus(task.status),
    assignmentStatus: task.assignmentStatus ?? (isTaskMaster ? "Unassigned" : "Assigned"),
    notes: task.notes ?? "",
    roleInTask: task.roleInTask ?? "",
    expectedDeliverable: task.expectedDeliverable ?? "",
    isTaskMaster,
  };
};

const validateGuidField = (name: string, value?: string, optional = false) => {
  if (optional && (!value || value === EMPTY_GUID)) return;
  if (!value || !isGuid(value)) {
    throw new Error(`Invalid ${name}. Please select a valid ${name}.`);
  }
};

// ─── Task Service ─────────────────────────────────────────────────────────────

export const taskService = {
  async createTask(payload: TaskCreatePayload) {
    validateGuidField("project ID", payload.projectId, true);
    const plannedDays = resolveWholeDays(payload.plannedDays, payload.estimatedHours ?? payload.totalHours);
    if (plannedDays <= 0) {
      throw new Error("Planned days must be greater than zero.");
    }

    const request = {
      taskGroupId: payload.taskGroupId,
      projectId: payload.projectId,
      projectName: payload.projectName,
      taskCode: payload.taskCode,
      taskName: (payload.taskName ?? payload.title ?? "").trim(),
      description: payload.description ?? "",
      workBreakdown: payload.workBreakdown ?? "",
      plannedDays,
      estimatedHours: plannedDays * TASK_HOURS_PER_DAY,
      startDate: payload.startDate,
      dueDate: payload.dueDate ?? payload.endDate ?? payload.startDate,
      priority: payload.priority ?? "Medium",
      status: payload.status,
    };
    const task = await apiRequest<TaskItem>("/Tasks/create-task", {
      method: "POST",
      body: JSON.stringify(request),
    });
    const normalized = normalizeTask(task);
    setStoredTasks([normalized, ...getStoredTasks()]);
    return normalized;
  },

  /**
   * Assigns a task via the backend.
   * If the IDs are not valid GUIDs the task cannot be persisted — throws.
   */
  async assignTask(payload: TaskAssignmentPayload) {
    const taskId = payload.taskId ?? payload.taskGroupId ?? "";
    validateGuidField("project ID", payload.projectId, true);
    validateGuidField("task ID", taskId);
    validateGuidField("employee ID", payload.userId ?? payload.assignedTo ?? "");
    const assignedDays = resolveWholeDays(payload.assignedDays, payload.assignedHours ?? payload.totalHours);
    if (assignedDays <= 0) {
      throw new Error("Assigned days must be greater than zero.");
    }

    const request = {
      taskId,
      projectId: payload.projectId,
      userId: payload.userId ?? payload.assignedTo,
      assignedToName: payload.assignedToName,
      assignedDays,
      assignedHours: assignedDays * TASK_HOURS_PER_DAY,
      assignmentStartDate: payload.assignmentStartDate ?? payload.startDate ?? "",
      assignmentDueDate: payload.assignmentDueDate ?? payload.endDate ?? payload.assignmentStartDate ?? payload.startDate ?? "",
      notes: payload.notes ?? "",
      roleInTask: payload.roleInTask ?? "",
      expectedDeliverable: payload.expectedDeliverable ?? "",
    };

    const task = await apiRequest<TaskItem>("/task-assignments", {
      method: "POST",
      body: JSON.stringify(request),
    });
    const normalized = normalizeTask(task);
    setStoredTasks([normalized, ...getStoredTasks()]);
    return normalized;
  },

  async assignTasks(payloads: TaskAssignmentPayload[]) {
    return await Promise.all(payloads.map(async (payload) => await this.assignTask(payload)));
  },

  /**
   * Updates a task via the backend. Throws on failure.
   */
  async updateTask(id: string, payload: TaskAssignmentPayload) {
    const taskId = payload.taskId ?? payload.taskGroupId ?? "";
    validateGuidField("task ID", id);
    validateGuidField("project ID", payload.projectId, true);
    validateGuidField("employee ID", payload.userId ?? payload.assignedTo ?? "");
    validateGuidField("task ID", taskId);
    const assignedDays = resolveWholeDays(payload.assignedDays, payload.assignedHours ?? payload.totalHours);
    if (assignedDays <= 0) {
      throw new Error("Assigned days must be greater than zero.");
    }

    const request = {
      taskId,
      projectId: payload.projectId,
      userId: payload.userId ?? payload.assignedTo,
      assignedToName: payload.assignedToName,
      assignedDays,
      assignedHours: assignedDays * TASK_HOURS_PER_DAY,
      assignmentStartDate: payload.assignmentStartDate ?? payload.startDate ?? "",
      assignmentDueDate: payload.assignmentDueDate ?? payload.endDate ?? payload.assignmentStartDate ?? payload.startDate ?? "",
      notes: payload.notes ?? "",
      roleInTask: payload.roleInTask ?? "",
      expectedDeliverable: payload.expectedDeliverable ?? "",
    };

    const task = await apiRequest<TaskItem>(`/task-assignments/${id}`, {
      method: "PUT",
      body: JSON.stringify(request),
    });
    const normalized = normalizeTask(task);
    const current = getStoredTasks();
    const existing = current.find((item) => item.id === id);
    setStoredTasks(
      existing
        ? current.map((item) => (item.id === id ? normalized : item))
        : [normalized, ...current],
    );
    return normalized;
  },

  async updateTaskDetails(id: string, payload: TaskCreatePayload) {
    validateGuidField("task ID", id);
    validateGuidField("project ID", payload.projectId, true);
    const plannedDays = resolveWholeDays(payload.plannedDays, payload.estimatedHours ?? payload.totalHours);
    if (plannedDays <= 0) {
      throw new Error("Planned days must be greater than zero.");
    }

    const request = {
      taskGroupId: payload.taskGroupId,
      projectId: payload.projectId,
      projectName: payload.projectName,
      taskCode: payload.taskCode,
      taskName: (payload.taskName ?? payload.title ?? "").trim(),
      description: payload.description ?? "",
      workBreakdown: payload.workBreakdown ?? "",
      plannedDays,
      estimatedHours: plannedDays * TASK_HOURS_PER_DAY,
      startDate: payload.startDate,
      dueDate: payload.dueDate ?? payload.endDate ?? payload.startDate,
      priority: payload.priority ?? "Medium",
      status: payload.status,
    };
    const task = await apiRequest<TaskItem>(`/Tasks/${id}/details`, {
      method: "PUT",
      body: JSON.stringify(request),
    });
    const normalized = normalizeTask(task);
    const current = getStoredTasks();
    const existing = current.find((item) => item.id === id);
    setStoredTasks(
      existing
        ? current.map((item) => (item.id === id ? normalized : item))
        : [normalized, ...current],
    );
    return normalized;
  },

  /**
   * Deletes a task via the backend. Throws on failure.
   */
  async deleteTask(id: string) {
    if (!isGuid(id)) {
      throw new Error("Invalid task ID.");
    }
    await apiRequest<void>(`/Tasks/${id}`, { method: "DELETE" });
    setStoredTasks(getStoredTasks().filter((item) => item.id !== id));
  },

  /**
   * Fetches tasks assigned to a user for a given date.
   * Falls back to localStorage cache if the backend is unreachable.
   */
  async getUserTasks(userId: string, date: string) {
    if (!isGuid(userId)) return [];
    try {
      const tasks = await apiRequest<TaskItem[]>(`/Tasks/user-tasks/${userId}?date=${encodeURIComponent(date)}`);
      const normalized = tasks.map(normalizeTask);
      const current = getStoredTasks();
      setStoredTasks([...normalized, ...current.filter((item) => !normalized.some((t) => t.id === item.id))]);
      return normalized;
    } catch {
      return getStoredTasks().filter(
        (task) => task.assignedTo === userId && task.startDate <= date && task.endDate >= date,
      );
    }
  },

  /**
   * Fetches task history (optionally filtered by project).
   * Falls back to localStorage cache if the backend is unreachable.
   */
  async getTaskHistory(projectId?: string) {
    if (projectId && !isGuid(projectId)) return [];
    try {
      const ref = projectId
        ? `/Tasks/history?projectId=${encodeURIComponent(projectId)}`
        : "/Tasks/history";
      const tasks = await apiRequest<TaskItem[]>(ref);
      const normalized = tasks.map(normalizeTask);
      const current = getStoredTasks();
      setStoredTasks([...normalized, ...current.filter((item) => !normalized.some((t) => t.id === item.id))]);
      return normalized;
    } catch {
      const tasks = getStoredTasks();
      return projectId ? tasks.filter((task) => task.projectId === projectId) : tasks;
    }
  },

  // ─── Daily Timesheet endpoints ───────────────────────────────────────────

  /**
   * Fetches a daily timesheet for a user on a specific date.
   * Falls back to localStorage cache if backend is unreachable.
   */
  async getDailyTimesheet(userId: string, date: string) {
    if (!isGuid(userId)) return undefined;
    try {
      return await apiRequest<DailyTimesheet | undefined>(`/timesheets/${userId}?date=${encodeURIComponent(date)}`);
    } catch {
      return getStoredDailyTimesheets().find((item) => item.userId === userId && item.date === date);
    }
  },

  /**
   * Fetches the full history of daily timesheets for a user.
   * Falls back to localStorage cache if backend is unreachable.
   */
  async getDailyTimesheetHistory(userId: string) {
    if (!isGuid(userId)) return [];
    try {
      return await apiRequest<DailyTimesheet[]>(`/timesheets/history/${userId}`);
    } catch {
      return getStoredDailyTimesheets()
        .filter((item) => item.userId === userId)
        .sort((a, b) => b.date.localeCompare(a.date));
    }
  },

  /**
   * Lists all daily timesheets across all users for admin oversight.
   */
  async listDailyTimesheets() {
    try {
      const records = await apiRequest<DailyTimesheet[]>("/timesheets");
      setStoredDailyTimesheets(records);
      return records;
    } catch {
      return getStoredDailyTimesheets().sort((a, b) => b.date.localeCompare(a.date));
    }
  },

  /**
   * Creates or replaces a daily timesheet via the backend. Throws on failure.
   */
  async saveDailyTimesheet(payload: DailyTimesheetSavePayload) {
    if (!isGuid(payload.userId)) {
      throw new Error("Invalid user ID. Please log in again.");
    }
    if (payload.entries.some((entry) => !isGuid(entry.taskId))) {
      throw new Error("One or more task entries have an invalid ID.");
    }
    const saved = await apiRequest<DailyTimesheet>("/timesheets/save", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const current = getStoredDailyTimesheets().filter(
      (item) => !(item.userId === saved.userId && item.date === saved.date),
    );
    setStoredDailyTimesheets([saved, ...current]);
    return saved;
  },

  /**
   * Updates an existing daily timesheet via the backend. Throws on failure.
   */
  async updateDailyTimesheet(id: string, payload: DailyTimesheetSavePayload) {
    if (!isGuid(id) || !isGuid(payload.userId)) {
      throw new Error("Invalid timesheet or user ID.");
    }
    if (payload.entries.some((entry) => !isGuid(entry.taskId))) {
      throw new Error("One or more task entries have an invalid ID.");
    }
    const saved = await apiRequest<DailyTimesheet>(`/timesheets/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const current = getStoredDailyTimesheets();
    const existing = current.find((item) => item.id === id);
    const updated: DailyTimesheet = existing ? { ...saved, id } : saved;
    setStoredDailyTimesheets(
      existing
        ? current.map((item) => (item.id === id ? updated : item))
        : [updated, ...current],
    );
    return updated;
  },

  /**
   * Deletes a daily timesheet via the backend. Throws on failure.
   */
  async deleteDailyTimesheet(id: string) {
    if (!isGuid(id)) {
      throw new Error("Invalid timesheet ID.");
    }
    await apiRequest<void>(`/timesheets/${id}`, { method: "DELETE" });
    setStoredDailyTimesheets(getStoredDailyTimesheets().filter((item) => item.id !== id));
  },
};

export { ApiError };
