import { useMemo, useState, type ChangeEvent } from "react";
import { Icon } from "../../components/Icon";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";

const panelClass = "rounded-[2rem] border border-white/70 bg-white/85 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/85";
const controlClass = "h-12 rounded-2xl border border-zinc-200 bg-white/90 px-4 text-sm text-zinc-700 outline-none transition focus:border-brand-500 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200";
const badgeClass = "inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
const actionButtonClass = "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const secondaryButtonClass = "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white";

const reportTypes = [
  "Payroll Summary",
  "Billing Summary",
  "Expense Ledger",
  "Project Cost Analysis",
] as const;

type ReportType = (typeof reportTypes)[number];

type ExportRow = {
  id: string;
  name: string;
  department: string;
  project: string;
  period: string;
  category: string;
  status: string;
  amount: number;
};

const sampleRows: ExportRow[] = [
  { id: "EFD-001", name: "Amit Verma", department: "Engineering", project: "Atlas Migration", period: "01 May - 15 May", category: "Payroll", status: "Ready", amount: 192000 },
  { id: "EFD-002", name: "Neha Sharma", department: "Operations", project: "Mercury Rollout", period: "01 May - 15 May", category: "Billing", status: "Ready", amount: 164000 },
  { id: "EFD-003", name: "Rahul Mehta", department: "Finance", project: "Zenith Compliance", period: "01 May - 15 May", category: "Expense", status: "Pending", amount: 86000 },
  { id: "EFD-004", name: "Priya Nair", department: "Support", project: "Nova Shared Services", period: "01 May - 15 May", category: "Billing", status: "Ready", amount: 121000 },
  { id: "EFD-005", name: "Karan Singh", department: "Engineering", project: "Atlas Migration", period: "16 May - 31 May", category: "Payroll", status: "Ready", amount: 208000 },
  { id: "EFD-006", name: "Sara Khan", department: "Operations", project: "Mercury Rollout", period: "16 May - 31 May", category: "Expense", status: "Pending", amount: 72000 },
];

const formatCurrency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const csvEscape = (value: string | number | boolean) => `"${String(value).replace(/"/g, '""')}"`;

const statusChipClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes("ready")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (normalized.includes("pending")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
};

const downloadBlob = (filename: string, blob: Blob) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const ExportFinancialDataPage = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const [selectedType, setSelectedType] = useState<ReportType>("Payroll Summary");
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2026-05-31");
  const [searchQuery, setSearchQuery] = useState("");
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("csv");

  const filteredRows = useMemo(() => {
    return sampleRows.filter((row) => {
      const matchesType = selectedType === "Payroll Summary"
        ? row.category === "Payroll"
        : selectedType === "Billing Summary"
          ? row.category === "Billing"
          : selectedType === "Expense Ledger"
            ? row.category === "Expense"
            : true;

      const matchesSearch = [row.name, row.department, row.project, row.period, row.status].some((value) =>
        value.toLowerCase().includes(searchQuery.toLowerCase()),
      );

      const rangeMatches = startDate <= row.period.slice(0, 10) && endDate >= row.period.slice(0, 10);
      return matchesType && matchesSearch && rangeMatches;
    });
  }, [endDate, searchQuery, selectedType, startDate]);

  const totalAmount = useMemo(() => filteredRows.reduce((sum, row) => sum + row.amount, 0), [filteredRows]);

  const handleExport = (format: "csv" | "xlsx" | "pdf") => {
    if (filteredRows.length === 0) {
      showToast("No records available for export.", "info");
      return;
    }

    const csvRows = [
      ["Record ID", "Name", "Department", "Project", "Period", "Category", "Status", "Amount"],
      ...filteredRows.map((row) => [row.id, row.name, row.department, row.project, row.period, row.category, row.status, formatCurrency(row.amount)]),
    ];

    const csv = csvRows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");
    downloadBlob(`export-financial-data-${selectedType.toLowerCase().replace(/\s+/g, "-")}.${format === "pdf" ? "txt" : format}`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
    showToast(`Exported ${filteredRows.length} rows as ${format.toUpperCase()}.`, "success");
  };

  const summaryCards = [
    { label: "Ready for export", value: filteredRows.length, accent: "bg-emerald-300/35" },
    { label: "Selected volume", value: formatCurrency(totalAmount), accent: "bg-sky-300/30" },
    { label: "Report type", value: selectedType, accent: "bg-violet-300/30" },
    { label: "Current format", value: exportFormat.toUpperCase(), accent: "bg-amber-300/30" },
  ];

  return (
    <section className="space-y-6">
      <div className="workspace-hero rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] p-8 text-white shadow-panel dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92))]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80">
              <Icon name="download" className="h-4 w-4" />
              Finance export workspace
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Export Financial Data</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-200/90">
                Create filtered exports for payroll, billing, and expense records. Set the range, choose the format, and download the consolidated financial snapshot instantly.
              </p>
            </div>
          </div>
          <div className="space-y-3 rounded-[1.75rem] border border-white/20 bg-white/5 p-5 text-sm text-zinc-200 backdrop-blur">
            <div className="flex items-center gap-3 text-sm text-zinc-300">
              <Icon name="clock" className="h-4 w-4" />
              Last export: 14 minutes ago
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-300">
              <Icon name="file-spreadsheet" className="h-4 w-4" />
              Default download: CSV
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-6">
          <div className={panelClass}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Export controls</h2>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Choose the filter set for the export and preview the rows included in this download.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => handleExport("csv")} className={actionButtonClass}>
                  <Icon name="download" className="h-4 w-4" /> CSV
                </button>
                <button type="button" onClick={() => handleExport("xlsx")} className={secondaryButtonClass}>
                  <Icon name="file-spreadsheet" className="h-4 w-4" /> Excel
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Report type</span>
                <select value={selectedType} onChange={(event) => setSelectedType(event.target.value as ReportType)} className={controlClass}>
                  {reportTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">From</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={controlClass} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">To</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={controlClass} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Format</span>
                <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as "csv" | "xlsx" | "pdf")} className={controlClass}>
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_0.8fr]">
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Search rows</span>
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name, project, department" className={controlClass} />
              </label>
              <div className="space-y-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Status</span>
                <div className="flex flex-wrap gap-2">
                  {['Ready', 'Pending', 'Closed'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSearchQuery(status)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-[1.75rem] border border-zinc-200/80 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-black/70">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-white">{card.value}</p>
              </div>
            ))}
          </div>

          <div className={panelClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Preview export rows</h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">This table shows every record that will be included in the current export selection.</p>
              </div>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-black/50 dark:text-zinc-200">{filteredRows.length} rows</span>
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm text-zinc-700 dark:text-zinc-200">
                <thead className="bg-zinc-50 text-xs uppercase tracking-[0.24em] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Record</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No records match the current filters.</td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                        <td className="px-4 py-4 font-semibold text-zinc-900 dark:text-white">{row.id}</td>
                        <td className="px-4 py-4">{row.project}</td>
                        <td className="px-4 py-4">{row.department}</td>
                        <td className="px-4 py-4">{row.period}</td>
                        <td className="px-4 py-4"><span className={`${statusChipClass(row.status)} px-3 py-1 text-xs`}>{row.status}</span></td>
                        <td className="px-4 py-4 font-semibold">{formatCurrency(row.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className={panelClass}>
            <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <Icon name="file-spreadsheet" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Export summary</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Prepare your export package before downloading.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-zinc-200 bg-white/90 p-4 dark:border-zinc-800 dark:bg-black/60">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Export window</p>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{startDate} — {endDate}</p>
              </div>
              <div className="rounded-3xl border border-zinc-200 bg-white/90 p-4 dark:border-zinc-800 dark:bg-black/60">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Records selected</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{filteredRows.length}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Total amount exported across all selected rows.</p>
              </div>
              <div className="rounded-3xl border border-zinc-200 bg-white/90 p-4 dark:border-zinc-800 dark:bg-black/60">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Export actions</p>
                <div className="mt-3 flex flex-col gap-3">
                  <button type="button" onClick={() => handleExport(exportFormat)} className={actionButtonClass}>
                    <Icon name="download" className="h-4 w-4" /> Download {exportFormat.toUpperCase()}
                  </button>
                  <button type="button" onClick={() => handleExport("csv")} className={secondaryButtonClass}>
                    <Icon name="refresh-cw" className="h-4 w-4" /> Refresh export preview
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={panelClass}>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Why use this workspace?</h3>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <li>• Export filtered finance records for payroll, billing, or expenses.</li>
              <li>• Download with the format your team needs: CSV, Excel, or PDF-ready summary.</li>
              <li>• Preview the exact rows before you export so reports stay accurate.</li>
            </ul>
          </div>
        </aside>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </section>
  );
};
