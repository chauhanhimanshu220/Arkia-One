import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { WorkspacePageHero } from "../../components/WorkspacePageHero";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";
import { leaveService, type LeaveTypePayload } from "../../services/leaveService";
import type { LeaveTypeDefinition } from "../../types/leave";

interface LeaveTypeFormState {
  id?: string;
  name: string;
  code: string;
  annualAllocation: string;
  color: string;
  paid: boolean;
  approvalRequired: boolean;
  active: boolean;
  description: string;
}

const defaultFormState: LeaveTypeFormState = {
  name: "",
  code: "",
  annualAllocation: "0",
  color: "#09090b",
  paid: true,
  approvalRequired: true,
  active: true,
  description: "",
};

const colorSwatches = ["#09090b", "#16a34a", "#f59e0b", "#7c3aed", "#f43f5e", "#14b8a6"];
const colorPattern = /^#(?:[0-9a-fA-F]{6})$/;

const toFormState = (leaveType: LeaveTypeDefinition): LeaveTypeFormState => ({
  id: leaveType.id,
  name: leaveType.name,
  code: leaveType.code,
  annualAllocation: String(leaveType.annualAllocation),
  color: leaveType.color,
  paid: leaveType.paid,
  approvalRequired: leaveType.approvalRequired,
  active: leaveType.active,
  description: leaveType.description,
});

export const LeaveTypeConfigurationPage = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [form, setForm] = useState<LeaveTypeFormState>(defaultFormState);

  const loadLeaveTypes = async () => {
    setLoading(true);
    try {
      const records = await leaveService.getLeaveTypes();
      const sorted = [...records].sort((left, right) => left.name.localeCompare(right.name));
      setLeaveTypes(sorted);
    } catch {
      showToast("Unable to load leave type configuration right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeaveTypes();
  }, []);

  const filteredLeaveTypes = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return leaveTypes;
    }

    return leaveTypes.filter((leaveType) =>
      [leaveType.name, leaveType.code, leaveType.description].join(" ").toLowerCase().includes(query),
    );
  }, [leaveTypes, searchText]);

  const selectedLeaveType = useMemo(
    () => leaveTypes.find((leaveType) => leaveType.id === selectedTypeId) ?? null,
    [leaveTypes, selectedTypeId],
  );

  useEffect(() => {
    if (selectedLeaveType) {
      setForm(toFormState(selectedLeaveType));
      return;
    }

    setForm(defaultFormState);
  }, [selectedLeaveType]);

  const stats = useMemo(() => {
    const active = leaveTypes.filter((leaveType) => leaveType.active);
    return {
      total: active.length,
      approval: active.filter((leaveType) => leaveType.approvalRequired).length,
      paid: active.filter((leaveType) => leaveType.paid).length,
      inactive: leaveTypes.filter((leaveType) => !leaveType.active).length,
    };
  }, [leaveTypes]);

  const resetForm = () => {
    setSelectedTypeId(null);
    setForm(defaultFormState);
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    const trimmedCode = form.code.trim().toUpperCase();
    const annualAllocation = Number(form.annualAllocation);

    if (!trimmedName) {
      showToast("Leave type name is required.", "info");
      return;
    }

    if (!trimmedCode) {
      showToast("Leave code is required.", "info");
      return;
    }

    if (!colorPattern.test(form.color.trim())) {
      showToast("Color must be a valid hex value like #09090b.", "info");
      return;
    }

    if (!Number.isFinite(annualAllocation) || annualAllocation < 0) {
      showToast("Max days per year must be zero or more.", "info");
      return;
    }

    const duplicateCode = leaveTypes.some(
      (leaveType) => leaveType.id !== form.id && leaveType.code.toUpperCase() === trimmedCode,
    );

    if (duplicateCode) {
      showToast("Leave code must be unique.", "info");
      return;
    }

    const payload: LeaveTypePayload = {
      id: form.id,
      name: trimmedName,
      code: trimmedCode,
      color: form.color.trim(),
      annualAllocation,
      paid: form.paid,
      approvalRequired: form.approvalRequired,
      active: form.active,
      description: form.description.trim() || `Policy rule for ${trimmedName}.`,
    };

    setSaving(true);
    try {
      const saved = await leaveService.saveLeaveType(payload);
      setLeaveTypes((current) => {
        const next = current.some((leaveType) => leaveType.id === saved.id)
          ? current.map((leaveType) => (leaveType.id === saved.id ? saved : leaveType))
          : [saved, ...current];

        return [...next].sort((left, right) => left.name.localeCompare(right.name));
      });
      setSelectedTypeId(saved.id);
      showToast(form.id ? "Leave type updated successfully." : "Leave type created successfully.", "success");
    } catch {
      showToast("Unable to save leave type right now.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (leaveType: LeaveTypeDefinition) => {
    setSaving(true);
    try {
      await leaveService.deleteLeaveType(leaveType.id);
      await loadLeaveTypes();
      if (selectedTypeId === leaveType.id) {
        resetForm();
      }
      showToast(`${leaveType.name} marked as inactive.`, "success");
    } catch {
      showToast("Unable to deactivate leave type right now.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading leave type configuration..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Leave types">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-zinc-950 dark:bg-white px-5 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
          >
            <Icon name="plus" className="h-4 w-4" />
            Add type
          </button>
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active Types" value={stats.total} subtitle="Available in employee flows" accent="bg-zinc-500/20" />
          <StatCard label="Approval Required" value={stats.approval} subtitle="Types routed into approval inboxes" accent="bg-amber-500/20" />
          <StatCard label="Paid Types" value={stats.paid} subtitle="Paid leave categories currently configured" accent="bg-emerald-500/20" />
          <StatCard label="Inactive Types" value={stats.inactive} subtitle="Archived policy entries retained for reference" accent="bg-zinc-400/20" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_420px]">
          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <div className="flex flex-col gap-4 border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Configured leave types</p>
              </div>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search name, code, or description"
                className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50/90 dark:bg-black/70">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                    <th className="px-6 py-4">Leave Type</th>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Paid</th>
                    <th className="px-6 py-4">Approval</th>
                    <th className="px-6 py-4">Color</th>
                    <th className="px-6 py-4">Max Days</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredLeaveTypes.map((leaveType) => (
                    <tr
                      key={leaveType.id}
                      className={`transition ${
                        selectedTypeId === leaveType.id ? "bg-brand-50/70 dark:bg-brand-500/10" : "hover:bg-zinc-50/80 dark:hover:bg-black/70"
                      }`}
                    >
                      <td className="px-6 py-4 align-top">
                        <button type="button" onClick={() => setSelectedTypeId(leaveType.id)} className="text-left">
                          <p className="font-semibold text-zinc-900 dark:text-white">{leaveType.name}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{leaveType.description}</p>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{leaveType.code}</td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{leaveType.paid ? "Paid" : "Unpaid"}</td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{leaveType.approvalRequired ? "Required" : "Optional"}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="h-4 w-4 rounded-full border border-white/80 shadow-sm" style={{ backgroundColor: leaveType.color }} />
                          <span className="text-sm text-zinc-600 dark:text-zinc-300">{leaveType.color}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">{leaveType.annualAllocation}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            leaveType.active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                          }`}
                        >
                          {leaveType.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedTypeId(leaveType.id)}
                          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          <Icon name="edit" className="h-4 w-4" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredLeaveTypes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No leave types match the current search.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">{form.id ? "Edit Leave Type" : "Create Leave Type"}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Configure entitlement, approval behavior, and display metadata for this policy type.</p>
              </div>
              {form.id ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Name</span>
                  <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Code</span>
                  <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Max Days Per Year</span>
                  <input type="number" min="0" value={form.annualAllocation} onChange={(event) => setForm((current) => ({ ...current, annualAllocation: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Color</span>
                  <div className="flex gap-3">
                    <input type="color" value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} className="h-12 w-16 rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-black" />
                    <input value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {colorSwatches.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, color: swatch }))}
                    className={`h-9 w-9 rounded-full border-2 transition ${form.color === swatch ? "border-zinc-900 dark:border-white" : "border-white/80 dark:border-zinc-700"}`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/70">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Paid Leave</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Use this for paid entitlement categories.</p>
                  </div>
                  <input type="checkbox" checked={form.paid} onChange={(event) => setForm((current) => ({ ...current, paid: event.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/70">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Requires Approval</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Toggle whether requests route into approval inboxes.</p>
                  </div>
                  <input type="checkbox" checked={form.approvalRequired} onChange={(event) => setForm((current) => ({ ...current, approvalRequired: event.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Description</span>
                <textarea rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-[1.5rem] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
              </label>

              <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50 dark:text-zinc-300">
                <p className="font-semibold text-[#185FA5] dark:text-[#B5D4F4]">Preview</p>
                <p className="mt-3">{form.name || "Leave type name"}</p>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">{form.code || "CODE"} · {form.paid ? "Paid" : "Unpaid"} · {form.approvalRequired ? "Approval required" : "Auto-approve ready"}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="h-4 w-4 rounded-full border border-white/80 shadow-sm" style={{ backgroundColor: form.color }} />
                  <span>{form.annualAllocation || "0"} days / year</span>
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => (selectedLeaveType ? void handleDeactivate(selectedLeaveType) : resetForm())}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
                >
                  <Icon name="trash" className="h-4 w-4" />
                  {selectedLeaveType ? (selectedLeaveType.active ? "Deactivate" : "Keep Inactive") : "Clear"}
                </button>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : form.id ? "Save Changes" : "Create Leave Type"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </>
  );
};
