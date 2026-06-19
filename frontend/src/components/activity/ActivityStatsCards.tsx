import { Icon, type IconName } from "../Icon";
import type { ActivitySummary } from "../../types/activity";

interface ActivityStatsCardsProps {
  summary: ActivitySummary | null;
  loading: boolean;
}

const cards = (summary: ActivitySummary) =>
  [
    {
      label: "Total Logins Today",
      value: summary.totalLoginsToday,
      subtitle: "All successful and failed sign-in attempts recorded today.",
      icon: "history" as IconName,
      accent: "bg-zinc-400/20",
    },
    {
      label: "Successful Logins",
      value: summary.successfulLoginsToday,
      subtitle: "Sessions that were allowed into the workspace.",
      icon: "approvals" as IconName,
      accent: "bg-emerald-400/20",
    },
    {
      label: "Failed Logins",
      value: summary.failedLoginsToday,
      subtitle: "Blocked attempts caused by credentials or location checks.",
      icon: "close" as IconName,
      accent: "bg-rose-400/20",
    },
    {
      label: "Unusual Locations",
      value: summary.unusualLocationsToday,
      subtitle: "Recent successful sign-ins flagged for location shifts.",
      icon: "map-pin" as IconName,
      accent: "bg-amber-400/20",
    },
  ] as const;

const formatValue = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export const ActivityStatsCards = ({ summary, loading }: ActivityStatsCardsProps) => {
  if (loading || !summary) {
    return (
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={`activity-stat-skeleton-${index}`}
            className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 shadow-sm dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50"
          >
            <div className="h-4 w-28 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-900" />
            <div className="mt-5 h-10 w-20 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-900" />
            <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-900" />
            <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-900" />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards(summary).map((card) => (
        <div
          key={card.label}
          className="rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 shadow-sm transition hover:-translate-y-1 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{card.label}</p>
              <p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{formatValue(card.value)}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{card.subtitle}</p>
            </div>
            <div className="rounded-2xl border border-transparent bg-[#E6F1FB] p-3 text-[#185FA5] dark:bg-[#0C447C]/30 dark:text-[#B5D4F4] shadow-sm">
              <Icon name={card.icon} className="h-5 w-5" />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
};
