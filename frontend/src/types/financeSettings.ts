export type FinanceSettingCategory = "tax" | "currency" | "billing-rules";

export type FinanceSettingStatus = "Active" | "Draft" | "Inactive";

export type FinanceSettingData = Record<string, string | number | boolean>;

export interface FinanceSettingRecord {
  id: string;
  category: FinanceSettingCategory;
  key: string;
  name: string;
  description: string;
  status: FinanceSettingStatus;
  data: FinanceSettingData;
  updatedAt: string;
  updatedBy: string;
}

export interface FinanceSettingSaveRequest {
  name: string;
  description: string;
  status: FinanceSettingStatus;
  data: FinanceSettingData;
}
