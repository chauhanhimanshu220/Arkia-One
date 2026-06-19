import { useMemo, useState, type FormEvent } from "react";
import type { LeavePayload } from "../../services/leaveService";
import type { LeaveRequest, LeaveTypeDefinition } from "../../types/leave";

interface LeaveRequestFormProps {
  employeeId: string;
  employeeName: string;
  department: string;
  leaveTypes: LeaveTypeDefinition[];
  existingLeaves: LeaveRequest[];
  onSubmit: (payload: LeavePayload) => Promise<void>;
  submitting: boolean;
}

type FormState = {
  type: LeavePayload["type"];
  startDate: string;
  endDate: string;
  reason: string;
};

const countDaysInclusive = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff + 1 : 0;
};

const isDateRangeOverlapping = (startDate: string, endDate: string, existingLeaves: LeaveRequest[]) =>
  existingLeaves.some((leave) => {
    if (leave.status === "Rejected") {
      return false;
    }

    return leave.startDate <= endDate && leave.endDate >= startDate;
  });

export const LeaveRequestForm = ({
  employeeId,
  employeeName,
  department,
  leaveTypes,
  existingLeaves,
  onSubmit,
  submitting,
}: LeaveRequestFormProps) => {
  const initialType = leaveTypes.find((type) => type.active)?.name ?? "Casual Leave";
  const [form, setForm] = useState<FormState>({
    type: initialType,
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const selectedLeaveType = useMemo(
    () => leaveTypes.find((leaveType) => leaveType.name === form.type) ?? leaveTypes[0],
    [form.type, leaveTypes],
  );
  const totalDays = useMemo(() => countDaysInclusive(form.startDate, form.endDate), [form.endDate, form.startDate]);
  const overlappingLeave = useMemo(
    () =>
      form.startDate && form.endDate
        ? existingLeaves.find(
            (leave) =>
              leave.status !== "Rejected" && leave.startDate <= form.endDate && leave.endDate >= form.startDate,
          ) ?? null
        : null,
    [existingLeaves, form.endDate, form.startDate],
  );

  const handleReset = () => {
    setForm({
      type: initialType,
      startDate: "",
      endDate: "",
      reason: "",
    });
    setErrors({});
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.type) {
      nextErrors.type = "Select a leave type.";
    }
    if (!form.startDate) {
      nextErrors.startDate = "Select a start date.";
    }
    if (!form.endDate) {
      nextErrors.endDate = "Select an end date.";
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      nextErrors.endDate = "End date cannot be earlier than start date.";
    }
    if (!form.reason.trim()) {
      nextErrors.reason = "Add a short reason for this leave request.";
    }
    if (form.startDate && form.endDate && isDateRangeOverlapping(form.startDate, form.endDate, existingLeaves)) {
      nextErrors.startDate = "You already have a leave request overlapping this date range.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    await onSubmit({
      employeeId,
      employeeName,
      department,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      days: totalDays,
      reason: form.reason.trim(),
      status: "Pending",
      managerApprovalStatus: "Pending",
      hrApprovalStatus: "Pending",
      adminApprovalStatus: "Pending",
    });

    handleReset();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Leave Type</label>
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as LeavePayload["type"] }))}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
            >
              {leaveTypes.filter((type) => type.active).map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
            </select>
            {errors.type ? <p className="mt-2 text-xs text-rose-500">{errors.type}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Total Days</label>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
              {totalDays > 0 ? `${totalDays} day${totalDays > 1 ? "s" : ""}` : "Select dates to calculate"}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
            />
            {errors.startDate ? <p className="mt-2 text-xs text-rose-500">{errors.startDate}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">End Date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
            />
            {errors.endDate ? <p className="mt-2 text-xs text-rose-500">{errors.endDate}</p> : null}
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Reason</label>
          <textarea
            rows={5}
            value={form.reason}
            onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Explain why you need leave for this period"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
          />
          {errors.reason ? <p className="mt-2 text-xs text-rose-500">{errors.reason}</p> : null}
        </div>

        {overlappingLeave ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Existing {overlappingLeave.status.toLowerCase()} request found from {overlappingLeave.startDate} to {overlappingLeave.endDate}.
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-800 dark:bg-black/70">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Selected Leave Type</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{selectedLeaveType?.description ?? "Leave policy details will appear here."}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="rounded-full bg-white px-3 py-1 dark:bg-black">
              {selectedLeaveType?.paid ? "Paid leave" : "Unpaid leave"}
            </span>
            <span className="rounded-full bg-white px-3 py-1 dark:bg-black">
              {selectedLeaveType?.approvalRequired ? "Manager approval required" : "No approval required"}
            </span>
            <span className="rounded-full bg-white px-3 py-1 dark:bg-black">
              Allocation: {selectedLeaveType?.annualAllocation ?? 0} days / year
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-zinc-950 dark:bg-white px-5 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Submitting..." : "Submit Leave Request"}
        </button>
      </div>
    </form>
  );
};
