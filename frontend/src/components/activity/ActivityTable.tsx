import { Icon } from "../Icon";
import { Pagination } from "../Pagination";
import type { ActivityLoginRow } from "../../types/activity";

interface ActivityTableProps {
  items: ActivityLoginRow[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
  onOpenSpot: (item: ActivityLoginRow) => Promise<void> | void;
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const statusBadgeClass = (value: string) =>
  value === "Success"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
    : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";

const formatLocationLines = (item: ActivityLoginRow) => {
  const primary = [item.city, item.state]
    .filter((value) => value.trim().length > 0)
    .join(", ");

  if (primary) {
    return {
      primary,
      secondary: item.country.trim() || item.location,
    };
  }

  return {
    primary: item.location,
    secondary: "",
  };
};

const hasKnownLocation = (item: ActivityLoginRow) => item.location.trim().length > 0 && item.location.trim().toLowerCase() !== "unknown";

export const ActivityTable = ({
  items,
  totalCount,
  currentPage,
  totalPages,
  loading,
  onPageChange,
  onSelect,
  onOpenSpot,
}: ActivityTableProps) => (
  <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50">
    <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500">Login Activity</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Recent authentication records</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Review who logged in, when the access happened, from where it was captured, and whether the request was accepted or rejected.
          </p>
        </div>
        <div className="rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200">
          {new Intl.NumberFormat("en-IN").format(totalCount)} matching record{totalCount === 1 ? "" : "s"}
        </div>
      </div>
    </div>

    <div className="overflow-auto">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur dark:bg-black/95">
          <tr>
            {["User", "Login Time", "Location", "IP Address", "Device", "Browser", "Status", "Spot", "Action"].map((heading) => (
              <th key={heading} className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {loading && items.length === 0 ? (
            Array.from({ length: 8 }, (_, index) => (
              <tr key={`activity-row-skeleton-${index}`}>
                <td colSpan={9} className="px-4 py-4">
                  <div className="h-12 animate-pulse rounded-2xl bg-zinc-100 dark:bg-black/60" />
                </td>
              </tr>
            ))
          ) : items.length > 0 ? (
            items.map((item) => {
              const location = formatLocationLines(item);
              const hasSpot =
                (typeof item.latitude === "number" && Number.isFinite(item.latitude) && typeof item.longitude === "number" && Number.isFinite(item.longitude)) ||
                hasKnownLocation(item);

              return (
                <tr key={item.id} className="cursor-pointer align-top transition hover:bg-zinc-50/80 dark:hover:bg-black/50" onClick={() => onSelect(item.id)}>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-zinc-900 dark:text-white">{item.fullName}</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.email}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{item.role}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{formatDateTime(item.loginTime)}</td>
                  <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{location.primary}</p>
                    {location.secondary ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">{location.secondary}</p> : null}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{item.ipAddress}</td>
                  <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                    <p>{item.deviceType}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{item.operatingSystem}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">{item.browser}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                      {item.isSuspicious ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                          Suspicious
                        </span>
                      ) : null}
                    </div>
                    {item.failureReason ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-200">{item.failureReason}</p> : null}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onOpenSpot(item);
                      }}
                      disabled={!hasSpot}
                      aria-label={hasSpot ? `View ${item.fullName} login spot on map` : `Location unavailable for ${item.fullName}`}
                      title={hasSpot ? `View ${item.fullName} on map` : "Location coordinates unavailable"}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                        hasSpot
                          ? "border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white"
                          : "cursor-not-allowed border-zinc-200/70 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600"
                      }`}
                    >
                      <Icon name="map-pin" className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(item.id);
                      }}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={9} className="px-6 py-16 text-center">
                <p className="text-base font-semibold text-zinc-900 dark:text-white">No activity records match the current filters.</p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Try broadening the date range or removing one of the filters to see more login events.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
  </section>
);
