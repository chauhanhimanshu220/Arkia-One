import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ToastContainer } from "../../components/ToastContainer";
import { TaskActionModal } from "../../components/tasks/TaskActionModal";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useEmployees } from "../../hooks/useEmployees";
import { useProjects } from "../../hooks/useProjects";
import { useToast } from "../../hooks/useToast";
import { isGuid } from "../../services/http";
import { taskService } from "../../services/taskService";
import type { TaskItem } from "../../types/task";
import {
  createTaskGroupId,
  groupTasks,
  normalizeTaskStatus,
  TASK_HOURS_PER_DAY,
  TASK_STATUSES,
  type GroupedTaskItem,
  type TaskStatus,
} from "../../utils/taskManagement";

type TaskPanelMode = "create" | "assign";
type TaskAssignmentFilter = "all" | "assigned" | "unassigned";

const taskStatusClasses: Record<TaskStatus, string> = {
  "To Do": "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Planned: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  "In Progress": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  "On Hold": "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
  Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
};

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

const formatDate = (value: string) => {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const formatText = (value?: string | null, fallback = "Not provided") => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
};

const getAssignmentMembers = (task: GroupedTaskItem | null) =>
  (task?.memberTasks ?? [])
    .filter((member) => Boolean(member.assignedTo))
    .sort((left, right) => (left.assignedToName || "").localeCompare(right.assignedToName || ""));

const todayIso = () => new Date().toISOString().slice(0, 10);

const getTaskHistorySets = async (projectId: string) => {
  const [visibleHistory, completeHistory] = await Promise.all([
    taskService.getTaskHistory(projectId || undefined),
    projectId ? taskService.getTaskHistory() : Promise.resolve<TaskItem[] | null>(null),
  ]);

  return {
    visibleHistory,
    completeHistory: completeHistory ?? visibleHistory,
  };
};

export const ProjectTaskWorkbenchPage = () => {
  const { projects, loading: projectsLoading } = useProjects();
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [taskPanelMode, setTaskPanelMode] = useState<TaskPanelMode>("create");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskGroupId, setSelectedTaskGroupId] = useState("");
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("To Do");
  const [taskStartDate, setTaskStartDate] = useState(todayIso());
  const [taskEndDate, setTaskEndDate] = useState(todayIso());
  const [taskTotalHours, setTaskTotalHours] = useState(TASK_HOURS_PER_DAY);
  const [editingTaskIds, setEditingTaskIds] = useState<string[]>([]);
  const [editingTaskGroupId, setEditingTaskGroupId] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [taskHistory, setTaskHistory] = useState<TaskItem[]>([]);
  const [allTaskHistory, setAllTaskHistory] = useState<TaskItem[]>([]);
  const [historyProjectId, setHistoryProjectId] = useState("");
  const [taskHistorySearch, setTaskHistorySearch] = useState("");
  const [taskAssignmentFilter, setTaskAssignmentFilter] = useState<TaskAssignmentFilter>("all");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewAssignmentTask, setViewAssignmentTask] = useState<GroupedTaskItem | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);

  useBodyScrollLock(taskPanelOpen || Boolean(viewAssignmentTask));

  const groupedTaskHistory = useMemo(() => groupTasks(taskHistory), [taskHistory]);
  const groupedAllTaskHistory = useMemo(() => groupTasks(allTaskHistory), [allTaskHistory]);
  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId) ?? null, [projects, selectedProjectId]);
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
  const viewedAssignmentMembers = useMemo(() => getAssignmentMembers(viewAssignmentTask), [viewAssignmentTask]);

  const assignmentEmployees = useMemo(() => {
    if (!selectedProject) return employees.filter((employee) => employee.status === "Active");

    return employees.filter(
      (employee) =>
        employee.status === "Active" &&
        (selectedProject.teamMemberIds.includes(employee.id) || selectedProject.managerId === employee.id),
    );
  }, [employees, selectedProject]);

  const filteredAssignmentEmployees = useMemo(() => {
    const query = assignSearch.trim().toLowerCase();
    return assignmentEmployees.filter(
      (employee) => !query || `${employee.fullName} ${employee.email} ${employee.role}`.toLowerCase().includes(query),
    );
  }, [assignSearch, assignmentEmployees]);

  const activeTaskAssignmentsByEmployeeId = useMemo(() => {
    const tasksByEmployeeId = new Map<string, TaskItem[]>();
    const excludedTaskIds = new Set(editingTaskIds);

    allTaskHistory.forEach((task) => {
      if (!task.assignedTo || excludedTaskIds.has(task.id) || normalizeTaskStatus(task.status) === "Completed") {
        return;
      }

      tasksByEmployeeId.set(task.assignedTo, [...(tasksByEmployeeId.get(task.assignedTo) ?? []), task]);
    });

    return tasksByEmployeeId;
  }, [allTaskHistory, editingTaskIds]);

  const selectedTaskAssignmentAlerts = useMemo(() => {
    const alerts: Array<{ employeeId: string; employeeName: string; tasks: TaskItem[] }> = [];

    assignUserIds.forEach((employeeId) => {
      const tasks = activeTaskAssignmentsByEmployeeId.get(employeeId) ?? [];
      const employee = employees.find((item) => item.id === employeeId);
      if (employee && tasks.length > 0) {
        alerts.push({ employeeId, employeeName: employee.fullName, tasks });
      }
    });

    return alerts;
  }, [activeTaskAssignmentsByEmployeeId, assignUserIds, employees]);

  const filteredTaskList = useMemo(() => {
    const query = taskHistorySearch.trim().toLowerCase();
    return groupedTaskHistory.filter((task) => {
      const hasAssignments = task.assignedToIds.length > 0;
      const matchesAssignmentFilter =
        taskAssignmentFilter === "all" ||
        (taskAssignmentFilter === "assigned" ? hasAssignments : !hasAssignments);
      const text = [
        task.title,
        task.description,
        task.projectName,
        task.assignmentStatus,
        task.assignedToName,
        task.status,
        task.startDate,
        task.endDate,
      ]
        .join(" ")
        .toLowerCase();

      return matchesAssignmentFilter && (!query || text.includes(query));
    });
  }, [groupedTaskHistory, taskAssignmentFilter, taskHistorySearch]);

  const filteredAssignmentList = useMemo(() => {
    const query = taskHistorySearch.trim().toLowerCase();
    return groupedTaskHistory.filter((task) => {
      if (task.assignedToIds.length === 0) {
        return false;
      }

      const text = [
        task.title,
        task.description,
        task.projectName,
        task.assignedToName,
        task.assignedToNames.join(" "),
        task.assignmentStatus,
        task.status,
        task.startDate,
        task.endDate,
      ]
        .join(" ")
        .toLowerCase();

      return !query || text.includes(query);
    });
  }, [groupedTaskHistory, taskHistorySearch]);

  const refreshTaskHistory = async (projectId: string) => {
    const { visibleHistory, completeHistory } = await getTaskHistorySets(projectId);
    setTaskHistory(visibleHistory);
    setAllTaskHistory(completeHistory);
  };

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId("");
      if (historyProjectId) {
        setHistoryProjectId("");
      }
      return;
    }

    const projectIdFromQuery = searchParams.get("projectId");
    if (projectIdFromQuery && projects.some((project) => project.id === projectIdFromQuery)) {
      setSelectedProjectId((current) => current || projectIdFromQuery);
      setHistoryProjectId((current) => current || projectIdFromQuery);
      return;
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }

    if (historyProjectId && !projects.some((project) => project.id === historyProjectId)) {
      setHistoryProjectId("");
    }
  }, [historyProjectId, projects, searchParams, selectedProjectId]);

  useEffect(() => {
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const { visibleHistory, completeHistory } = await getTaskHistorySets(historyProjectId);
        setTaskHistory(visibleHistory);
        setAllTaskHistory(completeHistory);
      } catch {
        setTaskHistory([]);
        setAllTaskHistory([]);
        showToast("Unable to load task history right now.", "error");
      } finally {
        setHistoryLoading(false);
      }
    };

    void loadHistory();
  }, [historyProjectId, showToast]);

  useEffect(() => {
    if (!viewAssignmentTask) {
      return;
    }

    const refreshedTask =
      groupedAllTaskHistory.find((task) => task.taskGroupId === viewAssignmentTask.taskGroupId || task.id === viewAssignmentTask.id) ?? null;

    if (!refreshedTask || refreshedTask.assignedToIds.length === 0) {
      setViewAssignmentTask(null);
      return;
    }

    if (refreshedTask !== viewAssignmentTask) {
      setViewAssignmentTask(refreshedTask);
    }
  }, [groupedAllTaskHistory, viewAssignmentTask]);

  const resetTaskForm = () => {
    setAssignUserIds([]);
    setAssignSearch("");
    setAssignPickerOpen(false);
    setSelectedTaskGroupId("");
    setTaskTitle("");
    setTaskDescription("");
    setTaskStatus("To Do");
    setTaskStartDate(todayIso());
    setTaskEndDate(todayIso());
    setTaskTotalHours(TASK_HOURS_PER_DAY);
    setEditingTaskIds([]);
    setEditingTaskGroupId(null);
  };

  const syncSearchParams = (nextMode?: TaskPanelMode, nextProjectId?: string, nextTaskGroupId?: string) => {
    const next = new URLSearchParams(searchParams);

    if (nextMode) {
      next.set("mode", nextMode);
    } else {
      next.delete("mode");
    }

    if (nextProjectId) {
      next.set("projectId", nextProjectId);
    } else {
      next.delete("projectId");
    }

    if (nextTaskGroupId) {
      next.set("taskGroupId", nextTaskGroupId);
    } else {
      next.delete("taskGroupId");
    }

    setSearchParams(next, { replace: true });
  };

  const closeTaskPanel = () => {
    setTaskPanelOpen(false);
    resetTaskForm();
    syncSearchParams(undefined, selectedProjectId || undefined, undefined);
  };

  const closeViewAssignmentModal = () => {
    setViewAssignmentTask(null);
  };

  const fillCreateForm = (task: GroupedTaskItem | null) => {
    setEditingTaskIds(task?.memberTaskIds ?? []);
    setEditingTaskGroupId(task?.taskGroupId ?? null);
    setSelectedTaskGroupId(task?.taskGroupId ?? "");
    setAssignUserIds([]);
    setTaskTitle(task?.title ?? "");
    setTaskDescription(task?.description ?? "");
    setTaskStatus(task ? normalizeTaskStatus(task.status) : "To Do");
    setTaskStartDate(task?.startDate ?? todayIso());
    setTaskEndDate(task?.endDate ?? task?.startDate ?? todayIso());
    setTaskTotalHours(task ? Number(task.totalHours || 0) || TASK_HOURS_PER_DAY : TASK_HOURS_PER_DAY);
  };

  const fillAssignForm = (task: GroupedTaskItem | null) => {
    setEditingTaskIds(task?.assignmentTaskIds ?? []);
    setEditingTaskGroupId(task?.taskGroupId ?? null);
    setSelectedTaskGroupId(task?.taskGroupId ?? "");
    setAssignUserIds(task?.assignedToIds ?? []);
    setTaskTitle(task?.title ?? "");
    setTaskDescription(task?.description ?? "");
    setTaskStatus(task ? normalizeTaskStatus(task.status) : "To Do");
    setTaskStartDate(task?.startDate ?? todayIso());
    setTaskEndDate(task?.endDate ?? task?.startDate ?? todayIso());
    setTaskTotalHours(task ? Number(task.totalHours || 0) || TASK_HOURS_PER_DAY : TASK_HOURS_PER_DAY);
  };

  const openCreateTaskPanel = (projectId?: string, task?: GroupedTaskItem | null, updateQuery = true) => {
    const resolvedProjectId = projectId !== undefined ? projectId : (task?.projectId ?? selectedProjectId ?? projects[0]?.id ?? "");
    setSelectedProjectId(resolvedProjectId);
    if (resolvedProjectId) {
      setHistoryProjectId((current) => current || resolvedProjectId);
    }
    setViewAssignmentTask(null);
    setTaskPanelMode("create");
    setTaskPanelOpen(true);
    setAssignPickerOpen(false);
    fillCreateForm(task ?? null);
    if (updateQuery) {
      syncSearchParams("create", resolvedProjectId || undefined, task?.taskGroupId);
    }
  };

  const openAssignTaskPanel = (projectId?: string, task?: GroupedTaskItem | null, updateQuery = true) => {
    const resolvedProjectId = projectId !== undefined ? projectId : (task?.projectId ?? selectedProjectId ?? projects[0]?.id ?? "");
    setSelectedProjectId(resolvedProjectId);
    if (resolvedProjectId) {
      setHistoryProjectId((current) => current || resolvedProjectId);
    }
    setViewAssignmentTask(null);
    setTaskPanelMode("assign");
    setTaskPanelOpen(true);
    setAssignPickerOpen(false);
    fillAssignForm(task ?? null);
    if (updateQuery) {
      syncSearchParams("assign", resolvedProjectId || undefined, task?.taskGroupId);
    }
  };

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (!mode || projects.length === 0 || historyLoading) {
      return;
    }

    const projectIdFromQuery = searchParams.get("projectId") ?? selectedProjectId ?? projects[0]?.id ?? "";
    const taskGroupIdFromQuery = searchParams.get("taskGroupId");
    const queryTask =
      taskGroupIdFromQuery
        ? groupedAllTaskHistory.find((task) => task.taskGroupId === taskGroupIdFromQuery || task.id === taskGroupIdFromQuery) ?? null
        : null;

    if (taskGroupIdFromQuery && !queryTask) {
      return;
    }

    if (mode === "create") {
      openCreateTaskPanel(projectIdFromQuery, queryTask, false);
    }

    if (mode === "assign") {
      openAssignTaskPanel(projectIdFromQuery, queryTask, false);
    }
  }, [groupedAllTaskHistory, historyLoading, projects, searchParams]);

  useEffect(() => {
    if (taskPanelMode !== "assign" || !taskPanelOpen) {
      return;
    }

    if (availableTasksForAssignment.length === 0) {
      if (selectedTaskGroupId) {
        fillAssignForm(null);
      }
      return;
    }

    const stillExists = availableTasksForAssignment.some((task) => task.taskGroupId === selectedTaskGroupId || task.id === selectedTaskGroupId);
    if (!selectedTaskGroupId || !stillExists) {
      fillAssignForm(availableTasksForAssignment[0] ?? null);
    }
  }, [availableTasksForAssignment, selectedTaskGroupId, taskPanelMode, taskPanelOpen]);

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      showToast("Task name is required.", "error");
      return;
    }
    if (!Number.isFinite(taskTotalHours) || Number(taskTotalHours) <= 0) {
      showToast("Estimated hours must be greater than zero.", "error");
      return;
    }
    if (selectedProject && !isGuid(selectedProject.id)) {
      showToast("Selected project is invalid.", "error");
      return;
    }

    const taskGroupId = editingTaskGroupId ?? createTaskGroupId();
    const payload = {
      taskGroupId,
      projectId: selectedProject?.id ?? "",
      projectName: selectedProject?.name ?? "",
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      totalHours: Number(taskTotalHours),
      status: taskStatus,
    };

    setSavingTask(true);
    try {
      if (editingTaskIds.length > 0) {
        await Promise.all(editingTaskIds.map(async (taskId) => taskService.updateTaskDetails(taskId, payload)));
        showToast("Task details updated successfully.", "success");
      } else {
        await taskService.createTask(payload);
        showToast("Task created successfully.", "success");
      }

      closeTaskPanel();
      if (selectedProject) {
        setHistoryProjectId(selectedProject.id);
        await refreshTaskHistory(selectedProject.id);
      } else {
        await refreshTaskHistory("");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save task details right now.", "error");
    } finally {
      setSavingTask(false);
    }
  };

  const handleAssignTask = async () => {
    if (!selectedTaskForAssignment) {
      showToast("Select an existing task first.", "error");
      return;
    }
    if (assignUserIds.length === 0) {
      showToast("Select at least one task owner.", "error");
      return;
    }
    if (!taskStartDate || !taskEndDate) {
      showToast("Start date and due date are required.", "error");
      return;
    }
    if (taskEndDate < taskStartDate) {
      showToast("Due date cannot be before start date.", "error");
      return;
    }
    if (!Number.isFinite(taskTotalHours) || Number(taskTotalHours) <= 0) {
      showToast("Assigned hours must be greater than zero.", "error");
      return;
    }
    if ((selectedProject && !isGuid(selectedProject.id)) || assignUserIds.some((id) => !isGuid(id))) {
      showToast("Selected project, task, or employee is invalid.", "error");
      return;
    }

    const selectedEmployees = employees.filter((employee) => assignUserIds.includes(employee.id));
    if (selectedEmployees.length !== assignUserIds.length) {
      showToast("One or more selected employees are invalid.", "error");
      return;
    }

    const existingAssignments = allTaskHistory.filter(
      (task) =>
        Boolean(task.assignedTo) &&
        (task.taskGroupId === selectedTaskForAssignment.taskGroupId || task.id === selectedTaskForAssignment.taskGroupId),
    );
    const existingTasksByEmployeeId = new Map(existingAssignments.map((task) => [task.assignedTo, task]));
    const removedAssignments = existingAssignments.filter((task) => !assignUserIds.includes(task.assignedTo));
    const retainedEmployees = selectedEmployees.filter((employee) => existingTasksByEmployeeId.has(employee.id));
    const newEmployees = selectedEmployees.filter((employee) => !existingTasksByEmployeeId.has(employee.id));

    setSavingTask(true);
    try {
      await Promise.all([
        ...retainedEmployees.map(async (employee) => {
          const task = existingTasksByEmployeeId.get(employee.id);
          if (!task) {
            return;
          }

          await taskService.updateTask(task.id, {
            taskGroupId: selectedTaskForAssignment.taskGroupId,
            projectId: selectedProject?.id ?? "",
            projectName: selectedProject?.name ?? "",
            assignedTo: employee.id,
            assignedToName: employee.fullName,
            title: selectedTaskForAssignment.title,
            description: selectedTaskForAssignment.description,
            startDate: taskStartDate,
            endDate: taskEndDate,
            totalHours: Number(taskTotalHours),
            status: taskStatus,
          });
        }),
        ...newEmployees.map(async (employee) =>
          taskService.assignTask({
            taskGroupId: selectedTaskForAssignment.taskGroupId,
            projectId: selectedProject?.id ?? "",
            projectName: selectedProject?.name ?? "",
            assignedTo: employee.id,
            assignedToName: employee.fullName,
            title: selectedTaskForAssignment.title,
            description: selectedTaskForAssignment.description,
            startDate: taskStartDate,
            endDate: taskEndDate,
            totalHours: Number(taskTotalHours),
            status: taskStatus,
          })),
        ...removedAssignments.map(async (task) => taskService.deleteTask(task.id)),
      ]);

      showToast(existingAssignments.length > 0 ? "Task assignments updated successfully." : "Task assigned successfully.", "success");
      closeTaskPanel();
      if (selectedProject) {
        setHistoryProjectId(selectedProject.id);
        await refreshTaskHistory(selectedProject.id);
      } else {
        await refreshTaskHistory("");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update task assignments right now.", "error");
    } finally {
      setSavingTask(false);
    }
  };

  const handleDeleteTask = async (task: GroupedTaskItem) => {
    if (!window.confirm(`Delete task ${task.title}${task.assignedToIds.length > 0 ? " and all its assignments" : ""}?`)) {
      return;
    }

    try {
      await Promise.all(task.memberTaskIds.map(async (taskId) => taskService.deleteTask(taskId)));
      await refreshTaskHistory(historyProjectId);
      showToast("Task deleted successfully.", "success");
    } catch {
      showToast("Unable to delete task right now.", "error");
    }
  };

  const handleDeleteAssignment = async (task: GroupedTaskItem) => {
    const assigneeSummary =
      task.assignedToNames.length > 0 ? task.assignedToNames.join(", ") : `${task.assignmentTaskIds.length} assigned team member(s)`;

    if (!window.confirm(`Remove all assignments for ${task.title} from ${assigneeSummary}?`)) {
      return;
    }

    try {
      await Promise.all(task.assignmentTaskIds.map(async (taskId) => taskService.deleteTask(taskId)));
      await refreshTaskHistory(historyProjectId);
      showToast("Task assignment removed successfully.", "success");
    } catch {
      showToast("Unable to remove task assignment right now.", "error");
    }
  };

  const handleManageViewedAssignment = () => {
    if (!viewAssignmentTask) {
      return;
    }

    const task = viewAssignmentTask;
    setViewAssignmentTask(null);
    openAssignTaskPanel(task.projectId, task);
  };

  if (projectsLoading || employeesLoading) {
    return <LoadingSpinner label="Loading task workbench..." />;
  }

  const taskListHeading = historyProjectId ? "Project task list" : "Task list";
  const assignmentListHeading = historyProjectId ? "Project assignment list" : "Assignment list";
  const taskListEmptyMessage =
    taskHistorySearch.trim() || taskAssignmentFilter !== "all"
      ? "No tasks match the current filters."
      : "No tasks created yet.";
  const remainingHours = selectedTaskForAssignment
    ? Math.max(0, Number(selectedTaskForAssignment.totalHours || 0) - Number(selectedTaskForAssignment.assignedHours || 0))
    : 0;
  const assigningExistingTask = Boolean(selectedTaskForAssignment?.assignedToIds.length);

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-5">
        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-5 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Task Module</p>
              <h2 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">Task management</h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Create task master records first, then assign them separately to project members when you are ready.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openCreateTaskPanel("")}
                className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Standalone Task
              </button>
              <button
                type="button"
                onClick={() => openCreateTaskPanel(selectedProjectId)}
                className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Create Task
              </button>
              <button
                type="button"
                onClick={() => openAssignTaskPanel(selectedProjectId)}
                className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
              >
                Assign Task
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <select
              value={historyProjectId}
              onChange={(event) => setHistoryProjectId(event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            <select
              value={taskAssignmentFilter}
              onChange={(event) => setTaskAssignmentFilter(event.target.value as TaskAssignmentFilter)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
            >
              <option value="all">All tasks</option>
              <option value="assigned">Assigned tasks</option>
              <option value="unassigned">Unassigned tasks</option>
            </select>

            <input
              value={taskHistorySearch}
              onChange={(event) => setTaskHistorySearch(event.target.value)}
              placeholder="Search tasks or assignments"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-200 md:col-span-2"
            />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{taskListHeading}</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Task master records can stay unassigned until the team is ready.</p>
          </div>

          <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-black/90">
                <tr>
                  {["Task Code", "Task Name", "Project", "Planned Days", "Total Hours", "Start Date", "Due Date", "Assignment Status", "Task Status", "Actions"].map((header) => (
                    <th
                      key={header}
                      className={classNames(
                        "px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400",
                        header === "Actions" ? "text-right" : "text-left",
                      )}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {historyLoading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Loading tasks...
                    </td>
                  </tr>
                ) : filteredTaskList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      {taskListEmptyMessage}
                    </td>
                  </tr>
                ) : (
                  filteredTaskList.map((task) => {
                    const status = normalizeTaskStatus(task.status);

                    return (
                      <tr key={task.id} className="align-top">
                        <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{task.taskCode || "Auto"}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-zinc-900 dark:text-white">{task.title}</p>
                          {task.workBreakdown ? <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{task.workBreakdown}</p> : null}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{task.projectName || "N/A"}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{task.plannedDays || 1}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{task.estimatedHours ?? task.totalHours}</td>
                        <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatDate(task.startDate)}</td>
                        <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatDate(task.endDate)}</td>
                        <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                          <p className="font-semibold text-zinc-900 dark:text-white">{task.assignmentStatus}</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {task.assignedToNames.length > 0 ? task.assignedToNames.join(", ") : "No owners yet"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${taskStatusClasses[status]}`}>{status}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openCreateTaskPanel(task.projectId, task)}
                              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                              Edit Task
                            </button>
                            <button
                              type="button"
                              onClick={() => openAssignTaskPanel(task.projectId, task)}
                              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                              Assign
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteTask(task)}
                              className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{assignmentListHeading}</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Assignments can be updated later without changing the task master definition.</p>
          </div>

          <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-black/90">
                <tr>
                  {["Task Name", "Project", "Assigned To", "Assigned Days", "Assigned Hours", "Start Date", "Due Date", "Assignment Status", "Actions"].map((header) => (
                    <th
                      key={header}
                      className={classNames(
                        "px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400",
                        header === "Actions" ? "text-right" : "text-left",
                      )}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {historyLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Loading assignments...
                    </td>
                  </tr>
                ) : filteredAssignmentList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      {taskHistorySearch.trim() ? "No assignments match your search." : "No task assignments yet."}
                    </td>
                  </tr>
                ) : (
                  filteredAssignmentList.map((task) => {
                    const status = normalizeTaskStatus(task.status);

                    return (
                      <tr key={task.id} className="align-top">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-zinc-900 dark:text-white">{task.title}</p>
                          {task.notes ? <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{task.notes}</p> : null}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{task.projectName || "N/A"}</td>
                        <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                          <p>{task.assignedToNames.length > 0 ? task.assignedToNames.join(", ") : "Assigned employee"}</p>
                          {task.assignedToNames.length > 1 ? (
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{task.assignedToNames.length} assigned users</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{task.assignedDaysTotal || 1}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{task.assignedHours || task.totalHours}</td>
                        <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatDate(task.startDate)}</td>
                        <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatDate(task.endDate)}</td>
                        <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{task.assignmentStatus || status}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setViewAssignmentTask(task)}
                              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => openAssignTaskPanel(task.projectId, task)}
                              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                              Manage
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteAssignment(task)}
                              className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {viewAssignmentTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={closeViewAssignmentModal}>
          <div
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-panel dark:border-zinc-800 dark:bg-black"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:px-8">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Assignment View</p>
                <h3 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{viewAssignmentTask.title}</h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {viewAssignmentTask.projectName || "No project selected"} with {viewAssignmentTask.assignedToIds.length} assigned user(s)
                </p>
              </div>
              <button
                type="button"
                onClick={closeViewAssignmentModal}
                className="rounded-2xl border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Assignment Status", value: viewAssignmentTask.assignmentStatus },
                  { label: "Assigned Users", value: String(viewAssignmentTask.assignedToIds.length) },
                  { label: "Assigned Days", value: String(viewAssignmentTask.assignedDaysTotal || 0) },
                  { label: "Assigned Hours", value: String(viewAssignmentTask.assignedHours || 0) },
                ].map((item) => (
                  <div key={item.label} className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{item.label}</p>
                    <p className="mt-3 text-2xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-6 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Task Overview</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Project</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{formatText(viewAssignmentTask.projectName, "N/A")}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Task Status</p>
                      <div className="mt-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${taskStatusClasses[normalizeTaskStatus(viewAssignmentTask.status)]}`}>
                          {normalizeTaskStatus(viewAssignmentTask.status)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Start Date</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{formatDate(viewAssignmentTask.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Due Date</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{formatDate(viewAssignmentTask.endDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Planned Hours</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{viewAssignmentTask.totalHours || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Remaining Hours</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{viewAssignmentTask.remainingHours || 0}</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Description</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{formatText(viewAssignmentTask.description, "No description added.")}</p>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Work Breakdown</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{formatText(viewAssignmentTask.workBreakdown, "No work breakdown added.")}</p>
                  </div>
                </div>

                <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-6 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Assigned Users</p>
                  <div className="mt-5 space-y-4">
                    {viewAssignmentTask.assignedToNames.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">No users are assigned to this task yet.</p>
                    ) : (
                      viewAssignmentTask.assignedToNames.map((name) => (
                        <div key={name} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-black/40">
                          <p className="font-semibold text-zinc-900 dark:text-white">{name}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
                <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
                  <h4 className="text-lg font-bold text-zinc-900 dark:text-white">Assignment Breakdown</h4>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Read-only details for each assigned team member on this task.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-black/60">
                      <tr>
                        {["Assigned User", "Assigned Days", "Assigned Hours", "Start Date", "Due Date", "Role In Task", "Expected Deliverable", "Notes"].map((header) => (
                          <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {viewedAssignmentMembers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            No assignment details available yet.
                          </td>
                        </tr>
                      ) : (
                        viewedAssignmentMembers.map((member) => (
                          <tr key={member.id} className="align-top">
                            <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{formatText(member.assignedToName, "Assigned employee")}</td>
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{member.assignedDays || 0}</td>
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{member.assignedHours ?? member.totalHours ?? 0}</td>
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatDate(member.startDate)}</td>
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatDate(member.endDate)}</td>
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatText(member.roleInTask)}</td>
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatText(member.expectedDeliverable)}</td>
                            <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatText(member.notes)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:px-8">
              <button
                type="button"
                onClick={closeViewAssignmentModal}
                className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleManageViewedAssignment}
                className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
              >
                Manage Assignment
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <TaskActionModal
        open={taskPanelOpen}
        mode={taskPanelMode}
        initialProjectId={selectedProjectId}
        initialTaskGroupId={selectedTaskGroupId}
        projects={projects}
        employees={employees}
        allTaskHistory={allTaskHistory}
        showToast={showToast}
        onClose={closeTaskPanel}
        onSaved={async (projectId) => {
          closeTaskPanel();
          setHistoryProjectId(projectId);
          await refreshTaskHistory(projectId);
        }}
      />
    </>
  );
};
