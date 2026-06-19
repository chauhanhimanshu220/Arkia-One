import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useEmployees } from "../hooks/useEmployees";
import { useAppTheme } from "../hooks/useAppTheme";
import { TopNavbar } from "../components/TopNavbar";
import { EmployeeInsightsModal } from "../components/dashboard/EmployeeInsightsModal";
import { getDefaultWorkspaceRoute } from "../config/workspaceNavigation";
import { buildEmployeeInsights, type WorkLogStatus } from "../utils/adminDashboard";
import { ChatProvider } from "../modules/chat/context/ChatContext";
import type { AuthUser } from "../types/auth";
import type { Employee } from "../types/employee";
import type { UserRole } from "../types/roles";
import { Sidebar } from "./Sidebar";

export interface AdminOutletContext {
  user: AuthUser;
  openEmployeeInsights: (employee: Employee) => void;
}

interface AdminLayoutProps {
  user: AuthUser;
  onLogout: () => void;
  onRoleChange: (role: UserRole) => void;
}

export const AdminLayout = ({ user, onLogout, onRoleChange }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme, toggleTheme } = useAppTheme();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const { employees, loading: employeesLoading } = useEmployees();
  const [insights, setInsights] = useState(() => buildEmployeeInsights([], []));

  useEffect(() => {
    setInsights(buildEmployeeInsights(employees, []));
  }, [employees]);

  const selectedInsight = useMemo(
    () => insights.find((entry) => entry.employee.id === selectedEmployeeId) ?? null,
    [insights, selectedEmployeeId],
  );

  const openEmployeeInsights = (employee: Employee) => {
    setSelectedEmployeeId(employee.id);
  };

  const handleRoleChange = (role: UserRole) => {
    if (role === user.role) {
      return;
    }

    onRoleChange(role);
    navigate(
      getDefaultWorkspaceRoute({
        ...user,
        role,
      }),
    );
  };

  const updateLogStatus = (employeeId: string, logId: string, status: WorkLogStatus) => {
    setInsights((current) =>
      current.map((insight) => {
        if (insight.employee.id !== employeeId) {
          return insight;
        }

        return {
          ...insight,
          workLogs: insight.workLogs.map((log) => (log.id === logId ? { ...log, status } : log)),
        };
      }),
    );
  };

  return (
    <ChatProvider>
      <div className="min-h-screen bg-white dark:bg-black">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={user}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        />
        <div className={`relative min-w-0 transition-all duration-300 ${sidebarCollapsed ? "lg:pl-[92px]" : "lg:pl-[304px]"}`}>
          <TopNavbar
            onMenuToggle={() => setSidebarOpen((current) => !current)}
            user={user}
            onRoleChange={handleRoleChange}
            onLogout={onLogout}
            employees={employees}
            searchLoading={employeesLoading}
            onSelectEmployee={openEmployeeInsights}
            theme={theme}
            onThemeToggle={toggleTheme}
          />
          <main className="relative w-full px-4 py-5 sm:px-5 lg:px-6">
            <div className="w-full max-w-none">
              <Outlet context={{ user, openEmployeeInsights } satisfies AdminOutletContext} />
            </div>
          </main>
        </div>

        <EmployeeInsightsModal
          open={Boolean(selectedInsight)}
          insight={selectedInsight}
          viewer={user}
          onClose={() => setSelectedEmployeeId(null)}
          onUpdateLogStatus={updateLogStatus}
        />
      </div>
    </ChatProvider>
  );
};
