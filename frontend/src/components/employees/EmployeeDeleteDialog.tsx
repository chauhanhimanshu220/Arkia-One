import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import type { Employee } from "../../types/employee";

interface EmployeeDeleteDialogProps {
  employee: Employee | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const EmployeeDeleteDialog = ({ employee, loading, onClose, onConfirm }: EmployeeDeleteDialogProps) => {
  useBodyScrollLock(Boolean(employee));

  if (!employee) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white p-6 shadow-panel dark:border-zinc-800 dark:bg-black">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-rose-500">Delete Employee</p>
        <h2 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">Are you sure?</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          This will permanently remove <span className="font-semibold text-zinc-700 dark:text-zinc-200">{employee.fullName}</span> from
          the employee directory.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};
