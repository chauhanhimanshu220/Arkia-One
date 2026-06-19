import { apiRequest } from "./http";
import type { FinanceSettingCategory, FinanceSettingRecord, FinanceSettingSaveRequest } from "../types/financeSettings";

const pathFor = (category: FinanceSettingCategory) => `/finance/settings/${category}`;

export const financeSettingsService = {
  getSettings(category: FinanceSettingCategory) {
    return apiRequest<FinanceSettingRecord[]>(pathFor(category));
  },

  createSetting(category: FinanceSettingCategory, input: FinanceSettingSaveRequest) {
    return apiRequest<FinanceSettingRecord>(pathFor(category), {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateSetting(category: FinanceSettingCategory, id: string, input: FinanceSettingSaveRequest) {
    return apiRequest<FinanceSettingRecord>(`${pathFor(category)}/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  deleteSetting(category: FinanceSettingCategory, id: string) {
    return apiRequest<void>(`${pathFor(category)}/${id}`, {
      method: "DELETE",
    });
  },
};
