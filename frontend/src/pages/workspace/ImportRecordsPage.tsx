import { useCallback, useMemo, useState, type DragEvent } from "react";
import { Icon } from "../../components/Icon";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";

type ValidationStatus = "Valid" | "Warning" | "Error";

type ValidationRow = {
  id: string;
  employee: string;
  department: string;
  project: string;
  date: string;
  hours: string;
  status: ValidationStatus;
  message: string;
};

type ErrorLog = {
  id: string;
  row: number;
  field: string;
  issue: string;
};

type ImportHistoryRow = {
  id: string;
  fileName: string;
  importedOn: string;
  records: number;
  success: number;
  failed: number;
  status: "Completed" | "Partial" | "Failed";
};

const panel = "rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_40px_120px_-55px_rgba(15,23,42,0.8)] backdrop-blur-sm ring-1 ring-white/5";
const inputButton = "inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80 px-5 text-sm font-semibold text-slate-100 transition hover:border-slate-200/10 hover:bg-slate-900/90";
const secondaryButton = "inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/50 px-5 text-sm font-semibold text-slate-100/80 transition hover:border-slate-200/10 hover:bg-slate-900/80";
const badge = "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]";
const sectionButton = "block rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-sky-400/30 hover:bg-slate-900/80";

const sampleTemplateCsv = [
  ["Employee ID", "Employee Name", "Department", "Project Code", "Date", "Hours", "Billable", "Description"],
  ["EMP-101", "Amit Verma", "Engineering", "ATL-001", "2026-05-01", "8", "Yes", "Feature implementation"],
  ["EMP-102", "Neha Sharma", "Operations", "MER-022", "2026-05-01", "7", "Yes", "Client review"],
].map((row) => row.join(",")).join("\n");

const downloadBlob = (filename: string, contents: string) => {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const ImportRecordsPage = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importState, setImportState] = useState<"idle" | "uploading" | "validating" | "ready">("idle");
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [historyRows, setHistoryRows] = useState<ImportHistoryRow[]>([
    { id: "HST-001", fileName: "timesheet-import-may.csv", importedOn: "20 May 2026", records: 120, success: 112, failed: 8, status: "Partial" },
    { id: "HST-002", fileName: "timesheet-import-apr.csv", importedOn: "10 May 2026", records: 96, success: 96, failed: 0, status: "Completed" },
    { id: "HST-003", fileName: "timesheet-import-mar.csv", importedOn: "28 Apr 2026", records: 130, success: 124, failed: 6, status: "Partial" },
  ]);

  const totalRows = validationRows.length;
  const validRows = validationRows.filter((row) => row.status === "Valid").length;
  const warningRows = validationRows.filter((row) => row.status === "Warning").length;
  const errorRows = validationRows.filter((row) => row.status === "Error").length;

  const uploadSummary = useMemo(
    () => ({
      uploaded: uploadProgress,
      fileName: selectedFile?.name ?? "No file selected",
      recordCount: totalRows,
      successCount: validRows,
      failedCount: errorRows,
    }),
    [errorRows, selectedFile, totalRows, uploadProgress, validRows],
  );

  const handleFile = useCallback((file: File | null) => {
    setSelectedFile(file);
    setImportState("idle");
    setUploadProgress(0);
    setValidationRows([]);
    setErrorLogs([]);
    if (file) {
      showToast(`${file.name} selected for import.`, "info");
    }
  }, [showToast]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    handleFile(file);
  }, [handleFile]);

  const handleUpload = () => {
    if (!selectedFile) {
      showToast("Choose a CSV or Excel file first.", "error");
      return;
    }

    setImportState("uploading");
    setUploadProgress(8);
    const interval = window.setInterval(() => {
      setUploadProgress((current) => {
        if (current >= 96) {
          window.clearInterval(interval);
          setImportState("validating");
          setTimeout(() => {
            const rows: ValidationRow[] = [
              { id: "1", employee: "Amit Verma", department: "Engineering", project: "Atlas Migration", date: "2026-05-01", hours: "8", status: "Valid", message: "Ready for import" },
              { id: "2", employee: "Neha Sharma", department: "Operations", project: "Mercury Rollout", date: "2026-05-01", hours: "7", status: "Valid", message: "Ready for import" },
              { id: "3", employee: "Ravi Mehta", department: "Finance", project: "Zenith Compliance", date: "2026-05-01", hours: "10", status: "Warning", message: "Overtime entry requires review" },
              { id: "4", employee: "Priya Nair", department: "Support", project: "Nova Shared Services", date: "2026-05-01", hours: "0", status: "Error", message: "Missing hours value" },
              { id: "5", employee: "Karan Singh", department: "Engineering", project: "Atlas Migration", date: "2026-05-01", hours: "9", status: "Valid", message: "Ready for import" },
              { id: "6", employee: "Sara Khan", department: "Operations", project: "Mercury Rollout", date: "2026-05-01", hours: "11", status: "Error", message: "Billable flag missing" },
            ];
            setValidationRows(rows);
            setErrorLogs([
              { id: "E-105", row: 4, field: "Hours", issue: "This field is required." },
              { id: "E-107", row: 6, field: "Billable", issue: "Billable status must be Yes or No." },
            ]);
            setUploadProgress(100);
            setImportState("ready");
            showToast("Upload completed and validation finished.", "success");
          }, 900);
          return 100;
        }
        return Math.min(100, current + Math.floor(Math.random() * 12) + 6);
      });
    }, 120);
  };

  const handleRetryFailed = () => {
    if (errorRows === 0) {
      showToast("No failed records to retry.", "info");
      return;
    }
    setImportState("uploading");
    setUploadProgress(20);
    const interval = window.setInterval(() => {
      setUploadProgress((current) => {
        if (current >= 100) {
          window.clearInterval(interval);
          setValidationRows((previous) => previous.map((row) => row.status === "Error" ? { ...row, status: "Valid", message: "Fixed and ready for import" } : row));
          setErrorLogs([]);
          setImportState("ready");
          showToast("Failed records retried successfully.", "success");
          return 100;
        }
        return Math.min(100, current + 10);
      });
    }, 160);
  };

  const handleDownloadTemplate = () => {
    downloadBlob("timesheet-import-template.csv", sampleTemplateCsv);
    showToast("Sample template downloaded.", "success");
  };

  return (
    <section className="space-y-8 px-4 pb-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 shadow-[0_40px_120px_-55px_rgba(15,23,42,0.8)] backdrop-blur-xl">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-sm font-semibold text-sky-200">
                  <Icon name="file-spreadsheet" className="h-4 w-4" /> Import Finance Records
                </p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">Timesheet Import Workspace</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300/90">
                  Upload, validate and import employee timesheets with enterprise-grade audit logs. Review failed rows, download a sample template, and keep a full import history for finance approvals.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <button type="button" onClick={handleDownloadTemplate} className={inputButton}>
                  <Icon name="download" className="h-4 w-4" /> Download sample template
                </button>
                <button type="button" onClick={handleRetryFailed} className={secondaryButton}>
                  <Icon name="refresh-cw" className="h-4 w-4" /> Retry failed import
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">File</p>
                <p className="mt-3 text-lg font-semibold text-white">{selectedFile?.name ?? "No file chosen"}</p>
              </article>
              <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Progress</p>
                <p className="mt-3 text-lg font-semibold text-white">{uploadSummary.uploaded}%</p>
              </article>
              <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Success</p>
                <p className="mt-3 text-lg font-semibold text-sky-300">{uploadSummary.successCount}</p>
              </article>
              <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Failed</p>
                <p className="mt-3 text-lg font-semibold text-rose-300">{uploadSummary.failedCount}</p>
              </article>
            </div>
          </div>

          <div className={panel}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Import workflow</h2>
                <p className="mt-2 text-sm text-slate-400">Drag a CSV or Excel file here to start the import process. The system will validate each row and present issues before finalizing the upload.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleDownloadTemplate} className={inputButton}>
                  <Icon name="download" className="h-4 w-4" /> Sample template
                </button>
                <button type="button" onClick={handleUpload} className={inputButton}>
                  <Icon name="import" className="h-4 w-4" /> Start upload
                </button>
              </div>
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`mt-6 rounded-[1.75rem] border-2 ${dragActive ? "border-sky-400/80 bg-sky-500/10" : "border-white/10 bg-slate-950/60"} p-8 text-center transition`}
            >
              <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-slate-900/80 text-slate-200 shadow-inner shadow-slate-950/60">
                <Icon name="file-spreadsheet" className="h-10 w-10 text-sky-300" />
              </div>
              <p className="mt-6 text-lg font-semibold text-white">Drag & drop your file here</p>
              <p className="mt-2 text-sm text-slate-400">CSV or Excel files supported. Or click to browse from your device.</p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <label className={secondaryButton}>
                  Choose file
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="sr-only"
                    onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
                <span>Upload status</span>
                <span>{importState === "idle" ? "Awaiting file" : importState === "uploading" ? "Uploading" : importState === "validating" ? "Validating" : "Ready to import"}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-300 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          </div>

          <div className={panel}>
            <h2 className="text-2xl font-semibold text-white">Import validation</h2>
            <p className="mt-2 text-sm text-slate-400">Review the parsed rows and correct any issues before committing the import.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">Valid rows</p>
                <p className="mt-3 text-3xl font-semibold text-sky-300">{validRows}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">Warnings</p>
                <p className="mt-3 text-3xl font-semibold text-amber-300">{warningRows}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">Errors</p>
                <p className="mt-3 text-3xl font-semibold text-rose-300">{errorRows}</p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/70">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm text-slate-200">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.24em] text-slate-400">
                  <tr>
                    <th className="px-4 py-4">Row</th>
                    <th className="px-4 py-4">Employee</th>
                    <th className="px-4 py-4">Project</th>
                    <th className="px-4 py-4">Date</th>
                    <th className="px-4 py-4">Hours</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {validationRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">No validation rows available.</td>
                    </tr>
                  ) : (
                    validationRows.map((row) => (
                      <tr key={row.id} className="border-t border-white/10">
                        <td className="px-4 py-4 text-slate-300">{row.id}</td>
                        <td className="px-4 py-4 text-slate-100">{row.employee}</td>
                        <td className="px-4 py-4 text-slate-300">{row.project}</td>
                        <td className="px-4 py-4 text-slate-300">{row.date}</td>
                        <td className="px-4 py-4 text-slate-300">{row.hours}</td>
                        <td className="px-4 py-4">
                          <span className={`${badge} ${row.status === "Valid" ? "bg-emerald-500/10 text-emerald-200" : row.status === "Warning" ? "bg-amber-500/10 text-amber-200" : "bg-rose-500/10 text-rose-200"}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-300">{row.message}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={panel}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Error logs</h2>
                <p className="mt-2 text-sm text-slate-400">Detailed import errors to help your team fix data issues quickly.</p>
              </div>
              <button type="button" onClick={handleRetryFailed} className={secondaryButton}>
                <Icon name="refresh-cw" className="h-4 w-4" /> Retry failed rows
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/70">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm text-slate-200">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.24em] text-slate-400">
                  <tr>
                    <th className="px-4 py-4">Error ID</th>
                    <th className="px-4 py-4">Row</th>
                    <th className="px-4 py-4">Field</th>
                    <th className="px-4 py-4">Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {errorLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">No errors found.</td>
                    </tr>
                  ) : (
                    errorLogs.map((log) => (
                      <tr key={log.id} className="border-t border-white/10">
                        <td className="px-4 py-4 text-slate-300">{log.id}</td>
                        <td className="px-4 py-4 text-slate-300">{log.row}</td>
                        <td className="px-4 py-4 text-slate-300">{log.field}</td>
                        <td className="px-4 py-4 text-slate-300">{log.issue}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className={panel}>
            <h2 className="text-xl font-semibold text-white">Workflow navigation</h2>
            <p className="mt-2 text-sm text-slate-400">Quickly jump between import actions and review stages.</p>
            <div className="mt-6 space-y-3">
              {[
                { label: "Upload file", description: "Start your batch import.", icon: "file-spreadsheet" as const },
                { label: "Review validation", description: "Inspect rows and fix issues.", icon: "eye" as const },
                { label: "Error logs", description: "See why records failed.", icon: "refresh-cw" as const },
                { label: "Import history", description: "Track previous imports.", icon: "history" as const },
              ].map((item) => (
                <button type="button" key={item.label} className={sectionButton}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sky-300">
                      <Icon name={item.icon} className="h-5 w-5" />
                    </span>
                    <div className="text-left">
                      <p className="font-semibold text-white">{item.label}</p>
                      <p className="text-sm text-slate-400">{item.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={panel}>
            <h2 className="text-xl font-semibold text-white">Import history</h2>
            <p className="mt-2 text-sm text-slate-400">Recent imports show the success rate and completion state for your finance team.</p>
            <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/70">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm text-slate-200">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.24em] text-slate-400">
                  <tr>
                    <th className="px-4 py-4">File</th>
                    <th className="px-4 py-4">Records</th>
                    <th className="px-4 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => (
                    <tr key={row.id} className="border-t border-white/10">
                      <td className="px-4 py-4 text-slate-100">{row.fileName}</td>
                      <td className="px-4 py-4 text-slate-300">{row.records}</td>
                      <td className="px-4 py-4">
                        <span className={`${badge} ${row.status === "Completed" ? "bg-emerald-500/10 text-emerald-200" : row.status === "Partial" ? "bg-amber-500/10 text-amber-200" : "bg-rose-500/10 text-rose-200"}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </section>
  );
};
