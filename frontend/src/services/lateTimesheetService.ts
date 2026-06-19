import { apiRequest } from "./http";
import type {
  LateTimesheetAccessRecord,
  LateTimesheetCreatePayload,
  LateTimesheetDateOption,
  LateTimesheetEligibleDate,
  LateTimesheetRequestRecord,
} from "../types/lateTimesheet";

export const lateTimesheetService = {
  async getEligibleDates(userId: string) {
    return await apiRequest<LateTimesheetEligibleDate[]>(
      `/late-timesheet-requests/eligible-dates?userId=${encodeURIComponent(userId)}`,
    );
  },

  async getEligibleOptions(userId: string, dates: string[]) {
    if (!dates.length) {
      return [] as LateTimesheetDateOption[];
    }

    return await apiRequest<LateTimesheetDateOption[]>(
      `/late-timesheet-requests/eligible-options?userId=${encodeURIComponent(userId)}&dates=${encodeURIComponent(dates.join(","))}`,
    );
  },

  async createRequest(payload: LateTimesheetCreatePayload) {
    return await apiRequest<LateTimesheetRequestRecord>("/late-timesheet-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listByUser(userId: string) {
    return await apiRequest<LateTimesheetRequestRecord[]>(`/late-timesheet-requests/by-user/${encodeURIComponent(userId)}`);
  },

  async listInbox(managerId?: string) {
    const query = managerId ? `?managerId=${encodeURIComponent(managerId)}` : "";
    return await apiRequest<LateTimesheetRequestRecord[]>(`/late-timesheet-requests/inbox${query}`);
  },

  async decideItem(itemId: string, decision: "Approved" | "Rejected", decisionNote = "") {
    return await apiRequest<LateTimesheetRequestRecord>(`/late-timesheet-requests/${encodeURIComponent(itemId)}/decision`, {
      method: "POST",
      body: JSON.stringify({
        decision,
        decisionNote,
      }),
    });
  },

  async getApprovedAccess(userId: string, weekStart: string) {
    return await apiRequest<LateTimesheetAccessRecord>(
      `/late-timesheet-requests/access?userId=${encodeURIComponent(userId)}&weekStart=${encodeURIComponent(weekStart)}`,
    );
  },
};
