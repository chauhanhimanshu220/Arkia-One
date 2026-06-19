import { ApiError, apiBaseUrl, apiRequest, getAuthHeaders } from "./http";
import type {
  ActivityLoginDetail,
  ActivityLoginsQuery,
  ActivityLoginsResponse,
  ActivitySummary,
  ActivityTrend,
  ActivityTrendRange,
} from "../types/activity";

const buildQueryString = (query: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    params.set(key, String(value));
  });

  const raw = params.toString();
  return raw ? `?${raw}` : "";
};

const parseErrorMessage = async (response: Response) => {
  const contentType = response.headers.get("Content-Type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const json = (await response.json()) as { message?: string };
      if (typeof json.message === "string" && json.message.trim()) {
        return json.message;
      }

      return JSON.stringify(json);
    }

    return await response.text();
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

export const activityService = {
  getSummary: () => apiRequest<ActivitySummary>("/activity/summary"),

  getTrend: (range: ActivityTrendRange) =>
    apiRequest<ActivityTrend>(`/activity/trends${buildQueryString({ range })}`),

  getLogins: (query: ActivityLoginsQuery) =>
    apiRequest<ActivityLoginsResponse>(
      `/activity/logins${buildQueryString({
        page: query.page,
        pageSize: query.pageSize,
        search: query.search,
        fromDate: query.fromDate,
        toDate: query.toDate,
        status: query.status,
        location: query.location,
        deviceType: query.deviceType,
      })}`,
    ),

  getDetail: (id: string) => apiRequest<ActivityLoginDetail>(`/activity/logins/${id}`),

  exportCsv: async (query: Omit<ActivityLoginsQuery, "page" | "pageSize">) => {
    const response = await fetch(
      `${apiBaseUrl}/activity/export${buildQueryString({
        search: query.search,
        fromDate: query.fromDate,
        toDate: query.toDate,
        status: query.status,
        location: query.location,
        deviceType: query.deviceType,
      })}`,
      {
        headers: {
          Accept: "text/csv",
          ...getAuthHeaders(),
        },
      },
    );

    if (!response.ok) {
      throw new ApiError(await parseErrorMessage(response), response.status, "/activity/export");
    }

    return response.blob();
  },
};
