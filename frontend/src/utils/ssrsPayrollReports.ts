import { apiBaseUrl } from "../services/http";

export const SSRS_PAYROLL_RENDER_FORMATS = [
  { value: "PDF", label: "PDF Document (.pdf)", extension: "pdf" },
  { value: "EXCELOPENXML", label: "Excel Workbook (.xlsx)", extension: "xlsx" },
  { value: "WORDOPENXML", label: "Word Document (.docx)", extension: "docx" },
  { value: "CSV", label: "CSV Data File (.csv)", extension: "csv" },
  { value: "XML", label: "XML Data File (.xml)", extension: "xml" },
] as const;

export type SsrsPayrollRenderFormat = (typeof SSRS_PAYROLL_RENDER_FORMATS)[number]["value"];

export type SsrsPayrollFilterState = {
  startDate: string;
  endDate: string;
  projectFilter: string;
  projectLabel?: string;
  statusFilter: string;
  employeeFilter: string;
  billableFilter: string;
  searchTerm: string;
  employeeScope?: string[];
};

export type SsrsPayrollSnapshotRow = {
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  designation: string;
  timesheetStatus: string;
  weekStart: string;
  weekEnd: string;
  entryDate: string;
  projectCode: string;
  projectName: string;
  clientBusinessUnit: string;
  taskName: string;
  billableLabel: string;
  entryHours: number;
  entryNote: string;
  updatedAtUtc: string;
};

export const getSsrsPayrollRenderFormatOption = (format: SsrsPayrollRenderFormat) =>
  SSRS_PAYROLL_RENDER_FORMATS.find((option) => option.value === format) ?? SSRS_PAYROLL_RENDER_FORMATS[0];

export const createSsrsPayrollExportFileName = (filters: SsrsPayrollFilterState, format: SsrsPayrollRenderFormat) => {
  const option = getSsrsPayrollRenderFormatOption(format);
  const safeStartDate = filters.startDate.replace(/[^0-9]/g, "");
  const safeEndDate = filters.endDate.replace(/[^0-9]/g, "");
  return `payroll-export-${safeStartDate}-${safeEndDate}.${option.extension}`;
};

const LOCAL_DEFAULT_BACKEND_TARGET = "http://localhost:5296";
const configuredSsrsApiBaseUrl = (import.meta.env.VITE_SSRS_API_BASE_URL as string | undefined)?.trim();
const configuredBackendTarget = (import.meta.env.VITE_BACKEND_TARGET as string | undefined)?.trim();
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

let resolvedSsrsApiBasePromise: Promise<string> | null = null;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const localSsrsFallbackApiBaseUrl = `${trimTrailingSlash(configuredBackendTarget || LOCAL_DEFAULT_BACKEND_TARGET)}/api`;

const toAbsoluteApiBaseUrl = (value: string) => trimTrailingSlash(new URL(value, window.location.origin).toString());

const buildApiUrl = (baseUrl: string, path: string) => {
  const normalizedBase = trimTrailingSlash(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

const createQuery = ({
  startDate,
  endDate,
  projectFilter,
  projectLabel,
  statusFilter,
  employeeFilter,
  billableFilter,
  searchTerm,
  employeeScope,
  format,
  snapshotId,
}: SsrsPayrollFilterState & { format?: SsrsPayrollRenderFormat; snapshotId?: string }) => {
  const query = new URLSearchParams();
  query.set("startDate", startDate);
  query.set("endDate", endDate);
  query.set("projectFilter", projectFilter || "All");
  query.set("statusFilter", statusFilter || "All");
  query.set("employeeFilter", employeeFilter || "All");
  query.set("billableFilter", billableFilter || "All");
  query.set("searchTerm", searchTerm.trim());

  if (projectLabel?.trim()) {
    query.set("projectLabel", projectLabel.trim());
  }

  if (employeeScope && employeeScope.length > 0) {
    query.set("employeeScope", JSON.stringify(employeeScope));
  }

  if (format) {
    query.set("format", format);
  }

  if (snapshotId) {
    query.set("snapshotId", snapshotId);
  }

  return query.toString();
};

const supportsSsrsApi = async (apiBase: string, filters: SsrsPayrollFilterState) => {
  try {
    const response = await fetch(`${buildApiUrl(apiBase, "/ssrs/payroll-export/view")}?${createQuery(filters)}`, {
      method: "GET",
      headers: {
        Accept: "text/html,application/json",
      },
    });
    return response.status !== 404;
  } catch {
    return false;
  }
};

const getCandidateApiBases = () => {
  const candidates = [configuredSsrsApiBaseUrl, apiBaseUrl];

  if (LOCAL_HOSTNAMES.has(window.location.hostname)) {
    candidates.push(localSsrsFallbackApiBaseUrl);
  }

  return Array.from(
    new Set(
      candidates
        .filter((value): value is string => Boolean(value))
        .map((value) => toAbsoluteApiBaseUrl(value)),
    ),
  );
};

const resolveSsrsApiBaseUrl = async (filters: SsrsPayrollFilterState) => {
  if (!resolvedSsrsApiBasePromise) {
    resolvedSsrsApiBasePromise = (async () => {
      const candidates = getCandidateApiBases();

      for (const candidate of candidates) {
        if (await supportsSsrsApi(candidate, filters)) {
          return candidate;
        }
      }

      throw new Error("Payroll export API is not reachable. Start the backend or point the app at the correct API URL and try again.");
    })();
  }

  return resolvedSsrsApiBasePromise;
};

export const resetSsrsApiBaseResolution = () => {
  resolvedSsrsApiBasePromise = null;
};

export const buildSsrsPayrollExportViewerUrl = async (filters: SsrsPayrollFilterState) =>
  `${buildApiUrl(await resolveSsrsApiBaseUrl(filters), "/ssrs/payroll-export/view")}?${createQuery(filters)}`;

export const buildSsrsPayrollExportDownloadUrl = async (
  filters: SsrsPayrollFilterState & { format: SsrsPayrollRenderFormat },
) => `${buildApiUrl(await resolveSsrsApiBaseUrl(filters), "/ssrs/payroll-export/download")}?${createQuery(filters)}`;

export const createSsrsPayrollExportSnapshot = async (filters: SsrsPayrollFilterState, rows: SsrsPayrollSnapshotRow[]) => {
  const apiBase = await resolveSsrsApiBaseUrl(filters);
  const response = await fetch(buildApiUrl(apiBase, "/ssrs/payroll-export/snapshot"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      filter: filters,
      rows,
    }),
  });

  if (!response.ok) {
    let message = "Unable to prepare the backend payroll report snapshot.";
    try {
      const payload = await response.json();
      if (payload && typeof payload.message === "string") {
        message = payload.message;
      }
    } catch {
      // Keep default message.
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as { snapshotId?: string };
  if (!payload.snapshotId) {
    throw new Error("Backend did not return a payroll report snapshot id.");
  }

  return payload.snapshotId;
};

export const buildSsrsPayrollExportSnapshotViewerUrl = async (filters: SsrsPayrollFilterState, snapshotId: string) =>
  `${buildApiUrl(await resolveSsrsApiBaseUrl(filters), "/ssrs/payroll-export/view")}?${createQuery({ ...filters, snapshotId })}`;

export const buildSsrsPayrollExportSnapshotDownloadUrl = async (
  filters: SsrsPayrollFilterState & { format: SsrsPayrollRenderFormat },
  snapshotId: string,
) => `${buildApiUrl(await resolveSsrsApiBaseUrl(filters), "/ssrs/payroll-export/download")}?${createQuery({ ...filters, snapshotId })}`;
