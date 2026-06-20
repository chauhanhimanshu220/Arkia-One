import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import {
  EMPLOYEE_GENDERS,
  USER_TYPES,
  WORK_LOCATIONS,
  type Employee,
  type EmployeeUpsertPayload,
} from "../../types/employee";
import { getPrimaryUserRole, USER_ROLES, type UserRole, normalizeUserRole } from "../../types/roles";
import { Icon } from "../Icon";
import { useAuth } from "../../hooks/useAuth";

export interface EmployeeModalValues extends EmployeeUpsertPayload {
  profilePhotoDataUrl: string | null;
}

type FormState = Omit<EmployeeModalValues, "password"> & {
  employeeCode: string;
  userId: string;
};

type PasswordMode = "keep" | "auto" | "manual";
type FormErrorKey = keyof FormState | "password";
type FormErrors = Partial<Record<FormErrorKey, string>>;

const MAX_PROFILE_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;

const createGeneratedPassword = () => {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const numeric = Math.floor(100 + Math.random() * 900).toString();
  return `Arkia@${random}${numeric}`;
};

const initialsFromName = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "EM";

const emptyForm: FormState = {
  employeeCode: "",
  userId: "",
  fullName: "",
  email: "",
  mobileNumber: "",
  dateOfBirth: "",
  gender: "Prefer not to say",
  role: "Employee",
  roles: ["Employee"],
  department: "",
  designation: "",
  reportingManagerId: null,
  businessUnit: "",
  workLocation: "Office",
  status: "Active",
  userType: "Internal",
  profilePhotoDataUrl: null,
};

interface EmployeeModalProps {
  open: boolean;
  employee: Employee | null;
  employees: Employee[];
  loading: boolean;
  departments: Employee["department"][];
  initialProfilePhoto: string | null;
  onClose: () => void;
  onSubmit: (values: EmployeeModalValues) => Promise<void>;
  title?: string;
  subtitle?: string;
  description?: string;
  fixedRole?: UserRole;
}

export const EmployeeModal = ({
  open,
  employee,
  employees,
  loading,
  departments,
  initialProfilePhoto,
  onClose,
  onSubmit,
  title,
  subtitle,
  description,
  fixedRole,
}: EmployeeModalProps) => {
  useBodyScrollLock(open);
  const { session } = useAuth();
  const currentUserRole = session?.user ? normalizeUserRole(session.user.role) : "Employee";

  const allowedRoles = useMemo(() => {
    return USER_ROLES.filter((role) => {
      // 1. License Owner is never assignable/selectable in EmployeeModal
      if (role === "License Owner") return false;
      // 2. System Admin is only assignable/selectable if logged-in user is a License Owner
      if (role === "System Admin") {
        return currentUserRole === "License Owner";
      }
      return true;
    });
  }, [currentUserRole]);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generatedPassword, setGeneratedPassword] = useState(() => createGeneratedPassword());
  const [manualPassword, setManualPassword] = useState("");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("keep");
  const [showPassword, setShowPassword] = useState(false);
  const [photoError, setPhotoError] = useState<string>("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (employee) {
      setForm({
        employeeCode: employee.employeeCode,
        userId: employee.userId,
        fullName: employee.fullName,
        email: employee.email,
        mobileNumber: employee.mobileNumber,
        dateOfBirth: employee.dateOfBirth,
        gender: employee.gender,
        role: employee.role,
        roles: employee.roles,
        department: employee.department || "",
        designation: employee.designation || (fixedRole === "System Admin" ? "System Administrator" : ""),
        reportingManagerId: employee.reportingManagerId,
        businessUnit: employee.businessUnit || "",
        workLocation: employee.workLocation || "Office",
        status: employee.status,
        userType: employee.userType,
        profilePhotoDataUrl: initialProfilePhoto,
      });
      setGeneratedPassword(createGeneratedPassword());
      setManualPassword("");
      setPasswordMode("keep");
      setShowPassword(false);
      setErrors({});
      setPhotoError("");
      return;
    }

    setForm({
      ...emptyForm,
      role: fixedRole ?? "Employee",
      roles: fixedRole ? [fixedRole] : ["Employee"],
      profilePhotoDataUrl: initialProfilePhoto,
      department: "",
      designation: fixedRole === "System Admin" ? "System Administrator" : "",
      businessUnit: "",
      workLocation: "Office",
    });
    setGeneratedPassword(createGeneratedPassword());
    setManualPassword("");
    setPasswordMode("auto");
    setShowPassword(false);
    setErrors({});
    setPhotoError("");
  }, [employee, initialProfilePhoto, open, fixedRole]);

  const availableManagers = useMemo(
    () =>
      employees
        .filter((item) => item.status === "Active" && item.id !== employee?.id)
        .sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [employee?.id, employees],
  );

  const maxDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const passwordConfigured = !employee || passwordMode !== "keep";
  const passwordLabel = employee ? "Reset Password" : "Create Password";
  const selectedPassword = passwordMode === "manual" ? manualPassword.trim() : generatedPassword;

  if (!open) {
    return null;
  }

  const inputClass =
    "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200";
  const readonlyClass = `${inputClass} cursor-not-allowed bg-zinc-50 text-zinc-500 dark:bg-black dark:text-zinc-400`;
  const labelClass = "mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300";
  const passwordModeButtonClass = (mode: PasswordMode) =>
    passwordMode === mode
      ? "rounded-xl border border-brand-500 bg-brand-50 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition dark:border-brand-400/50 dark:bg-brand-500/10 dark:text-zinc-400 dark:text-zinc-500"
      : "rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!form.fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    }

    if (!form.userId.trim()) {
      nextErrors.userId = "User ID is required.";
    } else if (/\s/.test(form.userId.trim())) {
      nextErrors.userId = "User ID cannot contain spaces.";
    }

    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!form.mobileNumber.trim()) {
      nextErrors.mobileNumber = "Mobile number is required.";
    } else if ((form.mobileNumber.match(/\d/g) ?? []).length < 8) {
      nextErrors.mobileNumber = "Enter a valid mobile number.";
    }

    if (!form.dateOfBirth) {
      nextErrors.dateOfBirth = "Date of birth is required.";
    } else if (form.dateOfBirth > maxDate) {
      nextErrors.dateOfBirth = "Date of birth cannot be in the future.";
    }

    if (fixedRole !== "System Admin" && !form.department) {
      nextErrors.department = "Select a department.";
    }

    if (fixedRole !== "System Admin" && !form.designation.trim()) {
      nextErrors.designation = "Designation is required.";
    }

    if (fixedRole !== "System Admin" && !form.businessUnit.trim()) {
      nextErrors.businessUnit = "Business unit is required.";
    }

    if (form.roles.length === 0) {
      nextErrors.roles = "Select at least one access role.";
    }

    if (passwordConfigured) {
      if (passwordMode === "manual") {
        if (!manualPassword.trim()) {
          nextErrors.password = "Password is required.";
        } else if (manualPassword.trim().length < 8) {
          nextErrors.password = "Password must be at least 8 characters long.";
        }
      } else if (!generatedPassword.trim()) {
        nextErrors.password = "Generate a password before saving.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please upload a valid image file.");
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      setPhotoError("Profile photo must be 2 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        setPhotoError("Unable to read this image. Please try another file.");
        return;
      }

      setForm((current) => ({ ...current, profilePhotoDataUrl: result }));
      setPhotoError("");
    };
    reader.onerror = () => {
      setPhotoError("Unable to read this image. Please try another file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    await onSubmit({
      employeeCode: form.employeeCode.trim() || undefined,
      userId: form.userId.trim(),
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      mobileNumber: form.mobileNumber.trim(),
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      role: getPrimaryUserRole(form.roles),
      roles: form.roles,
      department: form.department,
      designation: form.designation.trim(),
      reportingManagerId: form.reportingManagerId || null,
      businessUnit: form.businessUnit.trim(),
      workLocation: form.workLocation,
      status: form.status,
      userType: form.userType,
      password: passwordConfigured ? selectedPassword : null,
      profilePhotoDataUrl: form.profilePhotoDataUrl,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-panel dark:border-zinc-800 dark:bg-black">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:px-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-brand-600">
              {title ?? (employee ? "Edit Employee" : "Add Employee")}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{subtitle ?? "Employee details"}</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {description ?? "Capture identity, organization mapping, and login access from one employee profile form."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
            <div className="space-y-8">
              <section className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Basic Information</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Core identity fields used for employee records and profile display.</p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
                  <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-black/60">
                    <div className="flex flex-col items-center text-center">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-600 to-accent-500 text-2xl font-bold text-white shadow-lg shadow-brand-600/20">
                        {form.profilePhotoDataUrl ? (
                          <img src={form.profilePhotoDataUrl} alt="Employee profile preview" className="h-full w-full object-cover" />
                        ) : (
                          initialsFromName(form.fullName)
                        )}
                      </div>
                      <p className="mt-4 text-sm font-semibold text-zinc-800 dark:text-zinc-100">Profile Photo</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        Optional, but useful for the employee directory and admin UI.
                      </p>
                      <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                      <div className="mt-4 flex w-full flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-950"
                        >
                          Upload Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((current) => ({ ...current, profilePhotoDataUrl: null }));
                            setPhotoError("");
                          }}
                          className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        >
                          Remove Photo
                        </button>
                      </div>
                      {photoError && <p className="mt-3 text-xs text-rose-500">{photoError}</p>}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Full Name</label>
                      <input
                        value={form.fullName}
                        onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                        className={inputClass}
                        placeholder="Enter employee name"
                      />
                      {errors.fullName && <p className="mt-2 text-xs text-rose-500">{errors.fullName}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>Employee Code</label>
                      <input
                        value={form.employeeCode}
                        readOnly
                        className={readonlyClass}
                        placeholder="Auto-generated on save"
                      />
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {employee ? "Employee code is locked after creation." : "Code will be auto-generated when you save this employee."}
                      </p>
                    </div>

                    <div>
                      <label className={labelClass}>Email Address</label>
                      <input
                        value={form.email}
                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                        className={inputClass}
                        placeholder="Enter employee email"
                      />
                      {errors.email && <p className="mt-2 text-xs text-rose-500">{errors.email}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>Mobile Number</label>
                      <input
                        value={form.mobileNumber}
                        onChange={(event) => setForm((current) => ({ ...current, mobileNumber: event.target.value }))}
                        className={inputClass}
                        placeholder="Enter mobile number"
                      />
                      {errors.mobileNumber && <p className="mt-2 text-xs text-rose-500">{errors.mobileNumber}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>Date of Birth</label>
                      <input
                        type="date"
                        max={maxDate}
                        value={form.dateOfBirth}
                        onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))}
                        className={inputClass}
                      />
                      {errors.dateOfBirth && <p className="mt-2 text-xs text-rose-500">{errors.dateOfBirth}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>Gender</label>
                      <select
                        value={form.gender}
                        onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value as FormState["gender"] }))}
                        className={inputClass}
                      >
                        {EMPLOYEE_GENDERS.map((gender) => (
                          <option key={gender} value={gender}>
                            {gender}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {fixedRole !== "System Admin" && (
                <section className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Organization Details</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Map the employee into department, reporting line, and work setup.</p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label className={labelClass}>Department</label>
                      <select
                        value={form.department}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            department: event.target.value,
                            businessUnit: current.businessUnit || event.target.value,
                          }))
                        }
                        className={inputClass}
                      >
                        <option value="">Select department</option>
                        {departments.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                      {errors.department && <p className="mt-2 text-xs text-rose-500">{errors.department}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>Designation / Role</label>
                      <input
                        value={form.designation}
                        onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))}
                        className={inputClass}
                        placeholder="e.g. Developer, Manager"
                      />
                      {errors.designation && <p className="mt-2 text-xs text-rose-500">{errors.designation}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>Reporting Manager</label>
                      <select
                        value={form.reportingManagerId ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            reportingManagerId: event.target.value || null,
                          }))
                        }
                        className={inputClass}
                      >
                        <option value="">No reporting manager</option>
                        {availableManagers.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.fullName} · {manager.designation}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>Business Unit</label>
                      <input
                        value={form.businessUnit}
                        onChange={(event) => setForm((current) => ({ ...current, businessUnit: event.target.value }))}
                        className={inputClass}
                        placeholder="Enter business unit"
                      />
                      {errors.businessUnit && <p className="mt-2 text-xs text-rose-500">{errors.businessUnit}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>Work Location</label>
                      <select
                        value={form.workLocation}
                        onChange={(event) => setForm((current) => ({ ...current, workLocation: event.target.value as FormState["workLocation"] }))}
                        className={inputClass}
                      >
                        {WORK_LOCATIONS.map((location) => (
                          <option key={location} value={location}>
                            {location}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>
              )}

              <section className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Login &amp; Access Control</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {employee
                      ? "Configure system role, account status, and create or reset the login credentials shared with the employee."
                      : "Configure system role, account status, and the temporary credentials that will be emailed automatically after the employee account is created."}
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label className={labelClass}>User ID</label>
                      <input
                        value={form.userId}
                        onChange={(event) => {
                          setForm((current) => ({ ...current, userId: event.target.value }));
                          setErrors((currentErrors) => ({ ...currentErrors, userId: undefined }));
                        }}
                        className={inputClass}
                        placeholder="e.g. john.doe or EMP001"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                      {errors.userId && <p className="mt-2 text-xs text-rose-500">{errors.userId}</p>}
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        This ID will be used by the employee to sign in, and system admins can update it later when needed.
                      </p>
                    </div>

                  <div className="xl:col-span-2">
                    <div className="mb-2">
                      <label className={`${labelClass} mb-0`}>{passwordLabel}</label>
                    </div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {employee ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordMode("keep");
                            setShowPassword(false);
                            setErrors((currentErrors) => ({ ...currentErrors, password: undefined }));
                          }}
                          className={passwordModeButtonClass("keep")}
                        >
                          Keep Existing
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordMode("auto");
                          setShowPassword(false);
                          setErrors((currentErrors) => ({ ...currentErrors, password: undefined }));
                        }}
                        className={passwordModeButtonClass("auto")}
                      >
                        Auto-Generate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordMode("manual");
                          setShowPassword(false);
                          setErrors((currentErrors) => ({ ...currentErrors, password: undefined }));
                        }}
                        className={passwordModeButtonClass("manual")}
                      >
                        Set Manually
                      </button>
                      {passwordMode === "auto" ? (
                        <button
                          type="button"
                          onClick={() => setGeneratedPassword(createGeneratedPassword())}
                          className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        >
                          Generate Again
                        </button>
                      ) : null}
                    </div>
                    {passwordMode === "keep" ? (
                      <>
                        <input value="Current password will remain unchanged" readOnly className={readonlyClass} />
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          Choose auto-generate or manual mode whenever you want to reset this employee's sign-in password.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={selectedPassword}
                            readOnly={passwordMode === "auto"}
                            onChange={(event) => {
                              if (passwordMode === "manual") {
                                setManualPassword(event.target.value);
                                setErrors((currentErrors) => ({ ...currentErrors, password: undefined }));
                              }
                            }}
                            className={passwordMode === "manual" ? `${inputClass} pr-12` : readonlyClass}
                            placeholder={passwordMode === "manual" ? "Enter password" : "Generate a password"}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-zinc-400 transition hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            aria-pressed={showPassword}
                          >
                            <Icon name={showPassword ? "eye-off" : "eye"} className="h-5 w-5" />
                          </button>
                        </div>


                        {errors.password && <p className="mt-2 text-xs text-rose-500">{errors.password}</p>}
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {passwordMode === "auto"
                            ? employee
                              ? "Use an auto-generated password when the admin wants to reset credentials quickly."
                              : "Use an auto-generated password for quick setup. It will be included in the welcome email sent to the employee."
                            : employee
                              ? "Set a password manually when the admin needs to reset credentials with a known value."
                              : "Set a password manually when the admin needs to provision a known temporary credential. It will be included in the welcome email."}
                        </p>
                      </>
                    )}
                  </div>

                  {!fixedRole && (
                    <div>
                      <label className={labelClass}>Access Roles</label>
                      <div className="grid gap-2">
                        {allowedRoles.map((role) => {
                          const selected = form.roles.includes(role);

                          return (
                            <label
                              key={role}
                              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                                selected
                                  ? "border-zinc-900 bg-zinc-50 text-zinc-900 dark:border-white dark:bg-zinc-900 dark:text-white"
                                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() =>
                                  setForm((current) => {
                                    const roles = current.roles.includes(role)
                                      ? current.roles.filter((item) => item !== role)
                                      : [...current.roles, role];
                                    const safeRoles = roles.length > 0 ? roles : current.roles;

                                    return {
                                      ...current,
                                      role: getPrimaryUserRole(safeRoles),
                                      roles: safeRoles,
                                    };
                                  })
                                }
                                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                              />
                              <span className="font-semibold">{role}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Primary role automatically: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{getPrimaryUserRole(form.roles)}</span>
                      </p>
                      {errors.roles && <p className="mt-2 text-xs text-rose-500">{errors.roles}</p>}
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>Status</label>
                    <select
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as FormState["status"] }))}
                      className={inputClass}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>User Type</label>
                    <select
                      value={form.userType}
                      onChange={(event) => setForm((current) => ({ ...current, userType: event.target.value as FormState["userType"] }))}
                      className={inputClass}
                    >
                      {USER_TYPES.map((userType) => (
                        <option key={userType} value={userType}>
                          {userType}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:justify-end sm:px-8">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-zinc-950 dark:bg-white px-5 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Saving..." : (fixedRole ? `Save ${fixedRole}` : "Save Employee")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
