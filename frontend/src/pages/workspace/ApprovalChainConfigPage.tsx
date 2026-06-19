import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { WorkspacePageHero } from "../../components/WorkspacePageHero";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";

type ApprovalModule =
  | "Leave Management"
  | "Timesheet Approval"
  | "Expense Claims"
  | "Purchase Requests"
  | "Travel Requests";

type AppliesToType = "Organisation" | "Department" | "Role" | "Employee Group";
type ApprovalOrder = "Sequential" | "Parallel";
type ApproverType =
  | "Reporting Manager"
  | "Specific User"
  | "Role-Based Approver"
  | "Department Head"
  | "HR Manager"
  | "Finance Admin"
  | "System Admin";

interface ApprovalLevel {
  id: string;
  approverType: ApproverType;
  approverValue: string;
  mandatory: boolean;
  escalationDays: string;
  allowReject: boolean;
  notes: string;
}

interface ApprovalChain {
  id: string;
  name: string;
  module: ApprovalModule;
  requestType: string;
  appliesToType: AppliesToType;
  appliesToValue: string;
  approvalOrder: ApprovalOrder;
  finalAction: "Approved" | "Rejected" | "Sent Back" | "Escalated";
  stopOnReject: boolean;
  autoApproveAfterDays: string;
  isActive: boolean;
  description: string;
  updatedAt: string;
  levels: ApprovalLevel[];
}

interface ApprovalChainFormState {
  id?: string;
  name: string;
  module: ApprovalModule;
  requestType: string;
  appliesToType: AppliesToType;
  appliesToValue: string;
  approvalOrder: ApprovalOrder;
  finalAction: "Approved" | "Rejected" | "Sent Back" | "Escalated";
  stopOnReject: boolean;
  autoApproveAfterDays: string;
  isActive: boolean;
  description: string;
  levels: ApprovalLevel[];
}

const createId = () => crypto.randomUUID();

const createEmptyLevel = (overrides?: Partial<ApprovalLevel>): ApprovalLevel => ({
  id: createId(),
  approverType: "Reporting Manager",
  approverValue: "",
  mandatory: true,
  escalationDays: "2",
  allowReject: true,
  notes: "",
  ...overrides,
});

const defaultFormState: ApprovalChainFormState = {
  name: "",
  module: "Leave Management",
  requestType: "",
  appliesToType: "Department",
  appliesToValue: "",
  approvalOrder: "Sequential",
  finalAction: "Approved",
  stopOnReject: true,
  autoApproveAfterDays: "",
  isActive: true,
  description: "",
  levels: [createEmptyLevel()],
};

const moduleOptions: ApprovalModule[] = [
  "Leave Management",
  "Timesheet Approval",
  "Expense Claims",
  "Purchase Requests",
  "Travel Requests",
];

const appliesToOptions: AppliesToType[] = ["Organisation", "Department", "Role", "Employee Group"];
const approvalOrderOptions: ApprovalOrder[] = ["Sequential", "Parallel"];
const approverOptions: ApproverType[] = [
  "Reporting Manager",
  "Specific User",
  "Role-Based Approver",
  "Department Head",
  "HR Manager",
  "Finance Admin",
  "System Admin",
];
const finalActionOptions: ApprovalChainFormState["finalAction"][] = ["Approved", "Rejected", "Sent Back", "Escalated"];

const toFormState = (chain: ApprovalChain): ApprovalChainFormState => ({
  id: chain.id,
  name: chain.name,
  module: chain.module,
  requestType: chain.requestType,
  appliesToType: chain.appliesToType,
  appliesToValue: chain.appliesToValue,
  approvalOrder: chain.approvalOrder,
  finalAction: chain.finalAction,
  stopOnReject: chain.stopOnReject,
  autoApproveAfterDays: chain.autoApproveAfterDays,
  isActive: chain.isActive,
  description: chain.description,
  levels: chain.levels.map((level) => ({ ...level })),
});

const formatUpdatedAt = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const statusTone = {
  Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Inactive: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
} as const;

export const ApprovalChainConfigPage = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const [chains, setChains] = useState<ApprovalChain[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [moduleFilter, setModuleFilter] = useState<ApprovalModule | "All">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [form, setForm] = useState<ApprovalChainFormState>({
    ...defaultFormState,
    levels: [createEmptyLevel()],
  });
  const [saving, setSaving] = useState(false);

  const filteredChains = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return chains.filter((chain) => {
      if (moduleFilter !== "All" && chain.module !== moduleFilter) {
        return false;
      }

      if (statusFilter !== "All") {
        const status = chain.isActive ? "Active" : "Inactive";
        if (status !== statusFilter) {
          return false;
        }
      }

      if (query) {
        const haystack = [chain.name, chain.module, chain.requestType, chain.appliesToValue, chain.description]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [chains, moduleFilter, searchText, statusFilter]);

  const selectedChain = useMemo(() => chains.find((chain) => chain.id === selectedChainId) ?? null, [chains, selectedChainId]);

  useEffect(() => {
    if (selectedChain) {
      setForm(toFormState(selectedChain));
      return;
    }

    setForm({
      ...defaultFormState,
      levels: [createEmptyLevel()],
    });
  }, [selectedChain]);

  const stats = useMemo(() => {
    const activeChains = chains.filter((chain) => chain.isActive);
    return {
      active: activeChains.length,
      totalLevels: chains.reduce((sum, chain) => sum + chain.levels.length, 0),
      modulesCovered: new Set(activeChains.map((chain) => chain.module)).size,
      parallel: chains.filter((chain) => chain.approvalOrder === "Parallel").length,
    };
  }, [chains]);

  const resetForm = () => {
    setSelectedChainId(null);
    setForm({
      ...defaultFormState,
      levels: [createEmptyLevel()],
    });
  };

  const updateLevel = (levelId: string, field: keyof ApprovalLevel, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      levels: current.levels.map((level) => (level.id === levelId ? { ...level, [field]: value } : level)),
    }));
  };

  const addLevel = () => {
    setForm((current) => ({
      ...current,
      levels: [...current.levels, createEmptyLevel({ approverType: current.levels[current.levels.length - 1]?.approverType ?? "Reporting Manager" })],
    }));
  };

  const moveLevel = (levelId: string, direction: "up" | "down") => {
    setForm((current) => {
      const index = current.levels.findIndex((level) => level.id === levelId);
      if (index === -1) {
        return current;
      }

      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= current.levels.length) {
        return current;
      }

      const nextLevels = [...current.levels];
      [nextLevels[index], nextLevels[swapIndex]] = [nextLevels[swapIndex], nextLevels[index]];
      return { ...current, levels: nextLevels };
    });
  };

  const removeLevel = (levelId: string) => {
    setForm((current) => {
      if (current.levels.length === 1) {
        return current;
      }

      return {
        ...current,
        levels: current.levels.filter((level) => level.id !== levelId),
      };
    });
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    const trimmedRequestType = form.requestType.trim();
    const trimmedScope = form.appliesToValue.trim();
    const autoApproveAfterDays =
      form.autoApproveAfterDays.trim() === "" ? "" : String(Number(form.autoApproveAfterDays.trim()));

    if (!trimmedName) {
      showToast("Chain name is required.", "info");
      return;
    }

    if (!trimmedRequestType) {
      showToast("Request type is required.", "info");
      return;
    }

    if (form.appliesToType !== "Organisation" && !trimmedScope) {
      showToast("Applicable scope value is required for this chain.", "info");
      return;
    }

    if (form.levels.length === 0) {
      showToast("At least one approval level is required.", "info");
      return;
    }

    if (
      form.levels.some(
        (level) =>
          !level.approverValue.trim() ||
          !level.escalationDays.trim() ||
          Number.isNaN(Number(level.escalationDays)) ||
          Number(level.escalationDays) < 0,
      )
    ) {
      showToast("Each approval level needs an approver value and a valid escalation day count.", "info");
      return;
    }

    const duplicateChain = chains.some(
      (chain) =>
        chain.id !== form.id &&
        chain.module === form.module &&
        chain.requestType.toLowerCase() === trimmedRequestType.toLowerCase() &&
        chain.appliesToType === form.appliesToType &&
        chain.appliesToValue.toLowerCase() === (form.appliesToType === "Organisation" ? "organisation-wide" : trimmedScope.toLowerCase()),
    );

    if (duplicateChain) {
      showToast("A chain for the same module, request type, and scope already exists.", "info");
      return;
    }

    setSaving(true);

    const nextChain: ApprovalChain = {
      id: form.id ?? createId(),
      name: trimmedName,
      module: form.module,
      requestType: trimmedRequestType,
      appliesToType: form.appliesToType,
      appliesToValue: form.appliesToType === "Organisation" ? "Organisation-wide" : trimmedScope,
      approvalOrder: form.approvalOrder,
      finalAction: form.finalAction,
      stopOnReject: form.stopOnReject,
      autoApproveAfterDays,
      isActive: form.isActive,
      description: form.description.trim() || `${trimmedName} approval rules for ${trimmedRequestType}.`,
      updatedAt: new Date().toISOString(),
      levels: form.levels.map((level) => ({
        ...level,
        approverValue: level.approverValue.trim(),
        escalationDays: String(Number(level.escalationDays)),
        notes: level.notes.trim(),
      })),
    };

    window.setTimeout(() => {
      setChains((current) => {
        const next = current.some((chain) => chain.id === nextChain.id)
          ? current.map((chain) => (chain.id === nextChain.id ? nextChain : chain))
          : [nextChain, ...current];

        return [...next].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      });
      setSelectedChainId(nextChain.id);
      setSaving(false);
      showToast(form.id ? "Approval chain updated successfully." : "Approval chain created successfully.", "success");
    }, 450);
  };

  const handleClone = (chain: ApprovalChain) => {
    const clonedChain: ApprovalChain = {
      ...chain,
      id: createId(),
      name: `${chain.name} Copy`,
      isActive: false,
      updatedAt: new Date().toISOString(),
      levels: chain.levels.map((level) => ({
        ...level,
        id: createId(),
      })),
    };

    setChains((current) => [clonedChain, ...current].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
    setSelectedChainId(clonedChain.id);
    showToast("Approval chain cloned into a draft-ready copy.", "success");
  };

  const handleToggleActive = (chain: ApprovalChain) => {
    setChains((current) =>
      current.map((item) =>
        item.id === chain.id
          ? {
              ...item,
              isActive: !item.isActive,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );

    if (selectedChainId === chain.id) {
      setForm((current) => ({ ...current, isActive: !chain.isActive }));
    }

    showToast(chain.isActive ? "Approval chain disabled." : "Approval chain activated.", "success");
  };

  const visibleSelectedChain = selectedChain;

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Approval workflow">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <Icon name="plus" className="h-4 w-4" />
              New chain
            </button>
            <button
              type="button"
              onClick={() => (visibleSelectedChain ? handleClone(visibleSelectedChain) : undefined)}
              disabled={!visibleSelectedChain}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="git-branch" className="h-4 w-4" />
              Clone
            </button>
          </div>
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active Chains" value={stats.active} subtitle="Currently routing live workflow requests" accent="bg-emerald-500/20" />
          <StatCard label="Approval Levels" value={stats.totalLevels} subtitle="Total configured review stages across all chains" accent="bg-zinc-500/20" />
          <StatCard label="Modules Covered" value={stats.modulesCovered} subtitle="Business modules with configured workflow logic" accent="bg-amber-500/20" />
          <StatCard label="Parallel Flows" value={stats.parallel} subtitle="Chains currently configured for multi-approver parallel review" accent="bg-fuchsia-500/20" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)]">
          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <div className="border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Configured chains</p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Search</span>
                    <input
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      placeholder="Chain name, module, request type, scope"
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Module</span>
                    <select
                      value={moduleFilter}
                      onChange={(event) => setModuleFilter(event.target.value as ApprovalModule | "All")}
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                    >
                      <option value="All">All modules</option>
                      {moduleOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</span>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as "All" | "Active" | "Inactive")}
                      className="w-full min-w-44 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                    >
                      <option value="All">All statuses</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setSearchText("");
                      setModuleFilter("All");
                      setStatusFilter("All");
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {filteredChains.map((chain) => {
                const status = chain.isActive ? "Active" : "Inactive";
                const isSelected = selectedChainId === chain.id;

                return (
                  <article
                    key={chain.id}
                    className={`rounded-[1.75rem] border p-5 transition ${
                      isSelected
                        ? "border-brand-200 bg-brand-50/70 dark:border-brand-500/40 dark:bg-brand-500/10"
                        : "border-zinc-200 bg-zinc-50/80 hover:bg-white dark:border-zinc-800 dark:bg-black/70 dark:hover:bg-black"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <button type="button" onClick={() => setSelectedChainId(chain.id)} className="text-left">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-lg font-semibold text-zinc-900 dark:text-white">{chain.name}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[status]}`}>{status}</span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                          {chain.module} · {chain.requestType} · {chain.appliesToType}: {chain.appliesToValue}
                        </p>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">{chain.description}</p>
                      </button>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedChainId(chain.id)}
                          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          <Icon name="edit" className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClone(chain)}
                          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          <Icon name="git-branch" className="h-4 w-4" />
                          Clone
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Levels</p>
                        <p className="mt-2 font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{chain.levels.length}</p>
                      </div>
                      <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Order</p>
                        <p className="mt-2 font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{chain.approvalOrder}</p>
                      </div>
                      <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Updated</p>
                        <p className="mt-2 font-semibold text-[#185FA5] dark:text-[#B5D4F4]">{formatUpdatedAt(chain.updatedAt)}</p>
                      </div>
                    </div>
                  </article>
                );
              })}

              {filteredChains.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-zinc-300 px-6 py-14 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  {chains.length === 0
                    ? "No approval chains have been configured yet."
                    : "No approval chains match the current filters."}
                </div>
              ) : null}
            </div>
          </section>
          <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">{form.id ? "Edit Approval Chain" : "Create Approval Chain"}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Configure workflow scope, approval order, escalation rules, and stage ownership for this chain.
                </p>
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

            <div className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Chain Name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Module</span>
                  <select
                    value={form.module}
                    onChange={(event) => setForm((current) => ({ ...current, module: event.target.value as ApprovalModule }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                  >
                    {moduleOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Request Type</span>
                  <input
                    value={form.requestType}
                    onChange={(event) => setForm((current) => ({ ...current, requestType: event.target.value }))}
                    placeholder="Example: Leave Request or Weekly Timesheet"
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Approval Order</span>
                  <select
                    value={form.approvalOrder}
                    onChange={(event) => setForm((current) => ({ ...current, approvalOrder: event.target.value as ApprovalOrder }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                  >
                    {approvalOrderOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Applies To</span>
                  <select
                    value={form.appliesToType}
                    onChange={(event) => setForm((current) => ({ ...current, appliesToType: event.target.value as AppliesToType }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                  >
                    {appliesToOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Scope Value</span>
                  <input
                    value={form.appliesToType === "Organisation" ? "Organisation-wide" : form.appliesToValue}
                    onChange={(event) => setForm((current) => ({ ...current, appliesToValue: event.target.value }))}
                    disabled={form.appliesToType === "Organisation"}
                    placeholder="Department, role, branch, or employee group"
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:disabled:bg-zinc-950"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Final Action</span>
                  <select
                    value={form.finalAction}
                    onChange={(event) => setForm((current) => ({ ...current, finalAction: event.target.value as ApprovalChainFormState["finalAction"] }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                  >
                    {finalActionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Auto-Approve After Days</span>
                  <input
                    type="number"
                    min="0"
                    value={form.autoApproveAfterDays}
                    onChange={(event) => setForm((current) => ({ ...current, autoApproveAfterDays: event.target.value }))}
                    placeholder="Optional"
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                  />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/70">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Active</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Controls whether the chain is available for routing.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                    className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/70">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Stop Workflow On Reject</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Turn off if rejected requests should route back for revision.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.stopOnReject}
                    onChange={(event) => setForm((current) => ({ ...current, stopOnReject: event.target.checked }))}
                    className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Description</span>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    className="w-full rounded-[1.5rem] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                  />
                </label>
              </div>

              <div className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-black/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-zinc-900 dark:text-white">Approval Levels</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Define who reviews at each stage, whether the step is mandatory, and how long before escalation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addLevel}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl bg-zinc-950 dark:bg-white px-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100"
                  >
                    <Icon name="plus" className="h-4 w-4" />
                    Add Level
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  {form.levels.map((level, index) => (
                    <div key={level.id} className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black/90">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-100">Level {index + 1}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {form.approvalOrder === "Parallel" ? "Runs alongside other stages in the same chain." : "Executes after the previous stage is completed."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => moveLevel(level.id, "up")}
                            className="inline-flex h-9 items-center justify-center rounded-2xl border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLevel(level.id, "down")}
                            className="inline-flex h-9 items-center justify-center rounded-2xl border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLevel(level.id)}
                            disabled={form.levels.length === 1}
                            className="inline-flex h-9 items-center justify-center rounded-2xl border border-rose-200 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/10"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Approver Type</span>
                          <select
                            value={level.approverType}
                            onChange={(event) => updateLevel(level.id, "approverType", event.target.value)}
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                          >
                            {approverOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Approver Value</span>
                          <input
                            value={level.approverValue}
                            onChange={(event) => updateLevel(level.id, "approverValue", event.target.value)}
                            placeholder="Role name, user name, or routing label"
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                          />
                        </label>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-[0.8fr_1fr_1fr]">
                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Escalation Days</span>
                          <input
                            type="number"
                            min="0"
                            value={level.escalationDays}
                            onChange={(event) => updateLevel(level.id, "escalationDays", event.target.value)}
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                          />
                        </label>
                        <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/70">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Mandatory</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Disable only for optional advisory review.</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={level.mandatory}
                            onChange={(event) => updateLevel(level.id, "mandatory", event.target.checked)}
                            className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                          />
                        </label>
                        <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/70">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Allow Reject</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Turn off when the stage can only approve or escalate.</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={level.allowReject}
                            onChange={(event) => updateLevel(level.id, "allowReject", event.target.checked)}
                            className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                          />
                        </label>
                      </div>

                      <label className="mt-4 block space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Stage Notes</span>
                        <textarea
                          rows={2}
                          value={level.notes}
                          onChange={(event) => updateLevel(level.id, "notes", event.target.value)}
                          placeholder="Explain what this approver validates before moving to the next stage."
                          className="w-full rounded-[1.35rem] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-black/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-zinc-900 dark:text-white">Workflow Preview</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Validate how the chain routes from the first reviewer through to the final action.
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${form.isActive ? statusTone.Active : statusTone.Inactive}`}>
                    {form.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {form.levels.map((level, index) => (
                    <div key={level.id} className="flex gap-4">
                      <div className="flex w-10 flex-col items-center">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 dark:bg-white text-sm font-semibold text-white dark:text-black">{index + 1}</span>
                        {index < form.levels.length - 1 ? <span className="mt-2 h-12 w-px bg-zinc-200 dark:bg-zinc-700" /> : null}
                      </div>
                      <div className="flex-1 rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          {level.approverType} {level.approverValue.trim() ? `· ${level.approverValue.trim()}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          {level.mandatory ? "Mandatory stage" : "Optional stage"} · Escalates after {level.escalationDays || "0"} day(s)
                        </p>
                        {level.notes.trim() ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{level.notes.trim()}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Workflow Outcome</p>
                    <div className="mt-3 space-y-2 text-zinc-600 dark:text-zinc-300">
                      <p>Order: {form.approvalOrder}</p>
                      <p>Reject handling: {form.stopOnReject ? "Stop workflow immediately" : "Send back for revision or escalation"}</p>
                      <p>Final action: {form.finalAction}</p>
                    </div>
                  </div>
                  <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Routing Notes</p>
                    <div className="mt-3 space-y-2 text-zinc-600 dark:text-zinc-300">
                      <p>Scope: {form.appliesToType} · {form.appliesToType === "Organisation" ? "Organisation-wide" : form.appliesToValue || "Scope not selected yet"}</p>
                      <p>Module: {form.module}</p>
                      <p>Auto-approve: {form.autoApproveAfterDays ? `After ${form.autoApproveAfterDays} day(s)` : "Disabled"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => (visibleSelectedChain ? handleToggleActive(visibleSelectedChain) : resetForm())}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  <Icon name="settings" className="h-4 w-4" />
                  {visibleSelectedChain ? (visibleSelectedChain.isActive ? "Disable Selected" : "Activate Selected") : "Clear Form"}
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
                    {saving ? "Saving..." : form.id ? "Save Chain" : "Create Chain"}
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
