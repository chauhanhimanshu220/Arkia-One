import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { useMyAccountProfile } from "../../hooks/useMyAccountProfile";
import type { AuthUser } from "../../types/auth";
import { formatUserRoles } from "../../types/roles";
import {
  accountCardClass,
  accountLabelClass,
  formatAccountDateTime,
  formatRelativeAccountDate,
  getProfileCompletionPercentage,
  initialsFromName,
} from "../../utils/accountProfile";

const ReadOnlyField = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
    <p className={accountLabelClass}>{label}</p>
    <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
  </div>
);

const ActionButton = ({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:bg-zinc-900"
  >
    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
  </button>
);

export const ProfileSettingsPage = ({
  user,
  onUserUpdate,
}: {
  user: AuthUser;
  onUserUpdate: (updates: Partial<AuthUser>) => void;
}) => {
  const navigate = useNavigate();
  const { profile, loading, loadError, reload } = useMyAccountProfile(user.id, onUserUpdate);
  const formattedRoles = profile ? formatUserRoles(profile.roles) : "";

  return (
    <section className="space-y-6">
      <WorkspacePageHero
        title="My Profile"
        belowTitle={<p className="text-sm text-zinc-500 dark:text-zinc-400">Identity-first account page with personal, work, and security summary before any edit actions.</p>}
      >
        <WorkspaceHeroMeta primary={profile ? `${getProfileCompletionPercentage(profile)}% profile complete` : "Loading"} secondary="Profile completion" />
        <WorkspaceHeroMeta primary={profile ? formatRelativeAccountDate(profile.updatedAtUtc) : "Pending"} secondary="Last profile update" />
      </WorkspacePageHero>

      {loading ? (
        <div className={`${accountCardClass} animate-pulse`}>
          <div className="h-6 w-40 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-24 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        </div>
      ) : null}

      {!loading && loadError ? (
        <div className={accountCardClass}>
          <p className="text-lg font-semibold text-zinc-900 dark:text-white">Unable to load your profile</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{loadError}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-4 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && profile ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
          <div className="space-y-6">
            <section className={accountCardClass}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-5">
                  {profile.profilePhotoUrl ? (
                    <img src={profile.profilePhotoUrl} alt={`${profile.fullName} profile`} className="h-24 w-24 rounded-[1.75rem] object-cover" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(212,212,216,0.9)_40%,rgba(24,24,27,0.95)_100%)] text-2xl font-bold text-zinc-900 dark:text-black">
                      {initialsFromName(profile.fullName)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className={accountLabelClass}>Profile Overview</p>
                    <h3 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-white">{profile.fullName}</h3>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{profile.email}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {[profile.status, formattedRoles, profile.department, profile.workLocation].map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-zinc-200/70 bg-zinc-100/80 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <ReadOnlyField label="Employee Code" value={profile.employeeCode} />
                      <ReadOnlyField label="Reporting Manager" value={profile.reportingManagerName || "Not assigned"} />
                    </div>
                  </div>
                </div>

                <div className="lg:w-[280px]">
                  <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
                      <span>Profile Completion</span>
                      <span>{getProfileCompletionPercentage(profile)}%</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.95),rgba(161,161,170,0.9),rgba(24,24,27,0.96))]"
                        style={{ width: `${getProfileCompletionPercentage(profile)}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Profile is now display-first. Edits and password changes live in a separate settings workspace.</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate("/admin/settings/account/personal-info")}
                      className="rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
                    >
                      Edit Personal Info
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/admin/settings/account/change-password")}
                      className="rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className={accountCardClass}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Personal Information</p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Read-only identity details shown first, with edit actions moved out of the primary layout.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/admin/settings/account/personal-info")}
                  className="rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Edit
                </button>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <ReadOnlyField label="Full Name" value={profile.fullName} />
                <ReadOnlyField label="Mobile Number" value={profile.mobileNumber || "Not added"} />
                <ReadOnlyField label="Date Of Birth" value={profile.dateOfBirth || "Not added"} />
                <ReadOnlyField label="Gender" value={profile.gender || "Not added"} />
              </div>
            </section>

            <section className={accountCardClass}>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Work Identity</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Organizational mapping stays transparent here and protected from self-service edits.</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <ReadOnlyField label="Department" value={profile.department} />
                <ReadOnlyField label="Designation / Role" value={profile.designation || formattedRoles} />
                <ReadOnlyField label="Reporting Manager" value={profile.reportingManagerName || "Not assigned"} />
                <ReadOnlyField label="Business Unit" value={profile.businessUnit || "Not assigned"} />
                <ReadOnlyField label="Work Location" value={profile.workLocation || "Not assigned"} />
                <ReadOnlyField label="Organization Name" value={profile.organizationName} />
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className={accountCardClass}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/80">
                  <Icon name="shield" className="h-5 w-5 text-zinc-700 dark:text-zinc-200" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Account Snapshot</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">A compact summary of readiness, security, and system identity.</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <ReadOnlyField label="Password Last Changed" value={formatAccountDateTime(profile.passwordChangedAtUtc)} />
                <ReadOnlyField label="Last Profile Update" value={formatAccountDateTime(profile.updatedAtUtc)} />
                <ReadOnlyField label="Account Status" value={profile.status} />
                <ReadOnlyField label="Security Ownership" value="Personal info is self-managed. Organization mapping is admin-controlled." />
              </div>
            </section>

            <section className={accountCardClass}>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Quick Actions</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Settings are still available, but they no longer dominate the default profile experience.</p>
              <div className="mt-5 grid gap-3">
                <ActionButton title="Edit Personal Info" description="Open the dedicated personal info page for mobile, date of birth, gender, and full name changes." onClick={() => navigate("/admin/settings/account/personal-info")} />
                <ActionButton title="Manage Photo & Profile" description="Upload or remove your avatar without turning this page into a form-heavy settings screen." onClick={() => navigate("/admin/settings/account")} />
                <ActionButton title="Change Password" description="Open the secure password page when you need to update credentials." onClick={() => navigate("/admin/settings/account/change-password")} />
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
};
