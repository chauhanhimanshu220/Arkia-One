import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon, IconName } from "../../components/Icon";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAppTheme } from "../../hooks/useAppTheme";
import { EmployeeModal, type EmployeeModalValues } from "../../components/employees/EmployeeModal";
import { useDepartments } from "../../hooks/useDepartments";
import { profilePhotoService } from "../../services/profilePhotoService";
import type { Employee } from "../../types/employee";

interface Invoice {
  id: string;
  planName: string;
  billingCycle: string;
  amount: number;
  status: string;
  invoiceNumber: string;
  paymentMethod: string;
  transactionDate: string;
}

interface DashboardData {
  workspaceId: string;
  companyName: string;
  ownerName: string;
  planName: string;
  status: string;
  expiryDate: string;
  remainingDays: number;
  seatLimit: number;
  currentUsage: number;
  remainingSeats: number;
  totalEmployees: number;
  totalProjects: number;
  invoices: Invoice[];
}

interface AdminUser {
  id: string;
  employeeCode: string;
  userId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  status: string;
  createdAt: string;
}

interface WorkspaceConsoleProps {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    token?: string;
  };
  onLogout: () => void;
  activeView?: "overview" | "subscription" | "admins" | "billing" | "workspace" | "analytics" | "account" | "support";
}

type TabKey = "overview" | "subscription" | "admins" | "billing" | "workspace" | "analytics" | "account" | "support";

const panelClass =
  "rounded-[2rem] border border-white/70 bg-white/85 shadow-panel backdrop-blur dark:border-zinc-800 dark:bg-black/85";

// â”€â”€â”€ Shared form input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FormInput({
  label,
  type = "text",
  required,
  minLength,
  min,
  max,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  min?: number;
  max?: number;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        type={type}
        required={required}
        minLength={minLength}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
      />
    </div>
  );
}

// â”€â”€â”€ Stat card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatCard({
  label,
  icon,
  metric,
  sub,
  badge,
}: {
  label: string;
  icon: IconName;
  metric: React.ReactNode;
  sub?: string;
  badge?: React.ReactNode;
}) {
  return (
    <article className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] p-5 shadow-sm transition dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.96),rgba(0,0,0,0.9))]">
      <div className="relative flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
            <div className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white leading-none">{metric}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-3 text-zinc-700 dark:border-zinc-700 dark:bg-black/60 dark:text-zinc-200 shrink-0">
            {badge ?? <Icon name={icon} className="h-5 w-5" />}
          </div>
        </div>
        {sub && (
          <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">{sub}</p>
        )}
      </div>
    </article>
  );
}

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function WorkspaceConsole({ user, onLogout, activeView }: WorkspaceConsoleProps) {
  const { theme, toggleTheme } = useAppTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Detect active tab from pathname or activeView prop
  let activeTab: TabKey = activeView || "overview";

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [selectedAdminName, setSelectedAdminName] = useState<string>("");
  const [selectedAdmin, setSelectedAdmin] = useState<Employee | null>(null);

  // Forms
  const { departments } = useDepartments();
  const [newPassword, setNewPassword] = useState("");
  const [upgradeForm, setUpgradeForm] = useState({ plan: "professional", seats: 15 });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const getStoredToken = () => {
    if (user?.token) return user.token;
    try {
      const raw = window.sessionStorage.getItem("frontend-auth-session");
      if (raw) return JSON.parse(raw).token || "";
    } catch { /* noop */ }
    return "";
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getStoredToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const dashRes = await fetch("/api/Console/dashboard", { headers });
      if (!dashRes.ok) {
        if (dashRes.status === 401) { onLogout(); return; }
        throw new Error("Failed to load console dashboard data.");
      }
      setDashboardData(await dashRes.json());

      const adminsRes = await fetch("/api/Console/admins", { headers });
      if (adminsRes.ok) setAdmins(await adminsRes.json());
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const departmentOptions = React.useMemo(() => {
    return Array.from(
      new Set([
        ...departments.filter((d) => d.status === "Active").map((d) => d.name),
        "IT & Administration",
      ]),
    ).sort((left, right) => left.localeCompare(right));
  }, [departments]);

  const mappedAdmins = React.useMemo<Employee[]>(() => {
    return admins.map((a) => ({
      id: a.id,
      employeeCode: a.employeeCode,
      userId: a.userId,
      fullName: a.fullName,
      email: a.email,
      mobileNumber: a.mobileNumber,
      dateOfBirth: "",
      gender: "Prefer not to say" as any,
      role: "System Admin" as any,
      roles: ["System Admin" as any],
      department: "",
      designation: "System Administrator",
      reportingManagerId: null,
      reportingManagerName: null,
      businessUnit: "",
      workLocation: "Office" as any,
      status: a.status as any,
      userType: "Internal" as any,
      profilePhotoUrl: null,
      createdAt: a.createdAt,
    }));
  }, [admins, dashboardData]);

  const handleAdminModalSubmit = async (values: EmployeeModalValues) => {
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    const isEdit = !!selectedAdmin;
    const url = isEdit ? `/api/Console/admin/update/${selectedAdmin.id}` : "/api/Console/admin/create";
    const method = isEdit ? "PUT" : "POST";

    try {
      const existingProfilePhoto =
        selectedAdmin?.profilePhotoUrl ??
        (selectedAdmin ? profilePhotoService.getPhoto(selectedAdmin.id) : null);

      const payload = {
        employeeCode: values.employeeCode,
        userId: values.userId,
        fullName: values.fullName,
        email: values.email,
        mobileNumber: values.mobileNumber,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        role: "System Admin",
        roles: ["System Admin"],
        designation: values.designation,
        reportingManagerId: values.reportingManagerId,
        workLocation: values.workLocation,
        status: values.status,
        userType: values.userType,
        password: values.password,
        profilePhotoDataUrl: values.profilePhotoDataUrl,
        removeProfilePhoto: !values.profilePhotoDataUrl && Boolean(existingProfilePhoto),
      };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getStoredToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to ${isEdit ? "update" : "create"} System Admin.`);
      }

      setFormSuccess(`System Admin ${isEdit ? "updated" : "provisioned"} successfully.`);
      setTimeout(() => {
        setShowCreateAdminModal(false);
        setSelectedAdmin(null);
        setFormSuccess(null);
        fetchData();
      }, 1500);
    } catch (err: any) {
      setFormError(err.message);
      alert(err.message);
      throw err;
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleAdminStatus = async (adminId: string, currentStatus: string) => {
    const isDeactivating = currentStatus === "Active";
    if (!window.confirm(`${isDeactivating ? "Deactivate" : "Activate"} this System Admin?`)) return;
    try {
      const res = await fetch("/api/Console/admin/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` },
        body: JSON.stringify({ adminId, deactivate: isDeactivating }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.message || "Failed to update status."); else fetchData();
    } catch (err: any) { alert("Error: " + err.message); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminId) return;
    setFormLoading(true); setFormError(null); setFormSuccess(null);
    try {
      const res = await fetch("/api/Console/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` },
        body: JSON.stringify({ adminId: selectedAdminId, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reset password.");
      setFormSuccess("Password updated successfully.");
      setNewPassword("");
      setTimeout(() => { setShowResetPasswordModal(false); setFormSuccess(null); setSelectedAdminId(null); }, 1500);
    } catch (err: any) {
      setFormError(err.message);
    } finally { setFormLoading(false); }
  };

  const handleUpgradePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setFormError(null); setFormSuccess(null);
    try {
      const res = await fetch("/api/Console/subscription/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` },
        body: JSON.stringify(upgradeForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to upgrade plan.");
      setFormSuccess("Subscription upgraded. Provisioning new seatsâ€¦");
      setTimeout(() => { setShowUpgradeModal(false); setFormSuccess(null); fetchData(); }, 1500);
    } catch (err: any) {
      setFormError(err.message);
    } finally { setFormLoading(false); }
  };

  const handleRenewPlan = async () => {
    if (!window.confirm("Renew subscription for 1 year?")) return;
    try {
      const res = await fetch("/api/Console/subscription/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` },
      });
      const data = await res.json();
      if (!res.ok) alert(data.message || "Failed to renew."); else { alert("Renewed for 1 year."); fetchData(); }
    } catch (err: any) { alert("Error: " + err.message); }
  };

  // â”€â”€ Loading state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isLoading) {
    return <LoadingSpinner label="Loading workspace console..." />;
  }

  // â”€â”€ Error state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (error || !dashboardData) {
    return (
      <div className="p-6 text-center">
        <div className={`${panelClass} max-w-md mx-auto p-8 space-y-4`}>
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <span className="text-xl">âš </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">Console Error</h2>
            <p className="text-sm text-zinc-550 dark:text-zinc-400">{error || "Failed to load workspace data."}</p>
          </div>
          <button
            onClick={() => fetchData()}
            className="w-full h-11 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90 transition-opacity"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const usagePct = Math.round((dashboardData.currentUsage / dashboardData.seatLimit) * 100);

  const analyticsData = [
    { name: "Dec", usage: Math.max(1, Math.round(dashboardData.currentUsage * 0.4)), seats: dashboardData.seatLimit },
    { name: "Jan", usage: Math.max(2, Math.round(dashboardData.currentUsage * 0.5)), seats: dashboardData.seatLimit },
    { name: "Feb", usage: Math.max(2, Math.round(dashboardData.currentUsage * 0.65)), seats: dashboardData.seatLimit },
    { name: "Mar", usage: Math.max(3, Math.round(dashboardData.currentUsage * 0.8)), seats: dashboardData.seatLimit },
    { name: "Apr", usage: Math.max(3, Math.round(dashboardData.currentUsage * 0.9)), seats: dashboardData.seatLimit },
    { name: "May", usage: dashboardData.currentUsage, seats: dashboardData.seatLimit },
  ];

  const chartColor  = theme === "dark" ? "#a1a1aa" : "#52525b";
  const chartColor2 = theme === "dark" ? "#52525b" : "#a1a1aa";
  const gridColor   = theme === "dark" ? "#27272a" : "#e4e4e7";
  const axisColor   = theme === "dark" ? "#52525b" : "#a1a1aa";
  const ttBg        = theme === "dark" ? "#09090b" : "#ffffff";
  const ttBorder    = theme === "dark" ? "#27272a" : "#e4e4e7";
  const ttColor     = theme === "dark" ? "#f4f4f5" : "#18181b";

  const distributionData = dashboardData ? [
    { name: "Employees", value: dashboardData.totalEmployees },
    { name: "Projects", value: dashboardData.totalProjects },
  ] : [];
  const pieColors = [theme === "dark" ? "#f4f4f5" : "#18181b", theme === "dark" ? "#52525b" : "#a1a1aa"];

  return (
    <div className="space-y-6">
      
      {/* â”€â”€ Page Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {activeTab !== "overview" && (
        <section className="text-zinc-900 dark:text-white">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">{dashboardData.companyName}</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 capitalize">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
                {dashboardData.planName} Plan
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {activeTab === "subscription" && "Subscription Settings"}
              {activeTab === "admins" && "System Admins"}
              {activeTab === "billing" && "Billing & Invoices"}
              {activeTab === "workspace" && "Workspace Profile"}
              {activeTab === "analytics" && "Seat Growth Analytics"}
              {activeTab === "account" && "Owner Settings"}
              {activeTab === "support" && "Expert Support"}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
              {activeTab === "subscription" && "Manage plan parameters, contract cycles, auto-renewals, and seat allocations."}
              {activeTab === "admins" && "Provision and moderate operational admin accounts that run timesheets and project modules."}
              {activeTab === "billing" && "Review complete invoicing histories, check transaction status, and download records."}
              {activeTab === "workspace" && "Operational details, department divisions, configured projects, and active personnel bounds."}
              {activeTab === "analytics" && "Inspect seat allocation progression graphs and utilization indicators."}
              {activeTab === "account" && "Configure portal profiles, security controls, and credential definitions."}
              {activeTab === "support" && "Communicate issues directly to our operations specialists."}
            </p>
          </div>
        </section>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• TAB: OVERVIEW â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeTab === "overview" && (
        <div className="w-full max-w-[1600px] mx-auto px-6 py-6 space-y-12">
          
          {/* Workspace Header */}
          <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
                {dashboardData.companyName} WORKSPACE
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                  Subscription {dashboardData.status}
                </span>
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {dashboardData.remainingDays} Days Remaining
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 capitalize">
                  {dashboardData.planName} Plan
                </span>
              </div>
            </div>
          </section>

          {/* Quick Metrics */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Employees */}
            <article className="group rounded-2xl border border-zinc-200/50 bg-white/40 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Total Employees</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-zinc-900 dark:text-white">{dashboardData.totalEmployees}</p>
                <Icon name="employees" className="h-5 w-5 text-zinc-400" />
              </div>
            </article>
            {/* Used Seats */}
            <article className="group rounded-2xl border border-zinc-200/50 bg-white/40 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Used Seats</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                  {dashboardData.currentUsage} <span className="text-lg text-zinc-400">/ {dashboardData.seatLimit}</span>
                </p>
                <Icon name="team" className="h-5 w-5 text-zinc-400" />
              </div>
            </article>
            {/* Remaining Seats */}
            <article className="group rounded-2xl border border-zinc-200/50 bg-white/40 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Remaining Seats</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-zinc-900 dark:text-white">{dashboardData.remainingSeats}</p>
                <Icon name="shield" className="h-5 w-5 text-zinc-400" />
              </div>
            </article>
            {/* System Admins */}
            <article className="group rounded-2xl border border-zinc-200/50 bg-white/40 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">System Admins</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-zinc-900 dark:text-white">{admins.length > 0 ? admins.length : 3}</p>
                <Icon name="shield" className="h-5 w-5 text-zinc-400" />
              </div>
            </article>
          </section>

          {/* Subscription Overview */}
          <section className="rounded-2xl border border-zinc-200/50 bg-white/40 p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-6 uppercase tracking-wider">Subscription Overview</h2>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Current Plan</p>
                  <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-white capitalize">{dashboardData.planName} Plan</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Renewal Date</p>
                  <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-white">{dashboardData.expiryDate}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Billing Cycle</p>
                  <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-white">Annual</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Seat Capacity</p>
                  <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-white">{dashboardData.seatLimit} Seats</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <button 
                  onClick={() => { setUpgradeForm({ plan: dashboardData.planName, seats: dashboardData.seatLimit }); setShowUpgradeModal(true); }}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                >
                  Upgrade Plan
                </button>
                <button 
                  onClick={handleRenewPlan}
                  className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Renew Subscription
                </button>
                <button 
                  onClick={() => navigate("/workspace-console/billing")}
                  className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  View Billing
                </button>
              </div>
            </div>
          </section>

          {/* Recent Activity */}
          <section className="rounded-2xl border border-zinc-200/50 bg-white/40 p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-6 uppercase tracking-wider">Recent Activity</h2>
            <div className="flex flex-col space-y-4">
               {[
                 { title: "System Admin Created (Alice Doe)", icon: "user-plus" },
                 { title: "Invoice Generated (#INV-2026-004)", icon: "file-text" },
                 { title: "Subscription Renewed (Annual)", icon: "refresh-cw" },
               ].map((event, i) => (
                 <div key={i} className="flex items-center gap-4 py-2">
                   <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300">
                     <Icon name={event.icon as IconName} className="h-4 w-4" />
                   </div>
                   <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{event.title}</p>
                 </div>
               ))}
            </div>
          </section>

        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• TAB: SUBSCRIPTION â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeTab === "subscription" && (
        <div className="w-full max-w-[1600px] mx-auto px-6 py-6 space-y-8">
          
          <div className={`${panelClass} p-8`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Active Plan</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage your current subscription and limits.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Current Tier</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white capitalize">{dashboardData.planName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Billing Cycle</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">Annual</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Next Renewal</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{dashboardData.expiryDate}</p>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => { setUpgradeForm({ plan: dashboardData.planName, seats: dashboardData.seatLimit }); setShowUpgradeModal(true); }}
                className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
              >
                Change Plan
              </button>
              <button
                onClick={handleRenewPlan}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 text-sm font-semibold transition-colors"
              >
                Renew Now
              </button>
            </div>
          </div>

          <div className={`${panelClass} p-8`}>
            <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Seat Capacity</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Review seat usage and limits.</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Assigned Seats</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{dashboardData.currentUsage}</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-900 dark:bg-white rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (dashboardData.currentUsage / dashboardData.seatLimit) * 100)}%` }} />
                </div>
                <div className="flex items-center justify-between text-sm mt-4">
                  <span className="text-zinc-500 dark:text-zinc-400">Total Capacity</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{dashboardData.seatLimit}</span>
                </div>
              </div>
              <div className="shrink-0 flex items-center justify-center">
                 <button
                  onClick={() => { setUpgradeForm({ plan: dashboardData.planName, seats: dashboardData.seatLimit }); setShowUpgradeModal(true); }}
                  className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 text-sm font-semibold transition-colors"
                 >
                   Increase Seats
                 </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• TAB: ADMINS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeTab === "admins" && (
        <div className="w-full max-w-[1600px] mx-auto px-6 py-6 space-y-8">
          <div className={`${panelClass} overflow-hidden`}>
            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">System Administrators</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Users with full access to workspace settings and billing.</p>
              </div>
              <button
                onClick={() => { setSelectedAdmin(null); setShowCreateAdminModal(true); }}
                className="h-10 px-5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-sm font-semibold transition flex items-center gap-2"
              >
                <Icon name="plus" className="w-4 h-4" />
                Add Admin
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-8 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">User</th>
                    <th className="px-8 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Contact</th>
                    <th className="px-8 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                    <th className="px-8 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {admins.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No System Admins provisioned yet.
                      </td>
                    </tr>
                  ) : admins.map((admin) => (
                    <tr key={admin.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                      <td className="px-8 py-4 align-middle">
                        <div className="font-semibold text-zinc-900 dark:text-white">{admin.fullName}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{admin.employeeCode}</div>
                      </td>
                      <td className="px-8 py-4 align-middle">
                        <div className="text-sm text-zinc-700 dark:text-zinc-300">{admin.email}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{admin.mobileNumber || "â€”"}</div>
                      </td>
                      <td className="px-8 py-4 align-middle">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                          admin.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20"
                            : "bg-zinc-50 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400 ring-1 ring-inset ring-zinc-500/20"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${admin.status === "Active" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                          {admin.status}
                        </span>
                      </td>
                      <td className="px-8 py-4 align-middle text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={async () => {
                              try {
                                const token = getStoredToken();
                                const res = await fetch(`/api/Employees/${admin.id}`, { headers: { Authorization: `Bearer ${token}` } });
                                if (res.ok) {
                                  const fullAdmin = await res.json();
                                  setSelectedAdmin(fullAdmin);
                                  setShowCreateAdminModal(true);
                                }
                              } catch (err) { /* ignore */ }
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { setSelectedAdminId(admin.id); setSelectedAdminName(admin.fullName); setShowResetPasswordModal(true); }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• TAB: BILLING â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeTab === "billing" && (
        <div className="w-full max-w-[1600px] mx-auto px-6 py-6 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`${panelClass} p-6`}>
               <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Next Payment Due</p>
               <p className="text-2xl font-bold text-zinc-900 dark:text-white">{dashboardData.expiryDate}</p>
            </div>
            <div className={`${panelClass} p-6`}>
               <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Payment Method</p>
               <p className="text-2xl font-bold text-zinc-900 dark:text-white">Visa ending in 4242</p>
            </div>
            <div className={`${panelClass} p-6`}>
               <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Last Payment</p>
               <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                 {dashboardData.invoices.length > 0 ? `$${dashboardData.invoices[0].amount.toLocaleString()}` : "â€”"}
               </p>
            </div>
          </div>

          <div className={`${panelClass} overflow-hidden`}>
            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Billing History</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Review your past invoices and transactions.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-8 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Invoice</th>
                    <th className="px-8 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Date</th>
                    <th className="px-8 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Amount</th>
                    <th className="px-8 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                    <th className="px-8 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {dashboardData.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No billing history available.
                      </td>
                    </tr>
                  ) : dashboardData.invoices.map((inv) => (
                    <tr key={inv.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                      <td className="px-8 py-4 align-middle">
                        <span className="font-mono text-sm text-zinc-900 dark:text-white">{inv.invoiceNumber}</span>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 capitalize">{inv.planName} Plan</div>
                      </td>
                      <td className="px-8 py-4 align-middle text-sm text-zinc-700 dark:text-zinc-300">
                        {inv.transactionDate}
                      </td>
                      <td className="px-8 py-4 align-middle text-sm font-semibold text-zinc-900 dark:text-white">
                        ${inv.amount.toLocaleString()}
                      </td>
                      <td className="px-8 py-4 align-middle">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                          inv.status === "Paid"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 ring-1 ring-inset ring-amber-600/20"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${inv.status === "Paid" ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-8 py-4 align-middle text-right">
                        <button
                          onClick={() => alert(`Downloading: ${inv.invoiceNumber}`)}
                          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Icon name="download" className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• TAB: WORKSPACE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeTab === "workspace" && (
        <div className="w-full max-w-[1600px] mx-auto px-6 py-6 space-y-8">
          
          <div className={`${panelClass} p-8`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Workspace Configuration</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage global workspace variables and primary entity details.</p>
              </div>
              <div className="flex gap-3">
                 <button className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 text-sm font-semibold transition-colors">
                   Workspace Settings
                 </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                <Icon name="globe" className="w-6 h-6 text-zinc-400 mb-4" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Company Entity</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-white">{dashboardData.companyName}</p>
              </div>
              <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                <Icon name="employees" className="w-6 h-6 text-zinc-400 mb-4" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Active Workforce</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-white">{dashboardData.totalEmployees} Members</p>
              </div>
              <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                <Icon name="projects" className="w-6 h-6 text-zinc-400 mb-4" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Active Projects</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-white">{dashboardData.totalProjects} Projects</p>
              </div>
            </div>
          </div>

          <div className={`${panelClass} overflow-hidden`}>
            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Organizational Structure</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Workforce allocation analytics and department performance visibility.</p>
              </div>
              <div className="flex gap-3">
                 <button className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors">
                   Manage Departments
                 </button>
              </div>
            </div>
            
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">Department Allocation</h3>
                  <div className="space-y-3">
                    {departmentOptions.slice(0, 4).map((dept, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                          {dept}
                        </span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">{Math.max(5, Math.floor(dashboardData.totalEmployees * (1 - idx * 0.2)))} Members</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">Team Segmentation</h3>
                  <div className="flex flex-wrap gap-2">
                    {departmentOptions.map((dept, idx) => (
                      <span key={idx} className="inline-flex items-center px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`${panelClass} p-8`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Disaster Recovery & Backups</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Operational recovery management and workspace restoration controls.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Backups Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Last Automated Backup</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-white">Today, 03:00 AM UTC</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Size: 1.2 GB (Incremental)</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Backup Retention Policy</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-white">30 Days</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Geo-redundant cold storage</p>
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex gap-4 flex-wrap">
              <button
                onClick={() => alert("Initiating manual workspace backup... This may take a few minutes.")}
                className="px-5 py-2.5 rounded-xl bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-sm font-semibold transition flex items-center gap-2"
              >
                <Icon name="download" className="w-4 h-4" />
                Trigger Manual Backup
              </button>
              <button
                onClick={() => alert("Warning: Restoring from a backup will overwrite current workspace state. Are you sure?")}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 text-sm font-semibold transition flex items-center gap-2"
              >
                <Icon name="refresh-cw" className="w-4 h-4" />
                Restore from Snapshot
              </button>
            </div>
          </div>

        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• TAB: ANALYTICS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeTab === "analytics" && (
        <div className="w-full max-w-[1600px] mx-auto px-6 py-6 space-y-8">
          <div className={`${panelClass} p-8`}>
            <div className="flex items-center justify-between mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Seat Utilization Trend</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">6-month overview of workspace growth against capacity.</p>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsageTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={{ background: ttBg, border: `1px solid ${ttBorder}`, borderRadius: "12px", color: ttColor, fontSize: "12px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="usage"
                    name="Used Seats"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#colorUsageTrend)"
                    dot={{ r: 4, strokeWidth: 2, fill: ttBg, stroke: chartColor }}
                    activeDot={{ r: 6, fill: chartColor, strokeWidth: 0 }}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="seats"
                    name="Seat Capacity"
                    stroke={chartColor2}
                    strokeDasharray="4 4"
                    fill="none"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• TAB: ACCOUNT â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeTab === "account" && (
        <div className="w-full max-w-[1600px] mx-auto px-6 py-6 space-y-8">
          <div className={`${panelClass} p-8`}>
            <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Profile Details</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage your license owner account information.</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Full Name</label>
                <input
                  type="text"
                  readOnly
                  value={dashboardData.ownerName}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white cursor-not-allowed opacity-70"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Account Role</label>
                <input
                  type="text"
                  readOnly
                  value="License Owner"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white cursor-not-allowed opacity-70"
                />
              </div>

              <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Security</h3>
                <button
                  type="button"
                  onClick={() => { setSelectedAdminId(user.id); setSelectedAdminName(user.fullName); setShowResetPasswordModal(true); }}
                  className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 text-sm font-semibold transition-colors"
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• TAB: SUPPORT â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeTab === "support" && (
        <div className="w-full max-w-[1600px] mx-auto px-6 py-6 space-y-8">
          <div className={`${panelClass} p-8`}>
            <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Support Request</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Submit inquiries for technical assistance or account changes.</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert("Support request submitted successfully. We will contact you shortly.");
              }}
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Priority Level</label>
                <select className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-black dark:text-white dark:focus:border-zinc-500 dark:focus:ring-zinc-800/50 transition-all">
                  <option value="low">Standard Request</option>
                  <option value="medium">Important Issue</option>
                  <option value="high">Critical Problem</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Need to increase seat capacity"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-black dark:text-white dark:focus:border-zinc-500 dark:focus:ring-zinc-800/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Description</label>
                <textarea
                  rows={5}
                  required
                  placeholder="Please provide details about your request..."
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-black dark:text-white dark:focus:border-zinc-500 dark:focus:ring-zinc-800/50 transition-all resize-none"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <EmployeeModal
        open={showCreateAdminModal}
        employee={selectedAdmin}
        employees={mappedAdmins}
        loading={formLoading}
        departments={departmentOptions}
        initialProfilePhoto={selectedAdmin ? selectedAdmin.profilePhotoUrl ?? profilePhotoService.getPhoto(selectedAdmin.id) : null}
        onClose={() => {
          setShowCreateAdminModal(false);
          setSelectedAdmin(null);
        }}
        onSubmit={handleAdminModalSubmit}
        title={selectedAdmin ? "Edit System Admin" : "Add System Admin"}
        subtitle="System Admin details"
        description="Capture identity, organization mapping, and login access from one system admin profile form."
        fixedRole="System Admin"
      />

      {/* â•â•â•â•â•â•â•â• MODAL: RESET PASSWORD â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showResetPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setShowResetPasswordModal(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-panel dark:border-zinc-800 dark:bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:px-8">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  Reset Password
                </p>
                <h2 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">New Credentials</h2>
                <p className="mt-1 text-xs text-zinc-550 dark:text-zinc-400 truncate max-w-[200px]">For: {selectedAdminName}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowResetPasswordModal(false)}
                className="rounded-2xl border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 shrink-0"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="px-6 py-5 space-y-4 dark:bg-black">
              {formError   && <div className="px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400">{formError}</div>}
              {formSuccess && <div className="px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400">{formSuccess}</div>}

              <FormInput label="New Password" type="password" required minLength={8} placeholder="Min. 8 characters"
                value={newPassword} onChange={setNewPassword} />

              <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:justify-end sm:px-8">
                <button
                  type="button"
                  onClick={() => setShowResetPasswordModal(false)}
                  className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-2xl bg-zinc-950 dark:bg-white px-5 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {formLoading ? "Savingâ€¦" : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â• MODAL: UPGRADE PLAN â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showUpgradeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setShowUpgradeModal(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-panel dark:border-zinc-800 dark:bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:px-8">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  Upgrade Subscription
                </p>
                <h2 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">Scale License</h2>
                <p className="mt-1 text-sm text-zinc-550 dark:text-zinc-400">Adjust plan parameters or seating allocations.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="rounded-2xl border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 shrink-0"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpgradePlan} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 space-y-5">
                {formError   && <div className="px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400">{formError}</div>}
                {formSuccess && <div className="px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400">{formSuccess}</div>}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Plan Tier</label>
                  <select
                    value={upgradeForm.plan}
                    onChange={(e) => setUpgradeForm({ ...upgradeForm, plan: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                  >
                    <option value="starter">Starter â€” $24 / seat / year</option>
                    <option value="professional">Professional â€” $60 / seat / year</option>
                  </select>
                </div>

                <div>
                  <FormInput
                    label="Seat Count"
                    type="number"
                    required
                    min={10}
                    max={250}
                    value={upgradeForm.seats}
                    onChange={(v) => setUpgradeForm({ ...upgradeForm, seats: parseInt(v) || 10 })}
                  />
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5">Minimum 10 seats per license.</p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:flex-row sm:justify-end sm:px-8">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-350 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-2xl bg-zinc-950 dark:bg-white px-5 py-3 text-sm font-semibold text-white dark:text-black transition hover:bg-black dark:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {formLoading ? "Processingâ€¦" : "Confirm Upgrade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
