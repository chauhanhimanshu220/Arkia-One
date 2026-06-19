import { Icon } from "./Icon";

export const LoadingSpinner = ({ label = "Loading..." }: { label?: string }) => (
  <div className="glass-panel flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-3xl">
    <div className="rounded-full border border-brand-100 bg-brand-50 p-4 dark:border-brand-500/20 dark:bg-brand-500/10">
      <Icon name="spinner" className="h-8 w-8 animate-spin text-brand-600" />
    </div>
    <p className="text-base font-semibold text-zinc-800 dark:text-white">{label}</p>
  </div>
);
