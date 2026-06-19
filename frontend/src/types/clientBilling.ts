export type ClientBillingStatus = "Draft" | "ReadyForInvoice" | "Invoiced" | "Paid" | "Cancelled";

export type ClientBillingType = "Hourly" | "Fixed Project" | "Milestone" | "Retainer";

export type ClientBillingDiscountType = "None" | "Fixed" | "Percentage";

export type ClientBillingInvoiceStatus = "Draft" | "Sent" | "Cancelled";

export interface ClientBillingLineItem {
  id: string;
  employeeId: string;
  employeeName: string;
  taskName: string;
  description: string;
  workDate: string;
  billableHours: number;
  rate: number;
  amount: number;
  isBillable: boolean;
}

export interface ClientBillingRecord {
  id: string;
  parentBillingId?: string | null;
  revisionNo: number;
  billingNumber: string;
  clientName: string;
  projectId: string;
  projectName: string;
  projectManagerName: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  billingType: ClientBillingType;
  currencyCode: string;
  totalBillableHours: number;
  rate: number;
  fixedAmount: number;
  milestoneLabel?: string;
  milestoneAmount: number;
  retainerAmount: number;
  baseAmount: number;
  taxPercentage: number;
  taxAmount: number;
  discountType: ClientBillingDiscountType;
  discountValue: number;
  discountAmount: number;
  adjustmentAmount: number;
  finalAmount: number;
  status: ClientBillingStatus;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  dueDate?: string | null;
  notes: string;
  lineItems: ClientBillingLineItem[];
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface GeneratedClientBillingInvoice {
  id: string;
  sourceBillingId: string;
  sourceBillingNumber: string;
  invoiceNo: string;
  client: string;
  project: string;
  manager: string;
  periodStart: string;
  periodEnd: string;
  approvedHours: number;
  billableHours: number;
  rate: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  dueDate: string;
  currencyCode: string;
  status: ClientBillingInvoiceStatus;
  billingType: ClientBillingType;
  lastPaymentDate?: string | null;
  paymentMode?: string | null;
  createdAt: string;
  updatedAt: string;
}
