import { Icon } from "./Icon";

interface ReportExportActionsProps {
  onExportExcel: () => void;
  onExportPdf: () => void;
}

export const ReportExportActions = ({ onExportExcel, onExportPdf }: ReportExportActionsProps) => (
  <div className="workspace-panel rounded-[1.75rem] p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Filtered Export</p>
    <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">Download the current filtered view.</h3>
    <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
      Export only the rows visible in this report as an Excel workbook or PDF summary.
    </p>
    <div className="mt-5 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onExportExcel}
        className="inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        <Icon name="download" className="h-4 w-4" />
        Excel (.xlsx)
      </button>
      <button
        type="button"
        onClick={onExportPdf}
        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        <Icon name="reports" className="h-4 w-4" />
        PDF Report
      </button>
    </div>
  </div>
);
