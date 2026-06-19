import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import type { DepartmentPayload, DepartmentSummary } from "../../types/department";
import type { Employee } from "../../types/employee";
import { Icon } from "../Icon";

interface DepartmentFormModalProps {
  open: boolean;
  department: DepartmentSummary | null;
  departments: DepartmentSummary[];
  employees: Employee[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: DepartmentPayload) => Promise<void>;
}

type FormValues = DepartmentPayload;

const emptyForm: FormValues = {
  name: "",
  code: "",
  description: "",
  parentDepartmentId: null,
  headEmployeeId: null,
  emailAlias: "",
  costCenter: "",
  status: "Active",
};

export const DepartmentFormModal = ({
  open,
  department,
  departments,
  employees,
  loading,
  onClose,
  onSubmit,
}: DepartmentFormModalProps) => {
  useBodyScrollLock(open);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [error, setError] = useState("");

  const parentOptions = useMemo(
    () => departments.filter((item) => item.id !== department?.id).sort((left, right) => left.name.localeCompare(right.name)),
    [department?.id, departments],
  );

  const headOptions = useMemo(() => {
    const normalizedDepartment = form.name.trim().toLowerCase();
    if (!normalizedDepartment) {
      return [];
    }

    const activeEmployees = employees.filter((employee) => employee.status === "Active");
    const matched = activeEmployees.filter((employee) => employee.department.trim().toLowerCase() === normalizedDepartment);
    const selectedHead =
      form.headEmployeeId && !matched.some((employee) => employee.id === form.headEmployeeId)
        ? activeEmployees.find((employee) => employee.id === form.headEmployeeId) ?? null
        : null;

    return selectedHead ? [selectedHead, ...matched] : matched;
  }, [employees, form.headEmployeeId, form.name]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (department) {
      setForm({
        name: department.name,
        code: department.code,
        description: department.description,
        parentDepartmentId: department.parentDepartmentId,
        headEmployeeId: department.headEmployeeId,
        emailAlias: department.emailAlias,
        costCenter: department.costCenter,
        status: department.status,
      });
      setError("");
      return;
    }

    setForm(emptyForm);
    setError("");
  }, [department, open]);

  if (!open) {
    return null;
  }

  const panelClass =
    "max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2.25rem] border border-white/70 bg-white/95 px-7 py-6 shadow-panel dark:border-zinc-800 dark:bg-black";
  const sectionClass = "rounded-[2rem] border border-zinc-200 bg-white/90 p-6 dark:border-zinc-800 dark:bg-black/60";
  const inputClass =
    "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200";
  const labelClass = "mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Department name is required.");
      return;
    }

    if (!form.code.trim()) {
      setError("Department code is required.");
      return;
    }

    setError("");
    await onSubmit({
      ...form,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      emailAlias: form.emailAlias.trim(),
      costCenter: form.costCenter.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className={panelClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-brand-600 dark:text-zinc-400 dark:text-zinc-500">
              {department ? "Edit Department" : "Add Department"}
            </p>
            <h2 className="mt-3 text-[2rem] font-bold tracking-tight text-zinc-900 dark:text-white">Department details</h2>
            <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">
              Define structure, ownership, and status so the rest of the system can use this department safely.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 bg-white p-3 text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
            aria-label="Close department modal"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className={sectionClass}>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Department Name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className={inputClass}
                  placeholder="Engineering"
                />
              </div>
              <div>
                <label className={labelClass}>Department Code</label>
                <input
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  className={inputClass}
                  placeholder="ENG"
                />
              </div>
            </div>

            <div className="mt-5">
              <label className={labelClass}>Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className={inputClass}
                placeholder="Describe department scope, ownership, and operational purpose"
              />
            </div>
          </div>

          <div className={sectionClass}>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Structure</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Parent Department</label>
                <select
                  value={form.parentDepartmentId ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      parentDepartmentId: event.target.value || null,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">No parent department</option>
                  {parentOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Department Head</label>
                <select
                  value={form.headEmployeeId ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      headEmployeeId: event.target.value || null,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">No head assigned</option>
                  {headOptions.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Only active employees already mapped to this department are eligible as head.
                </p>
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Settings</p>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <div>
                <label className={labelClass}>Email Alias</label>
                <input
                  value={form.emailAlias}
                  onChange={(event) => setForm((current) => ({ ...current, emailAlias: event.target.value }))}
                  className={inputClass}
                  placeholder="engineering@company.com"
                />
              </div>
              <div>
                <label className={labelClass}>Cost Center</label>
                <input
                  value={form.costCenter}
                  onChange={(event) => setForm((current) => ({ ...current, costCenter: event.target.value }))}
                  className={inputClass}
                  placeholder="CC-1001"
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as FormValues["status"],
                    }))
                  }
                  className={inputClass}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}

          <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-zinc-950 dark:bg-white px-6 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Saving..." : department ? "Update Department" : "Save Department"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
