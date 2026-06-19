import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { taskService } from "../../services/taskService";
import { isGuid } from "../../services/http";
import type { Employee } from "../../types/employee";
import type { Project } from "../../types/project";
import type { TaskItem } from "../../types/task";
import {
  TASK_HOURS_PER_DAY,
  TASK_STATUSES,
  createTaskGroupId,
  groupTasks,
  normalizeTaskStatus,
  type GroupedTaskItem,
  type TaskStatus,
} from "../../utils/taskManagement";

export type TaskActionModalMode = "create" | "assign";

interface TaskActionModalProps {
  open: boolean;
  mode: TaskActionModalMode;
  initialProjectId?: string | null;
  initialTaskGroupId?: string | null;
  projects: Project[];
  employees: Employee[];
  allTaskHistory: TaskItem[];
  showToast: (title: string, tone?: "success" | "error" | "info") => void;
  onClose: () => void;
  onSaved: (projectId: string) => Promise<void> | void;
}

interface AssignmentRowState {
  key: string;
  assignmentId: string | null;
  employeeId: string;
  employeeName: string;
  assignedDays: number;
  assignmentStartDate: string;
  assignmentDueDate: string;
  notes: string;
  roleInTask: string;
  expectedDeliverable: string;
}

const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

const todayIso = () => new Date().toISOString().slice(0, 10);

const formatDate = (value: string) => {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const wholeDays = (value: number | string | undefined, fallback = 1) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? Math.max(1, Math.round(numeric)) : fallback;
};

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
};

const rangeDaysInclusive = (startDate: string, dueDate: string, fallback = 1) => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(dueDate);
  if (!start || !end) {
    return fallback;
  }

  const diffDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 ? diffDays + 1 : fallback;
};

const addDaysToIsoDate = (value: string, daysToAdd: number) => {
  const date = parseIsoDate(value);
  if (!date) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
};

const taskCodePrefix = (project: Project | null) => {
  if (!project) return "STD";
  const raw = project.code?.trim()
    ? project.code
    : project.name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("");

  const cleaned = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return cleaned ? cleaned.slice(0, 6) : "TASK";
};

const nextTaskSequence = (projectId: string, tasks: GroupedTaskItem[], year: number) => {
  const sequences = tasks
    .filter((task) => task.projectId === projectId)
    .map((task) => {
      const code = task.taskCode ?? "";
      const match = code.match(/-(\d{3,})$/);
      return match ? Number(match[1]) : 0;
    });

  return (sequences.length > 0 ? Math.max(...sequences) : 0) + 1;
};

const buildTaskCodePreview = (project: Project | null, tasks: GroupedTaskItem[], startDate: string) => {
  const year = Number(startDate?.slice(0, 4)) || new Date().getFullYear();
  const prefix = taskCodePrefix(project);
  const sequence = nextTaskSequence(project?.id ?? "", tasks, year);
  return prefix === "STD" ? `STD-${year}-${sequence.toString().padStart(3, "0")}` : `TSK-${prefix}-${year}-${sequence.toString().padStart(3, "0")}`;
};

const resolveTaskTimeline = (task: GroupedTaskItem | null) => {
  if (!task) {
    return { startDate: "", endDate: "" };
  }

  const masterTask =
    task.memberTasks.find((member) => member.id === task.masterTaskId) ??
    task.memberTasks.find((member) => Boolean(member.isTaskMaster) || !member.assignedTo) ??
    null;

  const startCandidates = [masterTask?.startDate, task.startDate, ...task.memberTasks.map((member) => member.startDate)]
    .filter((value): value is string => Boolean(value))
    .sort();
  const endCandidates = [masterTask?.endDate, task.endDate, ...task.memberTasks.map((member) => member.endDate)]
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    startDate: masterTask?.startDate || startCandidates[0] || "",
    endDate: masterTask?.endDate || endCandidates[endCandidates.length - 1] || startCandidates[0] || "",
  };
};

const assignmentRowDays = (row: AssignmentRowState) =>
  rangeDaysInclusive(row.assignmentStartDate, row.assignmentDueDate, wholeDays(row.assignedDays, 1));

const assignmentRowsHours = (rows: AssignmentRowState[]) =>
  rows.reduce((total, row) => total + assignmentRowDays(row) * TASK_HOURS_PER_DAY, 0);

const assignmentRowsDays = (rows: AssignmentRowState[]) =>
  rows.reduce((total, row) => total + assignmentRowDays(row), 0);

const canKeepAssignmentRows = (currentRows: AssignmentRowState[], nextRows: AssignmentRowState[], plannedHours: number) => {
  const currentHours = assignmentRowsHours(currentRows);
  const nextHours = assignmentRowsHours(nextRows);
  const tolerance = 0.001;

  return nextHours <= plannedHours + tolerance || nextHours <= currentHours + tolerance;
};

const sortAssignmentRows = (rows: AssignmentRowState[]) =>
  [...rows].sort((left, right) => left.employeeName.localeCompare(right.employeeName));

const buildAssignmentRow = ({
  task,
  assignment,
  employee,
}: {
  task: GroupedTaskItem | null;
  assignment?: TaskItem | null;
  employee?: Employee | null;
}): AssignmentRowState => {
  const timeline = resolveTaskTimeline(task);
  const fallbackDays = Math.max(
    1,
    Math.ceil(Number(assignment?.assignedHours ?? assignment?.totalHours ?? TASK_HOURS_PER_DAY) / TASK_HOURS_PER_DAY),
  );
  const assignmentStartDate = assignment
    ? assignment.startDate || timeline.startDate || todayIso()
    : "";
  const assignmentDueDate = assignment
    ? assignment.endDate || timeline.endDate || assignmentStartDate
    : "";

  return {
    key: assignment?.id ?? employee?.id ?? createTaskGroupId(),
    assignmentId: assignment?.id ?? null,
    employeeId: assignment?.assignedTo ?? employee?.id ?? "",
    employeeName: assignment?.assignedToName ?? employee?.fullName ?? "Selected team member",
    assignedDays: rangeDaysInclusive(
      assignmentStartDate,
      assignmentDueDate,
      wholeDays(assignment?.assignedDays, fallbackDays),
    ),
    assignmentStartDate,
    assignmentDueDate,
    notes: assignment?.notes ?? "",
    roleInTask: assignment?.roleInTask ?? "",
    expectedDeliverable: assignment?.expectedDeliverable ?? "",
  };
};

const sectionCardClass =
  "rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-black/60";
const fieldClass =
  "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-black dark:text-zinc-200";
const tableInputClass =
  "w-full min-w-[7rem] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-black dark:text-zinc-200";

export const TaskActionModal = ({
  open,
  mode,
  initialProjectId,
  initialTaskGroupId,
  projects,
  employees,
  allTaskHistory,
  showToast,
  onClose,
  onSaved,
}: TaskActionModalProps) => {
  useBodyScrollLock(open);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskGroupId, setSelectedTaskGroupId] = useState("");

  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [workBreakdown, setWorkBreakdown] = useState("");
  const [taskPriority, setTaskPriority] = useState<(typeof TASK_PRIORITIES)[number]>("Medium");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("To Do");
  const [plannedDays, setPlannedDays] = useState<number | "">("");

  const [assignmentRows, setAssignmentRows] = useState<AssignmentRowState[]>([]);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentPickerOpen, setAssignmentPickerOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  const createStartRef = useRef<HTMLInputElement | null>(null);
  const createDueRef = useRef<HTMLInputElement | null>(null);
  const assignmentPickerRef = useRef<HTMLDivElement | null>(null);

  const groupedAllTaskHistory = useMemo(() => groupTasks(allTaskHistory), [allTaskHistory]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedCreateTask = useMemo(
    () =>
      groupedAllTaskHistory.find((task) => task.taskGroupId === selectedTaskGroupId || task.id === selectedTaskGroupId) ?? null,
    [groupedAllTaskHistory, selectedTaskGroupId],
  );

  const availableTasksForAssignment = useMemo(
    () => groupedAllTaskHistory.filter((task) => !selectedProjectId || task.projectId === selectedProjectId),
    [groupedAllTaskHistory, selectedProjectId],
  );

  const selectedTaskForAssignment = useMemo(
    () =>
      availableTasksForAssignment.find((task) => task.taskGroupId === selectedTaskGroupId || task.id === selectedTaskGroupId) ??
      groupedAllTaskHistory.find((task) => task.taskGroupId === selectedTaskGroupId || task.id === selectedTaskGroupId) ??
      null,
    [availableTasksForAssignment, groupedAllTaskHistory, selectedTaskGroupId],
  );

  const assignmentEmployees = useMemo(() => {
    if (!selectedProject) {
      return employees.filter((employee) => employee.status === "Active");
    }

    return employees.filter(
      (employee) =>
        employee.status === "Active" &&
        (selectedProject.teamMemberIds.includes(employee.id) || selectedProject.managerId === employee.id),
    );
  }, [employees, selectedProject]);

  const existingAssignments = useMemo(
    () =>
      (selectedTaskForAssignment?.memberTasks ?? [])
        .filter((task) => Boolean(task.assignedTo))
        .sort((left, right) => (left.assignedToName || "").localeCompare(right.assignedToName || "")),
    [selectedTaskForAssignment],
  );

  const selectedEmployeeIds = useMemo(() => assignmentRows.map((row) => row.employeeId), [assignmentRows]);
  const selectedEmployeeIdSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);

  const filteredAssignmentEmployees = useMemo(() => {
    const query = assignmentSearch.trim().toLowerCase();
    return assignmentEmployees.filter(
      (employee) => !query || `${employee.fullName} ${employee.email} ${employee.role}`.toLowerCase().includes(query),
    );
  }, [assignmentEmployees, assignmentSearch]);

  const taskCodePreview = useMemo(() => {
    if (selectedCreateTask?.taskCode) {
      return selectedCreateTask.taskCode;
    }

    return buildTaskCodePreview(selectedProject, groupedAllTaskHistory, todayIso());
  }, [groupedAllTaskHistory, selectedCreateTask?.taskCode, selectedProject]);

  const taskPlannedHours = Math.max(0, Number(selectedTaskForAssignment?.estimatedHours ?? selectedTaskForAssignment?.totalHours ?? 0));
  const taskPlannedDaysTotal = Math.max(0, Number(selectedTaskForAssignment?.plannedDays ?? wholeDays(taskPlannedHours, 1)));
  const selectedTaskTimeline = useMemo(() => resolveTaskTimeline(selectedTaskForAssignment), [selectedTaskForAssignment]);
  const storedAssignedHours = existingAssignments.reduce(
    (total, item) => total + Number(item.assignedHours ?? item.totalHours ?? 0),
    0,
  );
  const proposedAssignedDays = assignmentRowsDays(assignmentRows);
  const proposedAssignedHours = assignmentRowsHours(assignmentRows);
  const remainingHours = Math.max(0, taskPlannedHours - storedAssignedHours);
  const remainingAfterSave = Math.max(0, taskPlannedHours - proposedAssignedHours);
  const remainingDaysAfterSave = Math.max(0, taskPlannedDaysTotal - proposedAssignedDays);
  const overAssignedHours = Math.max(0, proposedAssignedHours - taskPlannedHours);
  const allTeamMembersSelected =
    assignmentEmployees.length > 0 && assignmentEmployees.every((employee) => selectedEmployeeIdSet.has(employee.id));

  const loadAssignmentRows = (task: GroupedTaskItem | null) => {
    const nextRows = sortAssignmentRows(
      (task?.memberTasks ?? [])
        .filter((assignment) => Boolean(assignment.assignedTo))
        .map((assignment) => buildAssignmentRow({ task, assignment })),
    );

    setAssignmentRows(nextRows);
    setAssignmentSearch("");
    setAssignmentPickerOpen(false);
  };

  const toggleEmployeeSelection = (employee: Employee) => {
    setAssignmentRows((current) => {
      const exists = current.some((row) => row.employeeId === employee.id);
      if (exists) {
        return current.filter((row) => row.employeeId !== employee.id);
      }

      const nextRows = sortAssignmentRows([...current, buildAssignmentRow({ task: selectedTaskForAssignment, employee })]);
      if (assignmentRowsHours(nextRows) > taskPlannedHours + 0.001) {
        showToast("You cannot assign more than the task's planned days or hours.", "error");
        return current;
      }

      return nextRows;
    });
  };

  const toggleSelectAllEmployees = () => {
    setAssignmentRows((current) => {
      if (allTeamMembersSelected) {
        return current.filter((row) => !assignmentEmployees.some((employee) => employee.id === row.employeeId));
      }

      const currentByEmployeeId = new Map(current.map((row) => [row.employeeId, row]));
      const nextRows = [...current];

      assignmentEmployees.forEach((employee) => {
        if (!currentByEmployeeId.has(employee.id)) {
          nextRows.push(buildAssignmentRow({ task: selectedTaskForAssignment, employee }));
        }
      });

      const sortedRows = sortAssignmentRows(nextRows);
      if (assignmentRowsHours(sortedRows) > taskPlannedHours + 0.001) {
        showToast("Select All would exceed the task's planned days or hours.", "error");
        return current;
      }

      return sortedRows;
    });
  };

  const updateAssignmentRow = (employeeId: string, update: Partial<AssignmentRowState>) => {
    setAssignmentRows((current) =>
      {
        const nextRows = current.map((row) => {
          if (row.employeeId !== employeeId) {
            return row;
          }

          const nextStartDate = update.assignmentStartDate ?? row.assignmentStartDate;
          const nextDueDate = update.assignmentDueDate ?? row.assignmentDueDate;

          return {
            ...row,
            ...update,
            assignedDays: rangeDaysInclusive(nextStartDate, nextDueDate, row.assignedDays),
            assignmentStartDate: nextStartDate,
            assignmentDueDate: nextDueDate < nextStartDate ? nextStartDate : nextDueDate,
          };
        });

        if (!canKeepAssignmentRows(current, nextRows, taskPlannedHours)) {
          showToast("You cannot assign more than the task's planned days or hours.", "error");
          return current;
        }

        return nextRows;
      },
    );
  };

  const applyFirstRowToAll = () => {
    setAssignmentRows((current) => {
      if (current.length <= 1) {
        return current;
      }

      const [source] = current;
      const nextRows = current.map((row, index) =>
        index === 0
          ? row
          : {
              ...row,
              assignedDays: source.assignedDays,
              assignmentStartDate: source.assignmentStartDate,
              assignmentDueDate: source.assignmentDueDate,
              notes: source.notes,
              roleInTask: source.roleInTask,
              expectedDeliverable: source.expectedDeliverable,
            },
      );

      if (assignmentRowsHours(nextRows) > taskPlannedHours + 0.001) {
        showToast("Apply first row to all would exceed the task's planned days or hours.", "error");
        return current;
      }

      return nextRows;
    });
  };

  const handleDivideEqually = () => {
    if (!selectedTaskForAssignment) {
      showToast("Select a task before dividing effort equally.", "error");
      return;
    }

    if (assignmentRows.length === 0) {
      showToast("No members selected for equal division.", "info");
      return;
    }

    const memberCount = assignmentRows.length;
    const targetHours = taskPlannedHours;

    if (targetHours <= 0) {
      showToast("This task does not have planned effort to divide.", "error");
      return;
    }

    if (targetHours % memberCount !== 0) {
      showToast(
        `${targetHours} planned hours cannot be equally divided among ${memberCount} members in 9-hour blocks.`,
        "error",
      );
      return;
    }

    const equalShareHours = targetHours / memberCount;
    if (equalShareHours % TASK_HOURS_PER_DAY !== 0) {
      showToast(
        `${targetHours} planned hours cannot be equally divided among ${memberCount} members in 9-hour blocks.`,
        "error",
      );
      return;
    }

    const equalShareDays = equalShareHours / TASK_HOURS_PER_DAY;
    const nextRows = assignmentRows.map((row) => {
      const nextDueDate = addDaysToIsoDate(row.assignmentStartDate, Math.max(0, equalShareDays - 1));
      return {
        ...row,
        assignedDays: equalShareDays,
        assignmentDueDate: nextDueDate ?? row.assignmentDueDate,
      };
    });

    setAssignmentRows(nextRows);
    showToast("Task effort divided equally across selected members.", "success");
  };

  useEffect(() => {
    if (!assignmentPickerOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (assignmentPickerRef.current && !assignmentPickerRef.current.contains(event.target as Node)) {
        setAssignmentPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [assignmentPickerOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const fallbackProjectId =
      initialProjectId && projects.some((project) => project.id === initialProjectId)
        ? initialProjectId
        : projects[0]?.id ?? "";
    const initialTask =
      initialTaskGroupId
        ? groupedAllTaskHistory.find((task) => task.taskGroupId === initialTaskGroupId || task.id === initialTaskGroupId) ?? null
        : null;

    if (mode === "create") {
      setSelectedProjectId(initialTask?.projectId ?? fallbackProjectId);
      setSelectedTaskGroupId(initialTask?.taskGroupId ?? "");
      setTaskName(initialTask?.title ?? "");
      setTaskDescription(initialTask?.description ?? "");
      setWorkBreakdown(initialTask?.workBreakdown ?? "");
      setTaskPriority(((initialTask?.priority ?? "Medium") as (typeof TASK_PRIORITIES)[number]) || "Medium");
      setTaskStatus(initialTask ? normalizeTaskStatus(initialTask.status) : "To Do");
      setPlannedDays(initialTask?.plannedDays ? wholeDays(initialTask.plannedDays, 1) : "");
      setAssignmentRows([]);
      setAssignmentSearch("");
      setAssignmentPickerOpen(false);
      return;
    }

    const initialTaskProjectId = initialTask ? initialTask.projectId : fallbackProjectId;
    const defaultTask =
      initialTask ??
      groupedAllTaskHistory.find((task) => task.projectId === initialTaskProjectId) ??
      null;

    setSelectedProjectId(defaultTask?.projectId ?? fallbackProjectId);
    setSelectedTaskGroupId(defaultTask?.taskGroupId ?? "");
    loadAssignmentRows(defaultTask);
  }, [groupedAllTaskHistory, initialProjectId, initialTaskGroupId, mode, open, projects]);

  useEffect(() => {
    if (!open || mode !== "assign") {
      return;
    }

    if (availableTasksForAssignment.length === 0) {
      setSelectedTaskGroupId("");
      loadAssignmentRows(null);
      return;
    }

    const stillExists = availableTasksForAssignment.some(
      (task) => task.taskGroupId === selectedTaskGroupId || task.id === selectedTaskGroupId,
    );

    if (!selectedTaskGroupId || !stillExists) {
      const nextTask = availableTasksForAssignment[0] ?? null;
      setSelectedTaskGroupId(nextTask?.taskGroupId ?? "");
      loadAssignmentRows(nextTask);
    }
  }, [availableTasksForAssignment, mode, open, selectedTaskGroupId]);

  const handleCreateTask = async () => {
    if (!taskName.trim()) {
      showToast("Task name is required.", "error");
      return;
    }

    if (plannedDays === "" || !Number.isInteger(plannedDays) || plannedDays <= 0) {
      showToast("Planned days must be a whole number greater than zero.", "error");
      return;
    }

    if (selectedProject && !isGuid(selectedProject.id)) {
      showToast("Selected project is invalid.", "error");
      return;
    }

    const payload = {
      taskGroupId: selectedCreateTask?.taskGroupId ?? createTaskGroupId(),
      projectId: selectedProject?.id ?? "",
      projectName: selectedProject?.name ?? "",
      taskCode: taskCodePreview,
      taskName: taskName.trim(),
      description: taskDescription.trim(),
      workBreakdown: workBreakdown.trim(),
      plannedDays: Number(plannedDays) || 0,
      estimatedHours: (Number(plannedDays) || 0) * TASK_HOURS_PER_DAY,
      priority: taskPriority,
      status: taskStatus,
    };

    setSavingTask(true);
    try {
      if (selectedCreateTask?.masterTaskId) {
        await taskService.updateTaskDetails(selectedCreateTask.masterTaskId, payload);
        showToast("Task details updated successfully.", "success");
      } else {
        await taskService.createTask(payload);
        showToast("Task created successfully.", "success");
      }

      await onSaved(selectedProject?.id ?? "");
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save task details right now.", "error");
    } finally {
      setSavingTask(false);
    }
  };

  const handleAssignTask = async () => {
    if (!selectedTaskForAssignment) {
      showToast("Task is required.", "error");
      return;
    }

    if (assignmentRows.length === 0) {
      showToast("Select at least one team member to assign this task.", "error");
      return;
    }

    if ((selectedProject && !isGuid(selectedProject.id)) || assignmentRows.some((row) => !isGuid(row.employeeId))) {
      showToast("Selected project, task, or employee is invalid.", "error");
      return;
    }

    const invalidRow = assignmentRows.find((row) => {
      if (!row.assignmentStartDate || !row.assignmentDueDate) {
        return true;
      }

      if (row.assignmentDueDate < row.assignmentStartDate) {
        return true;
      }

      return false;
    });

    if (invalidRow) {
      const rowLabel = invalidRow.employeeName || "Selected team member";

      if (!invalidRow.assignmentStartDate || !invalidRow.assignmentDueDate) {
        showToast(`${rowLabel} must have both assignment dates filled in.`, "error");
        return;
      }

      if (invalidRow.assignmentDueDate < invalidRow.assignmentStartDate) {
        showToast(`${rowLabel} has a due date before the start date.`, "error");
        return;
      }
    }

    if (proposedAssignedHours > taskPlannedHours) {
      showToast(`Assigned hours exceed the task total by ${overAssignedHours} hours.`, "error");
      return;
    }

    const taskId = selectedTaskForAssignment.masterTaskId ?? selectedTaskForAssignment.taskGroupId ?? selectedTaskForAssignment.id;
    const existingAssignmentsByEmployeeId = new Map(existingAssignments.map((assignment) => [assignment.assignedTo, assignment]));
    const removedAssignments = existingAssignments.filter((assignment) => !selectedEmployeeIdSet.has(assignment.assignedTo));
    const rowsToUpdate = assignmentRows.filter((row) => existingAssignmentsByEmployeeId.has(row.employeeId));
    const rowsToCreate = assignmentRows.filter((row) => !existingAssignmentsByEmployeeId.has(row.employeeId));

    setSavingTask(true);
    try {
      await Promise.all([
        ...rowsToUpdate.map(async (row) => {
          const existingAssignment = existingAssignmentsByEmployeeId.get(row.employeeId);
          if (!existingAssignment) {
            return;
          }

          const assignedDays = assignmentRowDays(row);

          await taskService.updateTask(existingAssignment.id, {
            taskId,
            projectId: selectedProject?.id ?? "",
            userId: row.employeeId,
            assignedToName: row.employeeName,
            assignedDays,
            assignedHours: assignedDays * TASK_HOURS_PER_DAY,
            assignmentStartDate: row.assignmentStartDate,
            assignmentDueDate: row.assignmentDueDate,
            notes: row.notes.trim(),
            roleInTask: row.roleInTask.trim(),
            expectedDeliverable: row.expectedDeliverable.trim(),
          });
        }),
        ...rowsToCreate.map(async (row) =>
          {
            const assignedDays = assignmentRowDays(row);
            return taskService.assignTask({
              taskId,
              projectId: selectedProject?.id ?? "",
              userId: row.employeeId,
              assignedToName: row.employeeName,
              assignedDays,
              assignedHours: assignedDays * TASK_HOURS_PER_DAY,
              assignmentStartDate: row.assignmentStartDate,
              assignmentDueDate: row.assignmentDueDate,
              notes: row.notes.trim(),
              roleInTask: row.roleInTask.trim(),
              expectedDeliverable: row.expectedDeliverable.trim(),
            });
          }),
        ...removedAssignments.map(async (assignment) => taskService.deleteTask(assignment.id)),
      ]);

      showToast(existingAssignments.length > 0 ? "Task assignments updated successfully." : "Task assigned successfully.", "success");
      await onSaved(selectedProject?.id ?? "");
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save the task assignment right now.", "error");
    } finally {
      setSavingTask(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white p-6 shadow-panel dark:border-zinc-800 dark:bg-black"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              {mode === "create" ? "Create Task" : "Assign Task"}
            </p>
            <h3 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
              {mode === "create" ? "Create Task" : "Assign Task"}
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {mode === "create"
                ? "Create the task structure and planned timeline for the selected project."
                : "Assign an existing task to one or many project team members."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {mode === "create" ? (
            <>
              <section className={sectionCardClass}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Section A</p>
                <h4 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">Project Context</h4>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Project</span>
                    <select
                      value={selectedProjectId}
                      onChange={(event) => setSelectedProjectId(event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">No Project (Standalone Task)</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Task Code</span>
                    <input value={taskCodePreview} readOnly className={classNames(fieldClass, "bg-zinc-50 text-zinc-500 dark:bg-zinc-900")} />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Task Name</span>
                    <input
                      value={taskName}
                      onChange={(event) => setTaskName(event.target.value)}
                      placeholder="Example: Frontend Dashboard Development"
                      className={fieldClass}
                    />
                  </label>
                </div>
              </section>

              <section className={sectionCardClass}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Section B</p>
                <h4 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">Task Planning</h4>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Task Description</span>
                    <textarea
                      rows={3}
                      value={taskDescription}
                      onChange={(event) => setTaskDescription(event.target.value)}
                      placeholder="Describe the overall scope and objective of the task."
                      className={fieldClass}
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Subtask / Work Breakdown</span>
                    <textarea
                      rows={4}
                      value={workBreakdown}
                      onChange={(event) => setWorkBreakdown(event.target.value)}
                      placeholder="Break the task into key deliverables, modules, or checkpoints."
                      className={fieldClass}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Priority</span>
                    <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as (typeof TASK_PRIORITIES)[number])} className={fieldClass}>
                      {TASK_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Status</span>
                    <select value={taskStatus} onChange={(event) => setTaskStatus(event.target.value as TaskStatus)} className={fieldClass}>
                      {TASK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className={sectionCardClass}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Section C</p>
                <h4 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">Effort & Timeline</h4>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Planned Days</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={plannedDays}
                      onChange={(event) => setPlannedDays(event.target.value === "" ? "" : wholeDays(event.target.value, 1))}
                      className={fieldClass}
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">1 working day = 9 hours</p>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Total Planned Hours</span>
                    <input value={(Number(plannedDays) || 0) * TASK_HOURS_PER_DAY} readOnly className={classNames(fieldClass, "bg-zinc-50 text-zinc-500 dark:bg-zinc-900")} />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Auto-calculated from planned days</p>
                  </label>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className={sectionCardClass}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Section A</p>
                <h4 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">Task Selection</h4>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Project</span>
                    <select
                      value={selectedProjectId}
                      onChange={(event) => {
                        const nextProjectId = event.target.value;
                        const nextTask = groupedAllTaskHistory.find((task) => task.projectId === nextProjectId) ?? null;
                        setSelectedProjectId(nextProjectId);
                        setSelectedTaskGroupId(nextTask?.taskGroupId ?? "");
                        loadAssignmentRows(nextTask);
                      }}
                      className={fieldClass}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Task</span>
                    <select
                      value={selectedTaskGroupId}
                      onChange={(event) => {
                        const nextTask =
                          availableTasksForAssignment.find(
                            (task) => task.taskGroupId === event.target.value || task.id === event.target.value,
                          ) ?? null;
                        setSelectedTaskGroupId(nextTask?.taskGroupId ?? "");
                        loadAssignmentRows(nextTask);
                      }}
                      className={fieldClass}
                    >
                      {availableTasksForAssignment.length === 0 ? (
                        <option value="">No tasks available</option>
                      ) : (
                        availableTasksForAssignment.map((task) => (
                          <option key={task.taskGroupId} value={task.taskGroupId}>
                            {task.taskCode ? `${task.taskCode} - ` : ""}
                            {task.title}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </div>

                {selectedTaskForAssignment ? (
                  <div className="mt-5 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Task Summary</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-black/70">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Task</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">
                          {selectedTaskForAssignment.taskCode ? `${selectedTaskForAssignment.taskCode} - ` : ""}
                          {selectedTaskForAssignment.title}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-black/70">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Planned Days / Hours</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">
                          {selectedTaskForAssignment.plannedDays || wholeDays(taskPlannedHours, 1)} days / {taskPlannedHours} hours
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-black/70">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Timeline</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">
                          {formatDate(selectedTaskTimeline.startDate)} - {formatDate(selectedTaskTimeline.endDate)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-black/70">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Already Assigned</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{storedAssignedHours} hours</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-black/70">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Remaining</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{remainingHours} hours</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-black/70">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Assignment Status</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{selectedTaskForAssignment.assignmentStatus}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    Select a project with existing tasks to continue.
                  </div>
                )}
              </section>

              <section className={sectionCardClass}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Section B</p>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h4 className="text-xl font-bold text-zinc-900 dark:text-white">Assign Team Members</h4>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      Choose one person, many people, or select the full project team in one go.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Selected Members</p>
                    <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">{assignmentRows.length}</p>
                  </div>
                </div>

                <div ref={assignmentPickerRef} className="relative mt-5">
                  <button
                    type="button"
                    onClick={() => setAssignmentPickerOpen((current) => !current)}
                    className={classNames(fieldClass, "flex items-center justify-between gap-4 text-left")}
                  >
                    <span className={assignmentRows.length === 0 ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-900 dark:text-white"}>
                      {assignmentRows.length === 0
                        ? "Select project team member"
                        : `${assignmentRows.length} team member${assignmentRows.length === 1 ? "" : "s"} selected`}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      {assignmentPickerOpen ? "Close" : "Select"}
                    </span>
                  </button>

                  {assignmentPickerOpen ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-black">
                      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
                        <input
                          value={assignmentSearch}
                          onChange={(event) => setAssignmentSearch(event.target.value)}
                          placeholder="Search project team member"
                          className={fieldClass}
                        />
                        <label className="mt-3 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200">
                          <input
                            type="checkbox"
                            checked={allTeamMembersSelected}
                            onChange={toggleSelectAllEmployees}
                            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                          />
                          <span>Select All Team Members</span>
                          <span className="ml-auto text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                            {assignmentEmployees.length}
                          </span>
                        </label>
                      </div>

                      <div className="max-h-72 overflow-y-auto p-2">
                        {filteredAssignmentEmployees.length === 0 ? (
                          <div className="rounded-2xl px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            No project team members match this search.
                          </div>
                        ) : (
                          filteredAssignmentEmployees.map((employee) => {
                            const selected = selectedEmployeeIdSet.has(employee.id);
                            return (
                              <label
                                key={employee.id}
                                className="flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-3 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleEmployeeSelection(employee)}
                                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block font-semibold text-zinc-900 dark:text-white">{employee.fullName}</span>
                                  <span className="mt-1 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                                    {employee.role} • {employee.email}
                                  </span>
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {assignmentRows.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {assignmentRows.map((row) => (
                      <button
                        key={`chip-${row.key}`}
                        type="button"
                        onClick={() => setAssignmentRows((current) => current.filter((item) => item.employeeId !== row.employeeId))}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-black"
                      >
                        <span>{row.employeeName}</span>
                        <span className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Remove</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className={sectionCardClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Section C</p>
                    <h4 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">Assignment Grid</h4>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      Set days, hours, dates, and delivery expectations per selected member.
                    </p>
                  </div>
                  {assignmentRows.length > 1 ? (
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={applyFirstRowToAll}
                        className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      >
                        Apply first row to all
                      </button>
                      <button
                        type="button"
                        onClick={handleDivideEqually}
                        className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      >
                        Divide Equally
                      </button>
                    </div>
                  ) : null}
                </div>

                {selectedTaskForAssignment ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      ["Planned", `${taskPlannedDaysTotal} days / ${taskPlannedHours} hours`],
                      ["Assigned Now", `${proposedAssignedDays} days / ${proposedAssignedHours} hours`],
                      ["Remaining", `${remainingDaysAfterSave} days / ${remainingAfterSave} hours`],
                      ["Saved Before Edit", `${Math.max(0, Number(selectedTaskForAssignment.assignedDaysTotal ?? 0))} days / ${storedAssignedHours} hours`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
                        <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {assignmentRows.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    Pick one or more team members to build the assignment rows.
                  </div>
                ) : (
                  <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800">
                    <div className="max-h-[420px] overflow-auto">
                      <table className="min-w-[1180px] w-full border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur dark:bg-black/95">
                          <tr>
                            {["Employee", "Days", "Hours", "Start Date", "Due Date", "Role", "Deliverable", "Notes", "Actions"].map((header) => (
                              <th
                                key={header}
                                className={classNames(
                                  "border-b border-zinc-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400",
                                  header === "Actions" ? "text-right" : "",
                                )}
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-black/60">
                          {assignmentRows.map((row) => {
                            const assignedDays = assignmentRowDays(row);
                            const assignedHours = assignedDays * TASK_HOURS_PER_DAY;

                            return (
                              <tr key={row.key} className="align-top">
                                <td className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
                                  <div className="min-w-[14rem]">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-semibold text-zinc-900 dark:text-white">{row.employeeName}</p>
                                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
                                        {row.assignmentId ? "Existing" : "New"}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Auto-calculated from the selected date range.</p>
                                  </div>
                                </td>

                                <td className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
                                  <input value={assignedDays} readOnly className={classNames(tableInputClass, "bg-zinc-50 text-zinc-500 dark:bg-zinc-900")} />
                                </td>

                                <td className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
                                  <input value={assignedHours} readOnly className={classNames(tableInputClass, "bg-zinc-50 text-zinc-500 dark:bg-zinc-900")} />
                                </td>

                                <td className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
                                  <input
                                    type="date"
                                    value={row.assignmentStartDate}
                                    onChange={(event) =>
                                      updateAssignmentRow(row.employeeId, {
                                        assignmentStartDate: event.target.value,
                                      })
                                    }
                                    className={tableInputClass}
                                  />
                                </td>

                                <td className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
                                  <input
                                    type="date"
                                    min={row.assignmentStartDate || undefined}
                                    value={row.assignmentDueDate}
                                    onChange={(event) =>
                                      updateAssignmentRow(row.employeeId, {
                                        assignmentDueDate: event.target.value,
                                      })
                                    }
                                    className={tableInputClass}
                                  />
                                </td>

                                <td className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
                                  <input
                                    value={row.roleInTask}
                                    onChange={(event) =>
                                      updateAssignmentRow(row.employeeId, {
                                        roleInTask: event.target.value,
                                      })
                                    }
                                    placeholder="UI Dev"
                                    className={tableInputClass}
                                  />
                                </td>

                                <td className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
                                  <input
                                    value={row.expectedDeliverable}
                                    onChange={(event) =>
                                      updateAssignmentRow(row.employeeId, {
                                        expectedDeliverable: event.target.value,
                                      })
                                    }
                                    placeholder="Dashboard cards"
                                    className={tableInputClass}
                                  />
                                </td>

                                <td className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
                                  <input
                                    value={row.notes}
                                    onChange={(event) =>
                                      updateAssignmentRow(row.employeeId, {
                                        notes: event.target.value,
                                      })
                                    }
                                    placeholder="Focus desktop first"
                                    className={classNames(tableInputClass, "min-w-[16rem]")}
                                  />
                                </td>

                                <td className="border-b border-zinc-100 px-4 py-4 text-right dark:border-zinc-800">
                                  <button
                                    type="button"
                                    onClick={() => setAssignmentRows((current) => current.filter((item) => item.employeeId !== row.employeeId))}
                                    className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <section className={sectionCardClass}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Section D</p>
                <h4 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">Assignment Summary</h4>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Task Total", `${taskPlannedHours} hours`],
                    ["Saved Before Edit", `${storedAssignedHours} hours`],
                    ["Planned Now", `${proposedAssignedHours} hours`],
                    ["Remaining After Save", `${remainingAfterSave} hours`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                  Selected members: {assignmentRows.length}. New assignments will be created for newly selected users, and deselected existing users will be removed on save.
                </p>

                {overAssignedHours > 0 ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                    The selected rows exceed the task total by {overAssignedHours} hours. Reduce one or more rows before saving.
                  </div>
                ) : null}
              </section>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void (mode === "create" ? handleCreateTask() : handleAssignTask())}
            disabled={savingTask || (mode === "assign" && !selectedTaskForAssignment)}
            className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
          >
            {savingTask
              ? mode === "create"
                ? "Saving..."
                : "Assigning..."
              : mode === "create"
                ? selectedCreateTask?.masterTaskId
                  ? "Update Task"
                  : "Create Task"
                : existingAssignments.length > 0
                  ? "Save Assignments"
                  : "Assign Task"}
          </button>
        </div>
      </div>
    </div>
  );
};
