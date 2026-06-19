import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ToastContainer } from "../../components/ToastContainer";
import { WorkspaceHeroMeta, WorkspacePageHero } from "../../components/WorkspacePageHero";
import { workspaceRoutes } from "../../config/workspaceNavigation";
import { useToast } from "../../hooks/useToast";
import { employeeApi } from "../../services/api";
import { clientBillingService } from "../../services/clientBillingService";
import { projectService } from "../../services/projectService";
import { timesheetService } from "../../services/timesheetService";
import type { AuthUser } from "../../types/auth";
import type {
  ClientBillingDiscountType,
  ClientBillingRecord,
  ClientBillingStatus,
  ClientBillingType,
  GeneratedClientBillingInvoice,
} from "../../types/clientBilling";
import type { Employee } from "../../types/employee";
import type { Project } from "../../types/project";
import type { TimesheetWeekRecord } from "../../types/timesheet";
import {
  buildApprovedBillingLineItems,
  buildClientBillingAmounts,
  buildClientBillingRecordSignature,
  deriveSuggestedBillingType,
  deriveSuggestedRate,
  formatBillingPeriod,
  formatCompactCurrency,
  formatCurrency,
  formatDateLabel,
  formatHours,
  isDateRangeOverlapping,
  toNumber,
  todayInput,
} from "../../utils/clientBilling";

type BillingFormState = {
  clientName: string;
  projectId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  billingType: ClientBillingType;
  currencyCode: string;
  status: ClientBillingStatus;
  billableHours: string;
  rate: string;
  fixedAmount: string;
  milestoneLabel: string;
  milestoneAmount: string;
  retainerAmount: string;
  taxPercentage: string;
  discountType: ClientBillingDiscountType;
  discountValue: string;
  adjustmentAmount: string;
  notes: string;
};

const panelClass = "rounded-[2rem] border border-white/70 bg-white/85 shadow-panel dark:border-zinc-800 dark:bg-black/85";
const inputClass =
  "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200";
const selectClass =
  "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200";
const primaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-100";
const secondaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900";

const billingTypeOptions: ClientBillingType[] = ["Hourly", "Fixed Project", "Milestone", "Retainer"];
const currencyOptions = ["INR", "USD", "EUR"];
const discountTypeOptions: ClientBillingDiscountType[] = ["None", "Fixed", "Percentage"];
const lockedStatuses: ClientBillingStatus[] = ["Invoiced", "Paid", "Cancelled"];

const getMonthBoundary = (kind: "start" | "end") => {
  const date = new Date();
  const target = kind === "start" ? new Date(date.getFullYear(), date.getMonth(), 1) : new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const year = target.getFullYear();
  const month = `${target.getMonth() + 1}`.padStart(2, "0");
  const day = `${target.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildDefaultFormState = (): BillingFormState => ({
  clientName: "",
  projectId: "",
  billingPeriodStart: getMonthBoundary("start"),
  billingPeriodEnd: getMonthBoundary("end"),
  billingType: "Hourly",
  currencyCode: "INR",
  status: "Draft",
  billableHours: "0",
  rate: "1000",
  fixedAmount: "0",
  milestoneLabel: "",
  milestoneAmount: "0",
  retainerAmount: "75000",
  taxPercentage: "18",
  discountType: "None",
  discountValue: "0",
  adjustmentAmount: "0",
  notes: "",
});

const toFormState = (record: ClientBillingRecord): BillingFormState => ({
  clientName: record.clientName,
  projectId: record.projectId,
  billingPeriodStart: record.billingPeriodStart,
  billingPeriodEnd: record.billingPeriodEnd,
  billingType: record.billingType,
  currencyCode: record.currencyCode,
  status: record.status,
  billableHours: String(record.totalBillableHours),
  rate: String(record.rate),
  fixedAmount: String(record.fixedAmount),
  milestoneLabel: record.milestoneLabel ?? "",
  milestoneAmount: String(record.milestoneAmount),
  retainerAmount: String(record.retainerAmount),
  taxPercentage: String(record.taxPercentage),
  discountType: record.discountType,
  discountValue: String(record.discountValue),
  adjustmentAmount: String(record.adjustmentAmount),
  notes: record.notes,
});

const getStatusClass = (status: ClientBillingStatus) => {
  switch (status) {
    case "ReadyForInvoice":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
    case "Draft":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
    case "Invoiced":
      return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200";
    case "Paid":
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
    case "Cancelled":
    default:
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  }
};

const getInvoiceStatusClass = (status: GeneratedClientBillingInvoice["status"]) => {
  switch (status) {
    case "Draft":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
    case "Sent":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
    case "Cancelled":
    default:
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  }
};

const SummaryCard = ({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) => (
  <div className={`${panelClass} p-5`}>
    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
    <p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">{value}</p>
    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{note}</p>
  </div>
);

export const ClientBillingPage = ({ user }: { user: AuthUser }) => {
  const navigate = useNavigate();
  const { toasts, showToast, dismissToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [weeks, setWeeks] = useState<TimesheetWeekRecord[]>([]);
  const [records, setRecords] = useState<ClientBillingRecord[]>([]);
  const [generatedInvoices, setGeneratedInvoices] = useState<GeneratedClientBillingInvoice[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [form, setForm] = useState<BillingFormState>(buildDefaultFormState);

  const refreshFinanceData = async () => {
    const [nextRecords, nextInvoices] = await Promise.all([
      clientBillingService.getBillingRecords(),
      clientBillingService.getGeneratedInvoices(),
    ]);
    setRecords(nextRecords);
    setGeneratedInvoices(nextInvoices);
  };

  const loadPage = async () => {
    setLoading(true);
    try {
      const [nextRecords, nextInvoices, nextProjects, nextEmployees, nextWeeks] = await Promise.all([
        clientBillingService.getBillingRecords(),
        clientBillingService.getGeneratedInvoices(),
        projectService.getProjects(),
        employeeApi.getEmployees(),
        timesheetService.listWeeks(),
      ]);
      setRecords(nextRecords);
      setGeneratedInvoices(nextInvoices);
      setProjects(nextProjects);
      setEmployees(nextEmployees.filter((employee) => employee.status === "Active"));
      setWeeks(nextWeeks);
    } catch {
      showToast("Unable to load client billing data right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, []);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );

  useEffect(() => {
    if (selectedRecord) {
      setForm(toFormState(selectedRecord));
      return;
    }

    setForm(buildDefaultFormState());
  }, [selectedRecord]);

  const clientOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...projects.map((project) => project.clientBusinessUnit.trim()),
            ...records.map((record) => record.clientName.trim()),
          ].filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [projects, records],
  );

  const liveProjects = useMemo(() => projects.filter((project) => project.isBillable), [projects]);

  const projectOptions = useMemo(() => {
    const filtered = liveProjects.filter((project) =>
      form.clientName ? project.clientBusinessUnit.trim() === form.clientName.trim() : true,
    );
    const options = [...filtered];

    if (selectedRecord && !options.some((project) => project.id === selectedRecord.projectId)) {
      options.unshift({
        id: selectedRecord.projectId,
        name: `${selectedRecord.projectName} (Historical)`,
        code: selectedRecord.projectId,
        description: selectedRecord.notes,
        clientBusinessUnit: selectedRecord.clientName,
        department: "",
        adminId: "",
        adminName: "",
        managerId: "",
        managerName: selectedRecord.projectManagerName,
        projectLead: selectedRecord.projectManagerName,
        deliveryModel: selectedRecord.billingType,
        teamMemberIds: [],
        teamMemberNames: [],
        teamSize: 0,
        budget: selectedRecord.baseAmount,
        isBillable: true,
        priority: "Medium",
        status: "Completed",
        startDate: selectedRecord.billingPeriodStart,
        endDate: selectedRecord.billingPeriodEnd,
        createdAt: selectedRecord.createdAt,
      });
    }

    return options;
  }, [form.clientName, liveProjects, selectedRecord]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === form.projectId) ?? null,
    [form.projectId, projects],
  );

  const approvedLineItems = useMemo(
    () =>
      buildApprovedBillingLineItems({
        employees,
        records: weeks,
        projectId: form.projectId,
        periodStart: form.billingPeriodStart,
        periodEnd: form.billingPeriodEnd,
        rate: toNumber(form.rate),
      }),
    [employees, form.billingPeriodEnd, form.billingPeriodStart, form.projectId, form.rate, weeks],
  );

  const approvedHours = useMemo(
    () => approvedLineItems.reduce((sum, item) => sum + item.billableHours, 0),
    [approvedLineItems],
  );

  const approvedEmployeesCount = useMemo(
    () => new Set(approvedLineItems.map((item) => item.employeeId)).size,
    [approvedLineItems],
  );

  useEffect(() => {
    if (selectedRecordId || form.billingType !== "Hourly") {
      return;
    }

    const nextBillableHours = approvedHours > 0 ? String(Number(approvedHours.toFixed(1))) : "0";
    setForm((current) => (current.billableHours === nextBillableHours ? current : { ...current, billableHours: nextBillableHours }));
  }, [approvedHours, form.billingType, selectedRecordId]);

  const preview = useMemo(
    () =>
      buildClientBillingAmounts({
        billingType: form.billingType,
        billableHours: toNumber(form.billableHours),
        rate: toNumber(form.rate),
        fixedAmount: toNumber(form.fixedAmount),
        milestoneAmount: toNumber(form.milestoneAmount),
        retainerAmount: toNumber(form.retainerAmount),
        taxPercentage: toNumber(form.taxPercentage),
        discountType: form.discountType,
        discountValue: toNumber(form.discountValue),
        adjustmentAmount: toNumber(form.adjustmentAmount),
      }),
    [form.adjustmentAmount, form.billableHours, form.billingType, form.discountType, form.discountValue, form.fixedAmount, form.milestoneAmount, form.rate, form.retainerAmount, form.taxPercentage],
  );

  const previewWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (form.billingType === "Hourly" && approvedLineItems.length === 0) {
      warnings.push("No approved billable timesheet hours were found for the selected project and period.");
    }

    if (selectedProject && (!selectedProject.isBillable || selectedProject.status === "On Hold" || selectedProject.status === "Pending")) {
      warnings.push("Selected project is not currently in a billable active state.");
    }

    if (preview.discountAmount > preview.baseAmount) {
      warnings.push("Discount currently exceeds the calculated base amount.");
    }

    if (form.billingType === "Hourly" && toNumber(form.rate) <= 0) {
      warnings.push("Hourly billing needs a positive rate before invoice generation.");
    }

    return warnings;
  }, [approvedLineItems.length, form.billingType, form.rate, preview.baseAmount, preview.discountAmount, selectedProject]);

  const summary = useMemo(() => {
    const activeRecords = records.filter((record) => record.status !== "Cancelled");
    const pendingRecords = records.filter((record) => record.status === "Draft" || record.status === "ReadyForInvoice");
    const draftInvoices = generatedInvoices.filter((invoice) => invoice.status === "Draft");
    const overdueAmount = generatedInvoices
      .filter((invoice) => invoice.status !== "Cancelled" && invoice.paidAmount < invoice.total && invoice.dueDate < todayInput())
      .reduce((sum, invoice) => sum + Math.max(invoice.total - invoice.paidAmount, 0), 0);

    return {
      totalBillableAmount: activeRecords.reduce((sum, record) => sum + record.finalAmount, 0),
      pendingBillingAmount: pendingRecords.reduce((sum, record) => sum + record.finalAmount, 0),
      draftInvoicesCount: draftInvoices.length,
      draftInvoicesAmount: draftInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
      overdueAmount,
    };
  }, [generatedInvoices, records]);

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return records;
    }

    return records.filter((record) =>
      [
        record.billingNumber,
        record.clientName,
        record.projectName,
        record.billingType,
        record.status,
        record.invoiceNumber ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [records, searchText]);

  const selectedInvoice = useMemo(
    () =>
      generatedInvoices.find(
        (invoice) => invoice.sourceBillingId === selectedRecord?.id || invoice.id === selectedRecord?.invoiceId,
      ) ?? null,
    [generatedInvoices, selectedRecord],
  );

  const isLockedRecord = selectedRecord ? lockedStatuses.includes(selectedRecord.status) : false;

  const buildNextBillingNumber = () => {
    const year = new Date().getFullYear();
    const highest = records.reduce((max, record) => {
      const numeric = Number(record.billingNumber.match(/(\d+)(?!.*\d)/)?.[1] ?? 0);
      return Math.max(max, numeric);
    }, 0);

    return `CB-${year}-${String(highest + 1).padStart(4, "0")}`;
  };

  const buildRecordFromForm = (targetStatus: ClientBillingStatus): ClientBillingRecord => {
    const now = new Date().toISOString();
    const projectName = selectedProject?.name ?? selectedRecord?.projectName ?? "Selected project";
    const projectManagerName = selectedProject?.managerName ?? selectedRecord?.projectManagerName ?? "Unassigned";
    const referenceHours = approvedHours > 0 ? approvedHours : toNumber(form.billableHours);

    return {
      id: selectedRecord?.id ?? crypto.randomUUID(),
      parentBillingId: selectedRecord?.parentBillingId ?? null,
      revisionNo: selectedRecord?.revisionNo ?? 1,
      billingNumber: selectedRecord?.billingNumber ?? "Preview",
      clientName: form.clientName.trim(),
      projectId: form.projectId,
      projectName,
      projectManagerName,
      billingPeriodStart: form.billingPeriodStart,
      billingPeriodEnd: form.billingPeriodEnd,
      billingType: form.billingType,
      currencyCode: form.currencyCode,
      totalBillableHours: form.billingType === "Hourly" ? toNumber(form.billableHours) : referenceHours,
      rate: toNumber(form.rate),
      fixedAmount: toNumber(form.fixedAmount),
      milestoneLabel: form.milestoneLabel.trim(),
      milestoneAmount: toNumber(form.milestoneAmount),
      retainerAmount: toNumber(form.retainerAmount),
      baseAmount: preview.baseAmount,
      taxPercentage: toNumber(form.taxPercentage),
      taxAmount: preview.taxAmount,
      discountType: form.discountType,
      discountValue: toNumber(form.discountValue),
      discountAmount: preview.discountAmount,
      adjustmentAmount: toNumber(form.adjustmentAmount),
      finalAmount: preview.finalAmount,
      status: targetStatus,
      invoiceId: selectedRecord?.invoiceId ?? null,
      invoiceNumber: selectedRecord?.invoiceNumber ?? null,
      dueDate: selectedRecord?.dueDate ?? null,
      notes: form.notes.trim(),
      lineItems: approvedLineItems,
      createdBy: selectedRecord?.createdBy ?? user.fullName,
      createdAt: selectedRecord?.createdAt ?? now,
      updatedBy: user.fullName,
      updatedAt: now,
    };
  };

  const validateForm = () => {
    const issues: string[] = [];

    if (!form.clientName.trim()) {
      issues.push("Client is required.");
    }

    if (!form.projectId) {
      issues.push("Project is required.");
    }

    if (!form.billingPeriodStart || !form.billingPeriodEnd) {
      issues.push("Billing period is required.");
    }

    if (form.billingPeriodStart && form.billingPeriodEnd && form.billingPeriodStart > form.billingPeriodEnd) {
      issues.push("Billing period start must be before the end date.");
    }

    if (toNumber(form.rate) < 0) {
      issues.push("Rate cannot be negative.");
    }

    if (toNumber(form.taxPercentage) < 0) {
      issues.push("Tax percentage cannot be negative.");
    }

    if (toNumber(form.discountValue) < 0) {
      issues.push("Discount cannot be negative.");
    }

    if (preview.discountAmount > preview.baseAmount) {
      issues.push("Discount cannot exceed the base amount.");
    }

    if (form.billingType === "Hourly") {
      if (approvedLineItems.length === 0) {
        issues.push("Hourly billing requires approved timesheet hours.");
      }
      if (toNumber(form.billableHours) <= 0) {
        issues.push("Billable hours must be greater than zero.");
      }
    }

    if (form.billingType === "Fixed Project" && toNumber(form.fixedAmount) <= 0) {
      issues.push("Fixed project billing needs a positive fixed amount.");
    }

    if (form.billingType === "Milestone") {
      if (!form.milestoneLabel.trim()) {
        issues.push("Milestone label is required for milestone billing.");
      }
      if (toNumber(form.milestoneAmount) <= 0) {
        issues.push("Milestone amount must be greater than zero.");
      }
    }

    if (form.billingType === "Retainer" && toNumber(form.retainerAmount) <= 0) {
      issues.push("Retainer billing needs a positive retainer amount.");
    }

    if (selectedProject && (!selectedProject.isBillable || selectedProject.status === "On Hold" || selectedProject.status === "Pending")) {
      issues.push("Only active billable projects can be billed.");
    }

    const selectedLineageId = selectedRecord ? selectedRecord.parentBillingId ?? selectedRecord.id : null;
    const conflictingRecord = records.find((record) => {
      if (record.status === "Cancelled") {
        return false;
      }

      if (record.projectId !== form.projectId) {
        return false;
      }

      if (selectedRecord && record.id === selectedRecord.id) {
        return false;
      }

      const recordLineageId = record.parentBillingId ?? record.id;
      if (selectedLineageId && recordLineageId === selectedLineageId) {
        return false;
      }

      return isDateRangeOverlapping(
        form.billingPeriodStart,
        form.billingPeriodEnd,
        record.billingPeriodStart,
        record.billingPeriodEnd,
      );
    });

    if (conflictingRecord) {
      issues.push(`Billing period overlaps with existing record ${conflictingRecord.billingNumber}.`);
    }

    return issues;
  };

  const resetForm = () => {
    setSelectedRecordId(null);
    setForm(buildDefaultFormState());
  };

  const handleClientChange = (clientName: string) => {
    setForm((current) => {
      const clientProjects = liveProjects.filter((project) => project.clientBusinessUnit.trim() === clientName.trim());
      const hasSelectedProject = clientProjects.some((project) => project.id === current.projectId);
      return {
        ...current,
        clientName,
        projectId: hasSelectedProject ? current.projectId : "",
      };
    });
  };

  const handleProjectChange = (projectId: string) => {
    const nextProject = projects.find((project) => project.id === projectId) ?? null;
    if (!nextProject) {
      setForm((current) => ({ ...current, projectId }));
      return;
    }

    const suggestedType = deriveSuggestedBillingType(nextProject);
    const suggestedRate = deriveSuggestedRate(nextProject);
    setForm((current) => ({
      ...current,
      clientName: nextProject.clientBusinessUnit.trim(),
      projectId,
      billingType: suggestedType,
      rate: String(suggestedRate),
      fixedAmount: suggestedType === "Fixed Project" ? String(Math.max(Math.round(nextProject.budget), 0)) : current.fixedAmount,
      milestoneLabel: suggestedType === "Milestone" ? "Delivery Milestone" : current.milestoneLabel,
      milestoneAmount: suggestedType === "Milestone" ? String(Math.max(Math.round(nextProject.budget * 0.35), 0)) : current.milestoneAmount,
      retainerAmount: suggestedType === "Retainer" ? String(Math.max(Math.round(suggestedRate * 160), 0)) : current.retainerAmount,
      currencyCode: "INR",
    }));
  };

  const persistRecord = async (targetStatus: "Draft" | "ReadyForInvoice") => {
    const issues = validateForm();
    if (issues.length > 0) {
      showToast(issues[0], "error");
      return null;
    }

    const now = new Date().toISOString();
    const baseRecord = buildRecordFromForm(targetStatus);
    let nextRecord = baseRecord;
    let createdRevision = false;

    if (selectedRecord && lockedStatuses.includes(selectedRecord.status)) {
      const currentSignature = buildClientBillingRecordSignature(selectedRecord);
      const nextSignature = buildClientBillingRecordSignature(baseRecord);

      if (currentSignature === nextSignature) {
        showToast("Make a change before creating a billing revision.", "info");
        return selectedRecord;
      }

      const lineageId = selectedRecord.parentBillingId ?? selectedRecord.id;
      const lineageRecords = records.filter((record) => record.id === lineageId || record.parentBillingId === lineageId);
      const nextRevisionNo = Math.max(...lineageRecords.map((record) => record.revisionNo), 1) + 1;
      const baseBillingNumber = selectedRecord.billingNumber.split("-R")[0];

      nextRecord = {
        ...baseRecord,
        id: crypto.randomUUID(),
        parentBillingId: lineageId,
        revisionNo: nextRevisionNo,
        billingNumber: `${baseBillingNumber}-R${nextRevisionNo}`,
        status: targetStatus,
        invoiceId: null,
        invoiceNumber: null,
        dueDate: null,
        createdBy: user.fullName,
        createdAt: now,
        updatedBy: user.fullName,
        updatedAt: now,
      };
      createdRevision = true;
    } else if (selectedRecord) {
      nextRecord = {
        ...baseRecord,
        id: selectedRecord.id,
        parentBillingId: selectedRecord.parentBillingId ?? null,
        revisionNo: selectedRecord.revisionNo,
        billingNumber: selectedRecord.billingNumber,
        createdBy: selectedRecord.createdBy,
        createdAt: selectedRecord.createdAt,
        invoiceId: selectedRecord.invoiceId ?? null,
        invoiceNumber: selectedRecord.invoiceNumber ?? null,
        dueDate: selectedRecord.dueDate ?? null,
        updatedBy: user.fullName,
        updatedAt: now,
      };
    } else {
      nextRecord = {
        ...baseRecord,
        id: crypto.randomUUID(),
        parentBillingId: null,
        revisionNo: 1,
        billingNumber: buildNextBillingNumber(),
        createdBy: user.fullName,
        createdAt: now,
        updatedBy: user.fullName,
        updatedAt: now,
      };
    }

    const nextRecords = await clientBillingService.saveBillingRecord(nextRecord);
    setRecords(nextRecords);
    setSelectedRecordId(nextRecord.id);
    showToast(
      createdRevision
        ? `Revision ${nextRecord.billingNumber} created for invoice-safe editing.`
        : targetStatus === "Draft"
          ? "Billing draft saved."
          : "Billing record marked ready for invoice.",
      "success",
    );

    return nextRecord;
  };

  const handleGenerateInvoice = async () => {
    const candidateReadyRecord = buildRecordFromForm("ReadyForInvoice");
    const hasSelectedChanges =
      selectedRecord && buildClientBillingRecordSignature(selectedRecord) !== buildClientBillingRecordSignature(candidateReadyRecord);

    if (selectedRecord?.invoiceId && !hasSelectedChanges) {
      navigate(workspaceRoutes["invoice-management"].path);
      return;
    }

    setSaving(true);
    try {
      const persisted = await persistRecord("ReadyForInvoice");
      if (!persisted) {
        return;
      }

      if (persisted.status === "Cancelled") {
        showToast("Cancelled billing records cannot generate invoices.", "error");
        return;
      }

      const result = await clientBillingService.generateInvoiceForBilling(persisted.id);
      setRecords(result.records);
      await refreshFinanceData();
      setSelectedRecordId(persisted.id);
      showToast(`Invoice draft ${result.invoice.invoiceNo} created and moved to Invoice Management.`, "success");
    } catch {
      showToast("Unable to generate invoice right now.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelRecord = async (record: ClientBillingRecord) => {
    if (record.status === "Invoiced" || record.status === "Paid" || record.status === "Cancelled") {
      showToast("Invoiced, paid, or cancelled records are locked for direct cancellation.", "info");
      return;
    }

    setSaving(true);
    try {
      const nextRecords = await clientBillingService.cancelBillingRecord(record.id);
      setRecords(nextRecords);
      await refreshFinanceData();
      if (selectedRecordId === record.id) {
        setSelectedRecordId(record.id);
      }
      showToast(`${record.billingNumber} moved to cancelled.`, "success");
    } catch {
      showToast("Unable to cancel this billing record right now.", "error");
    } finally {
      setSaving(false);
    }
  };

  const openRecord = (recordId: string) => {
    setSelectedRecordId(recordId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return <LoadingSpinner label="Loading client billing..." />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <section className="space-y-6">
        <WorkspacePageHero
          title="Client Billing"
          belowTitle={
            <div className="max-w-3xl space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <p>
                Calculate billable client amount from approved timesheets, project billing models, tax, discount, and
                finance adjustments before invoice generation.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Approved Timesheets Only", "Billing Preview", "Invoice Management Handoff", "Duplicate Billing Guard"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          }
        >
          <WorkspaceHeroMeta primary={user.role} secondary={`${records.length} billing records tracked`} />
          <WorkspaceHeroMeta
            primary={`${generatedInvoices.length} invoices generated`}
            secondary={`${records.filter((record) => record.status === "ReadyForInvoice").length} ready for invoice`}
          />
          <button type="button" onClick={resetForm} className={secondaryButtonClass}>
            <Icon name="plus" className="h-4 w-4" />
            Create Billing
          </button>
          <Link to={workspaceRoutes["invoice-management"].path} className={primaryButtonClass}>
            <Icon name="file-spreadsheet" className="h-4 w-4" />
            Invoice Management
          </Link>
        </WorkspacePageHero>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Billable Amount"
            value={formatCompactCurrency(summary.totalBillableAmount)}
            note={formatCurrency(summary.totalBillableAmount)}
          />
          <SummaryCard
            label="Pending Billing"
            value={formatCompactCurrency(summary.pendingBillingAmount)}
            note={`${records.filter((record) => record.status === "Draft" || record.status === "ReadyForInvoice").length} open records`}
          />
          <SummaryCard
            label="Draft Invoices"
            value={`${summary.draftInvoicesCount}`}
            note={formatCurrency(summary.draftInvoicesAmount)}
          />
          <SummaryCard
            label="Overdue Payments"
            value={formatCompactCurrency(summary.overdueAmount)}
            note={summary.overdueAmount > 0 ? "Outstanding on overdue invoices" : "No overdue exposure"}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-6">
            <section className={`${panelClass} p-6`}>
              <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {selectedRecord ? "Edit Client Billing" : "Billing Setup Form"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Select client, project, billing period, and the charging model used to calculate the final billing amount.
                  </p>
                </div>
                {selectedRecord ? (
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(selectedRecord.status)}`}>
                    {selectedRecord.billingNumber} · {selectedRecord.status}
                  </span>
                ) : null}
              </div>

              {selectedRecord && lockedStatuses.includes(selectedRecord.status) ? (
                <div className="mt-5 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                  {selectedRecord.status === "Cancelled"
                    ? "This billing record is kept for audit only. Saving changes will create a fresh revision instead of rewriting history."
                    : "This billing record already affects invoice history. Saving changes will create a new revision and keep the original record unchanged."}
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Client Name</span>
                  <select value={form.clientName} onChange={(event) => handleClientChange(event.target.value)} className={selectClass}>
                    <option value="">Select client</option>
                    {clientOptions.map((client) => (
                      <option key={client} value={client}>
                        {client}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Project Name</span>
                  <select value={form.projectId} onChange={(event) => handleProjectChange(event.target.value)} className={selectClass}>
                    <option value="">Select project</option>
                    {projectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Billing Type</span>
                  <select
                    value={form.billingType}
                    onChange={(event) => setForm((current) => ({ ...current, billingType: event.target.value as ClientBillingType }))}
                    className={selectClass}
                  >
                    {billingTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Billing Period Start</span>
                  <input
                    type="date"
                    value={form.billingPeriodStart}
                    onChange={(event) => setForm((current) => ({ ...current, billingPeriodStart: event.target.value }))}
                    className={inputClass}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Billing Period End</span>
                  <input
                    type="date"
                    value={form.billingPeriodEnd}
                    onChange={(event) => setForm((current) => ({ ...current, billingPeriodEnd: event.target.value }))}
                    className={inputClass}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Currency</span>
                  <select
                    value={form.currencyCode}
                    onChange={(event) => setForm((current) => ({ ...current, currencyCode: event.target.value }))}
                    className={selectClass}
                  >
                    {currencyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Billing Status</span>
                  <input value={selectedRecord?.status ?? form.status} readOnly className={`${inputClass} cursor-not-allowed opacity-80`} />
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {form.billingType === "Hourly" ? "Hourly Rate" : "Rate / Reference Rate"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={form.rate}
                    onChange={(event) => setForm((current) => ({ ...current, rate: event.target.value }))}
                    className={inputClass}
                  />
                </label>

                {form.billingType === "Hourly" ? (
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Billable Hours</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={form.billableHours}
                        onChange={(event) => setForm((current) => ({ ...current, billableHours: event.target.value }))}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, billableHours: String(Number(approvedHours.toFixed(1))) }))}
                        className="shrink-0 rounded-2xl border border-zinc-200 px-3 py-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      >
                        Use Approved
                      </button>
                    </div>
                  </label>
                ) : null}

                {form.billingType === "Fixed Project" ? (
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Fixed Amount</span>
                    <input
                      type="number"
                      min="0"
                      value={form.fixedAmount}
                      onChange={(event) => setForm((current) => ({ ...current, fixedAmount: event.target.value }))}
                      className={inputClass}
                    />
                  </label>
                ) : null}

                {form.billingType === "Milestone" ? (
                  <>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Milestone</span>
                      <input
                        value={form.milestoneLabel}
                        onChange={(event) => setForm((current) => ({ ...current, milestoneLabel: event.target.value }))}
                        placeholder="Backend Complete"
                        className={inputClass}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Milestone Amount</span>
                      <input
                        type="number"
                        min="0"
                        value={form.milestoneAmount}
                        onChange={(event) => setForm((current) => ({ ...current, milestoneAmount: event.target.value }))}
                        className={inputClass}
                      />
                    </label>
                  </>
                ) : null}

                {form.billingType === "Retainer" ? (
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Retainer Amount</span>
                    <input
                      type="number"
                      min="0"
                      value={form.retainerAmount}
                      onChange={(event) => setForm((current) => ({ ...current, retainerAmount: event.target.value }))}
                      className={inputClass}
                    />
                  </label>
                ) : null}

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Tax %</span>
                  <input
                    type="number"
                    min="0"
                    value={form.taxPercentage}
                    onChange={(event) => setForm((current) => ({ ...current, taxPercentage: event.target.value }))}
                    className={inputClass}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Discount Type</span>
                  <select
                    value={form.discountType}
                    onChange={(event) => setForm((current) => ({ ...current, discountType: event.target.value as ClientBillingDiscountType }))}
                    className={selectClass}
                  >
                    {discountTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Discount Value</span>
                  <input
                    type="number"
                    min="0"
                    value={form.discountValue}
                    onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))}
                    className={inputClass}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Adjustment Amount</span>
                  <input
                    type="number"
                    value={form.adjustmentAmount}
                    onChange={(event) => setForm((current) => ({ ...current, adjustmentAmount: event.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="mt-6 block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Billing Notes</span>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Add billing comments, invoice context, or internal finance notes."
                  className={`${inputClass} min-h-[120px] resize-y`}
                />
              </label>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSaving(true);
                    void persistRecord("Draft").finally(() => setSaving(false));
                  }}
                  className={secondaryButtonClass}
                  disabled={saving}
                >
                  <Icon name="edit" className="h-4 w-4" />
                  {isLockedRecord ? "Create Draft Revision" : "Save Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaving(true);
                    void persistRecord("ReadyForInvoice").finally(() => setSaving(false));
                  }}
                  className={secondaryButtonClass}
                  disabled={saving}
                >
                  <Icon name="send" className="h-4 w-4" />
                  {isLockedRecord ? "Create Ready Revision" : "Mark Ready"}
                </button>
                <button type="button" onClick={() => void handleGenerateInvoice()} className={primaryButtonClass} disabled={saving}>
                  <Icon name="file-spreadsheet" className="h-4 w-4" />
                  {selectedRecord?.invoiceId ? "Open Invoice Management" : "Generate Invoice"}
                </button>
                <button type="button" onClick={resetForm} className={secondaryButtonClass} disabled={saving}>
                  <Icon name="close" className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </section>

            <section className={panelClass}>
              <div className="flex flex-col gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Approved Billable Work</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Only approved timesheet rows within the selected billing window are used for client billing.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <span className="rounded-full bg-zinc-100 px-3 py-1 font-semibold dark:bg-zinc-900">
                    {formatHours(approvedHours)} approved
                  </span>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 font-semibold dark:bg-zinc-900">
                    {approvedEmployeesCount} employees
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                  <thead className="bg-zinc-50/90 dark:bg-black/70">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Task</th>
                      <th className="px-6 py-4">Work Date</th>
                      <th className="px-6 py-4">Hours</th>
                      <th className="px-6 py-4">Rate</th>
                      <th className="px-6 py-4">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {approvedLineItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-14 text-center text-sm text-zinc-500 dark:text-zinc-400">
                          No approved billable work found for the selected project and billing period.
                        </td>
                      </tr>
                    ) : (
                      approvedLineItems.map((item) => (
                        <tr key={item.id} className="transition hover:bg-zinc-50/70 dark:hover:bg-black/40">
                          <td className="px-6 py-4 align-top">
                            <p className="font-medium text-zinc-900 dark:text-white">{item.employeeName}</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.description}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{item.taskName}</td>
                          <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatDateLabel(item.workDate)}</td>
                          <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatHours(item.billableHours)}</td>
                          <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{formatCurrency(item.rate, form.currencyCode)}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(item.amount, form.currencyCode)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className={`${panelClass} p-6`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">Billing Preview</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Review the amount calculation before saving or sending the record to Invoice Management.
                  </p>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(selectedRecord?.status ?? form.status)}`}>
                  {selectedRecord?.status ?? form.status}
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Approved Hours</p>
                  <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{formatHours(approvedHours)}</p>
                </div>
                <div className="rounded-[1.5rem] border border-emerald-200/80 bg-emerald-50/80 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <p className="text-sm text-emerald-700 dark:text-emerald-200">Final Billing Amount</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(preview.finalAmount, form.currencyCode)}</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  { label: "Base Amount", value: formatCurrency(preview.baseAmount, form.currencyCode) },
                  { label: "Tax Amount", value: formatCurrency(preview.taxAmount, form.currencyCode) },
                  { label: "Discount", value: formatCurrency(preview.discountAmount, form.currencyCode) },
                  { label: "Adjustment", value: formatCurrency(toNumber(form.adjustmentAmount), form.currencyCode) },
                  {
                    label: form.billingType === "Hourly" ? "Billable Hours Used" : "Reference Billable Hours",
                    value: formatHours(form.billingType === "Hourly" ? toNumber(form.billableHours) : approvedHours),
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-black/40">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{item.label}</span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>

              {previewWarnings.length > 0 ? (
                <div className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">Validation Warnings</p>
                  <div className="mt-3 space-y-2 text-sm text-amber-800 dark:text-amber-100">
                    {previewWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className={`${panelClass} p-6`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {selectedRecord ? "Selected Billing Record" : "Workflow Controls"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {selectedRecord
                      ? "Track billing status, revision history, and invoice linkage for the selected record."
                      : "Save as draft, mark ready, then generate invoice once finance has reviewed the billing preview."}
                  </p>
                </div>
                {selectedRecord ? (
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                    Rev {selectedRecord.revisionNo}
                  </span>
                ) : null}
              </div>

              {selectedRecord ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{selectedRecord.billingNumber}</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {selectedRecord.clientName} · {selectedRecord.projectName}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Billing Period</p>
                        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                          {formatBillingPeriod(selectedRecord.billingPeriodStart, selectedRecord.billingPeriodEnd)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Project Manager</p>
                        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{selectedRecord.projectManagerName}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Last Updated</p>
                        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{formatDateLabel(selectedRecord.updatedAt.slice(0, 10))}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Final Amount</p>
                        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{formatCurrency(selectedRecord.finalAmount, selectedRecord.currencyCode)}</p>
                      </div>
                    </div>
                  </div>

                  {selectedInvoice ? (
                    <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{selectedInvoice.invoiceNo}</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            Due {formatDateLabel(selectedInvoice.dueDate)} · Paid {formatCurrency(selectedInvoice.paidAmount, selectedInvoice.currencyCode)}
                          </p>
                        </div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getInvoiceStatusClass(selectedInvoice.status)}`}>
                          {selectedInvoice.status}
                        </span>
                      </div>
                      <div className="mt-4">
                        <Link to={workspaceRoutes["invoice-management"].path} className="text-sm font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                          Open Invoice Management
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
                      No invoice draft is linked yet. Generate invoice once the billing record is ready for finance sign-off.
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 space-y-3 rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                  <p>Hourly billing pulls only approved timesheet rows for the selected project and period.</p>
                  <p>Billing periods cannot overlap with another active billing record for the same project.</p>
                  <p>Already invoiced records stay immutable and create revisions instead of changing historical values.</p>
                </div>
              )}
            </section>
          </div>
        </section>

        <section className={panelClass}>
          <div className="flex flex-col gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">Billing Records</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Review draft, ready, invoiced, paid, and cancelled records with invoice-safe edit actions.
              </p>
            </div>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search billing number, client, project, type, status, or invoice"
              className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50/90 dark:bg-black/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  <th className="px-6 py-4">Billing No</th>
                  <th className="px-6 py-4">Client / Project</th>
                  <th className="px-6 py-4">Billing Period</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Invoice</th>
                  <th className="px-6 py-4">Updated</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No client billing records match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className={
                        selectedRecordId === record.id
                          ? "bg-brand-50/60 dark:bg-brand-500/10"
                          : "transition hover:bg-zinc-50/70 dark:hover:bg-black/40"
                      }
                    >
                      <td className="px-6 py-4 align-top">
                        <p className="font-semibold text-zinc-900 dark:text-white">{record.billingNumber}</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Rev {record.revisionNo}</p>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <p className="font-medium text-zinc-900 dark:text-white">{record.clientName}</p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{record.projectName}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">
                        {formatBillingPeriod(record.billingPeriodStart, record.billingPeriodEnd)}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{record.billingType}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-zinc-900 dark:text-white">
                        {formatCurrency(record.finalAmount, record.currencyCode)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-200">{record.invoiceNumber ?? "Not generated"}</td>
                      <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">{formatDateLabel(record.updatedAt.slice(0, 10))}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openRecord(record.id)} className={secondaryButtonClass}>
                            <Icon name="eye" className="h-4 w-4" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (record.invoiceId) {
                                navigate(workspaceRoutes["invoice-management"].path);
                                return;
                              }

                              openRecord(record.id);
                            }}
                            className={secondaryButtonClass}
                          >
                            <Icon name="file-spreadsheet" className="h-4 w-4" />
                            {record.invoiceId ? "Open Invoice" : "Generate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCancelRecord(record)}
                            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
                            disabled={saving || record.status === "Invoiced" || record.status === "Paid" || record.status === "Cancelled"}
                          >
                            <Icon name="trash" className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </>
  );
};
