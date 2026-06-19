import { Icon } from "../Icon";
import type { ActivityFilterOptions } from "../../types/activity";

interface ActivityFiltersProps {
  search: string;
  fromDate: string;
  toDate: string;
  status: string;
  location: string;
  deviceType: string;
  filterOptions: ActivityFilterOptions;
  onSearchChange: (value: string) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onDeviceTypeChange: (value: string) => void;
  onReset: () => void;
}

const filterClass =
  "h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:focus:border-sky-500 dark:focus:ring-sky-500/10";

export const ActivityFilters = ({
  search,
  fromDate,
  toDate,
  status,
  location,
  deviceType,
  filterOptions,
  onSearchChange,
  onFromDateChange,
  onToDateChange,
  onStatusChange,
  onLocationChange,
  onDeviceTypeChange,
  onReset,
}: ActivityFiltersProps) => (
  <section className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-black/50 p-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-500">Filters</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Inspect a precise slice of login activity</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Search by user or email, narrow by date, and isolate the exact status, location, or device profile you want to review.
        </p>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="h-12 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-950"
      >
        Reset filters
      </button>
    </div>

    <div className="mt-5 grid gap-3 xl:grid-cols-[1.35fr_repeat(5,minmax(0,1fr))]">
      <label className="relative block">
        <span className="sr-only">Search activity</span>
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by user name or email"
          className={`${filterClass} pl-11`}
        />
      </label>

      <input type="date" value={fromDate} onChange={(event) => onFromDateChange(event.target.value)} className={filterClass} />
      <input type="date" value={toDate} onChange={(event) => onToDateChange(event.target.value)} className={filterClass} />

      <select value={status} onChange={(event) => onStatusChange(event.target.value)} className={filterClass}>
        <option value="">All statuses</option>
        {filterOptions.statuses.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <select value={location} onChange={(event) => onLocationChange(event.target.value)} className={filterClass}>
        <option value="">All locations</option>
        {filterOptions.locations.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <select value={deviceType} onChange={(event) => onDeviceTypeChange(event.target.value)} className={filterClass}>
        <option value="">All devices</option>
        {filterOptions.deviceTypes.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  </section>
);
