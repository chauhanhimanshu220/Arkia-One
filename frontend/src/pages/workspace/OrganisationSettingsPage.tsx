import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { StatCard } from "../../components/StatCard";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";
import { USER_ROLES } from "../../types/roles";
import { systemApi } from "../../services/api";

type RoleSetting = {
  role: "Employee" | "Team Manager" | "HR Manager" | "Finance Admin" | "System Admin";
  defaultLanding: string;
  dataScope: string;
  canApprove: boolean;
  canExport: boolean;
  receiveDailyDigest: boolean;
};

type PlatformDefaults = {
  organisationName: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  workWeekStart: string;
  standardDayHours: string;
  leaveCycle: string;
  defaultApprovalMode: string;
};

type EnterpriseControls = {
  multiLevelApproval: boolean;
  auditLogging: boolean;
  strictRejectionNotes: boolean;
  weekendEntryLock: boolean;
  enforceManagerHierarchy: boolean;
  sessionTimeoutMinutes: string;
  passwordRotationDays: string;
  payrollExportEnabled: boolean;
  billingReportsEnabled: boolean;
  advancedReportsEnabled: boolean;
};

const defaultPlatformDefaults: PlatformDefaults = {
  organisationName: "",
  timezone: "",
  dateFormat: "",
  currency: "",
  workWeekStart: "",
  standardDayHours: "",
  leaveCycle: "",
  defaultApprovalMode: "",
};

const defaultRoleSettings: RoleSetting[] = (USER_ROLES as readonly string[])
  .filter((role): role is RoleSetting["role"] => role !== "License Owner")
  .map((role) => ({
    role,
    defaultLanding: "",
    dataScope: "",
    canApprove: false,
    canExport: false,
    receiveDailyDigest: false,
  }));

const defaultEnterpriseControls: EnterpriseControls = {
  multiLevelApproval: false,
  auditLogging: false,
  strictRejectionNotes: false,
  weekendEntryLock: false,
  enforceManagerHierarchy: false,
  sessionTimeoutMinutes: "",
  passwordRotationDays: "",
  payrollExportEnabled: false,
  billingReportsEnabled: false,
  advancedReportsEnabled: false,
};

const toggleCardClass =
  "flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/70";

export const OrganisationSettingsPage = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const [platformDefaults, setPlatformDefaults] = useState<PlatformDefaults>(defaultPlatformDefaults);
  const [roleSettings, setRoleSettings] = useState<RoleSetting[]>(defaultRoleSettings);
  const [enterpriseControls, setEnterpriseControls] = useState<EnterpriseControls>(defaultEnterpriseControls);
  const [lastSavedAt, setLastSavedAt] = useState("Not saved yet");
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const handlePurge = async () => {
    setPurging(true);
    try {
      await systemApi.purgeAllNonUserData();
      showToast("All non-user data (timesheets, leaves, projects, tasks) successfully purged.", "success");
      setShowPurgeConfirm(false);
      window.setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch {
      showToast("Failed to purge data. Please check network connection.", "error");
    } finally {
      setPurging(false);
    }
  };

  const stats = useMemo(
    () => ({
      configuredRoles: roleSettings.length,
      approvalEnabledRoles: roleSettings.filter((role) => role.canApprove).length,
      exportEnabledRoles: roleSettings.filter((role) => role.canExport).length,
      enterpriseFlags: [
        enterpriseControls.multiLevelApproval,
        enterpriseControls.auditLogging,
        enterpriseControls.payrollExportEnabled,
        enterpriseControls.billingReportsEnabled,
        enterpriseControls.advancedReportsEnabled,
      ].filter(Boolean).length,
    }),
    [enterpriseControls, roleSettings],
  );

  const updateRoleSetting = <K extends keyof RoleSetting>(roleName: RoleSetting["role"], field: K, value: RoleSetting[K]) => {
    setRoleSettings((current) =>
      current.map((role) => (role.role === roleName ? { ...role, [field]: value } : role)),
    );
  };

  const handleSave = () => {
    if (!platformDefaults.organisationName.trim()) {
      showToast("Organisation name is required.", "info");
      return;
    }

    if (!platformDefaults.timezone.trim()) {
      showToast("Default timezone is required.", "info");
      return;
    }

    if (!Number.isFinite(Number(platformDefaults.standardDayHours)) || Number(platformDefaults.standardDayHours) <= 0) {
      showToast("Standard day hours must be greater than zero.", "info");
      return;
    }

    if (!Number.isFinite(Number(enterpriseControls.sessionTimeoutMinutes)) || Number(enterpriseControls.sessionTimeoutMinutes) < 5) {
      showToast("Session timeout must be at least 5 minutes.", "info");
      return;
    }

    if (!Number.isFinite(Number(enterpriseControls.passwordRotationDays)) || Number(enterpriseControls.passwordRotationDays) < 0) {
      showToast("Password rotation days must be zero or more.", "info");
      return;
    }

    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setLastSavedAt(
        new Date().toLocaleString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      showToast("Organisation settings saved successfully.", "success");
    }, 400);
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="space-y-6">
        <WorkspacePageHero title="Organisation Settings">
          <WorkspaceHeroMeta primary="Last saved" secondary={lastSavedAt} />
        </WorkspacePageHero>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Roles Configured" value={stats.configuredRoles} subtitle="Role behavior profiles currently managed here" accent="bg-zinc-500/20" />
          <StatCard label="Approval Roles" value={stats.approvalEnabledRoles} subtitle="Roles currently allowed to process approvals" accent="bg-amber-500/20" />
          <StatCard label="Export Roles" value={stats.exportEnabledRoles} subtitle="Roles with report or data export access" accent="bg-emerald-500/20" />
          <StatCard label="Enterprise Flags" value={stats.enterpriseFlags} subtitle="High-level controls enabled across the workspace" accent="bg-fuchsia-500/20" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Platform-wide Defaults</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Base values that apply whenever a lower-level module setting is not explicitly configured.
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 dark:bg-brand-500/15 dark:text-brand-100">
                  Global defaults
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Organisation Name</span>
                  <input value={platformDefaults.organisationName} onChange={(event) => setPlatformDefaults((current) => ({ ...current, organisationName: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Default Timezone</span>
                  <input value={platformDefaults.timezone} onChange={(event) => setPlatformDefaults((current) => ({ ...current, timezone: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Date Format</span>
                  <select value={platformDefaults.dateFormat} onChange={(event) => setPlatformDefaults((current) => ({ ...current, dateFormat: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                    <option value="">Select date format</option>
                    <option value="DD MMM YYYY">DD MMM YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Currency</span>
                  <select value={platformDefaults.currency} onChange={(event) => setPlatformDefaults((current) => ({ ...current, currency: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                    <option value="">Select currency</option>
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Work Week Start</span>
                  <select value={platformDefaults.workWeekStart} onChange={(event) => setPlatformDefaults((current) => ({ ...current, workWeekStart: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                    <option value="">Select start day</option>
                    <option value="Monday">Monday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Standard Day Hours</span>
                  <input type="number" min="1" value={platformDefaults.standardDayHours} onChange={(event) => setPlatformDefaults((current) => ({ ...current, standardDayHours: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Leave Cycle</span>
                  <select value={platformDefaults.leaveCycle} onChange={(event) => setPlatformDefaults((current) => ({ ...current, leaveCycle: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                    <option value="">Select leave cycle</option>
                    <option value="Calendar Year">Calendar Year</option>
                    <option value="Financial Year">Financial Year</option>
                    <option value="Rolling 12 Months">Rolling 12 Months</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Default Approval Mode</span>
                  <select value={platformDefaults.defaultApprovalMode} onChange={(event) => setPlatformDefaults((current) => ({ ...current, defaultApprovalMode: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                    <option value="">Select approval mode</option>
                    <option value="Sequential">Sequential</option>
                    <option value="Parallel">Parallel</option>
                    <option value="Single-step">Single-step</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Role-aware Operating Settings</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Fine-tune default landing pages, access scope, and workflow behaviors for each role profile.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {roleSettings.map((roleSetting) => (
                  <article key={roleSetting.role} className="rounded-[1.6rem] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-black/70">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-zinc-900 dark:text-white">{roleSetting.role}</p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Define what this role sees first and how it behaves across approvals, exports, and notifications.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-black dark:text-zinc-200">
                        {roleSetting.dataScope}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Default Landing</span>
                        <input value={roleSetting.defaultLanding} onChange={(event) => updateRoleSetting(roleSetting.role, "defaultLanding", event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Data Scope</span>
                        <input value={roleSetting.dataScope} onChange={(event) => updateRoleSetting(roleSetting.role, "dataScope", event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
                      </label>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <label className={toggleCardClass}>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Can Approve</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Enable inbox-driven approval actions.</p>
                        </div>
                        <input type="checkbox" checked={roleSetting.canApprove} onChange={(event) => updateRoleSetting(roleSetting.role, "canApprove", event.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                      </label>
                      <label className={toggleCardClass}>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Can Export</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Allow reports and data extracts.</p>
                        </div>
                        <input type="checkbox" checked={roleSetting.canExport} onChange={(event) => updateRoleSetting(roleSetting.role, "canExport", event.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                      </label>
                      <label className={toggleCardClass}>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Daily Digest</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Send role-specific summary updates.</p>
                        </div>
                        <input type="checkbox" checked={roleSetting.receiveDailyDigest} onChange={(event) => updateRoleSetting(roleSetting.role, "receiveDailyDigest", event.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">Enterprise Administration Controls</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  High-impact system-wide toggles for workflow control, security posture, and enterprise reporting behavior.
                </p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className={toggleCardClass}>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Multi-level Approval</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Enable chained reviews across multiple approvers.</p>
                  </div>
                  <input type="checkbox" checked={enterpriseControls.multiLevelApproval} onChange={(event) => setEnterpriseControls((current) => ({ ...current, multiLevelApproval: event.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                </label>
                <label className={toggleCardClass}>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Audit Logging</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Track configuration and workflow events centrally.</p>
                  </div>
                  <input type="checkbox" checked={enterpriseControls.auditLogging} onChange={(event) => setEnterpriseControls((current) => ({ ...current, auditLogging: event.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                </label>
                <label className={toggleCardClass}>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Strict Rejection Notes</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Require a comment whenever approval is rejected.</p>
                  </div>
                  <input type="checkbox" checked={enterpriseControls.strictRejectionNotes} onChange={(event) => setEnterpriseControls((current) => ({ ...current, strictRejectionNotes: event.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                </label>
                <label className={toggleCardClass}>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Weekend Entry Lock</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Prevent regular timesheet logging on weekends.</p>
                  </div>
                  <input type="checkbox" checked={enterpriseControls.weekendEntryLock} onChange={(event) => setEnterpriseControls((current) => ({ ...current, weekendEntryLock: event.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                </label>
                <label className={toggleCardClass}>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Enforce Manager Hierarchy</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Route approvals only through stored reporting relationships.</p>
                  </div>
                  <input type="checkbox" checked={enterpriseControls.enforceManagerHierarchy} onChange={(event) => setEnterpriseControls((current) => ({ ...current, enforceManagerHierarchy: event.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                </label>
                <label className={toggleCardClass}>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Advanced Reports</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Enable cross-functional analytics modules.</p>
                  </div>
                  <input type="checkbox" checked={enterpriseControls.advancedReportsEnabled} onChange={(event) => setEnterpriseControls((current) => ({ ...current, advancedReportsEnabled: event.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Session Timeout (Minutes)</span>
                  <input type="number" min="5" value={enterpriseControls.sessionTimeoutMinutes} onChange={(event) => setEnterpriseControls((current) => ({ ...current, sessionTimeoutMinutes: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Password Rotation (Days)</span>
                  <input type="number" min="0" value={enterpriseControls.passwordRotationDays} onChange={(event) => setEnterpriseControls((current) => ({ ...current, passwordRotationDays: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200" />
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className={toggleCardClass}>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Payroll Export Enabled</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Allows finance-facing payroll export workflows.</p>
                  </div>
                  <input type="checkbox" checked={enterpriseControls.payrollExportEnabled} onChange={(event) => setEnterpriseControls((current) => ({ ...current, payrollExportEnabled: event.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                </label>
                <label className={toggleCardClass}>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Billing Reports Enabled</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Controls finance access to billing analytics screens.</p>
                  </div>
                  <input type="checkbox" checked={enterpriseControls.billingReportsEnabled} onChange={(event) => setEnterpriseControls((current) => ({ ...current, billingReportsEnabled: event.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500" />
                </label>
              </div>
            </section>

            <section className="rounded-[2rem] border border-red-500/30 bg-red-500/5 p-6 shadow-panel dark:border-red-500/30 dark:bg-red-950/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone: System Data Reset</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Purge all timesheets, leave requests, projects, tasks, chat histories, and audit logs from the database while keeping user accounts and department structures intact.
                  </p>
                </div>
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-300">
                  Destructive
                </span>
              </div>

              <div className="mt-6">
                {showPurgeConfirm ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/40">
                    <p className="text-sm font-semibold text-red-900 dark:text-red-200">Are you absolutely sure?</p>
                    <p className="mt-1 text-xs text-red-700 dark:text-red-300">This action cannot be undone. All operational data across the workspace will be permanently wiped.</p>
                    <div className="mt-4 flex items-center gap-3">
                      <button type="button" onClick={handlePurge} disabled={purging} className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                        {purging ? "Purging data..." : "Yes, Purge Non-User Data"}
                      </button>
                      <button type="button" onClick={() => setShowPurgeConfirm(false)} disabled={purging} className="rounded-xl bg-zinc-200 px-4 py-2.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowPurgeConfirm(true)} className="inline-flex items-center gap-2 rounded-2xl border border-red-600 bg-red-600/10 px-5 py-3.5 text-sm font-semibold text-red-600 transition hover:bg-red-600 hover:text-white dark:border-red-500 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white">
                    <Icon name="trash" className="h-4 w-4" />
                    Purge Non-User Data
                  </button>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Configuration Snapshot</p>
              <div className="mt-5 space-y-4 text-sm text-zinc-600 dark:text-zinc-300">
                <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Platform Defaults</p>
                  <div className="mt-3 space-y-2">
                    <p>{platformDefaults.timezone}</p>
                    <p>{platformDefaults.standardDayHours} hours / day</p>
                    <p>{platformDefaults.defaultApprovalMode} approvals by default</p>
                  </div>
                </div>
                <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Role Behavior</p>
                  <div className="mt-3 space-y-2">
                    <p>{roleSettings.filter((role) => role.canApprove).length} role(s) can approve requests</p>
                    <p>{roleSettings.filter((role) => role.canExport).length} role(s) can export data</p>
                    <p>{roleSettings.filter((role) => role.receiveDailyDigest).length} role(s) receive daily digests</p>
                  </div>
                </div>
                <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Enterprise Controls</p>
                  <div className="mt-3 space-y-2">
                    <p>{enterpriseControls.multiLevelApproval ? "Multi-level approvals enabled" : "Single-step approval mode"}</p>
                    <p>{enterpriseControls.auditLogging ? "Audit logging enforced" : "Audit logging disabled"}</p>
                    <p>{enterpriseControls.enforceManagerHierarchy ? "Manager hierarchy routing active" : "Fallback routing allowed"}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-6 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Admin Checklist</p>
              <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  Confirm timezone and work-week defaults before adding new teams.
                </div>
                <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  Keep approval and export access aligned with role responsibilities.
                </div>
                <div className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
                  Revisit enterprise toggles whenever new modules or policies are introduced.
                </div>
              </div>
            </section>

            <button type="button" onClick={handleSave} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-[1.6rem] bg-zinc-950 dark:bg-white px-5 py-4 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60">
              <Icon name="settings" className="h-4 w-4" />
              {saving ? "Saving organisation settings..." : "Save Organisation Settings"}
            </button>
          </aside>
        </div>
      </section>
    </>
  );
};
