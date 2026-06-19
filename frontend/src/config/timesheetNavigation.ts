export const TIMESHEET_TARGET_DATE_KEY = "timesheet-target-date";
export const TIMESHEET_TARGET_MODE_KEY = "timesheet-target-mode";
export const TIMESHEET_TARGET_INTENT_KEY = "timesheet-target-intent";

export const setTimesheetNavigationTarget = (
  date: string,
  mode: "daily" | "weekly" = "weekly",
  intent: "default" | "late-request" = "default",
) => {
  window.sessionStorage.setItem(TIMESHEET_TARGET_DATE_KEY, date);
  window.sessionStorage.setItem(TIMESHEET_TARGET_MODE_KEY, mode);
  window.sessionStorage.setItem(TIMESHEET_TARGET_INTENT_KEY, intent);
};

export const consumeTimesheetNavigationTarget = () => {
  const date = window.sessionStorage.getItem(TIMESHEET_TARGET_DATE_KEY);
  const mode = window.sessionStorage.getItem(TIMESHEET_TARGET_MODE_KEY) as "daily" | "weekly" | null;
  const intent = (window.sessionStorage.getItem(TIMESHEET_TARGET_INTENT_KEY) as "default" | "late-request" | null) ?? "default";

  window.sessionStorage.removeItem(TIMESHEET_TARGET_DATE_KEY);
  window.sessionStorage.removeItem(TIMESHEET_TARGET_MODE_KEY);
  window.sessionStorage.removeItem(TIMESHEET_TARGET_INTENT_KEY);

  return {
    date,
    mode,
    intent,
  };
};
