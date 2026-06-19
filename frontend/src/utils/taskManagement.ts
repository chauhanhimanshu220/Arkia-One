import type { TaskItem } from "../types/task";

export const TASK_HOURS_PER_DAY = 9;
export const TASK_STATUSES = ["To Do", "Planned", "In Progress", "On Hold", "Completed"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskAssignmentState = "Unassigned" | "Partially Assigned" | "Fully Assigned";

export type GroupedTaskItem = TaskItem & {
  memberTaskIds: string[];
  memberTasks: TaskItem[];
  assignedToIds: string[];
  assignedToNames: string[];
  masterTaskId: string | null;
  assignmentTaskIds: string[];
  assignedHours: number;
  assignedDaysTotal: number;
  remainingHours: number;
  assignmentStatus: TaskAssignmentState;
};

export const createTaskGroupId = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const randomValue = Math.floor(Math.random() * 16);
    const next = character === "x" ? randomValue : (randomValue & 0x3) | 0x8;
    return next.toString(16);
  });

export const normalizeTaskStatus = (status?: string | null): TaskStatus => {
  const value = status?.trim().toLowerCase();
  if (value === "planned") return "Planned";
  if (value === "in progress") return "In Progress";
  if (value === "on hold") return "On Hold";
  if (value === "done" || value === "completed" || value === "approved") return "Completed";
  return "To Do";
};

export const isCompletedTaskStatus = (status?: string | null) => normalizeTaskStatus(status) === "Completed";

const toPositiveNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const toWholeDays = (value: unknown, fallbackHours = 0) => {
  const numeric = Number(value ?? 0);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(1, Math.round(numeric));
  }

  return fallbackHours > 0 ? Math.max(1, Math.ceil(fallbackHours / TASK_HOURS_PER_DAY)) : 0;
};

const taskIsMaster = (task: TaskItem) => Boolean(task.isTaskMaster ?? !task.assignedTo);

const taskPlannedHours = (task: TaskItem) => {
  const explicit = toPositiveNumber(task.estimatedHours);
  if (explicit > 0) {
    return explicit;
  }

  return taskIsMaster(task) ? toPositiveNumber(task.totalHours) : 0;
};

const taskAssignedHours = (task: TaskItem) => {
  const explicit = toPositiveNumber(task.assignedHours);
  if (explicit > 0) {
    return explicit;
  }

  return taskIsMaster(task) ? 0 : toPositiveNumber(task.totalHours);
};

const assignmentStateFor = (plannedHours: number, assignedHours: number): TaskAssignmentState => {
  if (assignedHours <= 0.001) return "Unassigned";
  if (assignedHours >= plannedHours - 0.001) return "Fully Assigned";
  return "Partially Assigned";
};

const buildLegacyTaskGroupKey = (task: TaskItem) =>
  [
    task.projectId,
    (task.title || task.taskName || "").trim().toLowerCase(),
    task.description.trim().toLowerCase(),
    task.startDate,
    task.endDate,
    Number(task.totalHours || task.estimatedHours || task.assignedHours || 0),
    normalizeTaskStatus(task.status),
  ].join("::");

const resolveTaskGroupKey = (task: TaskItem) => {
  const groupId = task.taskGroupId?.trim();
  return groupId ? `group:${groupId}` : `legacy:${buildLegacyTaskGroupKey(task)}`;
};

const resolveGroupedTimeline = (task: GroupedTaskItem) => {
  const startCandidates = task.memberTasks
    .map((member) => member.startDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  const endCandidates = task.memberTasks
    .map((member) => member.endDate)
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    startDate: task.startDate || startCandidates[0] || "",
    endDate: task.endDate || endCandidates[endCandidates.length - 1] || startCandidates[0] || "",
  };
};

const buildGroupedTask = (task: TaskItem): GroupedTaskItem => {
  const isMaster = taskIsMaster(task);
  const plannedHours = taskPlannedHours(task);
  const assignedHours = taskAssignedHours(task);
  const plannedDays = toWholeDays(task.plannedDays, plannedHours);
  const assignedDays = toWholeDays(task.assignedDays, assignedHours);

  return {
    ...task,
    taskName: task.taskName || task.title,
    title: task.title || task.taskName || "",
    id: task.taskGroupId || task.id,
    taskGroupId: task.taskGroupId || task.id,
    memberTaskIds: [task.id],
    memberTasks: [task],
    totalHours: plannedHours > 0 ? plannedHours : task.totalHours,
    estimatedHours: plannedHours,
    plannedDays,
    assignedToIds: !isMaster && task.assignedTo ? [task.assignedTo] : [],
    assignedToNames: !isMaster && task.assignedToName ? [task.assignedToName] : [],
    masterTaskId: isMaster ? task.id : null,
    assignmentTaskIds: !isMaster ? [task.id] : [],
    assignedHours,
    assignedDaysTotal: !isMaster ? assignedDays : 0,
    remainingHours: Math.max(0, plannedHours - assignedHours),
    assignmentStatus: assignmentStateFor(plannedHours, assignedHours),
  };
};

export const groupTasks = (tasks: TaskItem[]): GroupedTaskItem[] => {
  const grouped = new Map<string, GroupedTaskItem>();

  tasks.forEach((task) => {
    const key = resolveTaskGroupKey(task);
    const current = grouped.get(key);
    const isMaster = taskIsMaster(task);
    const plannedHours = taskPlannedHours(task);
    const assignedHours = taskAssignedHours(task);
    const plannedDays = toWholeDays(task.plannedDays, plannedHours);
    const assignedDays = toWholeDays(task.assignedDays, assignedHours);

    if (!current) {
      grouped.set(key, buildGroupedTask(task));
      return;
    }

    current.memberTaskIds.push(task.id);
    current.memberTasks.push(task);

    if (!isMaster) {
      current.assignmentTaskIds.push(task.id);
      current.assignedHours += assignedHours;
      current.assignedDaysTotal += assignedDays;

      if (task.assignedTo && !current.assignedToIds.includes(task.assignedTo)) {
        current.assignedToIds.push(task.assignedTo);
      }

      if (task.assignedToName && !current.assignedToNames.includes(task.assignedToName)) {
        current.assignedToNames.push(task.assignedToName);
      }

      if (!current.masterTaskId && plannedHours > 0) {
        current.totalHours = Math.max(Number(current.totalHours || 0), plannedHours);
        current.estimatedHours = Math.max(Number(current.estimatedHours || 0), plannedHours);
        current.plannedDays = Math.max(Number(current.plannedDays || 0), plannedDays);
        current.status = current.status || task.status;
        current.projectName = current.projectName || task.projectName;
      }

      return;
    }

    current.masterTaskId = task.id;
    current.projectId = task.projectId;
    current.projectName = task.projectName;
    current.taskCode = task.taskCode || current.taskCode;
    current.taskName = task.taskName || task.title;
    current.title = task.title || task.taskName || "";
    current.description = task.description;
    current.workBreakdown = task.workBreakdown;
    current.startDate = task.startDate;
    current.endDate = task.endDate;
    current.totalHours = plannedHours > 0 ? plannedHours : Number(task.totalHours || 0);
    current.estimatedHours = plannedHours > 0 ? plannedHours : current.estimatedHours;
    current.plannedDays = plannedDays > 0 ? plannedDays : current.plannedDays;
    current.priority = task.priority || current.priority;
    current.status = task.status;
  });

  return Array.from(grouped.values()).map((task) => ({
    ...task,
    ...resolveGroupedTimeline(task),
    assignedToName: task.assignedToNames.join(", "),
    remainingHours: Math.max(0, Number(task.estimatedHours || task.totalHours || 0) - Number(task.assignedHours || 0)),
    assignmentStatus: assignmentStateFor(Number(task.estimatedHours || task.totalHours || 0), Number(task.assignedHours || 0)),
  }));
};
