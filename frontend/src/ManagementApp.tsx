import { Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { ManagementLayout } from "./layouts/ManagementLayout";
import { ManagementDashboardPage } from "./pages/management/ManagementDashboardPage";
import { ManagementCompaniesPage } from "./pages/management/ManagementCompaniesPage";
import { ManagementPlaceholderPage } from "./pages/management/ManagementPlaceholderPage";
import { ManagementSubscriptionsPage } from "./pages/management/ManagementSubscriptionsPage";
import { ManagementBillingPage } from "./pages/management/ManagementBillingPage";
import { ManagementAnalyticsPage } from "./pages/management/ManagementAnalyticsPage";
import { ManagementSystemHealthPage } from "./pages/management/ManagementSystemHealthPage";
import { ManagementAdministrationPage } from "./pages/management/ManagementAdministrationPage";
import { ManagementSupportPage } from "./pages/management/ManagementSupportPage";
import { LoadingSpinner } from "./components/LoadingSpinner";

export function ManagementApp() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner label="Checking session..." />;
  }

  // Allow access only if logged in and has the super_admin role (or account_type === 'super_admin')
  if (!session || ((session.user.role as string) !== 'super_admin' && session.user.account_type !== 'super_admin')) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/management" element={<ManagementLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ManagementDashboardPage />} />
        <Route path="companies" element={<ManagementCompaniesPage />} />
        <Route path="subscriptions" element={<ManagementSubscriptionsPage />} />
        <Route path="billing" element={<ManagementBillingPage />} />
        <Route path="analytics" element={<ManagementAnalyticsPage />} />
        <Route path="system-health" element={<ManagementSystemHealthPage />} />
        <Route path="administration" element={<ManagementAdministrationPage />} />
        <Route path="support" element={<ManagementSupportPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/management/dashboard" replace />} />
    </Routes>
  );
}
