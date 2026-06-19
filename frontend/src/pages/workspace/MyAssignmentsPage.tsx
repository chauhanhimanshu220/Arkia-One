import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatCard } from "../../components/StatCard";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { useProjects } from "../../hooks/useProjects";
import { taskService } from "../../services/taskService";
import type { AuthUser } from "../../types/auth";
import type { Project } from "../../types/project";
import type { TaskItem } from "../../types/task";
import { normalizeTaskStatus, TASK_STATUSES, type TaskStatus } from "../../utils/taskManagement";
import "./MyAssignmentsPage.css";

type Tab = "overview" | "projects" | "tasks" | "board" | "files" | "activity";
type Priority = "Low" | "Medium" | "High" | "Critical";
type ProjectDocument = {
  id: string;
  projectId: string;
  name: string;
  type: string;
  source: string;
  updatedAt: string;
};
type ActivityEvent = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  when: string;
  tone: "blue" | "emerald" | "amber" | "rose" | "zinc";
};

const tabs: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "projects", label: "Projects", icon: "projects" },
  { id: "tasks", label: "Tasks", icon: "approvals" },
  { id: "board", label: "Basket", icon: "inbox" },
  { id: "files", label: "Files", icon: "file-spreadsheet" },
  { id: "activity", label: "Activity", icon: "history" },
];

const statusClasses: Record<TaskStatus | Project["status"], string> = {
  "To Do": "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Planned: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  "In Progress": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  "On Hold": "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
  Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
};

const priorityDotClasses: Record<Priority, string> = {
  Low: "bg-zinc-400",
  Medium: "bg-amber-500",
  High: "bg-rose-500",
  Critical: "bg-red-600",
};

const activityToneClasses: Record<ActivityEvent["tone"], string> = {
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
};

const panelClass = "rounded-3xl border border-white/70 bg-white/90 shadow-panel backdrop-blur-xl dark:border-zinc-800 dark:bg-black/80";
const compactPanelClass = "rounded-2xl border border-zinc-200 bg-zinc-50/50 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/50";

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const formatRelativeDue = (value?: string | null) => {
  if (!value) return "No due date";
  const due = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "No due date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue`;
  return `Due in ${diff} days`;
};

const isOverdue = (task: TaskItem) => {
  const status = normalizeTaskStatus(task.status);
  if (status === "Completed") return false;
  const dueDate = task.dueDate || task.endDate;
  if (!dueDate) return false;
  const due = new Date(dueDate.includes("T") ? dueDate : `${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
};

const progressForStatus = (status: string) => {
  switch (normalizeTaskStatus(status)) {
    case "Completed":
      return 100;
    case "In Progress":
      return 62;
    case "On Hold":
      return 35;
    case "Planned":
      return 15;
    case "To Do":
    default:
      return 0;
  }
};

const normalizePriority = (priority?: string | null): Priority => {
  const value = priority?.trim();
  if (value === "Low" || value === "Medium" || value === "High" || value === "Critical") return value;
  return "Medium";
};

const taskDueDate = (task: TaskItem) => task.dueDate || task.endDate || task.startDate;

const taskText = (task: TaskItem) =>
  [
    task.title,
    task.taskName,
    task.taskCode,
    task.projectName,
    task.status,
    task.priority,
    task.description,
    task.roleInTask,
    task.expectedDeliverable,
  ]
    .join(" ")
    .toLowerCase();

const sortByDueDate = (left: TaskItem, right: TaskItem) => (taskDueDate(left) || "9999-12-31").localeCompare(taskDueDate(right) || "9999-12-31");

const buildDocuments = (projects: Project[], tasks: TaskItem[]): ProjectDocument[] => {
  const docs: ProjectDocument[] = [];

  projects.forEach((project) => {
    docs.push({
      id: `${project.id}-brief`,
      projectId: project.id,
      name: `${project.code || project.name} project brief`,
      type: "Brief",
      source: project.projectLead || project.managerName || "Project workspace",
      updatedAt: project.createdAt || project.startDate,
    });
  });

  tasks.forEach((task) => {
    if (!task.expectedDeliverable?.trim() && !task.workBreakdown?.trim()) return;
    docs.push({
      id: `${task.id}-deliverable`,
      projectId: task.projectId,
      name: task.expectedDeliverable?.trim() || `${task.title} work breakdown`,
      type: task.expectedDeliverable?.trim() ? "Deliverable" : "Work Plan",
      source: task.title || "Assigned task",
      updatedAt: taskDueDate(task) || task.startDate,
    });
  });

  return docs;
};

const buildActivity = (projects: Project[], tasks: TaskItem[]): ActivityEvent[] => {
  const assignmentEvents = tasks.slice(0, 10).map((task) => ({
    id: `task-${task.id}`,
    projectId: task.projectId,
    title: task.title || task.taskName || "Assigned task",
    description: `${normalizeTaskStatus(task.status)} task in ${task.projectName || "project workspace"}`,
    when: formatRelativeDue(taskDueDate(task)),
    tone: isOverdue(task) ? "rose" : normalizeTaskStatus(task.status) === "Completed" ? "emerald" : "blue",
  })) satisfies ActivityEvent[];

  const projectEvents = projects.slice(0, 5).map((project) => ({
    id: `project-${project.id}`,
    projectId: project.id,
    title: project.name,
    description: `${project.status} project assigned through ${project.deliveryModel || "workspace access"}`,
    when: `Ends ${formatDate(project.endDate)}`,
    tone: project.status === "Completed" ? "emerald" : project.status === "On Hold" ? "amber" : "zinc",
  })) satisfies ActivityEvent[];

  return [...assignmentEvents, ...projectEvents].slice(0, 12);
};

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className={`${panelClass} animate-in px-6 py-20 text-center`}>
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-300">
        <Icon name="projects" className="h-10 w-10" />
      </div>
      <h3 className="mt-8 text-2xl font-bold text-zinc-900 dark:text-white">{title}</h3>
      <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}

function ProgressBar({ value, tone = "bg-zinc-900 dark:bg-white" }: { value: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress-bar-premium">
      <div className={classNames("progress-fill-premium", tone)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const normalized = normalizeTaskStatus(status);
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClasses[normalized]}`}>{normalized}</span>;
}

function PriorityBadge({ priority }: { priority?: string | null }) {
  const normalized = normalizePriority(priority);
  return (
    <span className="inline-flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
      <span className={`h-2.5 w-2.5 rounded-full ${priorityDotClasses[normalized]} shadow-sm`} />
      {normalized}
    </span>
  );
}

function ProjectDetailsModal({
  project,
  tasks,
  documents,
  onClose,
}: {
  project: Project;
  tasks: TaskItem[];
  documents: ProjectDocument[];
  onClose: () => void;
}) {
  const completed = tasks.filter((task) => normalizeTaskStatus(task.status) === "Completed").length;
  const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : project.status === "Completed" ? 100 : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xl" onClick={onClose}>
      <div
        className="animate-in flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/95 shadow-2xl dark:border-zinc-800 dark:bg-black/95"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-6 border-b border-zinc-200/50 px-8 py-8 dark:border-zinc-800/50">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">{project.code || "Project"}</span>
              <TaskStatusBadge status={project.status} />
            </div>
            <h3 className="mt-4 text-4xl font-black tracking-tight text-zinc-900 dark:text-white">{project.name}</h3>
            <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">{project.description || "Project details are available based on your assignment access."}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 transition-all hover:rotate-90 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Icon name="close" className="h-6 w-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-8">
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { label: "Status", value: project.status, icon: "git-branch" },
              { label: "Priority", value: project.priority, icon: "alert" },
              { label: "My Tasks", value: String(tasks.length), icon: "approvals" },
              { label: "Completion", value: `${progress}%`, icon: "dashboard" },
            ].map((item, idx) => (
              <div key={item.label} className={classNames(compactPanelClass, "animate-in p-6", `stagger-${idx + 1}`)}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{item.label}</p>
                  <Icon name={item.icon as IconName} className="h-4 w-4 text-zinc-400" />
                </div>
                <p className="mt-4 text-2xl font-black text-zinc-900 dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className={classNames(compactPanelClass, "p-8")}>
              <div className="flex items-center justify-between border-b border-zinc-200/50 pb-6 dark:border-zinc-800/50">
                <h4 className="text-xl font-black text-zinc-900 dark:text-white">Assigned Tasks</h4>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{completed} of {tasks.length} completed</span>
                  <div className="h-2 w-24 rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
              <div className="mt-8 space-y-4">
                {tasks.length === 0 ? (
                  <p className="py-10 text-center text-zinc-500 dark:text-zinc-400">No task assignments found for you on this project.</p>
                ) : (
                  tasks.map((task) => (
                    <div key={task.id} className="premium-card rounded-2xl border border-zinc-200 bg-white/50 p-5 transition-all hover:bg-white dark:border-zinc-800 dark:bg-black/50 dark:hover:bg-black">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-lg font-bold text-zinc-900 dark:text-white">{task.title || task.taskName}</p>
                          <div className="mt-2 flex items-center gap-3">
                            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{formatRelativeDue(taskDueDate(task))}</span>
                            <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                            <PriorityBadge priority={task.priority} />
                          </div>
                        </div>
                        <TaskStatusBadge status={task.status} />
                      </div>
                      <div className="mt-6">
                        <ProgressBar value={progressForStatus(task.status)} />
                        <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400">
                           <span>Progress</span>
                           <span>{progressForStatus(task.status)}%</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div className={classNames(compactPanelClass, "p-8")}>
                <h4 className="text-xl font-black text-zinc-900 dark:text-white">Project Intel</h4>
                <div className="mt-8 space-y-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Access Basis</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                      You are authorized for this workspace as a project member with direct task assignments.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Project Lead</p>
                      <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-white">{project.managerName || "Not assigned"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Delivery</p>
                      <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-white">{project.deliveryModel || "Standard"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={classNames(compactPanelClass, "p-8")}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xl font-black text-zinc-900 dark:text-white">Assets</h4>
                  <span className="text-xs font-bold text-zinc-500">{documents.length} files</span>
                </div>
                <div className="mt-8 space-y-3">
                  {documents.length === 0 ? (
                    <p className="py-6 text-sm text-zinc-500 dark:text-zinc-400">No project assets shared yet.</p>
                  ) : (
                    documents.map((document) => (
                      <div key={document.id} className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white/50 p-4 transition-all hover:border-zinc-300 dark:border-zinc-800 dark:bg-black/50 dark:hover:border-zinc-700">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black">
                          <Icon name="file-spreadsheet" className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{document.name}</p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">{document.type}</p>
                        </div>
                        <Icon name="chevron-right" className="h-4 w-4 text-zinc-300" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  projects,
  tasks,
  activity,
  onOpenProject,
}: {
  projects: Project[];
  tasks: TaskItem[];
  activity: ActivityEvent[];
  onOpenProject: (project: Project) => void;
}) {
  const nextTasks = tasks.filter((task) => normalizeTaskStatus(task.status) !== "Completed").sort(sortByDueDate).slice(0, 5);
  const activeProjects = projects.filter((project) => project.status === "Active");

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Assigned Projects" value={projects.length} subtitle={`${activeProjects.length} active`} accent="bg-sky-500/20" />
          <StatCard label="Open Tasks" value={tasks.filter((task) => normalizeTaskStatus(task.status) !== "Completed").length} subtitle="Current backlog" accent="bg-amber-500/20" />
          <StatCard label="Total Impact" value={tasks.filter((task) => normalizeTaskStatus(task.status) === "Completed").length} subtitle="Tasks completed" accent="bg-emerald-500/20" />
          <StatCard label="Critical Risk" value={tasks.filter(isOverdue).length} subtitle="Overdue items" accent="bg-rose-500/20" />
        </div>

        <div className={`${panelClass} animate-in overflow-hidden border-none shadow-2xl stagger-1`}>
          <div className="flex items-center justify-between border-b border-zinc-200/50 bg-zinc-50/50 px-8 py-6 dark:border-zinc-800/50 dark:bg-zinc-950/50">
            <div>
              <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">Priority Workspace</h3>
              <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">Mission critical tasks requiring immediate attention.</p>
            </div>
            <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <Icon name="history" className="h-5 w-5 text-zinc-500" />
            </button>
          </div>
          <div className="divide-y divide-zinc-100/50 dark:divide-zinc-800/50">
            {nextTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
                  <Icon name="check" className="h-8 w-8" />
                </div>
                <p className="mt-6 text-lg font-bold text-zinc-900 dark:text-white">Clear Skies</p>
                <p className="mt-1 text-sm text-zinc-500">No pending assignments for you.</p>
              </div>
            ) : (
              nextTasks.map((task) => (
                <div key={task.id} className="group grid gap-6 px-8 py-6 transition-all hover:bg-zinc-50/80 dark:hover:bg-zinc-950/80 md:grid-cols-[1fr_160px_140px]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold text-zinc-900 transition-colors group-hover:text-black dark:text-white dark:group-hover:text-white">{task.title || task.taskName}</p>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-sm font-bold text-zinc-500 dark:text-zinc-400">
                       <span className="truncate max-w-[200px]">{task.projectName || "Standard Project"}</span>
                       <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                       <span className={classNames(isOverdue(task) ? "text-rose-500" : "")}>{formatRelativeDue(taskDueDate(task))}</span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <TaskStatusBadge status={task.status} />
                  </div>
                  <div className="flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-400">Velocity</span>
                       <span className="text-[10px] font-black text-zinc-900 dark:text-white">{progressForStatus(task.status)}%</span>
                    </div>
                    <ProgressBar value={progressForStatus(task.status)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {activeProjects.slice(0, 4).map((project, idx) => {
            const projectTasks = tasks.filter((task) => task.projectId === project.id);
            const progress = projectTasks.length
              ? Math.round((projectTasks.filter((task) => normalizeTaskStatus(task.status) === "Completed").length / projectTasks.length) * 100)
              : project.status === "Completed"
                ? 100
                : 0;

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onOpenProject(project)}
                className={classNames(panelClass, "animate-in group p-8 text-left transition-all hover:-translate-y-2 hover:shadow-2xl stagger-" + (idx + 1))}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{project.code || "PRJ"}</span>
                    <h4 className="mt-3 text-xl font-black text-zinc-900 dark:text-white">{project.name}</h4>
                    <p className="mt-2 text-sm font-bold text-zinc-500">{projectTasks.length} assigned tasks</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-400 transition-all group-hover:bg-zinc-900 group-hover:text-white dark:bg-zinc-900 dark:group-hover:bg-white dark:group-hover:text-black">
                    <Icon name="chevron-right" className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Workspace Health</span>
                    <span className="text-sm font-black text-zinc-900 dark:text-white">{progress}%</span>
                  </div>
                  <ProgressBar value={progress} tone="bg-zinc-950 dark:bg-white" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={classNames(panelClass, "animate-in flex flex-col p-8 stagger-2")}>
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">Pulse</h3>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="flex-1 space-y-8 overflow-y-auto">
          {activity.slice(0, 8).map((item) => (
            <div key={item.id} className="activity-item-premium">
              <div className="activity-dot-premium" style={{ backgroundColor: item.tone === 'rose' ? '#f43f5e' : item.tone === 'emerald' ? '#10b981' : item.tone === 'amber' ? '#f59e0b' : '#000' }} />
              <div className="min-w-0">
                <p className="text-sm font-black text-zinc-900 dark:text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{item.description}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.when}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectsTab({
  projects,
  tasks,
  onOpenProject,
}: {
  projects: Project[];
  tasks: TaskItem[];
  onOpenProject: (project: Project) => void;
}) {
  if (projects.length === 0) {
    return <EmptyState title="No project assignments yet" description="Assigned projects will appear here as soon as a manager adds you to a project team or assigns you a task." />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
      {projects.map((project, idx) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id);
        const completed = projectTasks.filter((task) => normalizeTaskStatus(task.status) === "Completed").length;
        const progress = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : project.status === "Completed" ? 100 : 0;

        return (
          <div key={project.id} className={classNames(panelClass, "animate-in flex flex-col p-8 stagger-" + (idx % 5 + 1))}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                   <TaskStatusBadge status={project.status} />
                   <PriorityBadge priority={project.priority} />
                </div>
                <h3 className="mt-4 text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{project.name}</h3>
                <p className="mt-1 text-sm font-bold text-zinc-500">{project.code || "Project Code"} • {project.department || "General"}</p>
              </div>
            </div>

            <p className="mt-6 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {project.description || "Project details and resources are accessible based on your current assignment credentials."}
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4">
              <div className={classNames(compactPanelClass, "p-4 text-center")}>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Tasks</p>
                <p className="mt-2 text-lg font-black text-zinc-900 dark:text-white">{projectTasks.length}</p>
              </div>
              <div className={classNames(compactPanelClass, "p-4 text-center")}>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Deadline</p>
                <p className="mt-2 text-[10px] font-black text-zinc-900 dark:text-white">{formatDate(project.endDate)}</p>
              </div>
              <div className={classNames(compactPanelClass, "p-4 text-center")}>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Team</p>
                <p className="mt-2 text-lg font-black text-zinc-900 dark:text-white">{project.teamSize || project.teamMemberIds.length || 1}</p>
              </div>
            </div>

            <div className="mt-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{completed} / {projectTasks.length} Complete</span>
                <span className="text-sm font-black text-zinc-900 dark:text-white">{progress}%</span>
              </div>
              <ProgressBar value={progress} tone="bg-zinc-900 dark:bg-white" />
            </div>

            <div className="mt-auto pt-8 flex items-center justify-between">
               <div className="flex -space-x-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-zinc-200 dark:border-black dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold">
                       {String.fromCharCode(64 + i)}
                    </div>
                  ))}
               </div>
               <button
                type="button"
                onClick={() => onOpenProject(project)}
                className="inline-flex h-11 items-center gap-3 rounded-2xl bg-zinc-900 px-6 text-sm font-black text-white transition-all hover:bg-black hover:scale-105 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
              >
                Project Intel
                <Icon name="chevron-right" className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TasksTab({ tasks }: { tasks: TaskItem[] }) {
  if (tasks.length === 0) {
    return <EmptyState title="No task assignments yet" description="Tasks assigned to you under each project will appear here with status, priority, deadlines, and progress." />;
  }

  return (
    <div className={classNames(panelClass, "animate-in overflow-hidden border-none shadow-2xl")}>
      <div className="bg-zinc-50/50 px-8 py-8 dark:bg-zinc-950/50">
        <h3 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Backlog Explorer</h3>
        <p className="mt-2 text-sm font-medium text-zinc-500">Comprehensive view of all your individual project commitments.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="bg-zinc-50/30 border-y border-zinc-200/50 dark:bg-zinc-950/30 dark:border-zinc-800/50">
              {["Assignment", "Project Context", "Priority", "Status", "Delivery Timeline", "Progress"].map((header) => (
                <th key={header} className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-800/50">
            {tasks.map((task) => (
              <tr key={task.id} className="group transition-all hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50">
                <td className="px-8 py-8">
                  <p className="text-lg font-bold text-zinc-900 dark:text-white">{task.title || task.taskName}</p>
                  <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-zinc-500 line-clamp-2">{task.description || "No tactical details provided."}</p>
                </td>
                <td className="px-8 py-8">
                   <div className="flex flex-col gap-1">
                      <span className="text-sm font-black text-zinc-900 dark:text-white">{task.projectName || "Project"}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{task.taskCode || "TASK-01"}</span>
                   </div>
                </td>
                <td className="px-8 py-8"><PriorityBadge priority={task.priority} /></td>
                <td className="px-8 py-8"><TaskStatusBadge status={task.status} /></td>
                <td className="px-8 py-8">
                  <div className="flex flex-col gap-1">
                    <span className={classNames("text-sm font-black", isOverdue(task) ? "text-rose-500" : "text-zinc-900 dark:text-white")}>
                      {formatDate(taskDueDate(task))}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{formatRelativeDue(taskDueDate(task))}</span>
                  </div>
                </td>
                <td className="px-8 py-8">
                  <div className="w-40">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-black text-zinc-900 dark:text-white">{progressForStatus(task.status)}%</span>
                    </div>
                    <ProgressBar value={progressForStatus(task.status)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BasketTab({ tasks }: { tasks: TaskItem[] }) {
  const [basketTasks, setBasketTasks] = useState<TaskItem[]>(tasks);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  useEffect(() => {
    setBasketTasks(tasks);
  }, [tasks]);


  return (
    <div className="kanban-basket-premium custom-scrollbar pb-8">
      {TASK_STATUSES.map((status) => {
        const statusTasks = basketTasks.filter((task) => normalizeTaskStatus(task.status) === status);

        return (
          <div
            key={status}
            className="kanban-column-premium"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggedTaskId) return;
              setBasketTasks((current) => current.map((task) => (task.id === draggedTaskId ? { ...task, status } : task)));
              setDraggedTaskId(null);
            }}
          >
            <div className="kanban-column-header">
              <div className="flex items-center gap-3">
                <span className={classNames("h-2 w-2 rounded-full", status === 'Completed' ? 'bg-emerald-500' : status === 'In Progress' ? 'bg-sky-500' : 'bg-zinc-400')} />
                <span className="font-black tracking-[0.2em]">{status}</span>
              </div>
              <span className="rounded-xl bg-zinc-100 px-3 py-1 text-[10px] font-black text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">{statusTasks.length}</span>
            </div>

            <div className="flex flex-1 flex-col gap-4">
              {statusTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    setDraggedTaskId(task.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  className="kanban-card-premium group"
                >
                  <div className="flex items-start justify-between">
                    <PriorityBadge priority={task.priority} />
                    <span className="text-[9px] font-black text-zinc-400">{progressForStatus(task.status)}%</span>
                  </div>
                  <p className="mt-4 text-base font-bold leading-tight text-zinc-900 dark:text-white group-hover:text-black dark:group-hover:text-white">{task.title || task.taskName}</p>
                  <p className="mt-2 truncate text-xs font-bold text-zinc-500">{task.projectName || "Project"}</p>
                  
                  <div className="mt-6">
                    <ProgressBar value={progressForStatus(task.status)} />
                  </div>
                  
                  <div className="mt-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name="clock" className="h-3 w-3 text-zinc-400" />
                      <span className="text-[10px] font-black uppercase text-zinc-400">{formatRelativeDue(taskDueDate(task))}</span>
                    </div>
                    <div className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[8px] font-bold">
                       {task.assignedDays || 1}d
                    </div>
                  </div>
                </div>
              ))}
              {statusTasks.length === 0 && (
                <div className="flex h-32 items-center justify-center rounded-[2rem] border-2 border-dashed border-zinc-200/50 dark:border-zinc-800/50">
                   <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Drop Here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FilesTab({ documents, projects }: { documents: ProjectDocument[]; projects: Project[] }) {
  if (documents.length === 0) {
    return <EmptyState title="No shared documents yet" description="Project briefs, work breakdowns, and task deliverables connected to your assignments will appear here." />;
  }

  return (
    <div className={classNames(panelClass, "animate-in overflow-hidden border-none shadow-2xl")}>
      <div className="bg-zinc-50/50 px-8 py-8 dark:bg-zinc-950/50">
        <h3 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Digital Assets</h3>
        <p className="mt-2 text-sm font-medium text-zinc-500">Resource repository for all your active project involvements.</p>
      </div>
      <div className="divide-y divide-zinc-100/50 dark:divide-zinc-800/50">
        {documents.map((document) => {
          const project = projects.find((item) => item.id === document.projectId);
          return (
            <div key={document.id} className="group flex flex-wrap items-center gap-8 px-8 py-6 transition-all hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-zinc-900 text-white transition-transform group-hover:scale-110 dark:bg-white dark:text-black">
                <Icon name="file-spreadsheet" className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-zinc-900 dark:text-white">{document.name}</p>
                <div className="mt-2 flex items-center gap-3 text-sm font-bold text-zinc-500">
                  <span>{project?.name || "Project"}</span>
                  <span className="h-1 w-1 rounded-full bg-zinc-300" />
                  <span className="uppercase text-[10px] tracking-widest">{document.type}</span>
                  <span className="h-1 w-1 rounded-full bg-zinc-300" />
                  <span>Updated {formatDate(document.updatedAt)}</span>
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-100 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                {document.source}
              </div>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 opacity-0 group-hover:opacity-100 transition-all dark:bg-zinc-900 dark:ring-zinc-800">
                 <Icon name="chevron-right" className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityTab({ activity }: { activity: ActivityEvent[] }) {
  if (activity.length === 0) {
    return <EmptyState title="No assignment activity yet" description="Recent project updates, assigned tasks, and deadline movement will appear here." />;
  }

  return (
    <div className={classNames(panelClass, "animate-in p-12 shadow-2xl")}>
      <h3 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Global Activity Feed</h3>
      <div className="mt-12 space-y-2">
        {activity.map((item, index) => (
          <div key={item.id} className="activity-item-premium">
             <div className="activity-dot-premium" style={{ backgroundColor: item.tone === 'rose' ? '#f43f5e' : item.tone === 'emerald' ? '#10b981' : item.tone === 'amber' ? '#f59e0b' : '#000' }} />
             <div className="animate-in stagger-1">
                <p className="text-xl font-black text-zinc-900 dark:text-white">{item.title}</p>
                <p className="mt-2 text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">{item.description}</p>
                <div className="mt-4 flex items-center gap-3">
                   <Icon name="clock" className="h-4 w-4 text-zinc-300" />
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{item.when}</p>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const MyAssignmentsPage = ({ user }: { user: AuthUser }) => {
  const { projects, loading: projectsLoading } = useProjects();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"All" | TaskStatus>("All");
  const [sortBy, setSortBy] = useState<string>("default");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    setQuery("");
    setSelectedStatus("All");
    setSortBy("default");
  }, [tab]);

  useEffect(() => {
    const loadAssignments = async () => {
      setTasksLoading(true);
      try {
        const history = await taskService.getTaskHistory();
        setTasks(history.filter((task) => task.assignedTo === user.id).sort(sortByDueDate));
      } finally {
        setTasksLoading(false);
      }
    };

    void loadAssignments();
  }, [user.id]);

  const assignedProjects = useMemo(() => {
    const taskProjectIds = new Set(tasks.map((task) => task.projectId).filter(Boolean));
    return projects
      .filter((project) => project.teamMemberIds.includes(user.id) || project.managerId === user.id || taskProjectIds.has(project.id))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [projects, tasks, user.id]);

  const filteredTasks = useMemo(() => {
    const assignedProjectIds = new Set(assignedProjects.map((project) => project.id));
    const search = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesProjectAccess = !task.projectId || assignedProjectIds.has(task.projectId);
      const matchesStatus = selectedStatus === "All" || normalizeTaskStatus(task.status) === selectedStatus;
      const matchesSearch = !search || taskText(task).includes(search);
      return matchesProjectAccess && matchesStatus && matchesSearch;
    }).sort((left, right) => {
      if (sortBy === "priority") {
        const priorities: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
        return (priorities[right.priority || "Low"] || 0) - (priorities[left.priority || "Low"] || 0);
      }
      if (sortBy === "project") {
        return (left.projectName || "").localeCompare(right.projectName || "");
      }
      if (sortBy === "date") {
        return (taskDueDate(left) || "9999").localeCompare(taskDueDate(right) || "9999");
      }
      return 0; // Default uses initial fetch sort
    });
  }, [assignedProjects, query, selectedStatus, sortBy, tasks]);

  const filteredProjects = useMemo(() => {
    const search = query.trim().toLowerCase();
    const result = search 
      ? assignedProjects.filter((project) =>
          [project.name, project.code, project.description, project.department, project.projectLead, project.managerName].join(" ").toLowerCase().includes(search)
        )
      : assignedProjects;
      
    if (sortBy === "progress") {
      return [...result].sort((a, b) => {
        const aTasks = tasks.filter((t) => t.projectId === a.id);
        const bTasks = tasks.filter((t) => t.projectId === b.id);
        const aProgress = aTasks.length ? aTasks.filter((t) => normalizeTaskStatus(t.status) === "Completed").length / aTasks.length : 0;
        const bProgress = bTasks.length ? bTasks.filter((t) => normalizeTaskStatus(t.status) === "Completed").length / bTasks.length : 0;
        return bProgress - aProgress;
      });
    }
    if (sortBy === "name") {
      return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [assignedProjects, query, sortBy]);

  const documents = useMemo(() => buildDocuments(assignedProjects, tasks), [assignedProjects, tasks]);
  const activity = useMemo(() => buildActivity(assignedProjects, tasks), [assignedProjects, tasks]);
  const selectedProjectTasks = selectedProject ? tasks.filter((task) => task.projectId === selectedProject.id) : [];
  const selectedProjectDocuments = selectedProject ? documents.filter((document) => document.projectId === selectedProject.id) : [];
  const loading = projectsLoading || tasksLoading;
  const activeProjectsCount = assignedProjects.filter((project) => project.status === "Active").length;
  const openTasksCount = tasks.filter((task) => normalizeTaskStatus(task.status) !== "Completed").length;

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <LoadingSpinner label="Synchronizing Workspace..." />
      </div>
    );
  }

  return (
    <section className="assignments-page space-y-10 pb-20">
      <WorkspacePageHero title="My Assignments">
        <WorkspaceHeroMeta primary={`${activeProjectsCount} Strategic Projects`} secondary={`${openTasksCount} Active Commitments`} />
      </WorkspacePageHero>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="tab-nav-premium flex-1 mb-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={classNames("tab-item-premium", tab === t.id && "active")}
            >
              <Icon name={t.icon} className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Filter Bar */}
      {(tab === "tasks" || tab === "projects" || tab === "files" || tab === "board") && (
        <div className="animate-in flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-zinc-200/50 bg-white/40 p-6 backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-black/40">
          <div className="flex flex-1 flex-wrap items-center gap-4">
            {(tab === "tasks" || tab === "files" || tab === "board") && (
              <div className="search-container-premium min-w-[300px]">
                <Icon name="search" className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder={tab === "tasks" ? "Search tasks..." : tab === "board" ? "Search board..." : "Search files..."}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="search-input-premium !bg-white/50 dark:!bg-zinc-900/50"
                />
              </div>
            )}

            {(tab === "tasks" || tab === "projects") && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {["All", ...(tab === "tasks" ? TASK_STATUSES : ["Active", "Completed", "On Hold"])].map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status as any)}
                    className={classNames(
                      "whitespace-nowrap rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                      selectedStatus === status
                        ? "bg-black text-white shadow-lg dark:bg-white dark:text-black"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sort By</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200/50 bg-white/50 px-4 text-[10px] font-black uppercase tracking-widest outline-none dark:border-zinc-800/50 dark:bg-zinc-900/50"
                >
                  <option value="default">Default</option>
                  {tab === "tasks" && (
                    <>
                      <option value="date">Due Date</option>
                      <option value="priority">Priority</option>
                      <option value="project">Project Name</option>
                    </>
                  )}
                  {tab === "projects" && (
                    <>
                      <option value="name">Name (A-Z)</option>
                      <option value="progress">Progress</option>
                    </>
                  )}
                </select>
             </div>
          </div>
        </div>
      )}

      <div className="min-h-[400px]">
        {tab === "overview" && (
          <OverviewTab
            projects={assignedProjects}
            tasks={tasks}
            activity={activity}
            onOpenProject={setSelectedProject}
          />
        )}
        {tab === "projects" && (
          <ProjectsTab
            projects={filteredProjects}
            tasks={tasks}
            onOpenProject={setSelectedProject}
          />
        )}
        {tab === "tasks" && <TasksTab tasks={filteredTasks} />}
        {tab === "board" && <BasketTab tasks={filteredTasks} />}
        {tab === "files" && <FilesTab documents={documents} projects={assignedProjects} />}
        {tab === "activity" && <ActivityTab activity={activity} />}
      </div>

      {selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          tasks={selectedProjectTasks}
          documents={selectedProjectDocuments}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </section>
  );
};
