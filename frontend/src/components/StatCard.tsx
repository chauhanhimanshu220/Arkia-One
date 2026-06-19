interface StatCardProps {
  label: string;
  value: number;
  accent?: string;
  subtitle?: string;
}

export const StatCard = ({ label, value, subtitle }: StatCardProps) => (
  <div className="relative overflow-hidden rounded-r-[1.5rem] rounded-l-none border border-zinc-200/80 border-l-[4px] border-l-[#378ADD] bg-zinc-50/80 p-5 shadow-sm transition hover:-translate-y-1 dark:border-zinc-800 dark:border-l-[#378ADD] dark:bg-black/50">
    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
    <p className="mt-3 text-3xl font-bold text-[#185FA5] dark:text-[#B5D4F4]">{value}</p>
    {subtitle ? <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
  </div>
);

