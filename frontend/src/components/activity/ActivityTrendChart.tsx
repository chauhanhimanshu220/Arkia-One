import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import type { ActivityTrend, ActivityTrendRange } from "../../types/activity";
import { activityTrendRangeOptions } from "../../types/activity";

interface ActivityTrendChartProps {
  trend: ActivityTrend | null;
  loading: boolean;
  selectedRange: ActivityTrendRange;
  onRangeChange: (range: ActivityTrendRange) => void;
}

export const ActivityTrendChart = ({
  trend,
  loading,
  selectedRange,
  onRangeChange,
}: ActivityTrendChartProps) => {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });

    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const chartOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        toolbar: { show: false },
        foreColor: isDark ? "#94a3b8" : "#64748b",
        fontFamily: "inherit",
      },
      dataLabels: { enabled: false },
      stroke: {
        curve: "smooth",
        width: [3, 2],
        dashArray: [0, 6],
      },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.28,
          opacityTo: 0.04,
        },
      },
      grid: {
        borderColor: isDark ? "rgba(161,161,170,0.12)" : "rgba(161,161,170,0.18)",
        strokeDashArray: 4,
      },
      legend: {
        position: "top",
        horizontalAlign: "left",
        labels: { colors: isDark ? "#94a3b8" : "#475569" },
      },
      xaxis: {
        categories: trend?.buckets.map((bucket) => bucket.label) ?? [],
        labels: {
          style: { colors: isDark ? "#64748b" : "#64748b" },
          rotate: -30,
        },
        axisBorder: { color: isDark ? "rgba(51,65,85,0.6)" : "rgba(203,213,225,0.9)" },
      },
      yaxis: {
        labels: {
          style: { colors: isDark ? "#64748b" : "#64748b" },
          formatter: (value) => Math.round(value).toString(),
        },
      },
      tooltip: {
        theme: isDark ? "dark" : "light",
      },
      colors: ["#38bdf8", "#fb7185"],
    }),
    [isDark, trend?.buckets],
  );

  const hasData = Boolean(trend?.buckets.some((bucket) => bucket.totalLogins > 0 || bucket.failedLogins > 0));

  return (
    <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500">Login Trend</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Authentication activity over time</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Keep one clean read on how successful and failed logins are moving through the selected monitoring window.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {activityTrendRangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onRangeChange(option.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                option.value === selectedRange
                  ? "bg-zinc-950 dark:bg-white text-white dark:text-black"
                  : "border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.82),rgba(0,0,0,0.72))]">
        {loading ? (
          <div className="h-[320px] animate-pulse rounded-[1.25rem] bg-zinc-100 dark:bg-black/60" />
        ) : hasData && trend ? (
          <Chart
            type="area"
            height={320}
            series={[
              { name: "Successful", data: trend.buckets.map((bucket) => bucket.successfulLogins) },
              { name: "Failed", data: trend.buckets.map((bucket) => bucket.failedLogins) },
            ]}
            options={chartOptions}
          />
        ) : (
          <div className="flex h-[320px] flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-zinc-200 text-center dark:border-zinc-700">
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">No login activity yet</p>
            <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
              Once users start signing in, the hourly and period trend will appear here without cluttering the rest of the page.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
