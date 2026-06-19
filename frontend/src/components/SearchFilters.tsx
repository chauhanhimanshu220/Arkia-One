import type { EmployeeRole } from "../types/employee";
import { USER_ROLES } from "../types/roles";
import { Icon } from "./Icon";

interface SearchFiltersProps {
  searchTerm: string;
  roleFilter: EmployeeRole | "All";
  onSearchChange: (value: string) => void;
  onRoleChange: (value: EmployeeRole | "All") => void;
  onExport: () => void;
  onAdd: () => void;
}

export const SearchFilters = ({
  searchTerm,
  roleFilter,
  onSearchChange,
  onRoleChange,
  onExport,
  onAdd,
}: SearchFiltersProps) => (
  <div className="workspace-panel flex flex-col gap-4 rounded-3xl p-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
      <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-black">
        <Icon name="search" className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
        <input
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search employees"
          className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200 dark:placeholder:text-zinc-500"
        />
      </label>
      <select
        value={roleFilter}
        onChange={(event) => onRoleChange(event.target.value as EmployeeRole | "All")}
        className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none ring-brand-500 transition focus:ring-2 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
      >
        <option value="All">All Roles</option>
        {USER_ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={onExport}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        <Icon name="download" className="h-4 w-4" />
        Export
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 dark:bg-white px-4 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
      >
        <Icon name="plus" className="h-4 w-4" />
        New Employee
      </button>
    </div>
  </div>
);
