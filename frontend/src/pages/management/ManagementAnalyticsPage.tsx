import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";

export function ManagementAnalyticsPage() {
  const { session } = useAuth();
  const token = session?.token;

  const [totalUsers, setTotalUsers] = useState(0);
  const [seatUtilization, setSeatUtilization] = useState(0);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch("/api/Management/analytics", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error("Failed to fetch analytics");
        }

        const data = await response.json();
        setTotalUsers(data.totalUsers || 0);
        setTotalCompanies(data.totalCompanies || 0);
        
        const allocated = data.totalSeatsAllocated || 1;
        const used = data.totalSeatsUsed || 0;
        setSeatUtilization(Math.round((used / allocated) * 100));
      } catch (err) {
        console.error("Error fetching analytics:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchAnalytics();
    }
  }, [token]);

  return (
    <div className="p-8 lg:p-10 h-full flex flex-col font-sans transition-colors duration-300 w-full">

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 relative z-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-600 dark:from-white dark:via-indigo-100 dark:to-gray-400 tracking-tight mb-2 transition-all duration-300">
            Platform Intelligence
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 font-medium transition-colors duration-300">
            Business intelligence and platform-wide growth analytics.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.05)] hover:-translate-y-0.5">
            Date Range: Last 30 Days
          </button>
          <button className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg dark:hover:shadow-[0_4px_25px_rgba(99,102,241,0.4)] hover:-translate-y-0.5">
            Export PDF Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 dark:from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Total Active Users</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">{totalUsers}</span>
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-500/20">+12%</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 dark:from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Avg Seat Utilization</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">{seatUtilization}%</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50 dark:from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Total Companies</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">{totalCompanies}</span>
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-500/20">+1</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 relative z-10">
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col p-6 backdrop-blur-xl shadow-sm dark:shadow-none transition-colors duration-300">
          <h3 className="text-sm font-bold text-slate-900 dark:text-gray-200 mb-6">User Growth Trajectory</h3>
          <div className="flex-1 w-full bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/5 flex items-end justify-between px-6 pb-6 pt-12 relative overflow-hidden group">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]" />
            {[30, 35, 45, 40, 55, 70, 65, 80, 85, 95, 90, 100].map((h, i) => (
              <div key={i} className="w-6 sm:w-8 relative overflow-hidden rounded-t-sm group/bar z-10 cursor-pointer" style={{ height: `${h}%` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-500 to-indigo-300 dark:from-indigo-900 dark:to-indigo-400 opacity-70 group-hover/bar:opacity-100 transition-opacity" />
                <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-400 dark:bg-indigo-300" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col p-6 backdrop-blur-xl shadow-sm dark:shadow-none transition-colors duration-300">
          <h3 className="text-sm font-bold text-slate-900 dark:text-gray-200 mb-6">Revenue Growth (MRR)</h3>
          <div className="flex-1 w-full bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/5 flex items-end justify-between px-6 pb-6 pt-12 relative overflow-hidden group">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]" />
            {[20, 25, 30, 40, 45, 50, 60, 65, 75, 80, 90, 100].map((h, i) => (
              <div key={i} className="w-6 sm:w-8 relative overflow-hidden rounded-t-sm group/bar z-10 cursor-pointer" style={{ height: `${h}%` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-500 to-emerald-300 dark:from-emerald-900 dark:to-emerald-400 opacity-70 group-hover/bar:opacity-100 transition-opacity" />
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 dark:bg-emerald-300" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
