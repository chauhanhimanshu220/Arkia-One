import type {
  ClientBillingLineItem,
  ClientBillingRecord,
  GeneratedClientBillingInvoice,
} from "../types/clientBilling";
import { addDays } from "../utils/clientBilling";

const CLIENT_BILLING_RECORDS_STORAGE_KEY = "finance-client-billing-records";
const CLIENT_BILLING_RECORDS_VERSION_KEY = `${CLIENT_BILLING_RECORDS_STORAGE_KEY}:version`;
const CLIENT_BILLING_INVOICES_STORAGE_KEY = "finance-client-billing-generated-invoices";
const CLIENT_BILLING_INVOICES_VERSION_KEY = `${CLIENT_BILLING_INVOICES_STORAGE_KEY}:version`;
const CLIENT_BILLING_STORAGE_VERSION = "1";

const createLineItem = (input: Omit<ClientBillingLineItem, "id"> & { id?: string }): ClientBillingLineItem => ({
  id: input.id ?? crypto.randomUUID(),
  employeeId: input.employeeId,
  employeeName: input.employeeName,
  taskName: input.taskName,
  description: input.description,
  workDate: input.workDate,
  billableHours: input.billableHours,
  rate: input.rate,
  amount: input.amount,
  isBillable: input.isBillable,
});

const seedBillingRecords: ClientBillingRecord[] = [
  {
    id: "client-billing-abc-draft",
    parentBillingId: null,
    revisionNo: 1,
    billingNumber: "CB-2026-0001",
    clientName: "ABC Pvt Ltd",
    projectId: "project-crm-development",
    projectName: "CRM Development",
    projectManagerName: "Ritika Bansal",
    billingPeriodStart: "2026-04-01",
    billingPeriodEnd: "2026-04-30",
    billingType: "Hourly",
    currencyCode: "INR",
    totalBillableHours: 120,
    rate: 1000,
    fixedAmount: 0,
    milestoneLabel: "",
    milestoneAmount: 0,
    retainerAmount: 0,
    baseAmount: 120000,
    taxPercentage: 18,
    taxAmount: 21600,
    discountType: "Fixed",
    discountValue: 5000,
    discountAmount: 5000,
    adjustmentAmount: 0,
    finalAmount: 136600,
    status: "Draft",
    invoiceId: null,
    invoiceNumber: null,
    dueDate: null,
    notes: "Draft hourly billing record waiting for final finance review.",
    lineItems: [
      createLineItem({ employeeId: "emp-rahul", employeeName: "Rahul Verma", taskName: "API Development", description: "Lead module delivery", workDate: "2026-04-10", billableHours: 9, rate: 1000, amount: 9000, isBillable: true }),
      createLineItem({ employeeId: "emp-neha", employeeName: "Neha Sharma", taskName: "UI Integration", description: "Completed billing dashboard UI", workDate: "2026-04-12", billableHours: 8, rate: 1000, amount: 8000, isBillable: true }),
      createLineItem({ employeeId: "emp-rahul", employeeName: "Rahul Verma", taskName: "Sprint QA Support", description: "Release validation and fixes", workDate: "2026-04-24", billableHours: 7, rate: 1000, amount: 7000, isBillable: true }),
    ],
    createdBy: "Finance Admin",
    createdAt: "2026-04-30T10:30:00.000Z",
    updatedBy: "Finance Admin",
    updatedAt: "2026-04-30T10:30:00.000Z",
  },
  {
    id: "client-billing-beebro-ready",
    parentBillingId: null,
    revisionNo: 1,
    billingNumber: "CB-2026-0002",
    clientName: "BeeBro Honey",
    projectId: "project-wms-development",
    projectName: "WMS Development",
    projectManagerName: "Ananya Sen",
    billingPeriodStart: "2026-04-01",
    billingPeriodEnd: "2026-04-30",
    billingType: "Hourly",
    currencyCode: "INR",
    totalBillableHours: 160,
    rate: 900,
    fixedAmount: 0,
    milestoneLabel: "",
    milestoneAmount: 0,
    retainerAmount: 0,
    baseAmount: 144000,
    taxPercentage: 18,
    taxAmount: 25920,
    discountType: "None",
    discountValue: 0,
    discountAmount: 0,
    adjustmentAmount: 0,
    finalAmount: 169920,
    status: "ReadyForInvoice",
    invoiceId: null,
    invoiceNumber: null,
    dueDate: null,
    notes: "Approved timesheet-backed billing ready for invoice generation.",
    lineItems: [
      createLineItem({ employeeId: "emp-rohan", employeeName: "Rohan Gupta", taskName: "Warehouse Workflow", description: "Inbound workflow automation", workDate: "2026-04-08", billableHours: 9, rate: 900, amount: 8100, isBillable: true }),
      createLineItem({ employeeId: "emp-meera", employeeName: "Meera Jain", taskName: "Mobile Scanner API", description: "Built client-facing endpoints", workDate: "2026-04-15", billableHours: 8, rate: 900, amount: 7200, isBillable: true }),
      createLineItem({ employeeId: "emp-rohan", employeeName: "Rohan Gupta", taskName: "Reporting Sync", description: "Inventory analytics wiring", workDate: "2026-04-25", billableHours: 7, rate: 900, amount: 6300, isBillable: true }),
    ],
    createdBy: "Finance Admin",
    createdAt: "2026-04-29T16:05:00.000Z",
    updatedBy: "Finance Admin",
    updatedAt: "2026-04-29T16:05:00.000Z",
  },
  {
    id: "client-billing-northwind-invoiced",
    parentBillingId: null,
    revisionNo: 1,
    billingNumber: "CB-2026-0003",
    clientName: "Northwind Mobility",
    projectId: "project-fleet-pulse",
    projectName: "Fleet Pulse",
    projectManagerName: "Ritika Bansal",
    billingPeriodStart: "2026-04-01",
    billingPeriodEnd: "2026-04-30",
    billingType: "Milestone",
    currencyCode: "INR",
    totalBillableHours: 0,
    rate: 0,
    fixedAmount: 0,
    milestoneLabel: "Backend Complete",
    milestoneAmount: 80000,
    retainerAmount: 0,
    baseAmount: 80000,
    taxPercentage: 18,
    taxAmount: 14400,
    discountType: "None",
    discountValue: 0,
    discountAmount: 0,
    adjustmentAmount: 0,
    finalAmount: 94400,
    status: "Invoiced",
    invoiceId: "cb-invoice-001",
    invoiceNumber: "INV-CB-2026-0001",
    dueDate: "2026-05-15",
    notes: "Milestone invoice generated after backend delivery sign-off.",
    lineItems: [
      createLineItem({ employeeId: "emp-sakshi", employeeName: "Sakshi Nair", taskName: "Backend Complete", description: "Milestone acceptance package", workDate: "2026-04-28", billableHours: 0, rate: 0, amount: 80000, isBillable: true }),
    ],
    createdBy: "Finance Admin",
    createdAt: "2026-04-28T14:45:00.000Z",
    updatedBy: "Finance Admin",
    updatedAt: "2026-05-01T09:10:00.000Z",
  },
  {
    id: "client-billing-aster-paid",
    parentBillingId: null,
    revisionNo: 1,
    billingNumber: "CB-2026-0004",
    clientName: "Aster Retail",
    projectId: "project-storeflow-support",
    projectName: "StoreFlow Support",
    projectManagerName: "Priya Malhotra",
    billingPeriodStart: "2026-03-01",
    billingPeriodEnd: "2026-03-31",
    billingType: "Retainer",
    currencyCode: "INR",
    totalBillableHours: 0,
    rate: 0,
    fixedAmount: 0,
    milestoneLabel: "",
    milestoneAmount: 0,
    retainerAmount: 75000,
    baseAmount: 75000,
    taxPercentage: 18,
    taxAmount: 13500,
    discountType: "Fixed",
    discountValue: 5000,
    discountAmount: 5000,
    adjustmentAmount: 0,
    finalAmount: 83500,
    status: "Paid",
    invoiceId: "cb-invoice-002",
    invoiceNumber: "INV-CB-2026-0002",
    dueDate: "2026-04-15",
    notes: "Monthly support retainer closed and payment received.",
    lineItems: [
      createLineItem({ employeeId: "emp-priya", employeeName: "Priya Malhotra", taskName: "Retainer", description: "March support retainer coverage", workDate: "2026-03-31", billableHours: 0, rate: 0, amount: 75000, isBillable: true }),
    ],
    createdBy: "Finance Admin",
    createdAt: "2026-03-31T18:15:00.000Z",
    updatedBy: "Finance Admin",
    updatedAt: "2026-04-17T11:30:00.000Z",
  },
];

const seedGeneratedInvoices: GeneratedClientBillingInvoice[] = [
  {
    id: "cb-invoice-001",
    sourceBillingId: "client-billing-northwind-invoiced",
    sourceBillingNumber: "CB-2026-0003",
    invoiceNo: "INV-CB-2026-0001",
    client: "Northwind Mobility",
    project: "Fleet Pulse",
    manager: "Ritika Bansal",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    approvedHours: 0,
    billableHours: 0,
    rate: 0,
    subtotal: 80000,
    tax: 14400,
    discount: 0,
    total: 94400,
    paidAmount: 0,
    dueDate: "2026-05-15",
    currencyCode: "INR",
    status: "Sent",
    billingType: "Milestone",
    lastPaymentDate: null,
    paymentMode: null,
    createdAt: "2026-05-01T09:10:00.000Z",
    updatedAt: "2026-05-01T09:10:00.000Z",
  },
  {
    id: "cb-invoice-002",
    sourceBillingId: "client-billing-aster-paid",
    sourceBillingNumber: "CB-2026-0004",
    invoiceNo: "INV-CB-2026-0002",
    client: "Aster Retail",
    project: "StoreFlow Support",
    manager: "Priya Malhotra",
    periodStart: "2026-03-01",
    periodEnd: "2026-03-31",
    approvedHours: 0,
    billableHours: 0,
    rate: 0,
    subtotal: 75000,
    tax: 13500,
    discount: 5000,
    total: 83500,
    paidAmount: 83500,
    dueDate: "2026-04-15",
    currencyCode: "INR",
    status: "Sent",
    billingType: "Retainer",
    lastPaymentDate: "2026-04-14",
    paymentMode: "Bank Transfer",
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-14T16:45:00.000Z",
  },
];

const getRecordStatusWeight = (status: ClientBillingRecord["status"]) => {
  switch (status) {
    case "ReadyForInvoice":
      return 0;
    case "Draft":
      return 1;
    case "Invoiced":
      return 2;
    case "Paid":
      return 3;
    case "Cancelled":
    default:
      return 4;
  }
};

const sortBillingRecords = (records: ClientBillingRecord[]) =>
  [...records].sort((left, right) => {
    const weightDifference = getRecordStatusWeight(left.status) - getRecordStatusWeight(right.status);
    if (weightDifference !== 0) {
      return weightDifference;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

const sortGeneratedInvoices = (invoices: GeneratedClientBillingInvoice[]) =>
  [...invoices].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

const setStoredBillingRecords = (records: ClientBillingRecord[]) => {
  window.localStorage.setItem(CLIENT_BILLING_RECORDS_VERSION_KEY, CLIENT_BILLING_STORAGE_VERSION);
  window.localStorage.setItem(CLIENT_BILLING_RECORDS_STORAGE_KEY, JSON.stringify(sortBillingRecords(records)));
};

const setStoredGeneratedInvoices = (invoices: GeneratedClientBillingInvoice[]) => {
  window.localStorage.setItem(CLIENT_BILLING_INVOICES_VERSION_KEY, CLIENT_BILLING_STORAGE_VERSION);
  window.localStorage.setItem(CLIENT_BILLING_INVOICES_STORAGE_KEY, JSON.stringify(sortGeneratedInvoices(invoices)));
};

const initializeStorage = () => {
  setStoredBillingRecords(seedBillingRecords);
  setStoredGeneratedInvoices(seedGeneratedInvoices);
};

const getStoredBillingRecords = (): ClientBillingRecord[] => {
  const version = window.localStorage.getItem(CLIENT_BILLING_RECORDS_VERSION_KEY);
  const raw = window.localStorage.getItem(CLIENT_BILLING_RECORDS_STORAGE_KEY);

  if (version !== CLIENT_BILLING_STORAGE_VERSION || !raw) {
    initializeStorage();
    return sortBillingRecords(seedBillingRecords);
  }

  try {
    const parsed = JSON.parse(raw) as ClientBillingRecord[];
    return Array.isArray(parsed) ? sortBillingRecords(parsed) : sortBillingRecords(seedBillingRecords);
  } catch {
    initializeStorage();
    return sortBillingRecords(seedBillingRecords);
  }
};

const getStoredGeneratedInvoices = (): GeneratedClientBillingInvoice[] => {
  const version = window.localStorage.getItem(CLIENT_BILLING_INVOICES_VERSION_KEY);
  const raw = window.localStorage.getItem(CLIENT_BILLING_INVOICES_STORAGE_KEY);

  if (version !== CLIENT_BILLING_STORAGE_VERSION || !raw) {
    initializeStorage();
    return sortGeneratedInvoices(seedGeneratedInvoices);
  }

  try {
    const parsed = JSON.parse(raw) as GeneratedClientBillingInvoice[];
    return Array.isArray(parsed) ? sortGeneratedInvoices(parsed) : sortGeneratedInvoices(seedGeneratedInvoices);
  } catch {
    initializeStorage();
    return sortGeneratedInvoices(seedGeneratedInvoices);
  }
};

const buildNextInvoiceNumber = (invoices: GeneratedClientBillingInvoice[]) => {
  const year = new Date().getFullYear();
  const highest = invoices.reduce((max, invoice) => {
    const numeric = Number(invoice.invoiceNo.match(/(\d+)$/)?.[1] ?? 0);
    return Math.max(max, numeric);
  }, 0);

  return `DRAFT-CB-${year}-${String(highest + 1).padStart(4, "0")}`;
};

const syncBillingStatusFromInvoice = (
  billingRecord: ClientBillingRecord,
  invoice: GeneratedClientBillingInvoice,
): ClientBillingRecord => ({
  ...billingRecord,
  status: invoice.status === "Cancelled" ? "Cancelled" : invoice.paidAmount >= invoice.total ? "Paid" : "Invoiced",
  invoiceId: invoice.id,
  invoiceNumber: invoice.invoiceNo,
  dueDate: invoice.dueDate,
  updatedAt: invoice.updatedAt,
  updatedBy: "Finance Admin",
});

export const clientBillingService = {
  async getBillingRecords() {
    return getStoredBillingRecords();
  },

  async getGeneratedInvoices() {
    return getStoredGeneratedInvoices();
  },

  async saveBillingRecord(record: ClientBillingRecord) {
    const current = getStoredBillingRecords();
    const next = current.some((item) => item.id === record.id)
      ? current.map((item) => (item.id === record.id ? record : item))
      : [record, ...current];
    setStoredBillingRecords(next);
    return sortBillingRecords(next);
  },

  async cancelBillingRecord(id: string) {
    const current = getStoredBillingRecords();
    const now = new Date().toISOString();
    const next = current.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "Cancelled" as const,
            updatedAt: now,
            updatedBy: "Finance Admin",
          }
        : item,
    );
    setStoredBillingRecords(next);

    const invoices = getStoredGeneratedInvoices();
    const nextInvoices = invoices.map((invoice) =>
      invoice.sourceBillingId === id
        ? {
            ...invoice,
            status: "Cancelled" as const,
            updatedAt: now,
          }
        : invoice,
    );
    setStoredGeneratedInvoices(nextInvoices);

    return sortBillingRecords(next);
  },

  async generateInvoiceForBilling(id: string) {
    const billingRecords = getStoredBillingRecords();
    const existingRecord = billingRecords.find((record) => record.id === id);
    if (!existingRecord) {
      throw new Error("Billing record not found.");
    }

    const currentInvoices = getStoredGeneratedInvoices();
    const existingInvoice = currentInvoices.find((invoice) => invoice.sourceBillingId === id);
    if (existingInvoice) {
      return {
        records: billingRecords,
        invoice: existingInvoice,
      };
    }

    const now = new Date().toISOString();
    const invoiceId = crypto.randomUUID();
    const invoiceNo = buildNextInvoiceNumber(currentInvoices);
    const dueDate = existingRecord.dueDate ?? addDays(existingRecord.billingPeriodEnd, 15);

    const invoice: GeneratedClientBillingInvoice = {
      id: invoiceId,
      sourceBillingId: existingRecord.id,
      sourceBillingNumber: existingRecord.billingNumber,
      invoiceNo,
      client: existingRecord.clientName,
      project: existingRecord.projectName,
      manager: existingRecord.projectManagerName,
      periodStart: existingRecord.billingPeriodStart,
      periodEnd: existingRecord.billingPeriodEnd,
      approvedHours: existingRecord.lineItems.reduce((sum, item) => sum + item.billableHours, 0),
      billableHours: existingRecord.totalBillableHours,
      rate: existingRecord.rate,
      subtotal: existingRecord.baseAmount,
      tax: existingRecord.taxAmount,
      discount: existingRecord.discountAmount,
      total: existingRecord.finalAmount,
      paidAmount: 0,
      dueDate,
      currencyCode: existingRecord.currencyCode,
      status: "Draft",
      billingType: existingRecord.billingType,
      lastPaymentDate: null,
      paymentMode: null,
      createdAt: now,
      updatedAt: now,
    };

    const nextInvoices = [invoice, ...currentInvoices];
    const nextRecords = billingRecords.map((record) =>
      record.id === id
        ? {
            ...record,
            status: "Invoiced" as const,
            invoiceId,
            invoiceNumber: invoiceNo,
            dueDate,
            updatedAt: now,
            updatedBy: "Finance Admin",
          }
        : record,
    );

    setStoredGeneratedInvoices(nextInvoices);
    setStoredBillingRecords(nextRecords);

    return {
      records: sortBillingRecords(nextRecords),
      invoice,
    };
  },

  async updateGeneratedInvoice(
    id: string,
    patch: Partial<Pick<GeneratedClientBillingInvoice, "status" | "paidAmount" | "dueDate" | "lastPaymentDate" | "paymentMode">>,
  ) {
    const invoices = getStoredGeneratedInvoices();
    const target = invoices.find((invoice) => invoice.id === id);
    if (!target) {
      return null;
    }

    const now = new Date().toISOString();
    const normalizedStatus = patch.status ?? target.status;
    const nextInvoiceNumber =
      normalizedStatus === "Sent" && target.invoiceNo.startsWith("DRAFT")
        ? target.invoiceNo.replace(/^DRAFT/, "INV")
        : target.invoiceNo;
    const updatedInvoice: GeneratedClientBillingInvoice = {
      ...target,
      ...patch,
      status: normalizedStatus,
      invoiceNo: nextInvoiceNumber,
      updatedAt: now,
    };
    const nextInvoices = invoices.map((invoice) => (invoice.id === id ? updatedInvoice : invoice));
    setStoredGeneratedInvoices(nextInvoices);

    const billingRecords = getStoredBillingRecords();
    const nextRecords = billingRecords.map((record) =>
      record.id === updatedInvoice.sourceBillingId ? syncBillingStatusFromInvoice(record, updatedInvoice) : record,
    );
    setStoredBillingRecords(nextRecords);

    return updatedInvoice;
  },
};
