import { useEffect, useRef, useState } from "react";
import type { SsrsPayrollRenderFormat } from "../utils/ssrsPayrollReports";
import { SSRS_PAYROLL_RENDER_FORMATS } from "../utils/ssrsPayrollReports";
import { Icon } from "./Icon";

const VIEWER_CHANNEL = "ssrs-payroll-viewer";
const VIEWER_ZOOM_OPTIONS = [75, 90, 100, 110, 125, 150];

type ViewerMessage =
  | { channel: typeof VIEWER_CHANNEL; type: "ready" }
  | { channel: typeof VIEWER_CHANNEL; type: "findResult"; count: number }
  | { channel: typeof VIEWER_CHANNEL; type: "pageInfo"; currentPage: number; totalPages: number };

interface SsrsReportWorkspaceViewerProps {
  viewerUrl: string | null;
  viewerLoading: boolean;
  hasPendingChanges: boolean;
  ssrsFormat: SsrsPayrollRenderFormat;
  onSsrsFormatChange: (value: SsrsPayrollRenderFormat) => void;
  onRefresh: () => void;
  onDownload: () => void;
  onOpenInNewTab: () => void;
  integrated?: boolean;
}

const toolbarButtonClass =
  "inline-flex h-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-brand-200 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 dark:hover:bg-zinc-900";
const toolbarIconButtonClass = `${toolbarButtonClass} w-10 px-0`;
const toolbarInputClass =
  "h-10 rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black/70 dark:text-zinc-200 dark:focus:ring-brand-500/20";

export function SsrsReportWorkspaceViewer({
  viewerUrl,
  viewerLoading,
  hasPendingChanges,
  ssrsFormat,
  onSsrsFormatChange,
  onRefresh,
  onDownload,
  onOpenInNewTab,
  integrated = false,
}: SsrsReportWorkspaceViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [findInput, setFindInput] = useState("");
  const [submittedFindText, setSubmittedFindText] = useState("");
  const [searchMatches, setSearchMatches] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const showLoadingOverlay = viewerLoading || Boolean(viewerUrl && !viewerReady);

  const postViewerMessage = (payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ channel: VIEWER_CHANNEL, ...payload }, "*");
  };

  const readDirectPageMetrics = () => {
    try {
      const frameWindow = iframeRef.current?.contentWindow;
      const frameDocument = frameWindow?.document;
      const reportPage = frameDocument?.getElementById("reportPage");
      if (!frameWindow || !frameDocument) {
        return null;
      }

      const viewportHeight = Math.max(frameWindow.innerHeight || iframeRef.current?.clientHeight || 1, 1);
      const reportHeight = reportPage?.getBoundingClientRect().height ?? 0;
      const documentHeight = Math.max(
        frameDocument.body?.scrollHeight ?? 0,
        frameDocument.documentElement?.scrollHeight ?? 0,
        reportHeight,
        viewportHeight,
      );
      const nextTotalPages = Math.max(1, Math.ceil(documentHeight / viewportHeight));
      const nextCurrentPage = Math.min(nextTotalPages, Math.max(1, Math.floor(frameWindow.scrollY / viewportHeight) + 1));

      return {
        currentPage: nextCurrentPage,
        totalPages: nextTotalPages,
        viewportHeight,
      };
    } catch {
      return null;
    }
  };

  const syncDirectPageInfo = () => {
    const metrics = readDirectPageMetrics();
    if (!metrics) {
      return;
    }

    setCurrentPage(metrics.currentPage);
    setTotalPages(metrics.totalPages);
  };

  useEffect(() => {
    setViewerReady(false);
    setSearchMatches(null);
    setCurrentPage(1);
    setTotalPages(1);
  }, [viewerUrl]);

  useEffect(() => {
    const handleViewerMessage = (event: MessageEvent<ViewerMessage>) => {
      const data = event.data;
      if (!data || data.channel !== VIEWER_CHANNEL) {
        return;
      }

      if (data.type === "ready") {
        setViewerReady(true);
        return;
      }

      if (data.type === "findResult") {
        setSearchMatches(Number.isFinite(data.count) ? Number(data.count) : 0);
        return;
      }

      if (data.type === "pageInfo") {
        setCurrentPage(Math.max(1, Number.isFinite(data.currentPage) ? Number(data.currentPage) : 1));
        setTotalPages(Math.max(1, Number.isFinite(data.totalPages) ? Number(data.totalPages) : 1));
      }
    };

    window.addEventListener("message", handleViewerMessage);
    return () => window.removeEventListener("message", handleViewerMessage);
  }, []);

  useEffect(() => {
    if (!viewerReady) {
      return;
    }

    postViewerMessage({ type: "setZoom", zoom: zoomPercent });
    window.setTimeout(syncDirectPageInfo, 100);
  }, [viewerReady, zoomPercent]);

  useEffect(() => {
    if (!viewerReady) {
      return;
    }

    postViewerMessage({ type: "find", term: submittedFindText });
  }, [submittedFindText, viewerReady]);

  const submitFind = () => {
    setSubmittedFindText(findInput.trim());
  };

  const clearFind = () => {
    setFindInput("");
    setSubmittedFindText("");
    setSearchMatches(null);
    if (viewerReady) {
      postViewerMessage({ type: "find", term: "" });
    }
  };

  const printViewer = () => {
    postViewerMessage({ type: "print" });
  };

  const goToPage = (page: number) => {
    const boundedPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(boundedPage);

    const metrics = readDirectPageMetrics();
    if (metrics) {
      const directBoundedPage = Math.min(Math.max(page, 1), metrics.totalPages);
      iframeRef.current?.contentWindow?.scrollTo({
        top: (directBoundedPage - 1) * metrics.viewportHeight,
        behavior: "smooth",
      });
      setCurrentPage(directBoundedPage);
      setTotalPages(metrics.totalPages);
    }

    postViewerMessage({ type: "goToPage", page: boundedPage });
  };

  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const Wrapper = integrated ? "div" : "section";
  const wrapperClass = integrated
    ? "overflow-hidden border-t border-zinc-200 dark:border-zinc-800"
    : "overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/80";

  return (
    <Wrapper className={wrapperClass}>
      <div className="border-b border-zinc-200/80 bg-white/90 px-6 py-5 dark:border-zinc-800 dark:bg-black/70">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">SSRS Viewer</p>
            <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">Embedded payroll report workspace</h3>
          </div>
          <div className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-300">
            {hasPendingChanges ? "Parameters changed. Select View Report to refresh the embedded report." : "Viewer is synced with the applied report parameters."}
          </div>
        </div>
      </div>

      <div className="border-b border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-black/50">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-[1.5rem] border border-zinc-200 bg-white px-2 py-2 shadow-sm dark:border-zinc-700 dark:bg-black/60">
            <button type="button" onClick={() => goToPage(1)} disabled={!viewerReady || !hasPreviousPage} className={toolbarIconButtonClass} title="First page">
              <Icon name="chevrons-left" className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={!viewerReady || !hasPreviousPage} className={toolbarIconButtonClass} title="Previous page">
              <Icon name="chevron-left" className="h-4 w-4" />
            </button>
            <input
              value={currentPage}
              onChange={(event) => {
                const page = Number(event.target.value);
                if (Number.isFinite(page)) {
                  goToPage(page);
                }
              }}
              className="h-10 w-12 rounded-2xl border border-zinc-200 bg-white px-2 text-center text-sm font-semibold text-zinc-700 shadow-sm outline-none dark:border-zinc-700 dark:bg-black/70 dark:text-zinc-200"
              aria-label="Current page"
            />
            <span className="px-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">of {totalPages}</span>
            <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={!viewerReady || !hasNextPage} className={toolbarIconButtonClass} title="Next page">
              <Icon name="chevron-right" className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => goToPage(totalPages)} disabled={!viewerReady || !hasNextPage} className={toolbarIconButtonClass} title="Last page">
              <Icon name="chevrons-right" className="h-4 w-4" />
            </button>
          </div>

          <button type="button" onClick={onRefresh} className={toolbarIconButtonClass} title="Refresh report">
            <Icon name="refresh-cw" className="h-4 w-4" />
          </button>

          <label className="flex items-center gap-2 rounded-[1.5rem] border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-300">
            <span>Zoom</span>
            <select
              value={zoomPercent}
              onChange={(event) => setZoomPercent(Number(event.target.value))}
              className={toolbarInputClass}
            >
              {VIEWER_ZOOM_OPTIONS.map((zoomOption) => (
                <option key={zoomOption} value={zoomOption}>
                  {zoomOption}%
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-[1.5rem] border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-300">
            <span>Export</span>
            <select
              value={ssrsFormat}
              onChange={(event) => onSsrsFormatChange(event.target.value as SsrsPayrollRenderFormat)}
              className={`${toolbarInputClass} min-w-[210px]`}
            >
              {SSRS_PAYROLL_RENDER_FORMATS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={onDownload} className={toolbarButtonClass}>
            <Icon name="download" className="mr-2 h-4 w-4" />
            Download
          </button>
          <button type="button" onClick={printViewer} className={toolbarIconButtonClass} title="Print report">
            <Icon name="printer" className="h-4 w-4" />
          </button>
          <button type="button" onClick={onOpenInNewTab} className={toolbarIconButtonClass} title="Open report in a new tab">
            <Icon name="external-link" className="h-4 w-4" />
          </button>

          <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-2">
            <input
              value={findInput}
              onChange={(event) => setFindInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitFind();
                }
              }}
              placeholder="Find in report"
              className={`${toolbarInputClass} min-w-[220px] flex-1 lg:max-w-[280px]`}
            />
            <button type="button" onClick={submitFind} className={toolbarButtonClass}>
              <Icon name="search" className="mr-2 h-4 w-4" />
              Find
            </button>
            <button type="button" onClick={clearFind} className={toolbarButtonClass}>
              Clear
            </button>
            <div className="min-w-[88px] text-right text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {searchMatches === null ? "Find" : `${searchMatches} match${searchMatches === 1 ? "" : "es"}`}
            </div>
          </div>
        </div>
      </div>

      <div className="relative min-h-[780px] bg-zinc-100/80 p-0 dark:bg-zinc-950/60">
        <div className="w-full">
          <div className="overflow-hidden bg-white dark:bg-black/80">
            {viewerUrl ? (
              <iframe
                ref={iframeRef}
                src={viewerUrl}
                title="SSRS payroll report viewer"
                className="h-[calc(100vh-190px)] min-h-[780px] w-full bg-white"
                onLoad={() => {
                  setViewerReady(true);
                  window.setTimeout(syncDirectPageInfo, 100);
                }}
              />
            ) : (
              <div className="flex h-[calc(100vh-190px)] min-h-[780px] items-center justify-center bg-white px-6 text-center text-sm text-zinc-500 dark:bg-black/80 dark:text-zinc-400">
                The report preview is not yet loaded. Click View Report to build the latest payroll report preview.
              </div>
            )}
          </div>
        </div>

        {showLoadingOverlay ? (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-100/50 backdrop-blur-[2px] dark:bg-black/30">
            <div className="rounded-2xl border border-zinc-200 bg-white/95 px-5 py-4 text-sm font-semibold text-zinc-700 shadow-panel dark:border-zinc-700 dark:bg-black/80 dark:text-zinc-200">
              Loading report preview...
            </div>
          </div>
        ) : null}
      </div>
    </Wrapper>
  );
}
