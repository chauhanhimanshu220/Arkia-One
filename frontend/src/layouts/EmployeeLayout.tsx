import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AdminLayout } from "./AdminLayout";
import { normalizeUserRole } from "../types/roles";
import { LoadingSpinner } from "../components/LoadingSpinner";

export const EmployeeLayout = () => {
  const { session, loading, logout, setActiveRole } = useAuth();

  if (loading) {
    return <LoadingSpinner label="Verifying access..." />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const role = normalizeUserRole(session.user.role);
  if (role !== "Employee") {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminLayout
      user={session.user}
      onLogout={logout}
      onRoleChange={setActiveRole}
    />
  );
};
