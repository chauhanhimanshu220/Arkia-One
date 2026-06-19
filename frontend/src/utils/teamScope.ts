import type { Employee } from "../types/employee";
import type { Project } from "../types/project";
import type { UserRole } from "../types/roles";

type TeamScopeMode = "organization" | "project" | "department" | "self";

interface BuildTeamScopeOptions {
  role: UserRole;
  employees: Employee[];
  projects: Project[];
  userId: string;
  includeSelf?: boolean;
  organizationRoles?: UserRole[];
}

export interface TeamScope {
  employees: Employee[];
  employeeIds: Set<string>;
  projects: Project[];
  projectIds: Set<string>;
  departments: string[];
  mode: TeamScopeMode;
  label: string;
  description: string;
}

const activeEmployees = (employees: Employee[]) => employees.filter((employee) => employee.status === "Active");

const sortEmployees = (employees: Employee[]) => [...employees].sort((left, right) => left.fullName.localeCompare(right.fullName));

const sortProjects = (projects: Project[]) => [...projects].sort((left, right) => left.name.localeCompare(right.name));

const sameName = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

const uniqueDepartments = (employees: Employee[]) => Array.from(new Set(employees.map((employee) => employee.department))).sort();

export const buildTeamScope = ({
  role,
  employees,
  projects,
  userId,
  includeSelf = false,
  organizationRoles = ["System Admin", "HR Manager", "Finance Admin"],
}: BuildTeamScopeOptions): TeamScope => {
  const active = activeEmployees(employees);
  const viewer = employees.find((employee) => employee.id === userId) ?? null;
  const organizationScope = organizationRoles.includes(role);

  if (organizationScope) {
    const scopedEmployees = sortEmployees(includeSelf ? active : active.filter((employee) => employee.id !== userId));
    const scopedProjects = sortProjects(projects);
    return {
      employees: scopedEmployees,
      employeeIds: new Set(scopedEmployees.map((employee) => employee.id)),
      projects: scopedProjects,
      projectIds: new Set(scopedProjects.map((project) => project.id)),
      departments: uniqueDepartments(scopedEmployees),
      mode: "organization",
      label: "Organization scope",
      description: "Synced from all active employees and SQL project records.",
    };
  }

  if (role === "Team Manager" && viewer) {
    const managerProjects = projects.filter(
      (project) =>
        project.managerId === userId ||
        sameName(project.managerName, viewer.fullName) ||
        sameName(project.projectLead, viewer.fullName),
    );

    const projectMemberIds = new Set<string>();
    managerProjects.forEach((project) => {
      project.teamMemberIds.forEach((employeeId) => projectMemberIds.add(employeeId));
    });

    if (includeSelf) {
      projectMemberIds.add(userId);
    } else {
      projectMemberIds.delete(userId);
    }

    if (managerProjects.length > 0) {
      const scopedEmployees = sortEmployees(active.filter((employee) => projectMemberIds.has(employee.id)));
      return {
        employees: scopedEmployees,
        employeeIds: new Set(scopedEmployees.map((employee) => employee.id)),
        projects: sortProjects(managerProjects),
        projectIds: new Set(managerProjects.map((project) => project.id)),
        departments: uniqueDepartments(scopedEmployees.length > 0 ? scopedEmployees : [viewer]),
        mode: "project",
        label: `${managerProjects.length} managed project${managerProjects.length === 1 ? "" : "s"}`,
        description: "Synced from SQL project manager and project team-member mapping.",
      };
    }

    const departmentEmployees = sortEmployees(
      active.filter((employee) => employee.department === viewer.department && (includeSelf || employee.id !== userId)),
    );
    const departmentProjects = sortProjects(
      projects.filter(
        (project) =>
          project.department === viewer.department ||
          project.teamMemberIds.includes(userId) ||
          project.managerId === userId,
      ),
    );

    return {
      employees: departmentEmployees,
      employeeIds: new Set(departmentEmployees.map((employee) => employee.id)),
      projects: departmentProjects,
      projectIds: new Set(departmentProjects.map((project) => project.id)),
      departments: uniqueDepartments(departmentEmployees.length > 0 ? departmentEmployees : [viewer]),
      mode: "department",
      label: `${viewer.department} fallback scope`,
      description: "No SQL project-manager mapping found yet, so department scope is used as fallback.",
    };
  }

  const selfEmployees = viewer ? [viewer] : [];
  const selfProjects = sortProjects(projects.filter((project) => project.teamMemberIds.includes(userId) || project.managerId === userId));

  return {
    employees: selfEmployees,
    employeeIds: new Set(selfEmployees.map((employee) => employee.id)),
    projects: selfProjects,
    projectIds: new Set(selfProjects.map((project) => project.id)),
    departments: uniqueDepartments(selfEmployees),
    mode: "self",
    label: "Personal scope",
    description: "Synced from your own employee and project assignments.",
  };
};
