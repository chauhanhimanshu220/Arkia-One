import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ToastContainer } from "../../components/ToastContainer";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { LeaveRequestForm } from "../../components/leaves/LeaveRequestForm";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useEmployees } from "../../hooks/useEmployees";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../services/http";
import { leaveService, type LeavePayload } from "../../services/leaveService";
import type { AuthUser } from "../../types/auth";
import type { LeaveRequest, LeaveTypeDefinition } from "../../types/leave";

const formatDisplayDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const RequestLeavePage = ({ user }: { user: AuthUser }) => {
  const { employees, loading: employeesLoading } = useEmployees();
  const { toasts, showToast, dismissToast } = useToast();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDefinition[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const [types, requests] = await Promise.all([
          leaveService.getLeaveTypes(),
          leaveService.getLeaves({ employeeId: user.id, year: new Date().getFullYear() }),
        ]);

        if (!active) {
          return;
        }

        setLeaveTypes(types);
        setLeaveRequests(requests);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [user.id]);

  const employeeProfile = useMemo(
    () => employees.find((employee) => employee.id === user.id),
    [employees, user.id],
  );

  const leaveBalances = useMemo(() => {
    return leaveTypes.map((leaveType) => {
      const usedDays = leaveRequests
        .filter((request) => request.type === leaveType.name && request.status !== "Rejected")
        .reduce((sum, request) => sum + request.days, 0);

      return {
        ...leaveType,
        usedDays,
        remainingDays: Math.max(leaveType.annualAllocation - usedDays, 0),
      };
    });
  }, [leaveRequests, leaveTypes]);

  const pendingRequests = useMemo(
    () => leaveRequests.filter((request) => request.status === "Pending").length,
    [leaveRequests],
  );
  const recentRequests = useMemo(() => leaveRequests.slice(0, 4), [leaveRequests]);
  const defaultDepartment = employeeProfile?.department ?? "Operations";

  const handleSubmit = async (payload: LeavePayload) => {
    setSubmitting(true);
    try {
      const created = await leaveService.addLeave(payload);
      setLeaveRequests((current) => [created, ...current]);
      showToast("Leave request submitted successfully.", "success");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message || "Unable to submit the leave request right now."
          : "Unable to submit the leave request right now.";
      showToast(message, "error");
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || employeesLoading) {
    return <LoadingSpinner label="Loading leave request form..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Request leave">
          <WorkspaceHeroMeta primary={`${pendingRequests} pending`} />
        </WorkspacePageHero>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
          <LeaveRequestForm
            employeeId={user.id}
            employeeName={user.fullName}
            department={defaultDepartment}
            leaveTypes={leaveTypes}
            existingLeaves={leaveRequests}
            onSubmit={handleSubmit}
            submitting={submitting}
          />

          <div className="space-y-6">
            <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Leave Balance</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Your current yearly allowance summary by leave type.
              </p>
              <div className="mt-5 space-y-3">
                {leaveBalances.map((leaveType) => (
                  <div key={leaveType.id} className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-white">{leaveType.name}</p>
                        <p className="mt-1 text-xs text-[#185FA5] dark:text-[#B5D4F4]">
                          Used {leaveType.usedDays} of {leaveType.annualAllocation} days
                        </p>
                      </div>
                      <span className="rounded-full bg-zinc-950 px-3 py-1 text-sm font-semibold text-white dark:bg-brand-500/15 dark:text-zinc-200">
                        {leaveType.remainingDays} left
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Approval Notes</p>
              <div className="mt-4 space-y-3">
                {[
                  "Submitted requests move into the manager approval flow automatically.",
                  "Overlapping pending or approved leave requests are blocked before submit.",
                  "Use your leave history to track previous approvals and status changes.",
                ].map((item) => (
                  <div key={item} className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70 dark:text-zinc-300">
                    {item}
                  </div>
                ))}
              </div>
              <Link
                to="/admin/leave/history"
                className="mt-5 inline-flex rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                View Leave History
              </Link>
            </div>

            <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Recent Requests</p>
              {recentRequests.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {recentRequests.map((request) => (
                    <div key={request.id} className="rounded-l-none rounded-r-[1.5rem] border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/70">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">{request.type}</p>
                          <p className="mt-1 text-sm text-[#185FA5] dark:text-[#B5D4F4]">
                            {formatDisplayDate(request.startDate)} to {formatDisplayDate(request.endDate)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            request.status === "Approved"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                              : request.status === "Rejected"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
                          }`}
                        >
                          {request.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300"><span className="text-[#185FA5] dark:text-[#B5D4F4]">{request.days} day(s)</span> · {request.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                  You have not submitted any leave requests for the current year yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
