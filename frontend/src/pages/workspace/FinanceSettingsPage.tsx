import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";
import { financeSettingsService } from "../../services/financeSettingsService";
import type { FinanceSettingCategory, FinanceSettingData, FinanceSettingRecord, FinanceSettingSaveRequest, FinanceSettingStatus } from "../../types/financeSettings";

type FieldType = "text" | "number" | "boolean";

type FieldConfig = {
  key: string;
  label: string;
  type: FieldType;
};

type PageConfig = {
  eyebrow: string;
  title: string;
  description: string;
  emptyText: string;
  primaryMetric: string;
  fields: FieldConfig[];
  defaultRecord: FinanceSettingSaveRequest;
};

type FormState = {
  id?: string;
  name: string;
  description: string;
  status: FinanceSettingStatus;
  data: Record<string, string | boolean>;
};

const panelClass = "rounded-[2rem] border border-zinc-200/80 bg-white/90 shadow-panel dark:border-zinc-800 dark:bg-black/85";
const inputClass = "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200";
const buttonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900";
const primaryButtonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-100";

const configs: Record<FinanceSettingCategory, PageConfig> = {
  tax: {
    eyebrow: "Finance Settings / Tax",
    title: "Tax Configuration",
    description: "Maintain GST, TDS, regional tax rates, thresholds, and effective dates fetched from the backend finance settings table.",
    emptyText: "No tax configuration rules are available.",
    primaryMetric: "Avg Rate",
    fields: [
      { key: "taxType", label: "Tax Type", type: "text" },
      { key: "rate", label: "Rate %", type: "number" },
      { key: "threshold", label: "Threshold", type: "number" },
      { key: "region", label: "Region", type: "text" },
      { key: "effectiveFrom", label: "Effective From", type: "text" },
    ],
    defaultRecord: {
      name: "New Tax Rule",
      description: "Tax rule used by finance billing and payout workflows.",
      status: "Draft",
      data: { taxType: "GST", rate: 18, threshold: 0, region: "India", effectiveFrom: new Date().toISOString().slice(0, 10) },
    },
  },
  currency: {
    eyebrow: "Finance Settings / Currency",
    title: "Currency Settings",
    description: "Manage base currency, symbols, exchange rates, and precision values used by reports, invoices, and exports.",
    emptyText: "No currencies are configured yet.",
    primaryMetric: "Currencies",
    fields: [
      { key: "code", label: "Code", type: "text" },
      { key: "symbol", label: "Symbol", type: "text" },
      { key: "exchangeRate", label: "Exchange Rate", type: "number" },
      { key: "precision", label: "Precision", type: "number" },
      { key: "isBaseCurrency", label: "Base Currency", type: "boolean" },
    ],
    defaultRecord: {
      name: "New Currency",
      description: "Currency available for finance reports and billing.",
      status: "Draft",
      data: { code: "EUR", symbol: "EUR", exchangeRate: 90, precision: 2, isBaseCurrency: false },
    },
  },
  "billing-rules": {
    eyebrow: "Finance Settings / Billing Rules",
    title: "Billing Rules",
    description: "Configure invoice cycle, payment terms, billable-hour behavior, overtime treatment, and invoice numbering rules.",
    emptyText: "No billing rules are configured yet.",
    primaryMetric: "Payment Terms",
    fields: [
      { key: "billingCycle", label: "Billing Cycle", type: "text" },
      { key: "billableHoursOnly", label: "Billable Hours Only", type: "boolean" },
      { key: "overtimeBillable", label: "Overtime Billable", type: "boolean" },
      { key: "paymentTermsDays", label: "Payment Terms Days", type: "number" },
      { key: "invoicePrefix", label: "Invoice Prefix", type: "text" },
    ],
    defaultRecord: {
      name: "New Billing Rule",
      description: "Billing rule used to prepare invoices from approved work records.",
      status: "Draft",
      data: { billingCycle: "Monthly", billableHoursOnly: true, overtimeBillable: true, paymentTermsDays: 30, invoicePrefix: "INV" },
    },
  },
};

const statusOptions: FinanceSettingStatus[] = ["Active", "Draft", "Inactive"];

const toFormState = (record: FinanceSettingRecord | FinanceSettingSaveRequest): FormState => ({
  id: "id" in record ? record.id : undefined,
  name: record.name,
  description: record.description,
  status: record.status,
  data: Object.fromEntries(Object.entries(record.data).map(([key, value]) => [key, typeof value === "boolean" ? value : String(value)])),
});

const toPayload = (form: FormState, fields: FieldConfig[]): FinanceSettingSaveRequest => ({
  name: form.name.trim(),
  description: form.description.trim(),
  status: form.status,
  data: fields.reduce<FinanceSettingData>((data, field) => {
    const value = form.data[field.key];
    if (field.type === "boolean") {
      data[field.key] = Boolean(value);
    } else if (field.type === "number") {
      const parsed = Number(value);
      data[field.key] = Number.isFinite(parsed) ? parsed : 0;
    } else {
      data[field.key] = String(value ?? "").trim();
    }
    return data;
  }, {}),
});

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not updated" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const statusClass = (status: string) => {
  if (status === "Active") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (status === "Draft") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
};

export const FinanceSettingsPage = ({ category }: { category: FinanceSettingCategory }) => {
  const config = configs[category];
  const { toasts, showToast, dismissToast } = useToast();
  const [records, setRecords] = useState<FinanceSettingRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(config.defaultRecord));

  const selectedRecord = useMemo(() => records.find((item) => item.id === selectedId) ?? null, [records, selectedId]);

  const loadSettings = async (showSuccess = false) => {
    setLoading(true);
    try {
      const data = await financeSettingsService.getSettings(category);
      setRecords(data);
      if (showSuccess) showToast(`${config.title} refreshed from backend.`, "success");
    } catch {
      showToast(`Unable to load ${config.title.toLowerCase()} from backend.`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedId(null);
    setForm(toFormState(config.defaultRecord));
    void loadSettings(false);
  }, [category]);

  useEffect(() => {
    setForm(toFormState(selectedRecord ?? config.defaultRecord));
  }, [config.defaultRecord, selectedRecord]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => [record.name, record.description, record.status, ...Object.values(record.data).map(String)].join(" ").toLowerCase().includes(query));
  }, [records, search]);

  const stats = useMemo(() => {
    const active = records.filter((record) => record.status === "Active").length;
    const numberValues = records.flatMap((record) => Object.values(record.data).filter((value): value is number => typeof value === "number"));
    const average = numberValues.length ? numberValues.reduce((sum, value) => sum + value, 0) / numberValues.length : 0;
    const lastUpdated = [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.updatedAt;
    return { total: records.length, active, average, lastUpdated };
  }, [records]);

  const saveRecord = async () => {
    if (!form.name.trim()) {
      showToast("Name is required before saving.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = toPayload(form, config.fields);
      const saved = form.id
        ? await financeSettingsService.updateSetting(category, form.id, payload)
        : await financeSettingsService.createSetting(category, payload);
      setRecords((current) => (current.some((item) => item.id === saved.id) ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current]));
      setSelectedId(saved.id);
      showToast(`${saved.name} saved successfully.`, "success");
    } catch {
      showToast("Unable to save finance setting right now.", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record: FinanceSettingRecord) => {
    setSaving(true);
    try {
      await financeSettingsService.deleteSetting(category, record.id);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      if (selectedId === record.id) setSelectedId(null);
      showToast(`${record.name} deleted.`, "success");
    } catch {
      showToast("Unable to delete finance setting right now.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading && records.length === 0) {
    return <LoadingSpinner label={`Loading ${config.title.toLowerCase()}...`} />;
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <section className="rounded-[2rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(250,250,250,0.98),rgba(244,244,245,0.94))] p-6 shadow-panel dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.98),rgba(0,0,0,0.94))]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">{config.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-white">{config.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">{config.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void loadSettings(true)} className={buttonClass}><Icon name="refresh-cw" className="h-4 w-4" /> Refresh</button>
            <button type="button" onClick={() => { setSelectedId(null); setForm(toFormState(config.defaultRecord)); }} className={primaryButtonClass}><Icon name="plus" className="h-4 w-4" /> New Rule</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className={`${panelClass} p-5`}><p className="text-sm text-zinc-500">Total Rules</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{stats.total}</p></div>
        <div className={`${panelClass} p-5`}><p className="text-sm text-zinc-500">Active</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{stats.active}</p></div>
        <div className={`${panelClass} p-5`}><p className="text-sm text-zinc-500">{config.primaryMetric}</p><p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">{category === "currency" ? stats.total : stats.average.toFixed(1)}</p><p className="mt-1 text-xs text-zinc-500">Last update: {stats.lastUpdated ? formatDate(stats.lastUpdated) : "Not updated"}</p></div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className={panelClass}>
          <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Backend Records</h2>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search settings" className={`${inputClass} mt-4`} />
          </div>
          <div className="max-h-[620px] overflow-auto p-3">
            {filteredRecords.map((record) => (
              <button key={record.id} type="button" onClick={() => setSelectedId(record.id)} className={`mb-3 w-full rounded-[1.5rem] border p-4 text-left transition ${selectedId === record.id ? "border-zinc-950 bg-zinc-100 dark:border-white dark:bg-zinc-900" : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-950"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-950 dark:text-white">{record.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">{record.description}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(record.status)}`}>{record.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                  {config.fields.slice(0, 3).map((field) => <span key={field.key} className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">{field.label}: {String(record.data[field.key] ?? "-")}</span>)}
                </div>
              </button>
            ))}
            {filteredRecords.length === 0 ? <p className="px-4 py-12 text-center text-sm text-zinc-500">{config.emptyText}</p> : null}
          </div>
        </div>

        <form className={`${panelClass} p-5`} onSubmit={(event) => { event.preventDefault(); void saveRecord(); }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">{form.id ? "Edit Rule" : "Create Rule"}</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Changes are saved through the backend API into the finance settings table.</p>
            </div>
            {selectedRecord ? <button type="button" onClick={() => void deleteRecord(selectedRecord)} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 disabled:opacity-60 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"><Icon name="trash" className="h-4 w-4" /> Delete</button> : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Name</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label>
            <label className="space-y-2 md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Description</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={`${inputClass} min-h-24`} /></label>
            <label className="space-y-2"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as FinanceSettingStatus }))} className={inputClass}>{statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            {config.fields.map((field) => (
              <label key={field.key} className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{field.label}</span>
                {field.type === "boolean" ? (
                  <select value={String(Boolean(form.data[field.key]))} onChange={(event) => setForm((current) => ({ ...current, data: { ...current.data, [field.key]: event.target.value === "true" } }))} className={inputClass}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input type={field.type === "number" ? "number" : "text"} value={String(form.data[field.key] ?? "")} onChange={(event) => setForm((current) => ({ ...current, data: { ...current.data, [field.key]: event.target.value } }))} className={inputClass} />
                )}
              </label>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setForm(toFormState(selectedRecord ?? config.defaultRecord))} className={buttonClass}>Reset</button>
            <button type="submit" disabled={saving} className={primaryButtonClass}><Icon name="check" className="h-4 w-4" /> Save</button>
          </div>
        </form>
      </section>
    </div>
  );
};
