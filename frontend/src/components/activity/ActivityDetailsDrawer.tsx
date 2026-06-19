import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import type { ActivityLoginDetail } from "../../types/activity";
import { Icon } from "../Icon";

interface ActivityDetailsDrawerProps {
  open: boolean;
  activity: ActivityLoginDetail | null;
  loading: boolean;
  onClose: () => void;
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Not captured";
  }

  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatCoordinate = (value: number | null) => (value === null ? "Unknown" : value.toFixed(6));
const formatAccuracy = (value: number | null) => (value === null ? "Unknown" : `${value.toFixed(1)} m`);
const detailCardClass =
  "rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 shadow-sm dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50";

export const ActivityDetailsDrawer = ({ open, activity, loading, onClose }: ActivityDetailsDrawerProps) => {
  useBodyScrollLock(open);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm dark:bg-black/60" onClick={onClose}>
      <aside
        className="h-full w-full max-w-3xl overflow-y-auto border-l border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] px-6 py-6 text-zinc-700 shadow-panel dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.98),rgba(0,0,0,0.98))] dark:text-zinc-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600 dark:text-sky-200">Activity Details</p>
            <h2 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
              {loading ? "Loading..." : activity?.fullName ?? "Authentication record"}
            </h2>
            {activity ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  {activity.email}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    activity.status === "Success"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
                  }`}
                >
                  {activity.status}
                </span>
                {activity.isSuspicious ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                    Suspicious
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 bg-white p-3 text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-400 dark:hover:bg-zinc-950 dark:hover:text-zinc-200"
            aria-label="Close activity details"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {loading || !activity ? (
          <div className="mt-8 rounded-[1.5rem] border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Loading the latest login activity record...
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Login Time", value: formatDateTime(activity.loginTime) },
                { label: "Logout Time", value: formatDateTime(activity.logoutTime) },
                { label: "IP Address", value: activity.ipAddress || "Unknown" },
                { label: "Device", value: activity.deviceType || "Unknown" },
              ].map((item) => (
                <div key={item.label} className={detailCardClass}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">{item.label}</p>
                  <p className="mt-3 text-sm font-semibold leading-6 text-zinc-900 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className={detailCardClass}>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">User Profile</p>
                <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Full Name:</span> {activity.fullName}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Email:</span> {activity.email}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Role:</span> {activity.role}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Department:</span> {activity.department}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Record Created:</span> {formatDateTime(activity.createdAt)}</p>
                </div>
              </div>

              <div className={detailCardClass}>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">Location Capture</p>
                <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Location:</span> {activity.location}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">City:</span> {activity.city || "Unknown"}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">State:</span> {activity.state || "Unknown"}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Country:</span> {activity.country || "Unknown"}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Latitude:</span> {formatCoordinate(activity.latitude)}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Longitude:</span> {formatCoordinate(activity.longitude)}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Accuracy:</span> {formatAccuracy(activity.accuracy)}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className={detailCardClass}>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">Device Fingerprint</p>
                <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Browser:</span> {activity.browser || "Unknown"}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Operating System:</span> {activity.operatingSystem || "Unknown"}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Device Type:</span> {activity.deviceType || "Unknown"}</p>
                  <p className="leading-6"><span className="font-semibold text-zinc-900 dark:text-white">User Agent:</span> {activity.userAgent || "Unknown"}</p>
                </div>
              </div>

              <div className={detailCardClass}>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">Security Notes</p>
                <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Status:</span> {activity.status}</p>
                  <p><span className="font-semibold text-zinc-900 dark:text-white">Suspicious:</span> {activity.isSuspicious ? "Yes" : "No"}</p>
                  <p className="leading-6">
                    <span className="font-semibold text-zinc-900 dark:text-white">Failure Reason:</span>{" "}
                    {activity.failureReason || "No failure reason captured for this record."}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
};
