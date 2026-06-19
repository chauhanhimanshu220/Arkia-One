import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { ProjectDeleteDialog } from "../../components/projects/ProjectDeleteDialog";
import { ProjectModal } from "../../components/projects/ProjectModal";
import { TaskActionModal } from "../../components/tasks/TaskActionModal";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useDepartments } from "../../hooks/useDepartments";
import { useEmployees } from "../../hooks/useEmployees";
import { useProjects } from "../../hooks/useProjects";
import { useToast } from "../../hooks/useToast";
import { isGuid } from "../../services/http";
import { taskService } from "../../services/taskService";
import type { Project, ProjectPriority, ProjectStatus } from "../../types/project";
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

const ITEMS_PER_PAGE = 8;
const NEAR_END_DAYS = 14;
type BillableFilter = "All" | "Billable" | "Internal";
type DetailTab = "Overview" | "Team Members" | "Tasks" | "Subtasks" | "Time & Utilization" | "Settings" | "History";
type TaskPanelMode = "create" | "assign";

const detailTabs: DetailTab[] = ["Overview", "Team Members", "Tasks", "Subtasks", "Time & Utilization", "Settings", "History"];
const statusOptions: Array<ProjectStatus | "All"> = ["All", "Active", "Pending", "On Hold", "Completed"];
const priorityOptions: Array<ProjectPriority | "All"> = ["All", "Critical", "High", "Medium", "Low"];
const monochromeBadgeClass = "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-100";

const statusClasses: Record<ProjectStatus, string> = {
  Active: monochromeBadgeClass,
  Completed: monochromeBadgeClass,
  Pending: monochromeBadgeClass,
  "On Hold": monochromeBadgeClass,
};

const priorityClasses: Record<ProjectPriority, string> = {
  Low: monochromeBadgeClass,
  Medium: monochromeBadgeClass,
  High: monochromeBadgeClass,
  Critical: monochromeBadgeClass,
};

const taskStatusClasses: Record<TaskStatus, string> = {
  "To Do": monochromeBadgeClass,
  Planned: monochromeBadgeClass,
  "In Progress": monochromeBadgeClass,
  "On Hold": monochromeBadgeClass,
  Completed: monochromeBadgeClass,
};

const currencyFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat("en-IN");

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

const formatDate = (value: string) => {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const parseDateUtc = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
};

const businessDays = (startDate: string, endDate: string) => {
  const start = parseDateUtc(startDate);
  const end = parseDateUtc(endDate);
  if (!start || !end || end < start) return 1;
  let total = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) total += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Math.max(1, total);
};

const daysUntilEnd = (project: Project) => {
  const end = parseDateUtc(project.endDate);
  if (!end) return null;
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
};

const plannedHours = (project: Project) => Math.max(1, project.teamSize || 1) * businessDays(project.startDate, project.endDate) * TASK_HOURS_PER_DAY;

const taskHoursForProject = (projectId: string, tasks: TaskItem[]) =>
  tasks.filter((task) => task.projectId === projectId).reduce((total, task) => total + Number(task.totalHours || 0), 0);

const percent = (used: number, planned: number) => (planned <= 0 ? 0 : Math.min(100, Math.round((used / planned) * 100)));

const billableType = (project: Project): BillableFilter =>
  project.isBillable ? "Billable" : "Internal";

const billableLabel = (project: Project) =>
  project.isBillable ? "Billable (Client)" : "Non-Billable (Internal)";

const taskTemplates = [
  ["Development Project", ["Requirement Analysis", "UI Design", "API Development", "Frontend Development", "Testing", "Deployment"]],
  ["Marketing Project", ["Research", "Content Planning", "Design Assets", "Campaign Setup", "Review"]],
  ["Support Project", ["Ticket Triage", "Root Cause Analysis", "Fix Validation", "Client Update", "Closure"]],
] as const;

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

export const ProjectManagementPage = () => {
  const navigate = useNavigate();
  const { projects, loading: projectsLoading, addProject, updateProject, deleteProject } = useProjects();
  const { employees, loading: employeesLoading, reload: reloadEmployees } = useEmployees();
  const { departments, loading: departmentsLoading } = useDepartments();
  const { toasts, showToast, dismissToast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "All">("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [billableFilter, setBillableFilter] = useState<BillableFilter>("All");
  const [priorityFilter, setPriorityFilter] = useState<ProjectPriority | "All">("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("Overview");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [taskPanelMode, setTaskPanelMode] = useState<TaskPanelMode>("create");
  const [assignProjectId, setAssignProjectId] = useState("");
  const [selectedTaskGroupId, setSelectedTaskGroupId] = useState("");
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("To Do");
  const [assignDate, setAssignDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignEndDate, setAssignEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [taskTotalHours, setTaskTotalHours] = useState(TASK_HOURS_PER_DAY);
  const [editingTaskIds, setEditingTaskIds] = useState<string[]>([]);
  const [editingTaskGroupId, setEditingTaskGroupId] = useState<string | null>(null);
  const [assigningTask, setAssigningTask] = useState(false);
  const [taskHistory, setTaskHistory] = useState<TaskItem[]>([]);
  const [allTaskHistory, setAllTaskHistory] = useState<TaskItem[]>([]);
  const [historyProjectId, setHistoryProjectId] = useState("");
  const [taskHistorySearch, setTaskHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);

  useBodyScrollLock(Boolean(detailProject) || taskPanelOpen);

  const activeDetailProject = useMemo(
    () => (detailProject ? projects.find((project) => project.id === detailProject.id) ?? detailProject : null),
    [detailProject, projects],
  );

  const projectDepartments = useMemo(
    () =>
      Array.from(
        new Set([
          ...departments.filter((department) => department.status === "Active").map((department) => department.name),
          ...projects.map((project) => project.department),
        ]),
      ).sort((left, right) => left.localeCompare(right)),
    [departments, projects],
  );

  const filteredProjects = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return projects.filter((project) => {
      const text = [project.name, project.code, project.clientBusinessUnit, project.department, project.managerName, project.projectLead, project.deliveryModel, billableLabel(project)]
        .join(" ")
        .toLowerCase();
      return (
        (!query || text.includes(query)) &&
        (statusFilter === "All" || project.status === statusFilter) &&
        (departmentFilter === "All" || project.department === departmentFilter) &&
        (billableFilter === "All" || billableType(project) === billableFilter) &&
        (priorityFilter === "All" || project.priority === priorityFilter)
      );
    });
  }, [billableFilter, departmentFilter, priorityFilter, projects, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const nearEnd = projects.filter((project) => {
      const days = daysUntilEnd(project);
      return project.status !== "Completed" && days !== null && days >= 0 && days <= NEAR_END_DAYS;
    }).length;

    return {
      total: projects.length,
      active: projects.filter((project) => project.status === "Active").length,
      completed: projects.filter((project) => project.status === "Completed").length,
      onHold: projects.filter((project) => project.status === "On Hold").length,
      billable: projects.filter((project) => billableType(project) === "Billable").length,
      withoutManager: projects.filter((project) => !project.managerId || project.managerName === "Unassigned").length,
      nearEnd,
    };
  }, [projects]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginatedProjects = filteredProjects.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const selectedAssignmentProject = useMemo(() => projects.find((project) => project.id === assignProjectId) ?? null, [assignProjectId, projects]);

  const assignmentEmployees = useMemo(() => {
    if (!selectedAssignmentProject) return employees.filter((employee) => employee.status === "Active");
    return employees.filter(
      (employee) =>
        employee.status === "Active" &&
        (selectedAssignmentProject.teamMemberIds.includes(employee.id) || selectedAssignmentProject.managerId === employee.id),
    );
  }, [employees, selectedAssignmentProject]);

  const filteredAssignmentEmployees = useMemo(() => {
    const query = assignSearch.trim().toLowerCase();
    return assignmentEmployees.filter((employee) => !query || `${employee.fullName} ${employee.email} ${employee.role}`.toLowerCase().includes(query));
  }, [assignSearch, assignmentEmployees]);

  const groupedTaskHistory = useMemo(() => groupTasks(taskHistory), [taskHistory]);
  const groupedAllTaskHistory = useMemo(() => groupTasks(allTaskHistory), [allTaskHistory]);
  const availableTasksForAssignment = useMemo(
    () => groupedAllTaskHistory.filter((task) => !assignProjectId || task.projectId === assignProjectId),
    [assignProjectId, groupedAllTaskHistory],
  );
  const selectedTaskForAssignment = useMemo(
    () =>
      availableTasksForAssignment.find((task) => task.taskGroupId === selectedTaskGroupId || task.id === selectedTaskGroupId) ??
      groupedAllTaskHistory.find((task) => task.taskGroupId === selectedTaskGroupId || task.id === selectedTaskGroupId) ??
      null,
    [availableTasksForAssignment, groupedAllTaskHistory, selectedTaskGroupId],
  );

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

  const filteredTaskHistory = useMemo(() => {
    const query = taskHistorySearch.trim().toLowerCase();
    return groupedTaskHistory.filter((task) => {
      const text = [task.title, task.description, task.projectName, task.assignedToName, task.status, task.startDate, task.endDate].join(" ").toLowerCase();
      return !query || text.includes(query);
    });
  }, [groupedTaskHistory, taskHistorySearch]);

  const remainingHours = selectedTaskForAssignment
    ? Math.max(0, Number(selectedTaskForAssignment.totalHours || 0) - Number(selectedTaskForAssignment.assignedHours || 0))
    : 0;
  const assigningExistingTask = Boolean(selectedTaskForAssignment?.assignedToIds.length);

  useEffect(() => {
    if (projects.length > 0 && (!assignProjectId || !projects.some((project) => project.id === assignProjectId))) {
      setAssignProjectId(projects[0].id);
    }
  }, [assignProjectId, projects]);

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
    if (taskPanelMode !== "assign" || !taskPanelOpen) {
      return;
    }

    if (availableTasksForAssignment.length === 0) {
      if (selectedTaskGroupId) {
        setEditingTaskIds([]);
        setEditingTaskGroupId(null);
        setSelectedTaskGroupId("");
        setAssignUserIds([]);
        setTaskTitle("");
        setTaskDescription("");
        setTaskStatus("To Do");
        setAssignDate(new Date().toISOString().slice(0, 10));
        setAssignEndDate(new Date().toISOString().slice(0, 10));
        setTaskTotalHours(TASK_HOURS_PER_DAY);
      }
      return;
    }

    const stillExists = availableTasksForAssignment.some((task) => task.taskGroupId === selectedTaskGroupId || task.id === selectedTaskGroupId);
    if (!selectedTaskGroupId || !stillExists) {
      const nextTask = availableTasksForAssignment[0] ?? null;
      setEditingTaskIds(nextTask?.assignmentTaskIds ?? []);
      setEditingTaskGroupId(nextTask?.taskGroupId ?? null);
      setSelectedTaskGroupId(nextTask?.taskGroupId ?? "");
      setAssignUserIds(nextTask?.assignedToIds ?? []);
      setTaskTitle(nextTask?.title ?? "");
      setTaskDescription(nextTask?.description ?? "");
      setTaskStatus(nextTask ? normalizeTaskStatus(nextTask.status) : "To Do");
      setAssignDate(nextTask?.startDate ?? new Date().toISOString().slice(0, 10));
      setAssignEndDate(nextTask?.endDate ?? nextTask?.startDate ?? new Date().toISOString().slice(0, 10));
      setTaskTotalHours(nextTask ? Number(nextTask.totalHours || 0) || TASK_HOURS_PER_DAY : TASK_HOURS_PER_DAY);
    }
  }, [availableTasksForAssignment, selectedTaskGroupId, taskPanelMode, taskPanelOpen]);

  const refreshTaskHistory = async (projectId: string) => {
    const { visibleHistory, completeHistory } = await getTaskHistorySets(projectId);
    setTaskHistory(visibleHistory);
    setAllTaskHistory(completeHistory);
  };

  const resetTaskForm = () => {
    setAssignUserIds([]);
    setAssignSearch("");
    setAssignPickerOpen(false);
    setSelectedTaskGroupId("");
    setTaskTitle("");
    setTaskDescription("");
    setTaskStatus("To Do");
    setAssignDate(new Date().toISOString().slice(0, 10));
    setAssignEndDate(new Date().toISOString().slice(0, 10));
    setTaskTotalHours(TASK_HOURS_PER_DAY);
    setEditingTaskIds([]);
    setEditingTaskGroupId(null);
  };

  const closeTaskPanel = () => {
    setTaskPanelOpen(false);
    resetTaskForm();
  };

  const fillCreateForm = (task: GroupedTaskItem | null) => {
    setEditingTaskIds(task?.memberTaskIds ?? []);
    setEditingTaskGroupId(task?.taskGroupId ?? null);
    setSelectedTaskGroupId(task?.taskGroupId ?? "");
    setAssignUserIds([]);
    setTaskTitle(task?.title ?? "");
    setTaskDescription(task?.description ?? "");
    setTaskStatus(task ? normalizeTaskStatus(task.status) : "To Do");
    setAssignDate(task?.startDate ?? new Date().toISOString().slice(0, 10));
    setAssignEndDate(task?.endDate ?? task?.startDate ?? new Date().toISOString().slice(0, 10));
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
    setAssignDate(task?.startDate ?? new Date().toISOString().slice(0, 10));
    setAssignEndDate(task?.endDate ?? task?.startDate ?? new Date().toISOString().slice(0, 10));
    setTaskTotalHours(task ? Number(task.totalHours || 0) || TASK_HOURS_PER_DAY : TASK_HOURS_PER_DAY);
  };

  const openCreateTaskPanel = (projectId?: string, task?: GroupedTaskItem | null) => {
    const resolvedProjectId = projectId ?? task?.projectId ?? assignProjectId ?? projects[0]?.id ?? "";
    if (resolvedProjectId) {
      setAssignProjectId(resolvedProjectId);
      setHistoryProjectId(resolvedProjectId);
    }
    setTaskPanelMode("create");
    setTaskPanelOpen(true);
    setAssignPickerOpen(false);
    fillCreateForm(task ?? null);
  };

  const openAssignTaskPanel = (projectId?: string, task?: GroupedTaskItem | null) => {
    const resolvedProjectId = projectId ?? task?.projectId ?? assignProjectId ?? projects[0]?.id ?? "";
    if (resolvedProjectId) {
      setAssignProjectId(resolvedProjectId);
      setHistoryProjectId(resolvedProjectId);
    }
    setTaskPanelMode("assign");
    setTaskPanelOpen(true);
    setAssignPickerOpen(false);
    fillAssignForm(task ?? null);
  };

  const handleSave = async (values: {
    name: string;
    code: string;
    description: string;
    clientBusinessUnit: string;
    department: string;
    deliveryModel: string;
    managerId: string;
    teamMemberIds: string[];
    budget: string;
    isBillable: boolean;
    priority: ProjectPriority;
    startDate: string;
    endDate: string;
    status: ProjectStatus;
  }) => {
    const manager = employees.find((employee) => employee.id === values.managerId);
    const teamMembers = employees.filter((employee) => values.teamMemberIds.includes(employee.id));
    const payload = {
      ...values,
      managerName: manager?.fullName ?? "Unassigned",
      projectLead: manager?.fullName ?? "Unassigned",
      deliveryModel: values.deliveryModel || "Dedicated Squad",
      teamMemberNames: teamMembers.map((employee) => employee.fullName),
      teamSize: teamMembers.length,
      budget: Number(values.budget),
    };

    setSaving(true);
    try {
      if (selectedProject) {
        await updateProject(selectedProject.id, payload);
        await reloadEmployees();
        showToast("Project updated successfully.", "success");
      } else {
        await addProject(payload);
        await reloadEmployees();
        showToast("Project created successfully.", "success");
      }
      setSelectedProject(null);
      setModalOpen(false);
      setCurrentPage(1);
    } catch {
      showToast("Unable to save the project right now.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProject(deleteTarget.id);
      await reloadEmployees();
      setDeleteTarget(null);
      showToast("Project deleted successfully.", "success");
    } catch {
      showToast("Unable to delete project right now.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateTask = async () => {
    if (!selectedAssignmentProject) {
      showToast("Select a project first.", "info");
      return;
    }
    if (!taskTitle.trim()) {
      showToast("Task name is required.", "error");
      return;
    }
    if (assignUserIds.length === 0) {
      showToast("Select at least one task owner.", "error");
      return;
    }
    if (!Number.isFinite(taskTotalHours) || Number(taskTotalHours) <= 0) {
      showToast("Estimated hours must be greater than zero.", "error");
      return;
    }
    if (!isGuid(selectedAssignmentProject.id)) {
      showToast("Selected project is invalid.", "error");
      return;
    }

    const taskGroupId = editingTaskGroupId ?? createTaskGroupId();
    const payload = {
      taskGroupId,
      projectId: selectedAssignmentProject.id,
      projectName: selectedAssignmentProject.name,
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      totalHours: Number(taskTotalHours),
      status: taskStatus,
    };

    setAssigningTask(true);
    try {
      if (editingTaskIds.length > 0) {
        await Promise.all(editingTaskIds.map(async (taskId) => taskService.updateTaskDetails(taskId, payload)));
        showToast("Task details updated successfully.", "success");
      } else {
        await taskService.createTask(payload);
        showToast("Task created successfully.", "success");
      }

      closeTaskPanel();
      setHistoryProjectId(selectedAssignmentProject.id);
      await refreshTaskHistory(selectedAssignmentProject.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save task details right now.", "error");
    } finally {
      setAssigningTask(false);
    }
  };

  const handleAssignTask = async () => {
    if (!selectedAssignmentProject) {
      showToast("Select a project first.", "info");
      return;
    }
    if (!selectedTaskForAssignment) {
      showToast("Select an existing task first.", "error");
      return;
    }
    if (assignUserIds.length === 0) {
      showToast("Select at least one task owner.", "error");
      return;
    }
    if (assignEndDate < assignDate) {
      showToast("Due date cannot be before start date.", "error");
      return;
    }
    if (!Number.isFinite(taskTotalHours) || Number(taskTotalHours) <= 0) {
      showToast("Assigned hours must be greater than zero.", "error");
      return;
    }
    if (!isGuid(selectedAssignmentProject.id) || assignUserIds.some((id) => !isGuid(id))) {
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

    setAssigningTask(true);
    try {
      await Promise.all([
        ...retainedEmployees.map(async (employee) => {
          const task = existingTasksByEmployeeId.get(employee.id);
          if (!task) {
            return;
          }

          await taskService.updateTask(task.id, {
            taskGroupId: selectedTaskForAssignment.taskGroupId,
            projectId: selectedAssignmentProject.id,
            projectName: selectedAssignmentProject.name,
            assignedTo: employee.id,
            assignedToName: employee.fullName,
            title: selectedTaskForAssignment.title,
            description: selectedTaskForAssignment.description,
            startDate: assignDate,
            endDate: assignEndDate,
            totalHours: Number(taskTotalHours),
            status: taskStatus,
          });
        }),
        ...newEmployees.map(async (employee) =>
          taskService.assignTask({
            taskGroupId: selectedTaskForAssignment.taskGroupId,
            projectId: selectedAssignmentProject.id,
            projectName: selectedAssignmentProject.name,
            assignedTo: employee.id,
            assignedToName: employee.fullName,
            title: selectedTaskForAssignment.title,
            description: selectedTaskForAssignment.description,
            startDate: assignDate,
            endDate: assignEndDate,
            totalHours: Number(taskTotalHours),
            status: taskStatus,
          })),
        ...removedAssignments.map(async (task) => taskService.deleteTask(task.id)),
      ]);

      showToast(existingAssignments.length > 0 ? "Task assignments updated successfully." : "Task assigned successfully.", "success");
      closeTaskPanel();
      setHistoryProjectId(selectedAssignmentProject.id);
      await refreshTaskHistory(selectedAssignmentProject.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update task assignments right now.", "error");
    } finally {
      setAssigningTask(false);
    }
  };

  const handleDeleteTask = async (task: GroupedTaskItem) => {
    if (!window.confirm(`Delete task ${task.title}${task.assignedToIds.length > 0 ? " and all its assignments" : ""}?`)) return;
    try {
      await Promise.all(task.memberTaskIds.map(async (taskId) => taskService.deleteTask(taskId)));
      await refreshTaskHistory(historyProjectId);
      showToast("Task deleted successfully.", "success");
    } catch {
      showToast("Unable to delete task right now.", "error");
    }
  };

  const handleExport = () => {
    const headers = ["Project Name", "Project Code", "Client / Internal", "Department", "Manager", "Team Size", "Start", "End", "Billable", "Priority", "Status", "Budget", "Planned Hours", "Assigned Task Hours"];
    const rows = filteredProjects.map((project) => [
      project.name,
      project.code,
      project.clientBusinessUnit || (project.isBillable ? "Client" : "Internal"),
      project.department,
      project.managerName,
      String(project.teamSize),
      project.startDate,
      project.endDate,
      billableLabel(project),
      project.priority,
      project.status,
      project.budget.toFixed(2),
      String(plannedHours(project)),
      String(taskHoursForProject(project.id, groupedAllTaskHistory)),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "project-management-master.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Project master records exported as CSV.", "info");
  };

  const openTaskWorkbench = (mode: "create" | "assign", projectId?: string, taskGroupId?: string) => {
    const task =
      taskGroupId
        ? groupedAllTaskHistory.find((item) => item.taskGroupId === taskGroupId || item.id === taskGroupId) ?? null
        : null;

    if (mode === "create") {
      openCreateTaskPanel(projectId, task);
      return;
    }

    openAssignTaskPanel(projectId, task);
  };

  const anyLoading = projectsLoading || employeesLoading || departmentsLoading;
  const detailTasks = activeDetailProject ? groupedAllTaskHistory.filter((task) => task.projectId === activeDetailProject.id) : [];
  const detailAssignedHours = activeDetailProject ? taskHoursForProject(activeDetailProject.id, groupedAllTaskHistory) : 0;
  const detailPlannedHours = activeDetailProject ? plannedHours(activeDetailProject) : 0;

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <section className="space-y-6">
        <div className="workspace-hero rounded-[2rem] p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">Project Management</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => showToast("Import entry point is ready for a future bulk upload API.", "info")} className="glass-button rounded-2xl px-5 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-100">Import</button>
              <button type="button" onClick={handleExport} className="glass-button rounded-2xl px-5 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-100">Export</button>
              <button type="button" onClick={() => navigate("/admin/admin/project-tasks")} className="glass-button rounded-2xl px-5 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-100">Manage Tasks</button>
              <button type="button" onClick={() => { setSelectedProject(null); setModalOpen(true); }} className="glass-button rounded-2xl px-5 py-3 text-sm font-semibold text-zinc-900 dark:text-white">Add Project</button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <StatCard label="Total Projects" value={stats.total} subtitle="Master records" accent="bg-white/20" />
          <StatCard label="Active" value={stats.active} subtitle="Open for work" accent="bg-white/20" />
          <StatCard label="Completed" value={stats.completed} subtitle="Closed delivery" accent="bg-white/20" />
          <StatCard label="On Hold" value={stats.onHold} subtitle="Paused work" accent="bg-white/20" />
          <StatCard label="Billable" value={stats.billable} subtitle="Client visible" accent="bg-white/20" />
          <StatCard label="No Manager" value={stats.withoutManager} subtitle="Needs owner" accent="bg-white/20" />
          <StatCard label="Near End" value={stats.nearEnd} subtitle={`Next ${NEAR_END_DAYS} days`} accent="bg-white/20" />
        </div>

        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-5 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_180px_220px_180px_180px_auto]">
            <label className="glass-input flex items-center gap-3 rounded-2xl px-4 py-3">
              <Icon name="search" className="h-4 w-4 text-zinc-400" />
              <input value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setCurrentPage(1); }} placeholder="Search by project, code, manager, client, department" className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200" />
            </label>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as ProjectStatus | "All"); setCurrentPage(1); }} className="glass-input rounded-2xl px-4 py-3 text-sm text-zinc-700 outline-none dark:text-zinc-200">
              {statusOptions.map((status) => <option key={status} value={status}>{status === "All" ? "All statuses" : status}</option>)}
            </select>
            <select value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setCurrentPage(1); }} className="glass-input rounded-2xl px-4 py-3 text-sm text-zinc-700 outline-none dark:text-zinc-200">
              <option value="All">All departments</option>
              {projectDepartments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            <select value={billableFilter} onChange={(event) => { setBillableFilter(event.target.value as BillableFilter); setCurrentPage(1); }} className="glass-input rounded-2xl px-4 py-3 text-sm text-zinc-700 outline-none dark:text-zinc-200">
              <option value="All">All</option>
              <option value="Billable">Billable (Client)</option>
              <option value="Internal">Non-Billable (Internal)</option>
            </select>
            <select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value as ProjectPriority | "All"); setCurrentPage(1); }} className="glass-input rounded-2xl px-4 py-3 text-sm text-zinc-700 outline-none dark:text-zinc-200">
              {priorityOptions.map((priority) => <option key={priority} value={priority}>{priority === "All" ? "All priorities" : priority}</option>)}
            </select>
            <button type="button" onClick={() => { setSearchTerm(""); setStatusFilter("All"); setDepartmentFilter("All"); setBillableFilter("All"); setPriorityFilter("All"); setCurrentPage(1); }} className="glass-button rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-100">Reset</button>
          </div>
        </div>

        {anyLoading ? (
          <LoadingSpinner label="Loading project management workspace..." />
        ) : (
          <div className="space-y-5">
            <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{filteredProjects.length} projects</h3>
                </div>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">No projects match the current filters.</div>
              ) : (
                <div className="space-y-3 p-4">
                  {paginatedProjects.map((project) => {
                    const plan = plannedHours(project);
                    const assigned = taskHoursForProject(project.id, groupedAllTaskHistory);
                    const usage = percent(assigned, plan);
                    const days = daysUntilEnd(project);
                    const teamPreview = project.teamMemberNames.slice(0, 3);
                    const extraTeamCount = Math.max(0, project.teamMemberNames.length - teamPreview.length);

                    return (
                      <div
                        key={project.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setDetailProject(project);
                          setDetailTab("Overview");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setDetailProject(project);
                            setDetailTab("Overview");
                          }
                        }}
                        className="w-full cursor-pointer rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-3 text-left transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50"
                      >
                        <div className="grid gap-2 xl:grid-cols-[minmax(240px,1.2fr)_minmax(140px,0.68fr)_minmax(180px,0.82fr)_minmax(170px,0.78fr)_minmax(180px,0.72fr)] xl:items-start">
                          <div className="min-w-0">
                            <p className="truncate text-[1.1rem] font-bold tracking-tight text-zinc-900 dark:text-white">{project.name}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                              <span>{project.code}</span>
                              <span className="text-zinc-300 dark:text-zinc-600">/</span>
                              <span>{project.clientBusinessUnit || (project.isBillable ? "Client Project" : "Internal Project")}</span>
                            </div>
                          </div>

                          <div className="min-w-0 rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-2.5 py-1.5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">Ownership</p>
                            <p className="mt-0.5 truncate font-semibold text-zinc-900 dark:text-white">{project.managerName || "Unassigned"}</p>
                            <p className="truncate text-zinc-500 dark:text-zinc-400">{project.department}</p>
                          </div>

                          <div className="min-w-0 rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-2.5 py-1.5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">Team</p>
                            <p className="mt-0.5 font-semibold text-zinc-900 dark:text-white">{project.teamSize} members</p>
                            <p className="truncate text-zinc-500 dark:text-zinc-400">
                              {teamPreview.join(", ") || "No team mapped"}
                              {extraTeamCount > 0 ? ` +${extraTeamCount} more` : ""}
                            </p>
                          </div>

                          <div className="min-w-0 rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-2.5 py-1.5 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">Timeline</p>
                            <p className="mt-0.5 truncate font-semibold text-zinc-900 dark:text-white">{formatDate(project.startDate)} to {formatDate(project.endDate)}</p>
                            <p className={classNames("truncate", days !== null && days >= 0 && days <= NEAR_END_DAYS ? "text-zinc-700 dark:text-zinc-200" : "text-zinc-500 dark:text-zinc-400")}>
                              {days === null ? "No end signal" : days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
                            </p>
                          </div>

                          <div className="flex flex-col gap-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">Quick Actions</p>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDetailProject(project);
                                  setDetailTab("Overview");
                                }}
                                className="rounded-xl border border-zinc-300 bg-white/75 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedProject(project);
                                  setModalOpen(true);
                                }}
                                className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTaskWorkbench("create", project.id);
                                }}
                                className="rounded-xl border border-zinc-300 bg-white/75 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                              >
                                Create Task
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTaskWorkbench("assign", project.id);
                                }}
                                className="rounded-xl border border-zinc-300 bg-white/75 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                              >
                                Assign Task
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDeleteTarget(project);
                                }}
                                className="rounded-xl border border-zinc-300 bg-white/75 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>

          </div>
        )}
        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-5 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">Task and assignment history</h3>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <select value={historyProjectId} onChange={(event) => setHistoryProjectId(event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
              <option value="">All projects</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <input value={taskHistorySearch} onChange={(event) => setTaskHistorySearch(event.target.value)} placeholder="Search tasks or assignments" className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-200 md:col-span-2" />
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="max-h-[460px] overflow-y-auto overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-black/90">
                <tr>{["Task / Subtask", "Project", "Owner", "Dates", "Hours", "Status", "Actions"].map((header) => <th key={header} className={classNames("px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400", header === "Actions" ? "text-right" : "text-left")}>{header}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {historyLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading task history...</td></tr>
                ) : filteredTaskHistory.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">{taskHistorySearch.trim() ? "No task records match your search." : "No task or assignment history yet."}</td></tr>
                ) : filteredTaskHistory.map((task) => {
                  const status = normalizeTaskStatus(task.status);
                  return (
                    <tr key={task.id} className="align-top">
                      <td className="px-4 py-4"><p className="font-semibold text-zinc-900 dark:text-white">{task.title}</p>{task.description ? <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{task.description}</p> : null}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{task.projectName || "N/A"}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                        <p>{task.assignedToName || "Unassigned"}</p>
                        {task.assignedToNames.length > 1 ? <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{task.assignedToNames.length} owners</p> : null}
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatDate(task.startDate)} - {formatDate(task.endDate)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{task.totalHours}</td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${taskStatusClasses[status]}`}>{status}</span></td>
                      <td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openTaskWorkbench(task.assignedToIds.length > 0 ? "assign" : "create", task.projectId, task.taskGroupId || task.id)} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900">Manage</button><button type="button" onClick={() => void handleDeleteTask(task)} className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10">Delete</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <ProjectModal
        open={modalOpen}
        project={selectedProject}
        projects={projects}
        departments={projectDepartments}
        employees={employees}
        loading={saving}
        onClose={() => {
          setModalOpen(false);
          setSelectedProject(null);
        }}
        onSubmit={handleSave}
      />
      <ProjectDeleteDialog project={deleteTarget} loading={deleting} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      {activeDetailProject ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 p-4 backdrop-blur-sm" onClick={() => setDetailProject(null)}>
          <div className="h-full w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white p-6 shadow-panel dark:border-zinc-800 dark:bg-black" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h3 className="text-3xl font-bold text-zinc-900 dark:text-white">{activeDetailProject.name}</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[activeDetailProject.status]}`}>{activeDetailProject.status}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityClasses[activeDetailProject.priority]}`}>{activeDetailProject.priority} Priority</span>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{billableLabel(activeDetailProject)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => { setSelectedProject(activeDetailProject); setModalOpen(true); }} className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900">Edit Project</button>
                <button type="button" onClick={() => setDetailProject(null)} className="rounded-2xl border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900" aria-label="Close project details"><Icon name="close" className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {detailTabs.map((tab) => <button key={tab} type="button" onClick={() => setDetailTab(tab)} className={classNames("rounded-2xl px-4 py-2 text-sm font-semibold transition", detailTab === tab ? "border border-zinc-300 bg-white/80 text-zinc-900 dark:border-white/10 dark:bg-white/10 dark:text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900")}>{tab}</button>)}
              </div>
            </div>

            <div className="mt-6">
              {detailTab === "Overview" ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  {[
                    ["Project identity", `Code: ${activeDetailProject.code}`, `Client/Internal: ${activeDetailProject.clientBusinessUnit || (activeDetailProject.isBillable ? "Client" : "Internal")}`, `Billability: ${billableLabel(activeDetailProject)}`, `Department: ${activeDetailProject.department}`, `Type: ${activeDetailProject.deliveryModel}`],
                    ["Ownership", `Manager: ${activeDetailProject.managerName || "Unassigned"}`, `Project Lead: ${activeDetailProject.projectLead || activeDetailProject.managerName}`, `Team Size: ${activeDetailProject.teamSize}`, `Budget: ${currencyFormatter.format(activeDetailProject.budget)}`],
                    ["Timeline", `Start: ${formatDate(activeDetailProject.startDate)}`, `End: ${formatDate(activeDetailProject.endDate)}`, `Business Days: ${businessDays(activeDetailProject.startDate, activeDetailProject.endDate)}`, `Progress: ${percent(detailAssignedHours, detailPlannedHours)}%`],
                  ].map(([title, ...lines]) => (
                    <div key={title} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-black/60">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
                      <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">{lines.map((line) => <p key={line}>{line}</p>)}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {detailTab === "Team Members" ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {activeDetailProject.teamMemberIds.length > 0 ? activeDetailProject.teamMemberIds.map((id, index) => {
                    const employee = employees.find((item) => item.id === id);
                    return (
                      <div key={id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-black/60">
                        <p className="font-semibold text-zinc-900 dark:text-white">{employee?.fullName ?? activeDetailProject.teamMemberNames[index] ?? "Team member"}</p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{employee?.role ?? "Project Contributor"} - {employee?.department ?? activeDetailProject.department}</p>
                      </div>
                    );
                  }) : <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400 md:col-span-2">No team members assigned yet.</div>}
                </div>
              ) : null}

              {detailTab === "Tasks" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        openTaskWorkbench("create", activeDetailProject.id);
                      }}
                      className="glass-button inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white"
                    >
                      <Icon name="plus" className="h-4 w-4" />
                      Create Task
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openTaskWorkbench("assign", activeDetailProject.id);
                      }}
                      className="glass-button inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white"
                    >
                      <Icon name="projects" className="h-4 w-4" />
                      Assign Task
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    {TASK_STATUSES.map((status) => <div key={status} className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-black/40"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${taskStatusClasses[status]}`}>{status}</span><p className="mt-4 text-3xl font-bold text-zinc-900 dark:text-white">{detailTasks.filter((task) => normalizeTaskStatus(task.status) === status).length}</p></div>)}
                  </div>
                  {detailTasks.length > 0 ? detailTasks.map((task) => (
                    <div key={task.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-black/60">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">{task.title}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {(task.assignedToName || "Unassigned")} - {formatDate(task.startDate)} to {formatDate(task.endDate)} - {task.totalHours} hrs
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openTaskWorkbench(task.assignedToIds.length > 0 ? "assign" : "create", task.projectId, task.taskGroupId || task.id)}
                          className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          Manage
                        </button>
                      </div>
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">No tasks created yet.</div>}
                </div>
              ) : null}

              {detailTab === "Subtasks" ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                  <div className="space-y-3">{detailTasks.length > 0 ? detailTasks.map((task) => <div key={task.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-black/60"><p className="font-semibold text-zinc-900 dark:text-white">{task.title}</p>{task.description ? <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{task.description}</p> : null}</div>) : <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">No subtasks.</div>}</div>
                  <div className="space-y-4">{taskTemplates.map(([name, tasks]) => <div key={name} className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-black/40"><p className="font-semibold text-zinc-900 dark:text-white">{name}</p><div className="mt-3 flex flex-wrap gap-2">{tasks.map((task) => <span key={task} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{task}</span>)}</div></div>)}</div>
                </div>
              ) : null}

              {detailTab === "Time & Utilization" ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  {[
                    ["Planned Hours", numberFormatter.format(detailPlannedHours), "Derived from team size, business days, and 9h/day."],
                    ["Assigned Task Hours", numberFormatter.format(detailAssignedHours), "Task estimates assigned from this page."],
                    ["Remaining Hours", numberFormatter.format(Math.max(0, detailPlannedHours - detailAssignedHours)), `${billableLabel(activeDetailProject)} project time structure.`],
                  ].map(([title, value]) => <div key={title} className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-black/40"><p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{title}</p><p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">{value}</p></div>)}
                </div>
              ) : null}

              {detailTab === "Settings" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{["Timesheet enabled for active team members", "Task required before time entry", `Approval owner: ${activeDetailProject.managerName || "Unassigned"}`, "Only mapped members should see this project", "Check open tasks before archive", `${billableLabel(activeDetailProject)} reporting rule`].map((setting) => <div key={setting} className="rounded-3xl border border-zinc-200 bg-white p-5 text-sm font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-black/40 dark:text-zinc-200">{setting}</div>)}</div>
              ) : null}

              {detailTab === "History" ? (
                <div className="space-y-3"><div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-black/60"><p className="font-semibold text-zinc-900 dark:text-white">Project created</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{formatDate(activeDetailProject.createdAt)} by {activeDetailProject.adminName || "Admin"}</p></div>{detailTasks.slice(0, 8).map((task) => <div key={task.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-black/60"><p className="font-semibold text-zinc-900 dark:text-white">{task.assignedToName ? "Task assigned" : "Task created"}: {task.title}</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{task.assignedToName || "Unassigned"} - {normalizeTaskStatus(task.status)}</p></div>)}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <TaskActionModal
        open={taskPanelOpen}
        mode={taskPanelMode}
        initialProjectId={assignProjectId}
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
