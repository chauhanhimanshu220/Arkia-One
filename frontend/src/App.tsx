import type { ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LoadingSpinner } from "./components/LoadingSpinner";
import {
  canAccessWorkspaceRoute,
  getDefaultWorkspaceRoute,
  getWorkspaceRoute,
  getRoleRoutePrefix,
  type WorkspaceRouteId,
} from "./config/workspaceNavigation";
import { useAuth } from "./hooks/useAuth";
import { AdminLayout } from "./layouts/AdminLayout";
import { WorkspaceConsoleLayout } from "./layouts/WorkspaceConsoleLayout";
import { SystemAdminLayout } from "./layouts/SystemAdminLayout";
import { HRManagerLayout } from "./layouts/HRManagerLayout";
import { FinanceAdminLayout } from "./layouts/FinanceAdminLayout";
import { TeamManagerLayout } from "./layouts/TeamManagerLayout";
import { EmployeeLayout } from "./layouts/EmployeeLayout";
import { TeamManagerDashboardPage } from "./pages/admin/TeamManagerDashboardPage";
import { HRDashboardPage } from "./pages/admin/HRDashboardPage";
import { DepartmentManagementPage } from "./pages/admin/DepartmentManagementPage";
import { EmployeeManagementPage } from "./pages/admin/EmployeeManagementPage";
import { MyDashboardPage } from "./pages/admin/MyDashboardPage";
import { ProjectManagementPage } from "./pages/admin/ProjectManagementPage";
import { ProjectTaskWorkbenchPage } from "./pages/admin/ProjectTaskWorkbenchPage";
import { ReportsPage } from "./pages/admin/ReportsPage";
import { PayrollExportPage } from "./pages/admin/PayrollExportPage";
import { SystemDashboardPage } from "./pages/admin/SystemDashboardPage";
import { TimesheetPage } from "./pages/admin/TimesheetPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { NotificationsPage } from "./pages/workspace/NotificationsPage";
import { AccountSettingsPage } from "./pages/workspace/AccountSettingsPage";
import { ActivityPage } from "./pages/workspace/ActivityPage";
import { AllTimesheetsPage } from "./pages/workspace/AllTimesheetsPage";
import { ApprovalHistoryPage } from "./pages/workspace/ApprovalHistoryPage";
import { ApprovalChainConfigPage } from "./pages/workspace/ApprovalChainConfigPage";
import { ApprovalInboxPage } from "./pages/workspace/ApprovalInboxPage";
import { EmployeeDirectoryPage } from "./pages/workspace/EmployeeDirectoryPage";
import { FinanceApprovalPage } from "./pages/workspace/FinanceApprovalPage";
import { FinanceCostManagementPage } from "./pages/workspace/FinanceCostManagementPage";
import { FinanceDashboardPage } from "./pages/workspace/FinanceDashboardPage";
import { FinancePersonalDashboardPage } from "./pages/workspace/FinancePersonalDashboardPage";
import { FinanceSettingsPage } from "./pages/workspace/FinanceSettingsPage";
import { ExportFinancialDataPage } from "./pages/workspace/ExportFinancialDataPage";
import { FinanceAuditPage } from "./pages/workspace/FinanceAuditPage";
import { ImportRecordsPage } from "./pages/workspace/ImportRecordsPage";
import { FinancialReportPage } from "./pages/workspace/FinancialReportPage";
import { InvoiceHistoryPage } from "./pages/workspace/InvoiceHistoryPage";
import { LateTimesheetApprovalPage } from "./pages/workspace/LateTimesheetApprovalPage";
import { LeaveApprovalInboxPage } from "./pages/workspace/LeaveApprovalInboxPage";
import { LeaveBalancePage } from "./pages/workspace/LeaveBalancePage";
import { LeaveSummaryReportPage } from "./pages/workspace/LeaveSummaryReportPage";
import { LeaveTypeConfigurationPage } from "./pages/workspace/LeaveTypeConfigurationPage";
import { MyLeaveHistoryPage } from "./pages/workspace/MyLeaveHistoryPage";
import { OvertimeSummaryPage } from "./pages/workspace/OvertimeSummaryPage";
import { OrganisationSettingsPage } from "./pages/workspace/OrganisationSettingsPage";
import { ProfileSettingsPage } from "./pages/workspace/ProfileSettingsPage";
import { RequestLeavePage } from "./pages/workspace/RequestLeavePage";
import { ClientBillingPage } from "./pages/workspace/ClientBillingPage";
import { SalaryStructureSetupPage } from "./pages/workspace/SalaryStructureSetupPage";
import { TeamCalendarPage } from "./pages/workspace/TeamCalendarPage";
import { TeamOverviewPage } from "./pages/workspace/TeamOverviewPage";
import { TeamTimesheetsPage } from "./pages/workspace/TeamTimesheetsPage";
import { BillingInvoicesPage } from "./pages/workspace/BillingInvoicesPage";
import { TimesheetHistoryPage } from "./pages/workspace/TimesheetHistoryPage";
import { PayrollHistoryPage } from "./pages/workspace/PayrollHistoryPage";
import { PayrollProcessingPage } from "./pages/workspace/PayrollProcessingPage";
import { TimesheetPayrollPage } from "./pages/workspace/TimesheetPayrollPage";
import { TimesheetPayrollQuickInfoPage } from "./pages/workspace/TimesheetPayrollQuickInfoPage";
import { TransactionsPage } from "./pages/workspace/TransactionsPage";
import { WorkspaceHomePage } from "./pages/workspace/WorkspaceHomePage";
import { WorkspacePlaceholderPage } from "./pages/workspace/WorkspacePlaceholderPage";
import { MyAssignmentsPage } from "./pages/workspace/MyAssignmentsPage";
import { TimesheetApprovalsPage } from "./pages/workspace/TimesheetApprovalsPage";
import { ChatPage } from "./modules/chat/pages/ChatPage";
import { Sales } from "./pages/Sales";
import { WorkspaceConsole } from "./pages/workspace/WorkspaceConsole";
import { WorkspaceConsolePortalHome } from "./pages/workspace/WorkspaceConsolePortalHome";
import type { AuthUser } from "./types/auth";
import { normalizeUserRole } from "./types/roles";

const AdminRouteFallback = ({ to }: { to: string }) => <Navigate to={to} replace />;

const GuardedRoute = ({
  user,
  routeId,
  fallbackTo,
  element,
}: {
  user: AuthUser;
  routeId: WorkspaceRouteId;
  fallbackTo: string;
  element: ReactElement;
}) => (canAccessWorkspaceRoute(user, routeId) ? element : <AdminRouteFallback to={fallbackTo} />);

const personalDashboardElementForUser = (user: AuthUser) => {
  const role = normalizeUserRole(user.role);
  if (role === "Employee") {
    return <WorkspaceHomePage user={user} />;
  }

  if (role === "Finance Admin") {
    return <FinancePersonalDashboardPage user={user} />;
  }

  if (role === "System Admin") {
    return <MyDashboardPage user={user} />;
  }

  if (role === "Team Manager") {
    return <TeamManagerDashboardPage user={user} />;
  }

  if (role === "HR Manager") {
    return <HRDashboardPage user={user} />;
  }

  return <TeamManagerDashboardPage user={user} />;
};

const dashboardRootElementForUser = (user: AuthUser) => {
  const role = normalizeUserRole(user.role);
  const prefix = getRoleRoutePrefix(role);
  if (role === "System Admin") {
    return <Navigate to={`${prefix}/dashboard/my`} replace />;
  }

  return personalDashboardElementForUser(user);
};

const AdminRedirectWrapper = ({ user }: { user: AuthUser }) => {
  const location = useLocation();
  const role = normalizeUserRole(user.role);
  const prefix = getRoleRoutePrefix(role);
  const targetPath = location.pathname.replace(/^\/admin/, prefix);
  const target = targetPath + location.search + location.hash;
  return <Navigate to={target} replace />;
};

const toAdminChildPath = (path: string) => path.replace(/^\/admin\/?/, "");

const adminPlaceholderRouteIds: WorkspaceRouteId[] = [
  "attendance-regularization",
  "overtime-approvals",
  "leave-policies",
  "leave-analytics",
  "attendance-report",
];

const routeNotCreatedElement = (routeId: WorkspaceRouteId) => {
  const route = getWorkspaceRoute(routeId);

  return (
    <WorkspacePlaceholderPage
      title={route.label}
      description="Not created yet."
      highlights={["Sidebar link is ready", "Route is connected", "Page content pending"]}
    />
  );
};

function App() {
  const { session, loading, login, logout, setActiveRole, updateSessionUser } = useAuth();

  if (loading) {
    return <LoadingSpinner label="Restoring session..." />;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<Sales onLogin={login} />} />
        <Route path="/login" element={<LoginPage onLogin={login} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (session.user.account_type === 'super_admin' || (session.user.role as string) === 'super_admin') {
    return <Navigate to="/management/dashboard" replace />;
  }

  const defaultRoute = getDefaultWorkspaceRoute(session.user);
  const rolePrefix = getRoleRoutePrefix(normalizeUserRole(session.user.role));

  const renderSharedRoutes = () => {
    const activeRole = normalizeUserRole(session.user.role);
    if (activeRole === "License Owner") {
      return (
        <>
          <Route
            path="console"
            element={
              <GuardedRoute
                user={session.user}
                routeId="console-overview"
                fallbackTo={defaultRoute}
                element={<WorkspaceConsolePortalHome />}
              />
            }
          />
          <Route
            path="dashboard"
            element={
              <GuardedRoute
                user={session.user}
                routeId="console-overview"
                fallbackTo={defaultRoute}
                element={<WorkspaceConsole user={{ ...session.user, token: session.token }} onLogout={logout} activeView="overview" />}
              />
            }
          />
          <Route
            path="subscription"
            element={
              <GuardedRoute
                user={session.user}
                routeId="console-subscription"
                fallbackTo={defaultRoute}
                element={<WorkspaceConsole user={{ ...session.user, token: session.token }} onLogout={logout} activeView="subscription" />}
              />
            }
          />
          <Route
            path="billing"
            element={
              <GuardedRoute
                user={session.user}
                routeId="console-billing"
                fallbackTo={defaultRoute}
                element={<WorkspaceConsole user={{ ...session.user, token: session.token }} onLogout={logout} activeView="billing" />}
              />
            }
          />
          <Route
            path="workspace"
            element={
              <GuardedRoute
                user={session.user}
                routeId="console-overview"
                fallbackTo={defaultRoute}
                element={<WorkspaceConsole user={{ ...session.user, token: session.token }} onLogout={logout} activeView="workspace" />}
              />
            }
          />
          <Route
            path="system-administration"
            element={
              <GuardedRoute
                user={session.user}
                routeId="console-admins"
                fallbackTo={defaultRoute}
                element={<WorkspaceConsole user={{ ...session.user, token: session.token }} onLogout={logout} activeView="admins" />}
              />
            }
          />
          <Route
            path="analytics"
            element={
              <GuardedRoute
                user={session.user}
                routeId="console-overview"
                fallbackTo={defaultRoute}
                element={<WorkspaceConsole user={{ ...session.user, token: session.token }} onLogout={logout} activeView="analytics" />}
              />
            }
          />
          <Route
            path="account"
            element={
              <GuardedRoute
                user={session.user}
                routeId="console-overview"
                fallbackTo={defaultRoute}
                element={<WorkspaceConsole user={{ ...session.user, token: session.token }} onLogout={logout} activeView="account" />}
              />
            }
          />
          <Route
            path="support"
            element={
              <GuardedRoute
                user={session.user}
                routeId="console-overview"
                fallbackTo={defaultRoute}
                element={<WorkspaceConsole user={{ ...session.user, token: session.token }} onLogout={logout} activeView="support" />}
              />
            }
          />
          <Route
            path="chat"
            element={
              <GuardedRoute
                user={session.user}
                routeId="chat"
                fallbackTo={defaultRoute}
                element={<ChatPage />}
              />
            }
          />
        </>
      );
    }

    return (
      <>
        <Route
          path="assignments"
          element={
            <GuardedRoute
              user={session.user}
              routeId="my-assignments"
              fallbackTo={defaultRoute}
              element={<MyAssignmentsPage user={session.user} />}
            />
          }
        />

        <Route
          path="chat"
          element={
            <GuardedRoute
              user={session.user}
              routeId="chat"
              fallbackTo={defaultRoute}
              element={<ChatPage />}
            />
          }
        />
        <Route
          path="dashboard"
          element={
            <GuardedRoute
              user={session.user}
              routeId="dashboard"
              fallbackTo={defaultRoute}
              element={dashboardRootElementForUser(session.user)}
            />
          }
        />
        <Route
          path="dashboard/my"
          element={
            <GuardedRoute
              user={session.user}
              routeId="dashboard"
              fallbackTo={defaultRoute}
              element={personalDashboardElementForUser(session.user)}
            />
          }
        />
        <Route
          path="dashboard/finance"
          element={
            <GuardedRoute
              user={session.user}
              routeId="finance-dashboard"
              fallbackTo={defaultRoute}
              element={<FinanceDashboardPage user={session.user} />}
            />
          }
        />
        <Route
          path="dashboard/system"
          element={
            <GuardedRoute
              user={session.user}
              routeId="system-dashboard"
              fallbackTo={defaultRoute}
              element={<SystemDashboardPage user={session.user} />}
            />
          }
        />
        <Route path="dashboard/system-overview" element={<Navigate to={`${rolePrefix}/dashboard/system`} replace />} />
        <Route
          path="team-overview"
          element={
            <GuardedRoute
              user={session.user}
              routeId="team-overview"
              fallbackTo={defaultRoute}
              element={<TeamOverviewPage user={session.user} />}
            />
          }
        />

        <Route
          path="timesheet"
          element={
            <GuardedRoute
              user={session.user}
              routeId="my-timesheet"
              fallbackTo={defaultRoute}
              element={<TimesheetPage user={session.user} />}
            />
          }
        />
        <Route
          path="timesheet/history"
          element={
            <GuardedRoute
              user={session.user}
              routeId="timesheet-history"
              fallbackTo={defaultRoute}
              element={<TimesheetHistoryPage user={session.user} />}
            />
          }
        />
        <Route
          path="timesheets/all"
          element={
            <GuardedRoute
              user={session.user}
              routeId="all-timesheets"
              fallbackTo={defaultRoute}
              element={<AllTimesheetsPage user={session.user} />}
            />
          }
        />
        <Route
          path="timesheets/bulk-approvals"
          element={
            <GuardedRoute
              user={session.user}
              routeId="bulk-approvals"
              fallbackTo={defaultRoute}
              element={<AllTimesheetsPage user={session.user} mode="bulk-approvals" />}
            />
          }
        />
        <Route
          path="timesheets/approved"
          element={
            <GuardedRoute
              user={session.user}
              routeId="approved-timesheets"
              fallbackTo={defaultRoute}
              element={<AllTimesheetsPage user={session.user} mode="approved" />}
            />
          }
        />
        <Route
          path="payroll/timesheets"
          element={
            <GuardedRoute
              user={session.user}
              routeId="timesheet-payroll"
              fallbackTo={defaultRoute}
              element={<TimesheetPayrollPage user={session.user} />}
            />
          }
        />
        <Route
          path="payroll/timesheets/quick-info/:employeeId"
          element={
            <GuardedRoute
              user={session.user}
              routeId="timesheet-payroll"
              fallbackTo={defaultRoute}
              element={<TimesheetPayrollQuickInfoPage user={session.user} />}
            />
          }
        />
        <Route
          path="payroll/processing"
          element={
            <GuardedRoute
              user={session.user}
              routeId="payroll-processing"
              fallbackTo={defaultRoute}
              element={<PayrollProcessingPage user={session.user} />}
            />
          }
        />
        <Route
          path="payroll/history"
          element={
            <GuardedRoute
              user={session.user}
              routeId="payroll-history"
              fallbackTo={defaultRoute}
              element={<PayrollHistoryPage user={session.user} />}
            />
          }
        />
        <Route
          path="payroll/export"
          element={
            <GuardedRoute
              user={session.user}
              routeId="payroll-export"
              fallbackTo={defaultRoute}
              element={<PayrollExportPage user={session.user} />}
            />
          }
        />

        <Route
          path="leave/request"
          element={
            <GuardedRoute
              user={session.user}
              routeId="leave-request"
              fallbackTo={defaultRoute}
              element={<RequestLeavePage user={session.user} />}
            />
          }
        />
        <Route
          path="leave/history"
          element={
            <GuardedRoute
              user={session.user}
              routeId="leave-history"
              fallbackTo={defaultRoute}
              element={<MyLeaveHistoryPage user={session.user} />}
            />
          }
        />
        <Route
          path="leave/balance"
          element={
            <GuardedRoute
              user={session.user}
              routeId="leave-balance"
              fallbackTo={defaultRoute}
              element={<LeaveBalancePage user={session.user} />}
            />
          }
        />
        <Route
          path="leave/calendar"
          element={
            <GuardedRoute
              user={session.user}
              routeId="leave-calendar"
              fallbackTo={defaultRoute}
              element={<TeamCalendarPage user={session.user} />}
            />
          }
        />
        <Route
          path="leave/types"
          element={
            <GuardedRoute
              user={session.user}
              routeId="leave-type-config"
              fallbackTo={defaultRoute}
              element={<LeaveTypeConfigurationPage />}
            />
          }
        />
        <Route
          path="approvals/inbox"
          element={
            <GuardedRoute
              user={session.user}
              routeId="approval-inbox"
              fallbackTo={defaultRoute}
              element={<ApprovalInboxPage user={session.user} />}
            />
          }
        />
        <Route
          path="approvals/timesheets"
          element={
            <GuardedRoute
              user={session.user}
              routeId="timesheet-approvals"
              fallbackTo={defaultRoute}
              element={<TimesheetApprovalsPage user={session.user} />}
            />
          }
        />
        <Route
          path="approvals/late-timesheets"
          element={
            <GuardedRoute
              user={session.user}
              routeId="late-timesheet-approvals"
              fallbackTo={defaultRoute}
              element={<LateTimesheetApprovalPage user={session.user} />}
            />
          }
        />
        <Route
          path="operations/activity"
          element={
            <GuardedRoute
              user={session.user}
              routeId="activity"
              fallbackTo={defaultRoute}
              element={<ActivityPage user={session.user} />}
            />
          }
        />
        <Route
          path="approvals/team-timesheets"
          element={
            <GuardedRoute
              user={session.user}
              routeId="team-timesheets"
              fallbackTo={defaultRoute}
              element={<TeamTimesheetsPage user={session.user} />}
            />
          }
        />
        <Route
          path="approvals/leave"
          element={
            <GuardedRoute
              user={session.user}
              routeId="leave-approval"
              fallbackTo={defaultRoute}
              element={<LeaveApprovalInboxPage user={session.user} />}
            />
          }
        />
        <Route
          path="approvals/override-console"
          element={
            <GuardedRoute
              user={session.user}
              routeId="admin-override-console"
              fallbackTo={defaultRoute}
              element={<LeaveApprovalInboxPage user={session.user} />}
            />
          }
        />
        <Route
          path="approvals/history"
          element={
            <GuardedRoute
              user={session.user}
              routeId="approval-history"
              fallbackTo={defaultRoute}
              element={<ApprovalHistoryPage user={session.user} />}
            />
          }
        />
        <Route
          path="reports/utilisation"
          element={
            <GuardedRoute
              user={session.user}
              routeId="utilisation-report"
              fallbackTo={defaultRoute}
              element={<ReportsPage user={session.user} />}
            />
          }
        />
        <Route
          path="reports/project-hours"
          element={
            <GuardedRoute
              user={session.user}
              routeId="project-hours-report"
              fallbackTo={defaultRoute}
              element={<ReportsPage user={session.user} />}
            />
          }
        />
        <Route
          path="reports/productivity"
          element={
            <GuardedRoute
              user={session.user}
              routeId="productivity-report"
              fallbackTo={defaultRoute}
              element={<ReportsPage user={session.user} />}
            />
          }
        />
        <Route
          path="reports/billing"
          element={
            <GuardedRoute
              user={session.user}
              routeId="billing-reports"
              fallbackTo={defaultRoute}
              element={<ReportsPage user={session.user} />}
            />
          }
        />
        <Route
          path="billing/invoices"
          element={
            <GuardedRoute
              user={session.user}
              routeId="invoice-management"
              fallbackTo={defaultRoute}
              element={<BillingInvoicesPage user={session.user} initialTab="invoices" />}
            />
          }
        />
        <Route
          path="billing/client"
          element={
            <GuardedRoute
              user={session.user}
              routeId="client-billing"
              fallbackTo={defaultRoute}
              element={<ClientBillingPage user={session.user} />}
            />
          }
        />
        <Route
          path="billing/payments"
          element={
            <GuardedRoute
              user={session.user}
              routeId="payment-tracking"
              fallbackTo={defaultRoute}
              element={<BillingInvoicesPage user={session.user} initialTab="payments" />}
            />
          }
        />
        <Route
          path="billing/history"
          element={
            <GuardedRoute
              user={session.user}
              routeId="invoice-history"
              fallbackTo={defaultRoute}
              element={<InvoiceHistoryPage user={session.user} />}
            />
          }
        />
        <Route
          path="reports/cost-billing"
          element={
            <GuardedRoute
              user={session.user}
              routeId="cost-billing-report"
              fallbackTo={defaultRoute}
              element={
                <WorkspacePlaceholderPage
                  title="Cost & Billing Reports"
                  description="Analyse project cost exposure, billing readiness, and finance-side delivery trends from a dedicated reporting view."
                  highlights={["Cost by project", "Billing readiness analytics", "Margin and cost tracking"]}
                />
              }
            />
          }
        />
        <Route
          path="finance/transactions/incoming"
          element={
            <GuardedRoute
              user={session.user}
              routeId="incoming-payments"
              fallbackTo={defaultRoute}
              element={<TransactionsPage user={session.user} view="incoming" />}
            />
          }
        />
        <Route
          path="finance/transactions/outgoing"
          element={
            <GuardedRoute
              user={session.user}
              routeId="outgoing-payments"
              fallbackTo={defaultRoute}
              element={<TransactionsPage user={session.user} view="outgoing" />}
            />
          }
        />
        <Route
          path="finance/transactions/logs"
          element={
            <GuardedRoute
              user={session.user}
              routeId="transaction-logs"
              fallbackTo={defaultRoute}
              element={<TransactionsPage user={session.user} view="logs" />}
            />
          }
        />
        <Route
          path="finance/reports/revenue"
          element={
            <GuardedRoute
              user={session.user}
              routeId="revenue-report"
              fallbackTo={defaultRoute}
              element={<FinancialReportPage reportType="revenue" />}
            />
          }
        />
        <Route
          path="finance/reports/expenses"
          element={
            <GuardedRoute
              user={session.user}
              routeId="expense-report"
              fallbackTo={defaultRoute}
              element={<FinancialReportPage reportType="expenses" />}
            />
          }
        />
        <Route
          path="finance/reports/profit-loss"
          element={
            <GuardedRoute
              user={session.user}
              routeId="profit-loss-report"
              fallbackTo={defaultRoute}
              element={<FinancialReportPage reportType="profit-loss" />}
            />
          }
        />
        <Route
          path="finance/reports/project-cost-analysis"
          element={
            <GuardedRoute
              user={session.user}
              routeId="project-cost-analysis"
              fallbackTo={defaultRoute}
              element={<FinancialReportPage reportType="project-cost-analysis" />}
            />
          }
        />
        <Route
          path="finance/reports/employee-cost"
          element={
            <GuardedRoute
              user={session.user}
              routeId="employee-cost-report"
              fallbackTo={defaultRoute}
              element={<FinancialReportPage reportType="employee-cost" />}
            />
          }
        />
        <Route
          path="finance/costs/projects"
          element={
            <GuardedRoute
              user={session.user}
              routeId="project-costing"
              fallbackTo={defaultRoute}
              element={<FinanceCostManagementPage view="projects" />}
            />
          }
        />
        <Route
          path="finance/costs/resources"
          element={
            <GuardedRoute
              user={session.user}
              routeId="resource-cost"
              fallbackTo={defaultRoute}
              element={<FinanceCostManagementPage view="resources" />}
            />
          }
        />
        <Route
          path="finance/costs/expenses"
          element={
            <GuardedRoute
              user={session.user}
              routeId="expense-tracking"
              fallbackTo={defaultRoute}
              element={<FinanceCostManagementPage view="expenses" />}
            />
          }
        />
        <Route
          path="finance/approvals/payroll"
          element={
            <GuardedRoute
              user={session.user}
              routeId="payroll-approval"
              fallbackTo={defaultRoute}
              element={<FinanceApprovalPage approvalType="payroll" user={session.user} />}
            />
          }
        />
        <Route
          path="finance/approvals/expenses"
          element={
            <GuardedRoute
              user={session.user}
              routeId="expense-approval"
              fallbackTo={defaultRoute}
              element={<FinanceApprovalPage approvalType="expenses" user={session.user} />}
            />
          }
        />
        <Route
          path="finance/approvals/billing"
          element={
            <GuardedRoute
              user={session.user}
              routeId="billing-approval"
              fallbackTo={defaultRoute}
              element={<FinanceApprovalPage approvalType="billing" user={session.user} />}
            />
          }
        />
        <Route
          path="finance/data/export"
          element={
            <GuardedRoute
              user={session.user}
              routeId="export-financial-data"
              fallbackTo={defaultRoute}
              element={<ExportFinancialDataPage />}
            />
          }
        />
        <Route
          path="finance/data/import"
          element={
            <GuardedRoute
              user={session.user}
              routeId="import-records"
              fallbackTo={defaultRoute}
              element={<ImportRecordsPage />}
            />
          }
        />
        <Route
          path="finance/audit/activity-logs"
          element={
            <GuardedRoute
              user={session.user}
              routeId="financial-activity-logs"
              fallbackTo={defaultRoute}
              element={<FinanceAuditPage user={session.user} view="activity-logs" />}
            />
          }
        />
        <Route
          path="finance/audit/changes-history"
          element={
            <GuardedRoute
              user={session.user}
              routeId="changes-history"
              fallbackTo={defaultRoute}
              element={<FinanceAuditPage user={session.user} view="changes-history" />}
            />
          }
        />
        <Route
          path="finance/audit/trail"
          element={
            <GuardedRoute
              user={session.user}
              routeId="audit-trail"
              fallbackTo={defaultRoute}
              element={<FinanceAuditPage user={session.user} view="audit-trail" />}
            />
          }
        />
        <Route
          path="finance/settings/tax"
          element={
            <GuardedRoute
              user={session.user}
              routeId="tax-configuration"
              fallbackTo={defaultRoute}
              element={<FinanceSettingsPage category="tax" />}
            />
          }
        />
        <Route
          path="finance/settings/currency"
          element={
            <GuardedRoute
              user={session.user}
              routeId="currency-settings"
              fallbackTo={defaultRoute}
              element={<FinanceSettingsPage category="currency" />}
            />
          }
        />
        <Route
          path="finance/settings/billing-rules"
          element={
            <GuardedRoute
              user={session.user}
              routeId="billing-rules"
              fallbackTo={defaultRoute}
              element={<FinanceSettingsPage category="billing-rules" />}
            />
          }
        />
        {adminPlaceholderRouteIds.map((routeId) => {
          const route = getWorkspaceRoute(routeId);

          return (
            <Route
              key={route.id}
              path={toAdminChildPath(route.path)}
              element={
                <GuardedRoute
                  user={session.user}
                  routeId={route.id}
                  fallbackTo={defaultRoute}
                  element={routeNotCreatedElement(route.id)}
                />
              }
            />
          );
        })}
        <Route
          path="finance/settings/salary-structure"
          element={
            <GuardedRoute
              user={session.user}
              routeId="salary-structure-setup"
              fallbackTo={defaultRoute}
              element={<SalaryStructureSetupPage />}
            />
          }
        />
        <Route
          path="reports/overtime"
          element={
            <GuardedRoute
              user={session.user}
              routeId="overtime-report"
              fallbackTo={defaultRoute}
              element={<OvertimeSummaryPage />}
            />
          }
        />
        <Route
          path="reports/leave-summary"
          element={
            <GuardedRoute
              user={session.user}
              routeId="leave-summary-report"
              fallbackTo={defaultRoute}
              element={<LeaveSummaryReportPage />}
            />
          }
        />
        <Route
          path="reports/payroll-export"
          element={
            <GuardedRoute
              user={session.user}
              routeId="payroll-export"
              fallbackTo={defaultRoute}
              element={<PayrollExportPage user={session.user} />}
            />
          }
        />

        <Route
          path="admin/employees"
          element={
            <GuardedRoute
              user={session.user}
              routeId="employee-management"
              fallbackTo={defaultRoute}
              element={<EmployeeManagementPage />}
            />
          }
        />
        <Route
          path="people/employees"
          element={
            <GuardedRoute
              user={session.user}
              routeId="employee-directory"
              fallbackTo={defaultRoute}
              element={<EmployeeDirectoryPage />}
            />
          }
        />
        <Route
          path="admin/departments"
          element={
            <GuardedRoute
              user={session.user}
              routeId="department-management"
              fallbackTo={defaultRoute}
              element={<DepartmentManagementPage />}
            />
          }
        />
        <Route
          path="people/profile-view"
          element={
            <GuardedRoute
              user={session.user}
              routeId="employee-profile-view"
              fallbackTo={defaultRoute}
              element={routeNotCreatedElement("employee-profile-view")}
            />
          }
        />
        <Route
          path="reports/employee-directory"
          element={
            <GuardedRoute
              user={session.user}
              routeId="employee-directory-report"
              fallbackTo={defaultRoute}
              element={routeNotCreatedElement("employee-directory-report")}
            />
          }
        />
        <Route
          path="reports/attrition"
          element={
            <GuardedRoute
              user={session.user}
              routeId="attrition-overview"
              fallbackTo={defaultRoute}
              element={routeNotCreatedElement("attrition-overview")}
            />
          }
        />
        <Route
          path="admin/projects"
          element={
            <GuardedRoute
              user={session.user}
              routeId="project-management"
              fallbackTo={defaultRoute}
              element={<ProjectManagementPage />}
            />
          }
        />
        <Route
          path="admin/project-tasks"
          element={
            <GuardedRoute
              user={session.user}
              routeId="project-task-workbench"
              fallbackTo={defaultRoute}
              element={<ProjectTaskWorkbenchPage />}
            />
          }
        />
        <Route
          path="admin/approval-chains"
          element={
            <GuardedRoute
              user={session.user}
              routeId="approval-chain-config"
              fallbackTo={defaultRoute}
              element={<ApprovalChainConfigPage />}
            />
          }
        />
        <Route
          path="admin/organisation"
          element={
            <GuardedRoute
              user={session.user}
              routeId="organisation-settings"
              fallbackTo={defaultRoute}
              element={<OrganisationSettingsPage />}
            />
          }
        />

        <Route
          path="settings/profile"
          element={
            <GuardedRoute
              user={session.user}
              routeId="profile-settings"
              fallbackTo={defaultRoute}
              element={<ProfileSettingsPage user={session.user} onUserUpdate={updateSessionUser} />}
            />
          }
        />
        <Route
          path="settings/account"
          element={
            <GuardedRoute
              user={session.user}
              routeId="account-settings"
              fallbackTo={defaultRoute}
              element={<AccountSettingsPage user={session.user} onUserUpdate={updateSessionUser} />}
            />
          }
        />
        <Route
          path="settings/account/personal-info"
          element={
            <GuardedRoute
              user={session.user}
              routeId="account-settings"
              fallbackTo={defaultRoute}
              element={<AccountSettingsPage user={session.user} onUserUpdate={updateSessionUser} mode="personal" />}
            />
          }
        />
        <Route
          path="settings/account/change-password"
          element={
            <GuardedRoute
              user={session.user}
              routeId="account-settings"
              fallbackTo={defaultRoute}
              element={<AccountSettingsPage user={session.user} onUserUpdate={updateSessionUser} mode="security" />}
            />
          }
        />
        <Route
          path="notifications"
          element={
            <GuardedRoute
              user={session.user}
              routeId="notifications"
              fallbackTo={defaultRoute}
              element={<NotificationsPage />}
            />
          }
        />

        <Route path="employee-management" element={<Navigate to={`${rolePrefix}/admin/employees`} replace />} />
        <Route path="project-management" element={<Navigate to={`${rolePrefix}/admin/projects`} replace />} />
        <Route path="project-tasks" element={<Navigate to={`${rolePrefix}/admin/project-tasks`} replace />} />
        <Route path="department-management" element={<Navigate to={`${rolePrefix}/admin/departments`} replace />} />
        <Route path="leave-management" element={<Navigate to={`${rolePrefix}/leave/types`} replace />} />
        <Route path="reports" element={<Navigate to={`${rolePrefix}/reports/utilisation`} replace />} />
        <Route path="approvals" element={<Navigate to={`${rolePrefix}/approvals/inbox`} replace />} />

      </>
    );
  };

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={defaultRoute} replace />} />
      <Route path="/" element={<Navigate to={defaultRoute} replace />} />

      {/* Role specific layout wrapper routes */}
      <Route path="/workspace-console" element={<WorkspaceConsoleLayout />}>
        <Route index element={<Navigate to={defaultRoute} replace />} />
        {renderSharedRoutes()}
      </Route>

      <Route path="/system-admin" element={<SystemAdminLayout />}>
        <Route index element={<Navigate to={defaultRoute} replace />} />
        {renderSharedRoutes()}
      </Route>

      <Route path="/hr-manager" element={<HRManagerLayout />}>
        <Route index element={<Navigate to={defaultRoute} replace />} />
        {renderSharedRoutes()}
      </Route>

      <Route path="/finance-admin" element={<FinanceAdminLayout />}>
        <Route index element={<Navigate to={defaultRoute} replace />} />
        {renderSharedRoutes()}
      </Route>

      <Route path="/team-manager" element={<TeamManagerLayout />}>
        <Route index element={<Navigate to={defaultRoute} replace />} />
        {renderSharedRoutes()}
      </Route>

      <Route path="/employee" element={<EmployeeLayout />}>
        <Route index element={<Navigate to={defaultRoute} replace />} />
        {renderSharedRoutes()}
      </Route>

      {/* Redirect wrapper for legacy /admin/* routes */}
      <Route path="/admin/*" element={<AdminRedirectWrapper user={session.user} />} />

      <Route
        path="/console/*"
        element={<Navigate to="/workspace-console" replace />}
      />

      <Route path="/chat" element={<Navigate to={`${rolePrefix}/chat`} replace />} />
      <Route path="*" element={<Navigate to={defaultRoute} replace />} />
    </Routes>
  );
}

export default App;
