export type ActivityTrendRange = "today" | "this_week" | "this_month";

export interface ActivitySummary {
  totalLoginsToday: number;
  successfulLoginsToday: number;
  failedLoginsToday: number;
  unusualLocationsToday: number;
  lastSyncedAtUtc: string;
}

export interface ActivityTrendBucket {
  label: string;
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
}

export interface ActivityTrend {
  range: ActivityTrendRange | string;
  buckets: ActivityTrendBucket[];
}

export interface ActivityFilterOptions {
  statuses: string[];
  locations: string[];
  deviceTypes: string[];
}

export interface ActivityLoginRow {
  id: string;
  userId: string | null;
  fullName: string;
  email: string;
  role: string;
  department: string;
  loginTime: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  city: string;
  state: string;
  country: string;
  ipAddress: string;
  deviceType: string;
  browser: string;
  operatingSystem: string;
  status: string;
  failureReason: string;
  isSuspicious: boolean;
}

export interface ActivityLoginsResponse {
  page: number;
  pageSize: number;
  totalCount: number;
  items: ActivityLoginRow[];
  filters: ActivityFilterOptions;
}

export interface ActivityLoginDetail extends ActivityLoginRow {
  logoutTime: string | null;
  accuracy: number | null;
  userAgent: string;
  createdAt: string;
}

export interface ActivityLoginsQuery {
  page: number;
  pageSize: number;
  search?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  location?: string;
  deviceType?: string;
}

export const activityTrendRangeOptions: Array<{ label: string; value: ActivityTrendRange }> = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
];
