import type { Employee } from "../../types/employee";
import { profilePhotoService } from "../../services/profilePhotoService";
import { formatUserRoles } from "../../types/roles";
import { Icon } from "../Icon";

interface EmployeeTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

const initialsFromName = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const roleClasses: Record<Employee["role"], string> = {
  Employee: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  "Team Manager": "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
  "HR Manager": "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200",
  "Finance Admin": "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  "System Admin": "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200",
  "License Owner": "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200",
};

export const EmployeeTable = ({ employees, onEdit, onDelete }: EmployeeTableProps) => (
  <div className="workspace-panel-strong rounded-3xl">
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead className="bg-zinc-50/80 dark:bg-black/70">
          <tr>
            <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Name</th>
            <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Email</th>
            <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Role</th>
            <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Department</th>
            <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Status</th>
            <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {employees.map((employee) => {
            const profilePhoto = employee.profilePhotoUrl ?? profilePhotoService.getPhoto(employee.id);

            return (
              <tr key={employee.id} className="transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {profilePhoto ? (
                      <img
                        src={profilePhoto}
                        alt={`${employee.fullName} profile`}
                        className="h-11 w-11 rounded-2xl object-cover shadow-lg shadow-brand-600/10"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 text-sm font-bold text-white shadow-lg shadow-brand-600/20">
                        {initialsFromName(employee.fullName)}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-zinc-800 dark:text-white">{employee.fullName}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {employee.employeeCode} · Joined {new Date(employee.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">User ID: {employee.userId}</p>
                  <p>{employee.email}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{employee.mobileNumber}</p>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {employee.roles.map((role) => (
                      <span key={`${employee.id}-${role}`} className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleClasses[role]}`}>
                        {role}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{formatUserRoles(employee.roles)}</p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{employee.userType}</p>
                </td>
                <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                  <p>{employee.department}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{employee.designation}</p>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      employee.status === "Active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
                    }`}
                  >
                    {employee.status}
                  </span>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{employee.workLocation}</p>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(employee)}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      <Icon name="edit" className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(employee)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {employees.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No employees match your current search and filter selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);
