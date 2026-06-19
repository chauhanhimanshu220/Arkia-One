import type { AuthUser } from "../types/auth";
import type { UserRole } from "../types/roles";
import { normalizeUserRole } from "../types/roles";
import type { IconName } from "../components/Icon";

export type WorkspaceSectionKey =
  | "Dashboard"
  | "Workspace"
  | "Collaboration"
  | "Operations"
  | "Approval Center"
  | "Project & Tasks"
  | "Payroll & Billing"
  | "Payroll Management"
  | "Billing & Invoicing"
  | "Financial Reports"
  | "Cost Management"
  | "Transactions"
  | "Timesheets"
  | "Leave Management"
  | "People"
  | "My Work"
  | "Work"
  | "Approvals"
  | "Data & Export"
  | "Settings"
  | "Audit"
  | "Leave"
  | "Reports"
  | "Calendar"
  | "HR Reports"
  | "Administration"
  | "Account"
  | "Session";

export type WorkspaceRouteId =
  | "dashboard"
  | "my-assignments"
  | "chat"
  | "system-dashboard"
  | "finance-dashboard"
  | "team-overview"
  | "my-timesheet"
  | "timesheet-history"
  | "all-timesheets"
  | "bulk-approvals"
  | "approved-timesheets"
  | "activity"
  | "timesheet-payroll"
  | "payroll-processing"
  | "payroll-history"
  | "leave-request"
  | "leave-history"
  | "leave-balance"
  | "leave-calendar"
  | "leave-type-config"
  | "approval-inbox"
  | "late-timesheet-approvals"
  | "team-timesheets"
  | "leave-approval"
  | "approval-history"
  | "utilisation-report"
  | "project-hours-report"
  | "productivity-report"
  | "billing-reports"
  | "billing-invoices"
  | "client-billing"
  | "invoice-management"
  | "payment-tracking"
  | "invoice-history"
  | "cost-billing-report"
  | "revenue-report"
  | "expense-report"
  | "profit-loss-report"
  | "project-cost-analysis"
  | "employee-cost-report"
  | "project-costing"
  | "resource-cost"
  | "expense-tracking"
  | "incoming-payments"
  | "outgoing-payments"
  | "transaction-logs"
  | "payroll-approval"
  | "expense-approval"
  | "billing-approval"
  | "export-financial-data"
  | "import-records"
  | "salary-structure-setup"
  | "tax-configuration"
  | "currency-settings"
  | "billing-rules"
  | "financial-activity-logs"
  | "changes-history"
  | "audit-trail"
  | "overtime-report"
  | "leave-summary-report"
  | "leave-summary"
  | "payroll-export"
  | "employee-management"
  | "employee-directory"
  | "department-management"
  | "project-management"
  | "project-task-workbench"
  | "approval-chain-config"
  | "organisation-settings"
  | "profile-settings"
  | "account-settings"
  | "notifications"
  | "timesheet-approvals"
  | "attendance-regularization"
  | "overtime-approvals"
  | "admin-override-console"
  | "leave-policies"
  | "leave-analytics"
  | "employee-profile-view"
  | "employee-directory-report"
  | "attrition-overview"
  | "attendance-report"
  | "console-overview"
  | "console-subscription"
  | "console-admins"
  | "console-billing";

export type SidebarBadgeKey = "approvals" | "leaveApprovals" | "notifications";

export interface WorkspaceRouteDefinition {
  id: WorkspaceRouteId;
  label: string;
  section: WorkspaceSectionKey;
  path: string;
  icon: IconName;
  roles: UserRole[];
  badgeKey?: SidebarBadgeKey;
}

export interface SidebarSection {
  title: WorkspaceSectionKey;
  items: WorkspaceRouteDefinition[];
}

type WorkspaceRouteOverrides = Partial<Pick<WorkspaceRouteDefinition, "label" | "section" | "path">>;

const allRoles: UserRole[] = ["Employee", "Team Manager", "HR Manager", "Finance Admin", "System Admin"];

export const workspaceRoutes: Record<WorkspaceRouteId, WorkspaceRouteDefinition> = {
  dashboard: {
    id: "dashboard",
    label: "Dashboard",
    section: "Dashboard",
    path: "/admin/dashboard",
    icon: "dashboard",
    roles: ["Employee", "Team Manager", "HR Manager", "Finance Admin", "System Admin"],
  },
  chat: {
    id: "chat",
    label: "Chat Hub",
    section: "Collaboration",
    path: "/admin/chat",
    icon: "message-circle",
    roles: ["Employee", "Team Manager", "HR Manager", "Finance Admin", "System Admin"],
  },
  "my-assignments": {
    id: "my-assignments",
    label: "My Assignments",
    section: "Workspace",
    path: "/admin/assignments",
    icon: "projects",
    roles: ["Employee", "Team Manager"],
  },
  "system-dashboard": {
    id: "system-dashboard",
    label: "System Dashboard",
    section: "Dashboard",
    path: "/admin/dashboard/system",
    icon: "dashboard",
    roles: ["System Admin"],
  },
  "team-overview": {
    id: "team-overview",
    label: "My Team Overview",
    section: "Dashboard",
    path: "/admin/team-overview",
    icon: "team",
    roles: ["Team Manager"],
  },
  "finance-dashboard": {
    id: "finance-dashboard",
    label: "Finance Dashboard",
    section: "Dashboard",
    path: "/admin/dashboard/finance",
    icon: "dashboard",
    roles: ["Finance Admin"],
  },
  "my-timesheet": {
    id: "my-timesheet",
    label: "My Timesheet",
    section: "My Work",
    path: "/admin/timesheet",
    icon: "timesheet",
    roles: ["Employee", "Team Manager", "Finance Admin", "System Admin"],
  },
  "timesheet-history": {
    id: "timesheet-history",
    label: "Timesheet History",
    section: "My Work",
    path: "/admin/timesheet/history",
    icon: "history",
    roles: ["Employee", "Team Manager", "Finance Admin", "System Admin"],
  },
  "all-timesheets": {
    id: "all-timesheets",
    label: "All Timesheets",
    section: "Operations",
    path: "/admin/timesheets/all",
    icon: "timesheet",
    roles: ["HR Manager", "System Admin"],
  },
  "bulk-approvals": {
    id: "bulk-approvals",
    label: "Bulk Approvals",
    section: "Operations",
    path: "/admin/timesheets/bulk-approvals",
    icon: "approvals",
    roles: ["System Admin"],
  },
  "approved-timesheets": {
    id: "approved-timesheets",
    label: "Approved Timesheets",
    section: "Payroll & Billing",
    path: "/admin/timesheets/approved",
    icon: "timesheet",
    roles: ["Finance Admin", "System Admin"],
  },
  "timesheet-payroll": {
    id: "timesheet-payroll",
    label: "Timesheet Payroll",
    section: "Payroll & Billing",
    path: "/admin/payroll/timesheets",
    icon: "file-spreadsheet",
    roles: ["Finance Admin"],
  },
  "payroll-processing": {
    id: "payroll-processing",
    label: "Payroll Processing",
    section: "Payroll Management",
    path: "/admin/payroll/processing",
    icon: "settings",
    roles: ["Finance Admin"],
  },
  "payroll-history": {
    id: "payroll-history",
    label: "Payroll History",
    section: "Payroll Management",
    path: "/admin/payroll/history",
    icon: "history",
    roles: ["Finance Admin"],
  },
  "leave-request": {
    id: "leave-request",
    label: "Request Leave",
    section: "Leave",
    path: "/admin/leave/request",
    icon: "leave",
    roles: ["Employee", "Team Manager", "System Admin"],
  },
  "leave-history": {
    id: "leave-history",
    label: "My Leave History",
    section: "Leave",
    path: "/admin/leave/history",
    icon: "history",
    roles: ["Employee", "Team Manager", "System Admin"],
  },
  "leave-balance": {
    id: "leave-balance",
    label: "Leave Balances",
    section: "Leave Management",
    path: "/admin/leave/balance",
    icon: "leave",
    roles: ["Employee", "Team Manager", "HR Manager", "System Admin"],
  },
  "employee-profile-view": {
    id: "employee-profile-view",
    label: "Employee Profile View",
    section: "People",
    path: "/admin/people/profile-view",
    icon: "user-circle",
    roles: ["HR Manager"],
  },
  "employee-directory-report": {
    id: "employee-directory-report",
    label: "Employee Directory Report",
    section: "HR Reports",
    path: "/admin/reports/employee-directory",
    icon: "reports",
    roles: ["HR Manager"],
  },
  "attrition-overview": {
    id: "attrition-overview",
    label: "Attrition Overview",
    section: "HR Reports",
    path: "/admin/reports/attrition",
    icon: "reports",
    roles: ["HR Manager"],
  },
  "leave-calendar": {
    id: "leave-calendar",
    label: "Calendar",
    section: "Leave Management",
    path: "/admin/leave/calendar",
    icon: "team",
    roles: ["Employee", "Team Manager", "HR Manager", "System Admin"],
  },
  "leave-type-config": {
    id: "leave-type-config",
    label: "Leave Types",
    section: "Leave Management",
    path: "/admin/leave/types",
    icon: "settings",
    roles: ["HR Manager", "System Admin"],
  },
  "approval-inbox": {
    id: "approval-inbox",
    label: "Approval Inbox",
    section: "Approval Center",
    path: "/admin/approvals/inbox",
    icon: "inbox",
    roles: ["Team Manager", "System Admin"],
    badgeKey: "approvals",
  },
  "late-timesheet-approvals": {
    id: "late-timesheet-approvals",
    label: "Late Timesheet Approvals",
    section: "Approval Center",
    path: "/admin/approvals/late-timesheets",
    icon: "inbox",
    roles: ["Team Manager", "System Admin"],
  },
  activity: {
    id: "activity",
    label: "Activity Logs",
    section: "Operations",
    path: "/admin/operations/activity",
    icon: "clock",
    roles: ["System Admin"],
  },
  "team-timesheets": {
    id: "team-timesheets",
    label: "Team Timesheets",
    section: "Approvals",
    path: "/admin/approvals/team-timesheets",
    icon: "team",
    roles: ["Team Manager"],
  },
  "leave-approval": {
    id: "leave-approval",
    label: "Leave Approvals",
    section: "Approval Center",
    path: "/admin/approvals/leave",
    icon: "approvals",
    roles: ["Team Manager", "HR Manager", "System Admin"],
    badgeKey: "leaveApprovals",
  },
  "approval-history": {
    id: "approval-history",
    label: "Approval History",
    section: "Approval Center",
    path: "/admin/approvals/history",
    icon: "history",
    roles: ["Team Manager", "HR Manager", "System Admin"],
  },
  "utilisation-report": {
    id: "utilisation-report",
    label: "Utilisation Report",
    section: "Reports",
    path: "/admin/reports/utilisation",
    icon: "reports",
    roles: ["Team Manager", "HR Manager", "Finance Admin", "System Admin"],
  },
  "project-hours-report": {
    id: "project-hours-report",
    label: "Project Hours Report",
    section: "Reports",
    path: "/admin/reports/project-hours",
    icon: "reports",
    roles: ["Team Manager", "HR Manager", "Finance Admin", "System Admin"],
  },
  "productivity-report": {
    id: "productivity-report",
    label: "Productivity Report",
    section: "Reports",
    path: "/admin/reports/productivity",
    icon: "reports",
    roles: ["Team Manager"],
  },
  "billing-reports": {
    id: "billing-reports",
    label: "Billing Reports",
    section: "Payroll & Billing",
    path: "/admin/reports/billing",
    icon: "reports",
    roles: ["Finance Admin", "System Admin"],
  },
  "billing-invoices": {
    id: "billing-invoices",
    label: "Billing & Invoices",
    section: "Payroll & Billing",
    path: "/admin/billing/invoices",
    icon: "reports",
    roles: ["Finance Admin"],
  },
  "client-billing": {
    id: "client-billing",
    label: "Client Billing",
    section: "Billing & Invoicing",
    path: "/admin/billing/client",
    icon: "file-spreadsheet",
    roles: ["Finance Admin"],
  },
  "invoice-management": {
    id: "invoice-management",
    label: "Invoice Management",
    section: "Billing & Invoicing",
    path: "/admin/billing/invoices",
    icon: "file-spreadsheet",
    roles: ["Finance Admin"],
  },
  "payment-tracking": {
    id: "payment-tracking",
    label: "Payment Tracking",
    section: "Billing & Invoicing",
    path: "/admin/billing/payments",
    icon: "clock",
    roles: ["Finance Admin"],
  },
  "invoice-history": {
    id: "invoice-history",
    label: "Invoice History",
    section: "Payroll & Billing",
    path: "/admin/billing/history",
    icon: "history",
    roles: ["Finance Admin"],
  },
  "cost-billing-report": {
    id: "cost-billing-report",
    label: "Cost & Billing Reports",
    section: "Reports",
    path: "/admin/reports/cost-billing",
    icon: "reports",
    roles: ["Finance Admin"],
  },
  "revenue-report": {
    id: "revenue-report",
    label: "Revenue Report",
    section: "Financial Reports",
    path: "/admin/finance/reports/revenue",
    icon: "reports",
    roles: ["Finance Admin"],
  },
  "expense-report": {
    id: "expense-report",
    label: "Expense Report",
    section: "Financial Reports",
    path: "/admin/finance/reports/expenses",
    icon: "reports",
    roles: ["Finance Admin"],
  },
  "profit-loss-report": {
    id: "profit-loss-report",
    label: "Profit & Loss Report",
    section: "Financial Reports",
    path: "/admin/finance/reports/profit-loss",
    icon: "reports",
    roles: ["Finance Admin"],
  },
  "project-cost-analysis": {
    id: "project-cost-analysis",
    label: "Project Cost Analysis",
    section: "Financial Reports",
    path: "/admin/finance/reports/project-cost-analysis",
    icon: "reports",
    roles: ["Finance Admin"],
  },
  "employee-cost-report": {
    id: "employee-cost-report",
    label: "Employee Cost Report",
    section: "Financial Reports",
    path: "/admin/finance/reports/employee-cost",
    icon: "reports",
    roles: ["Finance Admin"],
  },
  "project-costing": {
    id: "project-costing",
    label: "Project Costing",
    section: "Cost Management",
    path: "/admin/finance/costs/projects",
    icon: "projects",
    roles: ["Finance Admin"],
  },
  "resource-cost": {
    id: "resource-cost",
    label: "Resource Cost",
    section: "Cost Management",
    path: "/admin/finance/costs/resources",
    icon: "employees",
    roles: ["Finance Admin"],
  },
  "expense-tracking": {
    id: "expense-tracking",
    label: "Expense Tracking",
    section: "Cost Management",
    path: "/admin/finance/costs/expenses",
    icon: "reports",
    roles: ["Finance Admin"],
  },
  "incoming-payments": {
    id: "incoming-payments",
    label: "Incoming Payments",
    section: "Transactions",
    path: "/admin/finance/transactions/incoming",
    icon: "download",
    roles: ["Finance Admin"],
  },
  "outgoing-payments": {
    id: "outgoing-payments",
    label: "Outgoing Payments",
    section: "Transactions",
    path: "/admin/finance/transactions/outgoing",
    icon: "download",
    roles: ["Finance Admin"],
  },
  "transaction-logs": {
    id: "transaction-logs",
    label: "Transaction Logs",
    section: "Transactions",
    path: "/admin/finance/transactions/logs",
    icon: "history",
    roles: ["Finance Admin"],
  },
  "payroll-approval": {
    id: "payroll-approval",
    label: "Payroll Approval",
    section: "Approvals",
    path: "/admin/finance/approvals/payroll",
    icon: "approvals",
    roles: ["Finance Admin"],
  },
  "expense-approval": {
    id: "expense-approval",
    label: "Expense Approval",
    section: "Approvals",
    path: "/admin/finance/approvals/expenses",
    icon: "approvals",
    roles: ["Finance Admin"],
  },
  "billing-approval": {
    id: "billing-approval",
    label: "Billing Approval",
    section: "Approvals",
    path: "/admin/finance/approvals/billing",
    icon: "approvals",
    roles: ["Finance Admin"],
  },
  "export-financial-data": {
    id: "export-financial-data",
    label: "Export Financial Data",
    section: "Data & Export",
    path: "/admin/finance/data/export",
    icon: "download",
    roles: ["Finance Admin"],
  },
  "import-records": {
    id: "import-records",
    label: "Import Records",
    section: "Data & Export",
    path: "/admin/finance/data/import",
    icon: "file-spreadsheet",
    roles: ["Finance Admin"],
  },
  "salary-structure-setup": {
    id: "salary-structure-setup",
    label: "Salary Structure Setup",
    section: "Settings",
    path: "/admin/finance/settings/salary-structure",
    icon: "settings",
    roles: ["Finance Admin"],
  },
  "tax-configuration": {
    id: "tax-configuration",
    label: "Tax Configuration",
    section: "Settings",
    path: "/admin/finance/settings/tax",
    icon: "settings",
    roles: ["Finance Admin"],
  },
  "currency-settings": {
    id: "currency-settings",
    label: "Currency Settings",
    section: "Settings",
    path: "/admin/finance/settings/currency",
    icon: "globe",
    roles: ["Finance Admin"],
  },
  "billing-rules": {
    id: "billing-rules",
    label: "Billing Rules",
    section: "Settings",
    path: "/admin/finance/settings/billing-rules",
    icon: "settings",
    roles: ["Finance Admin"],
  },
  "financial-activity-logs": {
    id: "financial-activity-logs",
    label: "Financial Activity Logs",
    section: "Audit",
    path: "/admin/finance/audit/activity-logs",
    icon: "clock",
    roles: ["Finance Admin"],
  },
  "changes-history": {
    id: "changes-history",
    label: "Changes History",
    section: "Audit",
    path: "/admin/finance/audit/changes-history",
    icon: "history",
    roles: ["Finance Admin"],
  },
  "audit-trail": {
    id: "audit-trail",
    label: "Audit Trail",
    section: "Audit",
    path: "/admin/finance/audit/trail",
    icon: "shield",
    roles: ["Finance Admin"],
  },
  "overtime-report": {
    id: "overtime-report",
    label: "Overtime Summary",
    section: "Reports",
    path: "/admin/reports/overtime",
    icon: "reports",
    roles: ["HR Manager", "System Admin"],
  },
  "leave-summary-report": {
    id: "leave-summary-report",
    label: "Leave Summary Report",
    section: "HR Reports",
    path: "/admin/reports/leave-summary",
    icon: "reports",
    roles: ["HR Manager", "System Admin"],
  },
  "leave-summary": {
    id: "leave-summary",
    label: "Leave Summary",
    section: "Leave Management",
    path: "/admin/reports/leave-summary",
    icon: "reports",
    roles: ["HR Manager", "System Admin"],
  },
  "payroll-export": {
    id: "payroll-export",
    label: "Payroll Export",
    section: "Reports",
    path: "/admin/reports/payroll-export",
    icon: "file-spreadsheet",
    roles: ["Finance Admin", "System Admin"],
  },
  "employee-management": {
    id: "employee-management",
    label: "Employee Management",
    section: "Administration",
    path: "/admin/admin/employees",
    icon: "employees",
    roles: ["System Admin"],
  },
  "employee-directory": {
    id: "employee-directory",
    label: "Employee Directory",
    section: "People",
    path: "/admin/people/employees",
    icon: "employees",
    roles: ["HR Manager"],
  },
  "department-management": {
    id: "department-management",
    label: "Department Management",
    section: "Administration",
    path: "/admin/admin/departments",
    icon: "departments",
    roles: ["HR Manager", "System Admin"],
  },
  "project-management": {
    id: "project-management",
    label: "Project Management",
    section: "Project & Tasks",
    path: "/admin/admin/projects",
    icon: "projects",
    roles: ["System Admin"],
  },
  "project-task-workbench": {
    id: "project-task-workbench",
    label: "Task Workbench",
    section: "Administration",
    path: "/admin/admin/project-tasks",
    icon: "git-branch",
    roles: ["System Admin"],
  },
  "approval-chain-config": {
    id: "approval-chain-config",
    label: "Approval Workflow",
    section: "Administration",
    path: "/admin/admin/approval-chains",
    icon: "git-branch",
    roles: ["System Admin"],
  },
  "organisation-settings": {
    id: "organisation-settings",
    label: "Organisation Settings",
    section: "Administration",
    path: "/admin/admin/organisation",
    icon: "settings",
    roles: ["System Admin"],
  },
  "profile-settings": {
    id: "profile-settings",
    label: "My Profile",
    section: "Account",
    path: "/admin/settings/profile",
    icon: "user-circle",
    roles: allRoles,
  },
  "account-settings": {
    id: "account-settings",
    label: "Account Settings",
    section: "Account",
    path: "/admin/settings/account",
    icon: "settings",
    roles: allRoles,
  },
  "notifications": {
    id: "notifications",
    label: "Notifications",
    section: "Account",
    path: "/admin/notifications",
    icon: "bell",
    roles: allRoles,
    badgeKey: "notifications",
  },
  "timesheet-approvals": {
    id: "timesheet-approvals",
    label: "Timesheet Approvals",
    section: "Approval Center",
    path: "/admin/approvals/timesheets",
    icon: "timesheet",
    roles: ["Team Manager", "System Admin"],
  },
  "attendance-regularization": {
    id: "attendance-regularization",
    label: "Attendance Regularization",
    section: "Approval Center",
    path: "/admin/approvals/attendance-regularization",
    icon: "clock",
    roles: ["System Admin"],
  },
  "overtime-approvals": {
    id: "overtime-approvals",
    label: "Overtime Approvals",
    section: "Approval Center",
    path: "/admin/approvals/overtime",
    icon: "clock",
    roles: ["System Admin"],
  },
  "admin-override-console": {
    id: "admin-override-console",
    label: "Admin Override Console",
    section: "Approval Center",
    path: "/admin/approvals/override",
    icon: "shield",
    roles: ["System Admin"],
  },
  "leave-policies": {
    id: "leave-policies",
    label: "Leave Policies",
    section: "Leave Management",
    path: "/admin/leave/policies",
    icon: "settings",
    roles: ["System Admin"],
  },
  "leave-analytics": {
    id: "leave-analytics",
    label: "Leave Analytics",
    section: "Reports",
    path: "/admin/reports/leave-analytics",
    icon: "reports",
    roles: ["System Admin"],
  },
  "attendance-report": {
    id: "attendance-report",
    label: "Attendance Report",
    section: "Reports",
    path: "/admin/reports/attendance",
    icon: "reports",
    roles: ["System Admin"],
  },
  "console-overview": {
    id: "console-overview",
    label: "Dashboard",
    section: "Dashboard",
    path: "/admin/console",
    icon: "dashboard",
    roles: ["License Owner"],
  },
  "console-subscription": {
    id: "console-subscription",
    label: "Subscription",
    section: "Workspace",
    path: "/admin/console/subscription",
    icon: "timesheet",
    roles: ["License Owner"],
  },
  "console-admins": {
    id: "console-admins",
    label: "System Admins",
    section: "Administration",
    path: "/admin/console/admins",
    icon: "user-circle",
    roles: ["License Owner"],
  },
  "console-billing": {
    id: "console-billing",
    label: "Invoices & Billing",
    section: "Reports",
    path: "/admin/console/billing",
    icon: "file-spreadsheet",
    roles: ["License Owner"],
  },
};

const roleRouteOrder: Record<UserRole, WorkspaceRouteId[]> = {
  Employee: [
    "dashboard",
    "my-assignments",
    "my-timesheet",
    "timesheet-history",
    "leave-request",
    "leave-history",
    "leave-balance",
    "leave-calendar",
    "profile-settings",
    "account-settings",
    "notifications",
  ],
  "Team Manager": [
    "dashboard",
    "team-overview",
    "my-assignments",
    "my-timesheet",
    "timesheet-history",
    "approval-inbox",
    "team-timesheets",
    "timesheet-approvals",
    "late-timesheet-approvals",
    "leave-approval",
    "approval-history",
    "leave-request",
    "leave-history",
    "utilisation-report",
    "project-hours-report",
    "productivity-report",
    "leave-calendar",
    "profile-settings",
    "account-settings",
    "notifications",
  ],
  "HR Manager": [
    "dashboard",
    "employee-directory",
    "employee-profile-view",
    "department-management",
    "leave-approval",
    "leave-type-config",
    "leave-balance",
    "leave-calendar",
    "leave-summary",
    "employee-directory-report",
    "leave-summary-report",
    "attrition-overview",
    "profile-settings",
    "account-settings",
    "notifications",
  ],
  "Finance Admin": [
    "dashboard",
    "finance-dashboard",
    "timesheet-payroll",
    "payroll-processing",
    "payroll-history",
    "payroll-export",
    "client-billing",
    "invoice-management",
    "payment-tracking",
    "invoice-history",
    "revenue-report",
    "expense-report",
    "profit-loss-report",
    "project-cost-analysis",
    "employee-cost-report",
    "project-costing",
    "resource-cost",
    "expense-tracking",
    "incoming-payments",
    "outgoing-payments",
    "transaction-logs",
    "payroll-approval",
    "expense-approval",
    "billing-approval",
    "export-financial-data",
    "import-records",
    "salary-structure-setup",
    "tax-configuration",
    "currency-settings",
    "billing-rules",
    "financial-activity-logs",
    "changes-history",
    "audit-trail",
  ],
  "System Admin": [
    "dashboard",
    "system-dashboard",
    "my-timesheet",
    "timesheet-history",
    "all-timesheets",
    "activity",
    "approval-inbox",
    "leave-approval",
    "timesheet-approvals",
    "late-timesheet-approvals",
    "attendance-regularization",
    "overtime-approvals",
    "bulk-approvals",
    "admin-override-console",
    "approval-history",
    "project-management",
    "project-task-workbench",
    "employee-management",
    "department-management",
    "approval-chain-config",
    "organisation-settings",
    "leave-type-config",
    "leave-policies",
    "leave-balance",
    "leave-calendar",
    "leave-summary-report",
    "utilisation-report",
    "project-hours-report",
    "overtime-report",
    "leave-analytics",
    "attendance-report",
    "profile-settings",
    "account-settings",
    "notifications",
  ],
  "License Owner": [
    "console-overview",
    "console-subscription",
    "console-admins",
    "console-billing",
    "profile-settings",
    "account-settings",
    "notifications",
  ],
};

const sectionOrder: WorkspaceSectionKey[] = [
  "Dashboard",
  "My Work",
  "Operations",
  "Approval Center",
  "Project & Tasks",
  "Administration",
  "Leave Management",
  "Reports",
  "Calendar",
  "HR Reports",
  "Collaboration",
  "Workspace",
  "Payroll Management",
  "Billing & Invoicing",
  "Financial Reports",
  "Cost Management",
  "Transactions",
  "Payroll & Billing",
  "Timesheets",
  "People",
  "Work",
  "Approvals",
  "Data & Export",
  "Settings",
  "Audit",
  "Leave",
  "Account",
];

const roleSectionOrder: Partial<Record<UserRole, WorkspaceSectionKey[]>> = {
  "System Admin": [
    "Dashboard",
    "My Work",
    "Operations",
    "Approval Center",
    "Project & Tasks",
    "Administration",
    "Leave Management",
    "Reports",
    "Account",
  ],
  "Finance Admin": [
    "Dashboard",
    "Payroll Management",
    "Billing & Invoicing",
    "Financial Reports",
    "Cost Management",
    "Transactions",
    "Approvals",
    "Data & Export",
    "Settings",
    "Audit",
  ],
  "HR Manager": ["Dashboard", "People", "Leave Management", "HR Reports", "Account"],
  "Team Manager": ["Dashboard", "Workspace", "My Work", "Approval Center", "Leave", "Reports", "Calendar", "Account"],
  Employee: ["Dashboard", "Workspace", "Collaboration", "Work", "Leave", "Account"],
  "License Owner": ["Dashboard", "Workspace", "Administration", "Reports", "Account"],
};

const hrSidebarOverrides: Partial<Record<WorkspaceRouteId, WorkspaceRouteOverrides>> = {
  dashboard: {
    label: "Personal Dashboard",
    section: "Dashboard",
  },
  "all-timesheets": {
    section: "Timesheets",
  },
  "leave-approval": {
    section: "Leave Management",
  },
  "leave-type-config": {
    label: "Leave Type Configuration",
    section: "Leave Management",
  },
  "leave-balance": {
    section: "Leave Management",
  },
  "leave-calendar": {
    section: "Leave Management",
  },
  "leave-summary": {
    section: "Reports",
  },
  "employee-directory": {
    section: "People",
  },
  "employee-profile-view": {
    section: "People",
  },
  "department-management": {
    section: "People",
    path: "/admin/admin/departments",
  },
  "leave-summary-report": {
    section: "HR Reports",
  },
  "employee-directory-report": {
    section: "HR Reports",
  },
  "attrition-overview": {
    section: "HR Reports",
  },
};

const teamManagerSidebarOverrides: Partial<Record<WorkspaceRouteId, WorkspaceRouteOverrides>> = {
  dashboard: {
    label: "Personal Dashboard",
    section: "Dashboard",
  },
  "team-overview": {
    label: "My Team Overview",
    section: "Dashboard",
  },
  "my-assignments": {
    section: "Workspace",
  },
  "my-timesheet": {
    section: "My Work",
  },
  "timesheet-history": {
    section: "My Work",
  },
  "approval-inbox": {
    section: "Approval Center",
  },
  "team-timesheets": {
    section: "Approval Center",
  },
  "timesheet-approvals": {
    section: "Approval Center",
  },
  "late-timesheet-approvals": {
    section: "Approval Center",
  },
  "leave-approval": {
    section: "Approval Center",
  },
  "approval-history": {
    section: "Approval Center",
  },
  "leave-request": {
    section: "Leave",
  },
  "leave-history": {
    section: "Leave",
  },
  "utilisation-report": {
    section: "Reports",
  },
  "project-hours-report": {
    section: "Reports",
  },
  "productivity-report": {
    section: "Reports",
  },
  "leave-calendar": {
    label: "Team Calendar",
    section: "Calendar",
  },
};

const systemAdminSidebarOverrides: Partial<Record<WorkspaceRouteId, WorkspaceRouteOverrides>> = {
  dashboard: {
    label: "My Dashboard",
    section: "Dashboard",
    path: "/admin/dashboard/my",
  },
  "system-dashboard": {
    section: "Dashboard",
  },
  "all-timesheets": {
    section: "Operations",
  },
  activity: {
    section: "Operations",
  },
  "approval-inbox": {
    section: "Approval Center",
  },
  "leave-approval": {
    label: "Leave Approvals",
    section: "Approval Center",
  },
  "timesheet-approvals": {
    section: "Approval Center",
  },
  "late-timesheet-approvals": {
    section: "Approval Center",
  },
  "attendance-regularization": {
    section: "Approval Center",
  },
  "overtime-approvals": {
    section: "Approval Center",
  },
  "bulk-approvals": {
    section: "Approval Center",
  },
  "admin-override-console": {
    section: "Approval Center",
  },
  "approval-history": {
    section: "Approval Center",
  },
  "project-management": {
    section: "Project & Tasks",
  },
  "project-task-workbench": {
    label: "Task Management",
    section: "Project & Tasks",
  },
  "employee-management": {
    section: "Administration",
  },
  "department-management": {
    section: "Administration",
  },
  "approval-chain-config": {
    label: "Approval Workflow",
    section: "Administration",
  },
  "organisation-settings": {
    section: "Administration",
  },
  "leave-type-config": {
    label: "Leave Types",
    section: "Leave Management",
  },
  "leave-policies": {
    section: "Leave Management",
  },
  "leave-balance": {
    label: "Leave Balances",
    section: "Leave Management",
  },
  "leave-calendar": {
    label: "Calendar",
    section: "Leave Management",
  },
  "leave-summary-report": {
    section: "Leave Management",
  },
  "utilisation-report": {
    section: "Reports",
  },
  "project-hours-report": {
    section: "Reports",
  },
  "overtime-report": {
    label: "Overtime Summary",
    section: "Reports",
  },
  "leave-analytics": {
    section: "Reports",
  },
  "attendance-report": {
    section: "Reports",
  },
};

const financeSidebarOverrides: Partial<Record<WorkspaceRouteId, WorkspaceRouteOverrides>> = {
  dashboard: {
    label: "Personal Dashboard",
    section: "Dashboard",
  },
  "finance-dashboard": {
    section: "Dashboard",
  },
  "timesheet-payroll": {
    section: "Payroll Management",
  },
  "payroll-export": {
    section: "Payroll Management",
    path: "/admin/payroll/export",
  },
  "approved-timesheets": {
    section: "Payroll Management",
  },
  "billing-invoices": {
    label: "Invoice Management",
    section: "Billing & Invoicing",
  },
  "invoice-history": {
    section: "Billing & Invoicing",
  },
  "billing-reports": {
    section: "Financial Reports",
  },
  "cost-billing-report": {
    section: "Financial Reports",
  },
  "my-timesheet": {
    section: "My Work",
  },
  "timesheet-history": {
    section: "My Work",
  },
};

export const getWorkspaceRoute = (id: WorkspaceRouteId) => workspaceRoutes[id];

export const getRoleRoutePrefix = (role: UserRole): string => {
  switch (role) {
    case "License Owner":
      return "/workspace-console";
    case "System Admin":
      return "/system-admin";
    case "HR Manager":
      return "/hr-manager";
    case "Finance Admin":
      return "/finance-admin";
    case "Team Manager":
      return "/team-manager";
    case "Employee":
      return "/employee";
    default:
      return "/employee";
  }
};

export const resolveRoutePath = (path: string, role: UserRole): string => {
  const prefix = getRoleRoutePrefix(role);
  return path.replace(/^\/admin/, prefix);
};

export const canAccessWorkspaceRoute = (user: AuthUser, routeId: WorkspaceRouteId) => {
  const activeRole = normalizeUserRole(user.role);
  return workspaceRoutes[routeId].roles.includes(activeRole);
};

export const getDefaultWorkspaceRoute = (user: AuthUser) => {
  const activeRole = normalizeUserRole(user.role);
  if (activeRole === "License Owner") {
    return "/workspace-console/console";
  }
  const orderedRouteIds = roleRouteOrder[activeRole];

  let basePath = "";
  if (activeRole === "System Admin") {
    basePath = systemAdminSidebarOverrides.dashboard?.path ?? workspaceRoutes.dashboard.path;
  } else {
    basePath = workspaceRoutes[orderedRouteIds[0] ?? roleRouteOrder[activeRole][0]].path;
  }
  return resolveRoutePath(basePath, activeRole);
};

export const getSidebarSectionsForUser = (user: AuthUser): SidebarSection[] => {
  const activeRole = normalizeUserRole(user.role);
  const allowedRouteIds = roleRouteOrder[activeRole];
  const preferredSections = [...(roleSectionOrder[activeRole] ?? [])];
  const allowedRoutes = allowedRouteIds.map((routeId) => {
    const route = workspaceRoutes[routeId];
    const overrides =
      activeRole === "HR Manager"
        ? hrSidebarOverrides[routeId]
        : activeRole === "Team Manager"
          ? teamManagerSidebarOverrides[routeId]
          : activeRole === "System Admin"
            ? systemAdminSidebarOverrides[routeId]
            : activeRole === "Finance Admin"
              ? financeSidebarOverrides[routeId]
          : undefined;
    const merged = overrides ? { ...route, ...overrides } : route;
    return {
      ...merged,
      path: resolveRoutePath(merged.path, activeRole),
    };
  });
  const orderedSections = [...preferredSections];

  allowedRoutes.forEach((route) => {
    if (!orderedSections.includes(route.section)) {
      orderedSections.push(route.section);
    }
  });

  sectionOrder.forEach((section) => {
    if (!orderedSections.includes(section)) {
      orderedSections.push(section);
    }
  });

  return orderedSections
    .map((sectionTitle) => ({
      title: sectionTitle,
      items: allowedRoutes.filter((route) => route.section === sectionTitle),
    }))
    .filter((section) => section.items.length > 0);
};
