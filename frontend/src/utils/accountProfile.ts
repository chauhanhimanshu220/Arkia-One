import type { MyAccountProfile } from "../types/account";
import type { AuthUser } from "../types/auth";

export const accountCardClass =
  "rounded-[2rem] border border-zinc-200/70 bg-white/90 p-6 shadow-panel dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(9,9,11,0.95),rgba(4,4,5,0.95))]";

export const accountInputClass =
  "mt-2 w-full rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-100/10";

export const accountLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500";

export const initialsFromName = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const formatAccountDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not available";

export const formatRelativeAccountDate = (value?: string | null) => {
  if (!value) {
    return "Not available";
  }

  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  return days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
};

export const getProfileCompletionPercentage = (profile: MyAccountProfile) =>
  Math.round(
    ([
      profile.profilePhotoUrl,
      profile.mobileNumber,
      profile.dateOfBirth,
      profile.gender,
      profile.reportingManagerName,
      profile.workLocation,
    ].filter(Boolean).length /
      6) *
      100,
  );

export const toAuthUserUpdate = (profile: MyAccountProfile): Partial<AuthUser> => ({
  fullName: profile.fullName,
  email: profile.email,
  role: profile.role,
  roles: profile.roles,
  organization: profile.organizationName,
  profilePhotoUrl: profile.profilePhotoUrl,
});
