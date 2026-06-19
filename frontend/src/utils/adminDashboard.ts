import type { Employee } from "../types/employee";
import type { Project } from "../types/project";
import type { DailyTimesheet } from "../types/task";

export type WorkLogStatus = "Draft" | "Submitted" | "Pending" | "Approved" | "Rejected";
export type AssignmentStatus = "Active" | "Completed";

export interface WorkLog {
  id: string;
  date: string;
  hoursWorked: number;
  workDescription: string;
  status: WorkLogStatus;
}

export interface EmployeeProjectAssignment {
  id: string;
  projectName: string;
  roleInProject: string;
  status: AssignmentStatus;
  progress: number;
}

export interface EmployeeInsight {
  employee: Employee;
  workLogs: WorkLog[];
  projects: EmployeeProjectAssignment[];
  weeklyHours: number;
  monthlyHours: number;
  utilization: number;
}

const projectRoles = ["Owner", "Lead", "Contributor", "Reviewer"];

const normalizeWorkLogStatus = (status: string): WorkLogStatus => {
  switch (status.trim().toLowerCase()) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
};

const numericSeed = (value: string) =>
  value.split("").reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);

const buildAssignments = (employee: Employee, projects: Project[]): EmployeeProjectAssignment[] => {
  const relatedProjects = projects.filter(
    (project) =>
      project.managerId === employee.id ||
      project.teamMemberIds.includes(employee.id) ||
      project.adminId === employee.id,
  );

  if (relatedProjects.length > 0) {
    return relatedProjects.map((project, index) => ({
      id: project.id,
      projectName: project.name,
      roleInProject:
        project.managerId === employee.id
          ? "Delivery Lead"
          : project.adminId === employee.id
            ? "Executive Sponsor"
            : projectRoles[(numericSeed(employee.id) + index) % projectRoles.length],
      status: project.status === "Completed" ? "Completed" : "Active",
      progress: project.status === "Completed" ? 100 : 48 + ((numericSeed(project.id) + index * 7) % 42),
    }));
  }

  return [];
};

export const buildEmployeeInsights = (
  employees: Employee[],
  projects: Project[],
  allDailyTimesheets: DailyTimesheet[] = [],
): EmployeeInsight[] =>
  employees.map((employee) => {
    const userSheets = allDailyTimesheets.filter((sheet) => sheet.userId === employee.id);

    const workLogs: WorkLog[] =
      userSheets.length > 0
        ? userSheets.map((sheet) => ({
            id: sheet.id,
            date: sheet.date,
            hoursWorked: sheet.totalHours,
            workDescription:
              sheet.entries.map((e) => e.workDescription).join("; ") || "No description provided",
            status: normalizeWorkLogStatus(sheet.status),
          }))
        : [];

    const assignments = buildAssignments(employee, projects);
    const weeklyHours = workLogs.slice(0, 7).reduce((sum, log) => sum + log.hoursWorked, 0);
    const monthlyHours = workLogs.reduce((sum, log) => sum + log.hoursWorked, 0);

    return {
      employee,
      workLogs,
      projects: assignments,
      weeklyHours,
      monthlyHours: Number(monthlyHours.toFixed(1)),
      utilization: Math.min(100, Math.round((monthlyHours / 112) * 100)),
    };
  });

export const formatDisplayDate = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, options ?? { day: "2-digit", month: "short", year: "numeric" });
