import { useMemo, useState } from "react";
import { DepartmentDetailsDrawer } from "../../components/departments/DepartmentDetailsDrawer";
import { DepartmentFormModal } from "../../components/departments/DepartmentFormModal";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Pagination } from "../../components/Pagination";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { useDepartments } from "../../hooks/useDepartments";
import { useEmployees } from "../../hooks/useEmployees";
import { ApiError } from "../../services/departmentService";
import { useToast } from "../../hooks/useToast";
import type { DepartmentDetail, DepartmentPayload, DepartmentStatus, DepartmentSummary } from "../../types/department";

const ITEMS_PER_PAGE = 8;

type HeadFilter = "All" | "With Head" | "No Head";
type StaffingFilter = "All" | "With Employees" | "No Employees";

const statusTone = (status: DepartmentStatus) =>
  status === "Active"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-zinc-200 text-zinc-700";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const DepartmentManagementPage = () => {
  const {
    departments,
    loading,
    addDepartment,
    updateDepartment,
    activateDepartment,
    deactivateDepartment,
    getDepartment,
  } = useDepartments();
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DepartmentStatus | "All">("All");
  const [headFilter, setHeadFilter] = useState<HeadFilter>("All");
  const [staffingFilter, setStaffingFilter] = useState<StaffingFilter>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [departmentDetail, setDepartmentDetail] = useState<DepartmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const filteredDepartments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return departments.filter((department) => {
      const matchesSearch =
        !query ||
        department.name.toLowerCase().includes(query) ||
        department.code.toLowerCase().includes(query) ||
        (department.headEmployeeName ?? "").toLowerCase().includes(query);

      const matchesStatus = statusFilter === "All" || department.status === statusFilter;
      const matchesHead =
        headFilter === "All" ||
        (headFilter === "With Head" ? Boolean(department.headEmployeeId) : !department.headEmployeeId);
      const matchesStaffing =
        staffingFilter === "All" ||
        (staffingFilter === "With Employees" ? department.employeeCount > 0 : department.employeeCount === 0);

      return matchesSearch && matchesStatus && matchesHead && matchesStaffing;
    });
  }, [departments, headFilter, searchTerm, staffingFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      totalDepartments: departments.length,
      activeDepartments: departments.filter((department) => department.status === "Active").length,
      inactiveDepartments: departments.filter((department) => department.status === "Inactive").length,
      withoutHead: departments.filter((department) => !department.headEmployeeId).length,
      withoutEmployees: departments.filter((department) => department.employeeCount === 0).length,
    };
  }, [departments]);

  const watchlist = useMemo(() => {
    return filteredDepartments
      .filter((department) => !department.headEmployeeId || department.employeeCount === 0)
      .sort((left, right) => {
        if (Number(Boolean(left.headEmployeeId)) !== Number(Boolean(right.headEmployeeId))) {
          return Number(Boolean(left.headEmployeeId)) - Number(Boolean(right.headEmployeeId));
        }

        return left.employeeCount - right.employeeCount;
      })
      .slice(0, 4);
  }, [filteredDepartments]);

  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);

  const paginatedDepartments = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredDepartments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDepartments, page]);

  const extractApiMessage = (rawMessage: string) => {
    try {
      const parsed = JSON.parse(rawMessage) as { message?: string };
      return parsed.message;
    } catch {
      return rawMessage;
    }
  };

  const activeDepartmentNames = useMemo(
    () => new Set(departments.filter((department) => department.status === "Active").map((department) => department.name)),
    [departments],
  );

  const handleExport = () => {
    const headers = ["Department Name", "Code", "Parent", "Head", "Employees", "Projects", "Status", "Updated"];
    const rows = filteredDepartments.map((department) => [
      department.name,
      department.code,
      department.parentDepartmentName ?? "",
      department.headEmployeeName ?? "",
      String(department.employeeCount),
      String(department.projectCount),
      department.status,
      department.updatedAtUtc,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "department-records.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Department records exported as CSV.", "info");
  };

  const openAddModal = () => {
    setSelectedDepartment(null);
    setModalOpen(true);
  };

  const openEditModal = (department: DepartmentSummary) => {
    setSelectedDepartment(department);
    setModalOpen(true);
  };

  const openDepartmentDrawer = async (department: DepartmentSummary) => {
    setDrawerOpen(true);
    setDetailLoading(true);
    setDepartmentDetail(null);

    try {
      const detail = await getDepartment(department.id);
      setDepartmentDetail(detail);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? extractApiMessage(error.message) ?? "Unable to load department details right now."
          : "Unable to load department details right now.";
      showToast(message, "error");
      setDrawerOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: DepartmentPayload) => {
    setSaving(true);
    try {
      const saved = selectedDepartment
        ? await updateDepartment(selectedDepartment.id, values)
        : await addDepartment(values);

      showToast(selectedDepartment ? "Department updated successfully." : "Department created successfully.", "success");
      setModalOpen(false);
      setSelectedDepartment(null);
      setCurrentPage(1);

      if (drawerOpen && departmentDetail?.id === saved.id) {
        const detail = await getDepartment(saved.id);
        setDepartmentDetail(detail);
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? extractApiMessage(error.message) ?? "Unable to save department right now."
          : "Unable to save department right now.";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (department: DepartmentSummary) => {
    const nextAction = department.status === "Active" ? "deactivate" : "activate";
    const confirmed = window.confirm(
      `Are you sure you want to ${nextAction} ${department.name}?`,
    );

    if (!confirmed) {
      return;
    }

    setStatusUpdatingId(department.id);
    try {
      const updated =
        department.status === "Active"
          ? await deactivateDepartment(department.id)
          : await activateDepartment(department.id);

      showToast(
        department.status === "Active"
          ? "Department deactivated successfully."
          : "Department activated successfully.",
        "success",
      );

      if (drawerOpen && departmentDetail?.id === updated.id) {
        const detail = await getDepartment(updated.id);
        setDepartmentDetail(detail);
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? extractApiMessage(error.message) ?? "Unable to update department status right now."
          : "Unable to update department status right now.";
      showToast(message, "error");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading department directory..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Department Management</h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Export
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="rounded-2xl bg-zinc-950 dark:bg-white px-5 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
            >
              Add Department
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Departments" value={stats.totalDepartments} subtitle="Master records" accent="bg-zinc-500/20" />
          <StatCard label="Active Departments" value={stats.activeDepartments} subtitle="In use" accent="bg-emerald-500/20" />
          <StatCard label="Inactive Departments" value={stats.inactiveDepartments} subtitle="Inactive" accent="bg-zinc-400/20" />
          <StatCard label="Without Head" value={stats.withoutHead} subtitle="Needs head" accent="bg-amber-500/20" />
          <StatCard label="Without Employees" value={stats.withoutEmployees} subtitle="Unstaffed" accent="bg-cyan-500/20" />
        </div>

        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-5 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_220px_220px]">
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by department name, code, or head"
              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as DepartmentStatus | "All");
                setCurrentPage(1);
              }}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select
              value={headFilter}
              onChange={(event) => {
                setHeadFilter(event.target.value as HeadFilter);
                setCurrentPage(1);
              }}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="All">All head states</option>
              <option value="With Head">With head</option>
              <option value="No Head">No head</option>
            </select>
            <select
              value={staffingFilter}
              onChange={(event) => {
                setStaffingFilter(event.target.value as StaffingFilter);
                setCurrentPage(1);
              }}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="All">All staffing states</option>
              <option value="With Employees">With employees</option>
              <option value="No Employees">No employees</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)]">
          <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{filteredDepartments.length} departments</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50/90 dark:bg-black/70">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Department</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Code</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Parent</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Head</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Employees</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Projects</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Status</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Updated</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {paginatedDepartments.map((department) => (
                    <tr
                      key={department.id}
                      className="cursor-pointer transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60"
                      onClick={() => void openDepartmentDrawer(department)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-zinc-900 dark:text-white">{department.name}</div>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">{department.code}</td>
                      <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-300">{department.parentDepartmentName ?? "—"}</td>
                      <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-300">{department.headEmployeeName ?? "Unassigned"}</td>
                      <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                        {department.employeeCount}
                        <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">({department.activeEmployeeCount} active)</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-300">{department.projectCount}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(department.status)}`}>
                          {department.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatDate(department.updatedAtUtc)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditModal(department);
                            }}
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleToggleStatus(department);
                            }}
                            disabled={statusUpdatingId === department.id}
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                          >
                            {statusUpdatingId === department.id
                              ? "Updating..."
                              : department.status === "Active"
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredDepartments.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No departments match the current filters.
              </div>
            ) : null}

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-5 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {watchlist.length} {watchlist.length === 1 ? "department needs attention" : "departments need attention"}
              </h3>
              <div className="mt-4 space-y-3">
                {watchlist.length > 0 ? (
                  watchlist.map((department) => (
                    <button
                      key={department.id}
                      type="button"
                      onClick={() => void openDepartmentDrawer(department)}
                      className="w-full rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-left transition hover:bg-zinc-100 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:hover:bg-zinc-900"
                    >
                      <p className="font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{department.name}</p>
                      <p className="mt-1 text-sm text-[#185FA5] dark:text-[#B5D4F4]">
                        {!department.headEmployeeId
                          ? "No head assigned."
                          : department.employeeCount === 0
                            ? "No employees mapped."
                            : "Needs review."}
                      </p>
                    </button>
                  ))
                ) : (
                    <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-sm text-[#185FA5] dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:text-[#B5D4F4]">
                    No issues in current view.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-gradient-to-br from-zinc-900 via-zinc-800 to-brand-700 p-5 text-white shadow-panel">
              <p className="text-sm font-medium text-white/70">Active</p>
              <p className="mt-2 text-3xl font-bold">{activeDepartmentNames.size}</p>
            </div>
          </div>
        </div>
      </section>

      <DepartmentFormModal
        open={modalOpen}
        department={selectedDepartment}
        departments={departments}
        employees={employees}
        loading={saving}
        onClose={() => {
          setModalOpen(false);
          setSelectedDepartment(null);
        }}
        onSubmit={handleSubmit}
      />

      <DepartmentDetailsDrawer
        open={drawerOpen}
        department={departmentDetail}
        loading={detailLoading}
        onClose={() => {
          setDrawerOpen(false);
          setDepartmentDetail(null);
        }}
      />
    </>
  );
};
