import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, IconName } from "../../components/Icon";
import { useAuth } from "../../hooks/useAuth";

interface DashboardData {
  companyName: string;
  planName: string;
  expiryDate: string;
  remainingDays: number;
  seatLimit: number;
  currentUsage: number;
  remainingSeats: number;
  totalEmployees: number;
  totalProjects: number;
  status: string;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    transactionDate: string;
    planName: string;
    billingCycle: string;
    amount: number;
    status: string;
    paymentMethod: string;
  }>;
}

interface AdminUser {
  id: string;
  fullName: string;
  status: string;
}

export const WorkspaceConsolePortalHome = () => {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [adminsCount, setAdminsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const getStoredToken = () => {
    if (session?.token) return session.token;
    try {
      const raw = window.sessionStorage.getItem("frontend-auth-session");
      if (raw) return JSON.parse(raw).token || "";
    } catch { /* noop */ }
    return "";
  };

  useEffect(() => {
    let active = true;
    const fetchConsoleStats = async () => {
      try {
        const token = getStoredToken();
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const [dashRes, adminsRes] = await Promise.all([
          fetch("/api/Console/dashboard", { headers }),
          fetch("/api/Console/admins", { headers }),
        ]);

        if (dashRes.ok && active) {
          const dashData = await dashRes.json();
          setData(dashData);
        }
        if (adminsRes.ok && active) {
          const adminsData = await adminsRes.json();
          setAdminsCount(adminsData.length || 0);
        }
      } catch (err) {
        console.error("Failed to fetch console stats", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchConsoleStats();
    return () => {
      active = false;
    };
  }, [session]);

  const initialsFromName = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const cards = [
    {
      id: "dashboard",
      title: "Dashboard",
      desc: "Real-time snapshot of active subscription details, days remaining, and key stats.",
      icon: "dashboard" as IconName,
      path: "/workspace-console/dashboard",
      badge: data ? `${data.currentUsage} / ${data.seatLimit} Seats` : undefined,
      glow: "hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.25)] hover:border-blue-500/50 dark:hover:border-blue-400/40",
      accent: "text-blue-550 dark:text-blue-400 bg-blue-500/5 border-blue-500/10 dark:bg-blue-500/10 dark:border-blue-500/20",
      actionText: "Enter Dashboard",
    },
    {
      id: "subscription",
      title: "Subscription",
      desc: "Manage plans, seat count upgrades, renewals, and billing cycles.",
      icon: "shield" as IconName,
      path: "/workspace-console/subscription",
      badge: data ? `${data.remainingDays} Days Left` : undefined,
      glow: "hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.25)] hover:border-indigo-500/50 dark:hover:border-indigo-400/40",
      accent: "text-indigo-550 dark:text-indigo-400 bg-indigo-500/5 border-indigo-500/10 dark:bg-indigo-500/10 dark:border-indigo-500/20",
      actionText: "Manage Plan",
    },
    {
      id: "billing",
      title: "Billing",
      desc: "Review invoices, download statements, and track workspace transaction logs.",
      icon: "file-spreadsheet" as IconName,
      path: "/workspace-console/billing",
      badge: data && data.invoices.length > 0 ? `$${data.invoices[0].amount.toLocaleString()} Last` : undefined,
      glow: "hover:shadow-[0_0_40px_-10px_rgba(168,85,247,0.25)] hover:border-purple-500/50 dark:hover:border-purple-400/40",
      accent: "text-purple-550 dark:text-purple-400 bg-purple-500/5 border-purple-500/10 dark:bg-purple-500/10 dark:border-purple-500/20",
      actionText: "View Invoices",
    },
    {
      id: "workspace",
      title: "Workspace",
      desc: "Comprehensive overview of department alignments, project assets, and personnel counts.",
      icon: "globe" as IconName,
      path: "/workspace-console/workspace",
      badge: data ? `${data.totalEmployees} Employees` : undefined,
      glow: "hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.25)] hover:border-emerald-500/50 dark:hover:border-emerald-400/40",
      accent: "text-emerald-555 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/10 dark:bg-emerald-500/10 dark:border-emerald-500/20",
      actionText: "Manage Assets",
    },
    {
      id: "system-administration",
      title: "System Administration",
      desc: "Provision system administrators, assign organization access, and manage credentials.",
      icon: "user-circle" as IconName,
      path: "/workspace-console/system-administration",
      badge: adminsCount > 0 ? `${adminsCount} Admins` : undefined,
      glow: "hover:shadow-[0_0_40px_-10px_rgba(20,184,166,0.25)] hover:border-teal-500/50 dark:hover:border-teal-400/40",
      accent: "text-teal-555 dark:text-teal-400 bg-teal-500/5 border-teal-500/10 dark:bg-teal-500/10 dark:border-teal-500/20",
      actionText: "Configure Access",
    },
    {
      id: "analytics",
      title: "Analytics",
      desc: "Deeper graphical breakdowns of capacity expansion, seat usage growth, and trends.",
      icon: "reports" as IconName,
      path: "/workspace-console/analytics",
      badge: "Seat Trends",
      glow: "hover:shadow-[0_0_40px_-10px_rgba(6,182,212,0.25)] hover:border-cyan-500/50 dark:hover:border-cyan-400/40",
      accent: "text-cyan-555 dark:text-cyan-400 bg-cyan-500/5 border-cyan-500/10 dark:bg-cyan-500/10 dark:border-cyan-500/20",
      actionText: "Analyze Trends",
    },
    {
      id: "account",
      title: "Account Profile",
      desc: "Manage License Owner personal specifications, security, and credentials.",
      icon: "settings" as IconName,
      path: "/workspace-console/account",
      badge: "Security",
      glow: "hover:shadow-[0_0_40px_-10px_rgba(244,63,94,0.25)] hover:border-rose-500/50 dark:hover:border-rose-400/40",
      accent: "text-rose-555 dark:text-rose-400 bg-rose-500/5 border-rose-500/10 dark:bg-rose-500/10 dark:border-rose-500/20",
      actionText: "Edit Security",
    },
    {
      id: "support",
      title: "Support Request",
      desc: "Connect with the technical team, file operations requests, and access briefings.",
      icon: "message-circle" as IconName,
      path: "/workspace-console/support",
      badge: "Helpdesk",
      glow: "hover:shadow-[0_0_40px_-10px_rgba(249,115,22,0.25)] hover:border-orange-500/50 dark:hover:border-orange-400/40",
      accent: "text-orange-555 dark:text-orange-400 bg-orange-500/5 border-orange-500/10 dark:bg-orange-500/10 dark:border-orange-500/20",
      actionText: "Get Helpdesk",
    },
  ];

  return (
    <div className="space-y-12 py-4 w-full max-w-[1600px] mx-auto font-sans relative">
      
      {/* Executive Welcome Section */}
      <section className="text-left space-y-4">

        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight text-zinc-900 dark:text-white">
          Workspace Console
        </h1>
        <p className="max-w-3xl text-sm sm:text-base leading-relaxed text-zinc-550 dark:text-zinc-400 font-medium">
          Manage subscriptions, billing, departments, access control, analytics, and organizational operations from a single executive workspace.
        </p>
      </section>


      {/* Grid of Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => navigate(card.path)}
            className={`group relative flex flex-col justify-between text-left rounded-[2rem] border border-zinc-200/50 bg-white/45 p-6 shadow-sm backdrop-blur-xl transition-all duration-500 hover:-translate-y-1.5 dark:border-zinc-800/60 dark:bg-zinc-950/10 overflow-hidden ${card.glow}`}
          >
            {/* Hover visual aura circle */}
            <div className="absolute -right-20 -top-20 w-40 h-40 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/5 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500 pointer-events-none" />

            <div className="space-y-5 relative z-10 w-full">
              <div className="flex items-center justify-between">
                {/* Icon Wrapper */}
                <div className={`flex h-11 w-11 items-center justify-center rounded-[1.25rem] border transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${card.accent}`}>
                  <Icon name={card.icon} className="h-5 w-5" />
                </div>

                {/* Badge if exists */}
                {card.badge && (
                  <span className="inline-block rounded-full border border-zinc-200/55 bg-white/80 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-zinc-500 dark:border-zinc-800/40 dark:bg-zinc-900/30 dark:text-zinc-400 font-mono backdrop-blur-md">
                    {card.badge}
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white group-hover:text-zinc-950 dark:group-hover:text-white transition-colors duration-200">
                  {card.title}
                </h3>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans font-medium">
                  {card.desc}
                </p>
              </div>
            </div>

            {/* Premium Dynamic Action Bar */}
            <div className="mt-8 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
              <span>{card.actionText}</span>
              <Icon name="chevron-right" className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </button>
        ))}
      </div>

    </div>
  );
};
