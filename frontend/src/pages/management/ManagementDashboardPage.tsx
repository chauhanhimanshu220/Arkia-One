import React, { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";

interface DashboardStats {
  totalRegisteredCompanies: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  expiringSubscriptions: number;
  totalPlatformUsers: number;
  totalActiveEmployees: number;
  currentActiveProjects: number;
  totalSeatAllocation: number;
  seatsUsed: number;
  seatsRemaining: number;
  monthlyRevenue: number;
  systemHealth: string;
  workspaceGrowth: string;
  platformActivity: Array<{ id: number; action: string; target: string; time: string }>;
}

export function ManagementDashboardPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/Management/dashboard", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error("Failed to fetch dashboard stats");
        }

        const data = await response.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-200 dark:border-indigo-500/20 rounded-full animate-pulse"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-indigo-600 dark:text-indigo-400 font-medium tracking-wider uppercase text-xs animate-pulse">Initializing Command Center...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10">
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 backdrop-blur-md p-6 rounded-2xl flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">System Error</h3>
          <p className="text-red-600 dark:text-red-400/80 max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-10 transition-colors duration-300 w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-600 dark:from-white dark:via-indigo-100 dark:to-gray-400 tracking-tight mb-2 transition-all duration-300">
            Platform Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 font-medium transition-colors duration-300">
            Real-time analytics and system health monitoring
          </p>
        </div>
        <div className="flex gap-4">
          <button className="group relative px-5 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 font-semibold text-sm transition-all hover:bg-slate-50 dark:hover:bg-white/10 hover:-translate-y-0.5 shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.05)] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100 dark:via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            Generate Report
          </button>
          <button className="group relative px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm transition-all hover:-translate-y-0.5 shadow-md hover:shadow-lg dark:hover:shadow-[0_4px_25px_rgba(99,102,241,0.4)] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            System Actions
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {/* Metric 1 */}
        <div className="group relative bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-lg dark:shadow-none dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 dark:from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-100 dark:bg-blue-500/20 rounded-full blur-[40px] group-hover:bg-blue-200 dark:group-hover:bg-blue-500/30 transition-all duration-500" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/20 flex items-center justify-center border border-blue-100 dark:border-blue-500/30">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-500/20">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                {stats?.workspaceGrowth}
              </span>
            </div>
            <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Registered Companies</h3>
            <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              {stats?.totalRegisteredCompanies.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="group relative bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-lg dark:shadow-none dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 dark:from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-100 dark:bg-indigo-500/20 rounded-full blur-[40px] group-hover:bg-indigo-200 dark:group-hover:bg-indigo-500/30 transition-all duration-500" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-100 dark:border-indigo-500/30">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
            <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Active Subscriptions</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{stats?.activeSubscriptions.toLocaleString()}</span>
              <span className="text-sm font-medium text-slate-400 dark:text-gray-500">/{stats?.totalRegisteredCompanies}</span>
            </div>
            <div className="mt-4 flex gap-3 text-[11px] font-semibold">
              <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded border border-red-100 dark:border-red-500/20">{stats?.expiredSubscriptions} Expired</span>
              <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded border border-amber-100 dark:border-amber-500/20">{stats?.expiringSubscriptions} Expiring</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="group relative bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-lg dark:shadow-none dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 dark:from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-100 dark:bg-emerald-500/20 rounded-full blur-[40px] group-hover:bg-emerald-200 dark:group-hover:bg-emerald-500/30 transition-all duration-500" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center border border-emerald-100 dark:border-emerald-500/30">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Global Seat Allocation</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{(stats?.totalSeatAllocation || 0).toLocaleString()}</span>
              <span className="text-sm font-medium text-slate-400 dark:text-gray-500">Seats</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-gray-800/50 rounded-full h-1.5 border border-slate-200 dark:border-white/5 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full relative" style={{ width: `${((stats?.seatsUsed || 0) / (stats?.totalSeatAllocation || 1)) * 100}%` }}>
                <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-l from-white/50 dark:from-white/30 to-transparent" />
              </div>
            </div>
            <div className="mt-2 text-[11px] font-medium text-slate-500 dark:text-gray-400 flex justify-between">
              <span className="text-emerald-600 dark:text-emerald-400">{stats?.seatsUsed.toLocaleString()} Used</span>
              <span>{stats?.seatsRemaining.toLocaleString()} Remaining</span>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="group relative bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-lg dark:shadow-none dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 dark:from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-100 dark:bg-amber-500/20 rounded-full blur-[40px] group-hover:bg-amber-200 dark:group-hover:bg-amber-500/30 transition-all duration-500" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/20 flex items-center justify-center border border-amber-100 dark:border-amber-500/30">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-500/20">
                +8.2%
              </span>
            </div>
            <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Monthly Recurring Revenue</h3>
            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-700 dark:from-amber-200 dark:to-amber-500 tracking-tight">
              ₹{((stats?.monthlyRevenue || 0) / 1000).toFixed(1)}k
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Chart & System Health) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Chart Section */}
          <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl backdrop-blur-xl flex flex-col overflow-hidden shadow-sm dark:shadow-none transition-colors duration-300">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.01]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                Platform Usage Trends
              </h3>
              <div className="flex gap-2">
                {['1W', '1M', '3M', '1Y'].map((span, i) => (
                  <button key={span} className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${i === 1 ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30' : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                    {span}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-6">
              <div className="h-64 w-full bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col items-center justify-end relative overflow-hidden group">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]" />
                
                {/* Mock Chart Visualization */}
                <div className="absolute bottom-0 left-0 right-0 h-3/4 flex items-end justify-between px-6 pb-4 gap-2">
                  {[40, 55, 30, 60, 80, 45, 70, 95, 85, 65, 90, 75, 100].map((h, i) => (
                    <div key={i} className="group/bar relative w-full flex justify-center">
                      <div className="absolute -top-8 bg-slate-800 dark:bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded border border-slate-700 dark:border-white/10 opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-md">
                        {h}k Users
                      </div>
                      <div 
                        className="w-full max-w-[40px] rounded-t-sm relative overflow-hidden transition-all duration-500 hover:opacity-100 opacity-70 cursor-pointer"
                        style={{ height: `${h}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-indigo-500 to-indigo-300 dark:from-indigo-900 dark:to-indigo-400" />
                        <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-400 dark:bg-indigo-300" />
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-white/50 dark:via-white/5 dark:to-white/20" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-1">Platform Users</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{stats?.totalPlatformUsers.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-1">Active Projects</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{stats?.currentActiveProjects.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-1">Active Employees</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{stats?.totalActiveEmployees.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* System Health Section */}
          <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl backdrop-blur-xl flex flex-col overflow-hidden shadow-sm dark:shadow-none transition-colors duration-300">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.01]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                System Health
              </h3>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Healthy</span>
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-1">API Server</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">99.99%</p>
                  </div>
                  <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div className="w-full bg-slate-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[99.99%] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-1">Database Load</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">24%</p>
                  </div>
                  <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                </div>
                <div className="w-full bg-slate-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-500 h-full w-[24%] shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-1">Memory Usage</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">42%</p>
                  </div>
                  <svg className="w-6 h-6 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                </div>
                <div className="w-full bg-slate-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-violet-500 h-full w-[42%] shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Recent Activity) */}
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl backdrop-blur-xl flex flex-col overflow-hidden h-[calc(100%-2rem)] shadow-sm dark:shadow-none transition-colors duration-300">
          <div className="px-6 py-5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.01]">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Activity Feed
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            <ul className="space-y-1">
              {stats?.platformActivity.map((act, idx) => (
                <li key={act.id} className="group relative p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-200">
                  <div className="absolute left-4 top-5 w-[1px] h-full bg-slate-200 dark:bg-white/5 group-last:hidden" />
                  <div className="flex gap-4 relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-500 border-2 border-white dark:border-[#050505] mt-1.5 z-10 shadow-[0_0_8px_rgba(139,92,246,0.4)] dark:shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-semibold text-slate-800 dark:text-gray-200">{act.action}</p>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-gray-500 whitespace-nowrap ml-2">{act.time}</span>
                      </div>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400/80 font-medium">{act.target}</p>
                    </div>
                  </div>
                </li>
              ))}
              {(!stats?.platformActivity || stats.platformActivity.length === 0) && (
                <li className="p-8 text-center text-slate-500 dark:text-gray-500 text-sm font-medium">No recent activity</li>
              )}
            </ul>
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
            <button className="w-full py-2 rounded-lg text-xs font-bold text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors uppercase tracking-widest">
              View All Logs
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
