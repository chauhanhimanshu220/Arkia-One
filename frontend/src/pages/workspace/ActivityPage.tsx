import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityDetailsDrawer } from "../../components/activity/ActivityDetailsDrawer";
import { ActivityFilters } from "../../components/activity/ActivityFilters";
import { ActivityHeader } from "../../components/activity/ActivityHeader";
import { ActivityStatsCards } from "../../components/activity/ActivityStatsCards";
import { ActivityTable } from "../../components/activity/ActivityTable";
import { ActivityTrendChart } from "../../components/activity/ActivityTrendChart";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";
import { activityService } from "../../services/activityService";
import type {
  ActivityFilterOptions,
  ActivityLoginDetail,
  ActivityLoginRow,
  ActivityLoginsResponse,
  ActivitySummary,
  ActivityTrend,
  ActivityTrendRange,
} from "../../types/activity";
import type { AuthUser } from "../../types/auth";

const PAGE_SIZE = 10;

const emptyFilterOptions: ActivityFilterOptions = {
  statuses: [],
  locations: [],
  deviceTypes: [],
};

const downloadBlob = (filename: string, blob: Blob) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const createExportFileName = () => `activity-logins-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;

const hasValidCoordinates = (latitude: number | null | undefined, longitude: number | null | undefined) =>
  typeof latitude === "number" &&
  Number.isFinite(latitude) &&
  typeof longitude === "number" &&
  Number.isFinite(longitude);

const getValidCoordinates = (
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): { latitude: number; longitude: number } | null =>
  hasValidCoordinates(latitude, longitude)
    ? { latitude: latitude as number, longitude: longitude as number }
    : null;

const createGoogleMapsUrl = (latitude: number, longitude: number) =>
  `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`;

export const ActivityPage = ({ user }: { user: AuthUser }) => {
  const { toasts, showToast, dismissToast } = useToast();
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [trend, setTrend] = useState<ActivityTrend | null>(null);
  const [logins, setLogins] = useState<ActivityLoginsResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<ActivityTrendRange>("today");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLoginDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const dateRangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);
  const filterOptions = logins?.filters ?? emptyFilterOptions;
  const totalPages = Math.max(1, Math.ceil((logins?.totalCount ?? 0) / PAGE_SIZE));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [deviceType, fromDate, location, searchQuery, status, toDate]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);

    try {
      const data = await activityService.getSummary();
      setSummary(data);
      return true;
    } catch {
      setPageError("Unable to load the activity summary right now.");
      showToast("Unable to load the activity summary right now.", "error");
      return false;
    } finally {
      setLoadingSummary(false);
    }
  }, [showToast]);

  const loadTrend = useCallback(async () => {
    setLoadingTrend(true);

    try {
      const data = await activityService.getTrend(selectedRange);
      setTrend(data);
      return true;
    } catch {
      setPageError("Unable to load the login trend right now.");
      showToast("Unable to load the login trend right now.", "error");
      return false;
    } finally {
      setLoadingTrend(false);
    }
  }, [selectedRange, showToast]);

  const loadLogins = useCallback(async () => {
    if (dateRangeInvalid) {
      setLoadingTable(false);
      return false;
    }

    setLoadingTable(true);

    try {
      const data = await activityService.getLogins({
        page: currentPage,
        pageSize: PAGE_SIZE,
        search: searchQuery || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        status: status || undefined,
        location: location || undefined,
        deviceType: deviceType || undefined,
      });

      setLogins(data);
      return true;
    } catch {
      setPageError("Unable to load login activity records right now.");
      showToast("Unable to load login activity records right now.", "error");
      return false;
    } finally {
      setLoadingTable(false);
    }
  }, [currentPage, dateRangeInvalid, deviceType, fromDate, location, searchQuery, showToast, status, toDate]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadTrend();
  }, [loadTrend]);

  useEffect(() => {
    void loadLogins();
  }, [loadLogins]);

  const handleRefresh = useCallback(async () => {
    if (dateRangeInvalid) {
      showToast("Choose a valid date range before refreshing.", "info");
      return;
    }

    setRefreshing(true);
    const results = await Promise.all([loadSummary(), loadTrend(), loadLogins()]);
    setRefreshing(false);

    if (results.every(Boolean)) {
      setPageError(null);
      showToast("Activity view refreshed.", "success");
      return;
    }

    showToast("Activity view refreshed with some missing data.", "info");
  }, [dateRangeInvalid, loadLogins, loadSummary, loadTrend, showToast]);

  const handleExport = useCallback(async () => {
    if (dateRangeInvalid) {
      showToast("Choose a valid date range before exporting.", "info");
      return;
    }

    setExporting(true);

    try {
      const blob = await activityService.exportCsv({
        search: searchQuery || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        status: status || undefined,
        location: location || undefined,
        deviceType: deviceType || undefined,
      });

      downloadBlob(createExportFileName(), blob);
      showToast("Activity CSV exported.", "success");
    } catch {
      showToast("Unable to export activity records right now.", "error");
    } finally {
      setExporting(false);
    }
  }, [dateRangeInvalid, deviceType, fromDate, location, searchQuery, showToast, status, toDate]);

  const handleOpenDetails = useCallback(
    async (id: string) => {
      setDrawerOpen(true);
      setDetailLoading(true);
      setSelectedActivity(null);

      try {
        const detail = await activityService.getDetail(id);
        setSelectedActivity(detail);
      } catch {
        setDrawerOpen(false);
        showToast("Unable to load this activity record right now.", "error");
      } finally {
        setDetailLoading(false);
      }
    },
    [showToast],
  );

  const handleOpenSpot = useCallback(
    async (item: ActivityLoginRow) => {
      const pendingMapWindow = window.open("about:blank", "_blank");
      if (!pendingMapWindow) {
        showToast("Allow pop-ups to open the selected login spot on Google Maps.", "info");
        return;
      }

      const openResolvedMap = (latitude: number, longitude: number) => {
        pendingMapWindow.location.replace(createGoogleMapsUrl(latitude, longitude));
      };

      const rowCoordinates = getValidCoordinates(item.latitude, item.longitude);
      if (rowCoordinates) {
        openResolvedMap(rowCoordinates.latitude, rowCoordinates.longitude);
        return;
      }

      try {
        const detail = await activityService.getDetail(item.id);

        const detailCoordinates = getValidCoordinates(detail.latitude, detail.longitude);
        if (!detailCoordinates) {
          pendingMapWindow.close();
          showToast("Location coordinates are not available for this login record.", "info");
          return;
        }

        openResolvedMap(detailCoordinates.latitude, detailCoordinates.longitude);
      } catch {
        pendingMapWindow.close();
        showToast("Unable to open the selected login spot right now.", "error");
      }
    },
    [showToast],
  );

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedActivity(null);
    setDetailLoading(false);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setStatus("");
    setLocation("");
    setDeviceType("");
    setCurrentPage(1);
  }, []);

  const warningMessage = useMemo(() => {
    if (dateRangeInvalid) {
      return "Start date cannot be after end date. Adjust the range to continue filtering the activity feed.";
    }

    return pageError;
  }, [dateRangeInvalid, pageError]);

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ActivityDetailsDrawer open={drawerOpen} activity={selectedActivity} loading={detailLoading} onClose={handleCloseDrawer} />

      <div className="space-y-6">
        <ActivityHeader
          userRole={user.role}
          lastSyncedAtUtc={summary?.lastSyncedAtUtc ?? null}
          refreshing={refreshing}
          exporting={exporting}
          onRefresh={handleRefresh}
          onExport={handleExport}
        />

        {warningMessage ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
            {warningMessage}
          </div>
        ) : null}

        <ActivityStatsCards summary={summary} loading={loadingSummary} />

        <ActivityFilters
          search={searchInput}
          fromDate={fromDate}
          toDate={toDate}
          status={status}
          location={location}
          deviceType={deviceType}
          filterOptions={filterOptions}
          onSearchChange={setSearchInput}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onStatusChange={setStatus}
          onLocationChange={setLocation}
          onDeviceTypeChange={setDeviceType}
          onReset={handleResetFilters}
        />

        <ActivityTable
          items={logins?.items ?? []}
          totalCount={logins?.totalCount ?? 0}
          currentPage={currentPage}
          totalPages={totalPages}
          loading={loadingTable}
          onPageChange={setCurrentPage}
          onSelect={handleOpenDetails}
          onOpenSpot={handleOpenSpot}
        />

        <ActivityTrendChart
          trend={trend}
          loading={loadingTrend}
          selectedRange={selectedRange}
          onRangeChange={setSelectedRange}
        />
      </div>
    </>
  );
};
