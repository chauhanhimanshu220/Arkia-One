import { useMemo, useState } from "react";
import { EmployeeModal, type EmployeeModalValues } from "../../components/employees/EmployeeModal";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../services/http";
import { profilePhotoService } from "../../services/profilePhotoService";
import type { Employee } from "../../types/employee";
import { formatUserRoles, hasAnyUserRole, hasUserRole } from "../../types/roles";

const ITEMS_PER_PAGE = 8;

const getEmployeeCode = (employee: Employee) => employee.employeeCode;

const formatJoinedDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const statusBadge = {
  Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Inactive: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
} as const;

export const EmployeeDirectoryPage = () => {
  const { employees, loading, updateEmployee } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState<Employee["role"] | "All">("All");
  const [statusFilter, setStatusFilter] = useState<Employee["status"] | "All">("All");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);

  const departmentOptions = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department))).sort((left, right) => left.localeCompare(right)),
    [employees],
  );

  const roleOptions = useMemo(
    () => Array.from(new Set(employees.flatMap((employee) => employee.roles))).sort((left, right) => left.localeCompare(right)),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return employees.filter((employee) => {
      if (departmentFilter !== "All" && employee.department !== departmentFilter) {
        return false;
      }

      if (roleFilter !== "All" && !hasUserRole(employee.roles, roleFilter)) {
        return false;
      }

      if (statusFilter !== "All" && employee.status !== statusFilter) {
        return false;
      }

      if (query) {
        const haystack = [employee.fullName, employee.email, getEmployeeCode(employee), employee.department, formatUserRoles(employee.roles)]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [departmentFilter, employees, roleFilter, searchText, statusFilter]);

  const stats = useMemo(() => {
    const active = employees.filter((employee) => employee.status === "Active");
    return {
      total: employees.length,
      active: active.length,
      inactive: employees.filter((employee) => employee.status === "Inactive").length,
      departments: new Set(active.map((employee) => employee.department)).size,
    };
  }, [employees]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEmployees, page]);

  const selectedEmployee =
    filteredEmployees.find((employee) => employee.id === selectedEmployeeId) ?? paginatedEmployees[0] ?? filteredEmployees[0] ?? null;

  const managerDirectory = useMemo(() => {
    const managers = employees.filter((employee) =>
      hasAnyUserRole(employee.roles, ["Team Manager", "HR Manager", "System Admin"]),
    );
    return managers.sort((left, right) => left.fullName.localeCompare(right.fullName));
  }, [employees]);

  const inferredManager = useMemo(() => {
    if (!selectedEmployee) {
      return null;
    }

    return (
      managerDirectory.find((manager) => manager.department === selectedEmployee.department && manager.id !== selectedEmployee.id) ??
      managerDirectory[0] ??
      null
    );
  }, [managerDirectory, selectedEmployee]);

  const resetFilters = () => {
    setSearchText("");
    setDepartmentFilter("All");
    setRoleFilter("All");
    setStatusFilter("All");
  };

  const extractApiMessage = (rawMessage: string) => {
    try {
      const parsed = JSON.parse(rawMessage) as { message?: string };
      return parsed.message;
    } catch {
      return rawMessage;
    }
  };

  const handleEditSubmit = async (values: EmployeeModalValues) => {
    if (!editingEmployee) {
      return;
    }

    setSaving(true);
    try {
      const existingProfilePhoto = editingEmployee.profilePhotoUrl ?? profilePhotoService.getPhoto(editingEmployee.id);
      const updatedEmployee = await updateEmployee(editingEmployee.id, {
        employeeCode: values.employeeCode,
        userId: values.userId,
        fullName: values.fullName,
        email: values.email,
        mobileNumber: values.mobileNumber,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        role: values.role,
        roles: values.roles,
        department: values.department,
        designation: values.designation,
        reportingManagerId: values.reportingManagerId,
        businessUnit: values.businessUnit,
        workLocation: values.workLocation,
        status: values.status,
        userType: values.userType,
        password: values.password,
        profilePhotoDataUrl: values.profilePhotoDataUrl,
        removeProfilePhoto: !values.profilePhotoDataUrl && Boolean(existingProfilePhoto),
      });
      profilePhotoService.removePhoto(updatedEmployee.id);
      showToast("Employee directory record updated successfully.", "success");
      setEditingEmployee(null);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? extractApiMessage(error.message) ?? "Unable to update employee right now."
          : "Unable to update employee right now.";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (employee: Employee) => {
    setSaving(true);
    try {
      await updateEmployee(employee.id, {
        employeeCode: employee.employeeCode,
        userId: employee.userId,
        fullName: employee.fullName,
        email: employee.email,
        mobileNumber: employee.mobileNumber,
        dateOfBirth: employee.dateOfBirth,
        gender: employee.gender,
        role: employee.role,
        roles: employee.roles,
        department: employee.department,
        designation: employee.designation,
        reportingManagerId: employee.reportingManagerId,
        businessUnit: employee.businessUnit,
        workLocation: employee.workLocation,
        status: employee.status === "Active" ? "Inactive" : "Active",
        userType: employee.userType,
        password: null,
      });
      showToast(
        employee.status === "Active" ? "Employee marked inactive." : "Employee reactivated successfully.",
        "success",
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? extractApiMessage(error.message) ?? "Unable to update employee status right now."
          : "Unable to update employee status right now.";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading employee directory..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Employee directory">
          <WorkspaceHeroMeta primary={`${filteredEmployees.length} employee(s)`} />
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Employees" value={stats.total} subtitle="All people records currently stored" accent="bg-zinc-500/20" />
          <StatCard label="Active Employees" value={stats.active} subtitle="Currently active employee accounts" accent="bg-emerald-500/20" />
          <StatCard label="Inactive Employees" value={stats.inactive} subtitle="Deactivated or archived employee records" accent="bg-zinc-400/20" />
          <StatCard label="Departments" value={stats.departments} subtitle="Departments represented by active employees" accent="bg-amber-500/20" />
        </div>

        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/85">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2 xl:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Search</span>
              <input
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Name, email, employee code, department, role"
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Department</span>
              <select
                value={departmentFilter}
                onChange={(event) => {
                  setDepartmentFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All departments</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Role</span>
              <select
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value as Employee["role"] | "All");
                  setCurrentPage(1);
                }}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as Employee["status"] | "All");
                  setCurrentPage(1);
                }}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              >
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <p>
              Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200">{filteredEmployees.length}</span> employee record(s)
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Reset
            </button>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
          <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-panel dark:border-zinc-800 dark:bg-black/85">
            <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Directory Listing</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                HR can review employee visibility here and jump into profile-level edits when needed.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50/90 dark:bg-black/70">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {paginatedEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className={`transition ${
                        selectedEmployee?.id === employee.id ? "bg-brand-50/70 dark:bg-brand-500/10" : "hover:bg-zinc-50/80 dark:hover:bg-black/70"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <button type="button" onClick={() => setSelectedEmployeeId(employee.id)} className="text-left">
                          <p className="font-semibold text-zinc-900 dark:text-white">{employee.fullName}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Joined {formatJoinedDate(employee.createdAt)}</p>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{getEmployeeCode(employee)}</td>
                      <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{employee.email}</td>
                      <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{employee.department}</td>
                      <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatUserRoles(employee.roles)}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge[employee.status]}`}>{employee.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedEmployeeId(employee.id)}
                            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            <Icon name="eye" className="h-4 w-4" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingEmployee(employee)}
                            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            <Icon name="edit" className="h-4 w-4" />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No employees match the current directory filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Employee Detail</p>
              {selectedEmployee ? (
                <div className="mt-5 space-y-4">
                  <div className="flex items-start gap-4">
                    {selectedEmployee.profilePhotoUrl ?? profilePhotoService.getPhoto(selectedEmployee.id) ? (
                      <img
                        src={selectedEmployee.profilePhotoUrl ?? profilePhotoService.getPhoto(selectedEmployee.id) ?? ""}
                        alt={`${selectedEmployee.fullName} profile`}
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-lg font-bold text-white dark:bg-white dark:text-black">
                        {selectedEmployee.fullName
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0] ?? "")
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-xl font-semibold text-zinc-900 dark:text-white">{selectedEmployee.fullName}</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{selectedEmployee.email}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Employee Code</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{selectedEmployee.employeeCode}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Status</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{selectedEmployee.status}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Role</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{formatUserRoles(selectedEmployee.roles)}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Department</p>
                      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">{selectedEmployee.department}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Reporting Visibility</p>
                      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                        {selectedEmployee.reportingManagerName
                          ? `${selectedEmployee.reportingManagerName} is set as the reporting manager for this employee.`
                          : inferredManager
                            ? `${inferredManager.fullName} is the closest available manager match in the current directory dataset for ${selectedEmployee.department}.`
                            : "No reporting manager is assigned yet."}
                      </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Record Notes</p>
                    <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                      <p>Joined on: {formatJoinedDate(selectedEmployee.createdAt)}</p>
                      <p>{selectedEmployee.designation} · {selectedEmployee.businessUnit} · {selectedEmployee.workLocation}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingEmployee(selectedEmployee)}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
                    >
                      <Icon name="edit" className="h-4 w-4" />
                      Edit Employee
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleStatus(selectedEmployee)}
                      disabled={saving}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                    >
                      <Icon name={selectedEmployee.status === "Active" ? "close" : "approvals"} className="h-4 w-4" />
                      {selectedEmployee.status === "Active" ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Select an employee from the directory to review profile details and HR actions.
                </p>
              )}
            </section>
          </div>
        </div>
      </section>

      <EmployeeModal
        open={Boolean(editingEmployee)}
        employee={editingEmployee}
        employees={employees}
        loading={saving}
        departments={departmentOptions}
        initialProfilePhoto={editingEmployee ? editingEmployee.profilePhotoUrl ?? profilePhotoService.getPhoto(editingEmployee.id) : null}
        onClose={() => setEditingEmployee(null)}
        onSubmit={handleEditSubmit}
      />
    </>
  );
};
