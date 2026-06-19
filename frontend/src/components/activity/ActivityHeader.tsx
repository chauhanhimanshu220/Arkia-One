import { WorkspacePageHero } from "../WorkspacePageHero";

interface ActivityHeaderProps {
  userRole: string;
  lastSyncedAtUtc: string | null;
  refreshing: boolean;
  exporting: boolean;
  onRefresh: () => void;
  onExport: () => void;
}

const formatSyncTime = (value: string | null) => {
  if (!value) {
    return "Waiting for first sync";
  }

  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const actionCardClass =
  "rounded-r-[1.25rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50";

export const ActivityHeader = ({
  userRole,
  lastSyncedAtUtc,
  refreshing,
  exporting,
  onRefresh,
  onExport,
}: ActivityHeaderProps) => (
  <WorkspacePageHero
    title="Activity Logs"
    belowTitle={
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-zinc-200/90 bg-white/95 px-4 py-2 font-semibold text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-black/80 dark:text-white">
          {userRole}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-700 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
          {formatSyncTime(lastSyncedAtUtc)}
        </span>
      </div>
    }
  >
    <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[480px]">
      <div className={actionCardClass}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Audit scope</p>
        <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">Login monitoring</p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className={actionCardClass}
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-300">{refreshing ? "Refreshing" : "Refresh"}</p>
        <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">
          {refreshing ? "Syncing…" : "Pull latest"}
        </p>
      </button>
      <button type="button" onClick={onExport} disabled={exporting} className={actionCardClass}>
        <p className="text-sm text-zinc-500 dark:text-zinc-300">{exporting ? "Exporting" : "Export"}</p>
        <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">{exporting ? "Building CSV…" : "CSV download"}</p>
      </button>
    </div>
  </WorkspacePageHero>
);
