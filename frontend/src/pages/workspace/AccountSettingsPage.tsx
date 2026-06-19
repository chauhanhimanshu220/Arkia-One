import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { ToastContainer } from "../../components/ToastContainer";
import { Icon } from "../../components/Icon";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { useMyAccountProfile } from "../../hooks/useMyAccountProfile";
import { useToast } from "../../hooks/useToast";
import { accountService } from "../../services/accountService";
import { passwordChangeService } from "../../services/passwordChangeService";
import type { AuthUser } from "../../types/auth";
import { EMPLOYEE_GENDERS, type EmployeeGender } from "../../types/employee";
import type { PasswordChangeRequestRecord, PasswordChangeRequestStatus } from "../../types/passwordChange";
import { formatUserRoles } from "../../types/roles";
import {
  accountCardClass,
  accountInputClass,
  accountLabelClass,
  formatAccountDateTime,
  formatRelativeAccountDate,
  getProfileCompletionPercentage,
  initialsFromName,
} from "../../utils/accountProfile";

type PersonalForm = { fullName: string; mobileNumber: string; dateOfBirth: string; gender: EmployeeGender };
type PasswordForm = { currentPassword: string; newPassword: string; confirmPassword: string };
type Errors<T> = Partial<Record<keyof T, string>>;
type AccountSettingsMode = "overview" | "personal" | "security";

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EMPTY_PASSWORD: PasswordForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

const passwordRules = [
  ["Minimum 8 characters", (value: string) => value.length >= 8],
  ["At least 1 uppercase", (value: string) => /[A-Z]/.test(value)],
  ["At least 1 lowercase", (value: string) => /[a-z]/.test(value)],
  ["At least 1 number", (value: string) => /\d/.test(value)],
  ["At least 1 special character", (value: string) => /[^A-Za-z0-9]/.test(value)],
] as const;

const toForm = (profile: {
  fullName: string;
  mobileNumber: string;
  dateOfBirth: string | null;
  gender: EmployeeGender;
}): PersonalForm => ({
  fullName: profile.fullName,
  mobileNumber: profile.mobileNumber ?? "",
  dateOfBirth: profile.dateOfBirth ?? "",
  gender: profile.gender,
});

const validateProfile = (form: PersonalForm) => {
  const errors: Errors<PersonalForm> = {};
  const name = form.fullName.trim();

  if (!name) {
    errors.fullName = "Full name is required.";
  } else if (name.length < 2 || name.length > 100) {
    errors.fullName = "Full name must be between 2 and 100 characters.";
  }

  if (form.mobileNumber.trim()) {
    const digits = form.mobileNumber.replace(/\D/g, "");
    if (!/^[0-9+()\-\s]+$/.test(form.mobileNumber.trim()) || digits.length < 8 || digits.length > 15) {
      errors.mobileNumber = "Enter a valid mobile number.";
    }
  }

  if (form.dateOfBirth && new Date(form.dateOfBirth) > new Date(new Date().toDateString())) {
    errors.dateOfBirth = "Date of birth cannot be in the future.";
  }

  if (!EMPLOYEE_GENDERS.includes(form.gender)) {
    errors.gender = "Select a valid gender.";
  }

  return errors;
};

const validatePassword = (form: PasswordForm) => {
  const errors: Errors<PasswordForm> = {};

  if (!form.currentPassword.trim()) {
    errors.currentPassword = "Current password is required.";
  }

  if (!form.newPassword.trim()) {
    errors.newPassword = "New password is required.";
  } else {
    const failedRule = passwordRules.find(([, test]) => !test(form.newPassword));
    if (failedRule) {
      errors.newPassword = failedRule[0];
    }
  }

  if (!form.confirmPassword.trim()) {
    errors.confirmPassword = "Confirm password is required.";
  } else if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  if (form.currentPassword && form.newPassword && form.currentPassword === form.newPassword) {
    errors.newPassword = "New password cannot be the same as current password.";
  }

  return errors;
};

const passwordStrength = (password: string) => passwordRules.reduce((score, [, test]) => score + Number(test(password)), 0);

const passwordRequestStatusClass: Record<PasswordChangeRequestStatus, string> = {
  "OTP Pending": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  "Pending HR Approval": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  Cancelled: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  Expired: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
};

const ReadOnlyField = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
    <p className={accountLabelClass}>{label}</p>
    <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
  </div>
);

export const AccountSettingsPage = ({
  user,
  onUserUpdate,
  mode = "overview",
}: {
  user: AuthUser;
  onUserUpdate: (updates: Partial<AuthUser>) => void;
  mode?: AccountSettingsMode;
}) => {
  const location = useLocation();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const { profile, loading, loadError, reload, setProfile } = useMyAccountProfile(user.id, onUserUpdate);
  const formattedRoles = profile ? formatUserRoles(profile.roles) : "";
  const [personalForm, setPersonalForm] = useState<PersonalForm>({
    fullName: user.fullName,
    mobileNumber: "",
    dateOfBirth: "",
    gender: "Prefer not to say",
  });
  const [savedForm, setSavedForm] = useState<PersonalForm>({
    fullName: user.fullName,
    mobileNumber: "",
    dateOfBirth: "",
    gender: "Prefer not to say",
  });
  const [personalErrors, setPersonalErrors] = useState<Errors<PersonalForm>>({});
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(EMPTY_PASSWORD);
  const [passwordErrors, setPasswordErrors] = useState<Errors<PasswordForm>>({});
  const [visible, setVisible] = useState<Record<keyof PasswordForm, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [passwordRequests, setPasswordRequests] = useState<PasswordChangeRequestRecord[]>([]);
  const [loadingPasswordRequests, setLoadingPasswordRequests] = useState(true);
  const [otpCode, setOtpCode] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  const loadPasswordRequests = useCallback(async () => {
    setLoadingPasswordRequests(true);
    try {
      setPasswordRequests(await passwordChangeService.listMyRequests());
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load password change requests.", "error");
    } finally {
      setLoadingPasswordRequests(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const nextForm = toForm(profile);
    setPersonalForm(nextForm);
    setSavedForm(nextForm);
  }, [profile?.id, profile?.updatedAtUtc]);

  useEffect(() => {
    if (loading || !location.hash) {
      return;
    }

    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, location.hash]);

  useEffect(() => {
    void loadPasswordRequests();
  }, [loadPasswordRequests]);

  const profileDirty = JSON.stringify(personalForm) !== JSON.stringify(savedForm);
  const passwordDirty = Object.values(passwordForm).some(Boolean);
  const score = passwordStrength(passwordForm.newPassword);
  const activeOtpRequest = passwordRequests.find((item) => item.status === "OTP Pending") ?? null;
  const latestPasswordRequest = passwordRequests[0] ?? null;
  const showPersonalWorkflow = mode !== "security";
  const showSecurityWorkflow = mode !== "personal";
  const contentClass = mode === "overview" ? "grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]" : "space-y-6";
  const pageTitle = mode === "personal" ? "Edit Personal Info" : mode === "security" ? "Change Password" : "Account Settings";
  const pageDescription =
    mode === "personal"
      ? "Update your personal fields and profile photo in a focused workspace. Security actions stay on their own page."
      : mode === "security"
        ? "Update your password with current-password validation and email OTP verification in a dedicated security workflow."
        : "Manage personal fields, profile photo, and password from a dedicated action-first workspace.";

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!PHOTO_TYPES.includes(file.type)) {
      showToast("Only JPG, PNG, and WEBP images are allowed.", "error");
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      showToast("Profile photo must be 2 MB or smaller.", "error");
      return;
    }

    setSavingPhoto(true);
    try {
      setProfile(await accountService.uploadMyProfilePhoto(file));
      showToast("Profile photo updated successfully.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to upload your photo.", "error");
    } finally {
      setSavingPhoto(false);
    }
  };

  const removePhoto = async () => {
    if (!profile?.profilePhotoUrl || !window.confirm("Remove your current profile photo?")) {
      return;
    }

    setSavingPhoto(true);
    try {
      setProfile(await accountService.removeMyProfilePhoto());
      showToast("Profile photo removed.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to remove your photo.", "error");
    } finally {
      setSavingPhoto(false);
    }
  };

  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
    const errors = validateProfile(personalForm);
    setPersonalErrors(errors);

    if (Object.keys(errors).length > 0) {
      showToast("Please review the highlighted profile fields.", "error");
      return;
    }

    setSavingProfile(true);
    try {
      setProfile(
        await accountService.updateMyProfile({
          fullName: personalForm.fullName.trim(),
          mobileNumber: personalForm.mobileNumber.trim(),
          dateOfBirth: personalForm.dateOfBirth || null,
          gender: personalForm.gender,
        }),
      );
      showToast("Profile updated successfully.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update your profile.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    const errors = validatePassword(passwordForm);
    setPasswordErrors(errors);

    if (Object.keys(errors).length > 0) {
      showToast("Please review the password requirements.", "error");
      return;
    }

    setSavingPassword(true);
    try {
      const challenge = await passwordChangeService.requestPasswordChange(passwordForm);
      setPasswordForm(EMPTY_PASSWORD);
      setPasswordErrors({});
      setOtpCode("");
      await loadPasswordRequests();
      showToast(challenge.message || `OTP sent to ${challenge.maskedEmail}. Verify it to finish updating your password.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to start your password change request.", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  const submitOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeOtpRequest) {
      showToast("No OTP verification request is currently waiting.", "error");
      return;
    }

    if (!otpCode.trim()) {
      showToast("Enter the OTP from your email to continue.", "error");
      return;
    }

    setVerifyingOtp(true);
    try {
      await passwordChangeService.verifyOtp({
        requestId: activeOtpRequest.id,
        otp: otpCode.trim(),
      });
      setOtpCode("");
      await Promise.all([loadPasswordRequests(), reload()]);
      showToast("OTP verified and password updated successfully.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to verify the OTP.", "error");
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <section className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <WorkspacePageHero
        title={pageTitle}
        belowTitle={<p className="text-sm text-zinc-500 dark:text-zinc-400">{pageDescription}</p>}
      >
        <WorkspaceHeroMeta primary={profile ? `${getProfileCompletionPercentage(profile)}% profile complete` : "Loading"} secondary="Account readiness" />
        <WorkspaceHeroMeta primary={profile ? formatRelativeAccountDate(profile.updatedAtUtc) : "Pending"} secondary="Last profile update" />
      </WorkspacePageHero>

      {loading ? (
        <div className={`${accountCardClass} animate-pulse`}>
          <div className="h-6 w-48 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-24 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        </div>
      ) : null}

      {!loading && loadError ? (
        <div className={accountCardClass}>
          <p className="text-lg font-semibold text-zinc-900 dark:text-white">Unable to load account settings</p>
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
        <div className={contentClass}>
          {showPersonalWorkflow ? (
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

                  <div>
                    <p className={accountLabelClass}>Profile Overview</p>
                    <h3 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{profile.fullName}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[profile.status, formattedRoles, profile.department, profile.workLocation].map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-zinc-200/70 bg-zinc-100/80 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <ReadOnlyField label="Employee Code" value={profile.employeeCode} />
                      <ReadOnlyField label="Email" value={profile.email} />
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
                    <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">This page is intentionally action-first, so edits and security controls are available here.</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} className="hidden" />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={savingPhoto}
                      className="rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
                    >
                      {savingPhoto ? "Saving..." : "Upload Photo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removePhoto()}
                      disabled={savingPhoto || !profile.profilePhotoUrl}
                      className="rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <form id="personal-info" onSubmit={submitProfile} className={accountCardClass}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Personal Information</p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Editable personal fields only. Organization mapping remains admin-controlled.</p>
                </div>
                <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400">
                  Save activates only when values change.
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label>
                  <span className={accountLabelClass}>Full Name</span>
                  <input value={personalForm.fullName} onChange={(event) => setPersonalForm((current) => ({ ...current, fullName: event.target.value }))} className={accountInputClass} />
                  {personalErrors.fullName ? <p className="mt-2 text-xs text-rose-500">{personalErrors.fullName}</p> : null}
                </label>

                <label>
                  <span className={accountLabelClass}>Mobile Number</span>
                  <input value={personalForm.mobileNumber} onChange={(event) => setPersonalForm((current) => ({ ...current, mobileNumber: event.target.value }))} className={accountInputClass} />
                  {personalErrors.mobileNumber ? <p className="mt-2 text-xs text-rose-500">{personalErrors.mobileNumber}</p> : null}
                </label>

                <label>
                  <span className={accountLabelClass}>Date Of Birth</span>
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={personalForm.dateOfBirth}
                    onChange={(event) => setPersonalForm((current) => ({ ...current, dateOfBirth: event.target.value }))}
                    className={accountInputClass}
                  />
                  {personalErrors.dateOfBirth ? <p className="mt-2 text-xs text-rose-500">{personalErrors.dateOfBirth}</p> : null}
                </label>

                <label>
                  <span className={accountLabelClass}>Gender</span>
                  <select value={personalForm.gender} onChange={(event) => setPersonalForm((current) => ({ ...current, gender: event.target.value as EmployeeGender }))} className={accountInputClass}>
                    {EMPLOYEE_GENDERS.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender}
                      </option>
                    ))}
                  </select>
                  {personalErrors.gender ? <p className="mt-2 text-xs text-rose-500">{personalErrors.gender}</p> : null}
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Full name, mobile number, date of birth, and gender are validated on both frontend and backend.</p>
                <button
                  type="submit"
                  disabled={!profileDirty || savingProfile}
                  className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
                >
                  {savingProfile ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>

            <section className={accountCardClass}>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Organization Information</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">These fields are visible here for transparency but remain read-only for self-service.</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                  ["Employee Code", profile.employeeCode],
                  ["Email Address", profile.email],
                  ["Department", profile.department],
                  ["Designation / Role", profile.designation || formattedRoles],
                  ["Reporting Manager", profile.reportingManagerName || "Not assigned"],
                  ["Business Unit", profile.businessUnit || "Not assigned"],
                  ["Work Location", profile.workLocation || "Not assigned"],
                  ["Organization Name", profile.organizationName],
                ].map(([label, value]) => (
                  <ReadOnlyField key={label} label={label} value={value} />
                ))}
              </div>
            </section>
          </div>
          ) : null}

          {showSecurityWorkflow ? (
          <div className="space-y-6">
            <form id="security" onSubmit={submitPassword} className={accountCardClass}>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Change Password</p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Password updates stay self-service: validate your current password, verify the email OTP, and the stored password updates immediately after successful verification.</p>
              <div className="mt-6 space-y-4">
                {([
                  { field: "currentPassword", label: "Current Password", autoComplete: "current-password" },
                  { field: "newPassword", label: "New Password", autoComplete: "new-password" },
                  { field: "confirmPassword", label: "Confirm New Password", autoComplete: "new-password" },
                ] as const).map((item) => (
                  <label key={item.field} className="block">
                    <span className={accountLabelClass}>{item.label}</span>
                    <div className="relative">
                      <input
                        type={visible[item.field] ? "text" : "password"}
                        autoComplete={item.autoComplete}
                        value={passwordForm[item.field]}
                        onChange={(event) => setPasswordForm((current) => ({ ...current, [item.field]: event.target.value }))}
                        className={`${accountInputClass} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setVisible((current) => ({ ...current, [item.field]: !current[item.field] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                      >
                        <Icon name={visible[item.field] ? "eye-off" : "eye"} className="h-4 w-4" />
                      </button>
                    </div>
                    {passwordErrors[item.field] ? <p className="mt-2 text-xs text-rose-500">{passwordErrors[item.field]}</p> : null}
                  </label>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-zinc-900 dark:text-zinc-100">Password Strength</span>
                  <span className={score >= 5 ? "text-emerald-500" : score >= 3 ? "text-amber-500" : "text-rose-500"}>
                    {!passwordForm.newPassword ? "Not started" : score >= 5 ? "Strong" : score >= 3 ? "Good" : "Weak"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 rounded-full ${
                        index < score ? (score >= 5 ? "bg-emerald-500" : score >= 3 ? "bg-amber-500" : "bg-rose-500") : "bg-zinc-200 dark:bg-zinc-800"
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {passwordRules.map(([rule, test]) => (
                    <div key={rule} className={`text-xs ${test(passwordForm.newPassword) ? "text-emerald-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                      {test(passwordForm.newPassword) ? "[OK]" : "[ ]"} {rule}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!passwordDirty || savingPassword}
                className="mt-5 w-full rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
              >
                {savingPassword ? "Sending OTP..." : "Send OTP"}
              </button>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Your password remains unchanged until OTP verification succeeds. After that, the update is applied immediately.</p>
            </form>

            {activeOtpRequest ? (
              <form onSubmit={submitOtp} className={accountCardClass}>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <Icon name="shield" className="h-5 w-5 text-amber-700 dark:text-amber-200" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-white">Verify Email OTP</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Enter the one-time code from your registered email to finish the password update securely.</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-300">
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Request Started:</span> {formatAccountDateTime(activeOtpRequest.requestedAtUtc)}</p>
                  <p className="mt-2"><span className="font-semibold text-zinc-900 dark:text-white">OTP Expires:</span> {formatAccountDateTime(activeOtpRequest.otpExpiresAtUtc)}</p>
                  <p className="mt-2">If the code expires, submit a fresh password change request to generate a new OTP.</p>
                </div>

                <label className="mt-5 block">
                  <span className={accountLabelClass}>One-Time Password</span>
                  <input
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter the 6-digit OTP"
                    className={accountInputClass}
                  />
                </label>

                <button
                  type="submit"
                  disabled={!otpCode.trim() || verifyingOtp}
                  className="mt-5 w-full rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
                >
                  {verifyingOtp ? "Verifying OTP..." : "Verify OTP And Update Password"}
                </button>
              </form>
            ) : null}

            <section className={accountCardClass}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/80">
                  <Icon name="shield" className="h-5 w-5 text-zinc-700 dark:text-zinc-200" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Security Snapshot</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Live self-service account status.</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <ReadOnlyField label="Password Last Changed" value={formatAccountDateTime(profile.passwordChangedAtUtc)} />
                <ReadOnlyField label="Last Profile Update" value={formatAccountDateTime(profile.updatedAtUtc)} />
                <ReadOnlyField label="Active Password Request" value={latestPasswordRequest ? latestPasswordRequest.status : "No request in progress"} />
                <ReadOnlyField label="Security Ownership" value="Personal fields editable, role mapping protected" />
              </div>
            </section>

            <section className={accountCardClass}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Password Change Requests</p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Track OTP delivery, verification, and password completion timing from one auditable history view.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadPasswordRequests()}
                  className="rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Refresh
                </button>
              </div>

              {loadingPasswordRequests ? (
                <div className="mt-5 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400">
                  Loading password request history...
                </div>
              ) : passwordRequests.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-zinc-200/80 bg-zinc-50/60 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                  No password change requests have been submitted yet.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {passwordRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${passwordRequestStatusClass[request.status]}`}>
                              {request.status}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Requested {formatAccountDateTime(request.requestedAtUtc)}</span>
                          </div>
                          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                            {request.status === "OTP Pending"
                              ? `OTP expires ${formatAccountDateTime(request.otpExpiresAtUtc)}.`
                              : request.status === "Completed"
                                ? `Password updated ${formatAccountDateTime(request.decisionAtUtc)}.`
                              : request.status === "Pending HR Approval"
                                ? `Legacy request waiting for HR review since ${formatAccountDateTime(request.otpVerifiedAtUtc)}.`
                                : request.decisionAtUtc
                                  ? `Decision recorded ${formatAccountDateTime(request.decisionAtUtc)}.`
                                  : `Last updated ${formatAccountDateTime(request.updatedAtUtc)}.`}
                          </p>
                        </div>
                        <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                          <p>Handled By</p>
                          <p className="mt-1 font-semibold text-zinc-700 dark:text-zinc-200">
                            {request.reviewedByName || (request.status === "Completed" ? "Self-service" : "Pending")}
                          </p>
                        </div>
                      </div>
                      {request.decisionNote ? (
                        <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-white/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-black/50 dark:text-zinc-300">
                          <span className="font-semibold text-zinc-900 dark:text-white">Decision Note:</span> {request.decisionNote}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
