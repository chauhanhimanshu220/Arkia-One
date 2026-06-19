import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";

export function ManagementSystemHealthPage() {
  const { session } = useAuth();
  const token = session?.token;

  const [healthData, setHealthData] = useState<any>(null);
  
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch("/api/Management/health", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        const data = await response.json();
        setHealthData(data);
      } catch (err) {
        console.error(err);
      }
    };
    if (token) fetchHealth();
  }, [token]);

  const alerts = [
    { id: 1, type: "Warning", message: "High CPU usage on Node.js instance-1", time: "10 mins ago" },
    { id: 2, type: "Critical", message: "Database connection pool at 90% capacity", time: "25 mins ago" },
    { id: 3, type: "Info", message: "Automated backup completed successfully", time: "2 hours ago" },
  ];

  return (
    <div className="p-8 lg:p-10 h-full flex flex-col font-sans transition-colors duration-300 w-full">

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 relative z-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-600 dark:from-white dark:via-indigo-100 dark:to-gray-400 tracking-tight mb-2 transition-all duration-300">
            Infrastructure Observability
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 font-medium transition-colors duration-300">
            Monitor technical health, server status, and operational alerts.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.05)] hover:-translate-y-0.5">
            View Error Logs
          </button>
          <button className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg dark:hover:shadow-[0_4px_25px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/70 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Restart Services
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 relative z-10">
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 dark:from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">API Uptime</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">{healthData?.serverUptime || '99.99%'}</span>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-500/20 uppercase tracking-widest">{healthData?.apiStatus || 'Operational'}</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 dark:from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Database Latency</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">42ms</span>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-500/20 uppercase tracking-widest">{healthData?.databaseHealth || 'Healthy'}</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50 dark:from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Active Connections</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">{healthData?.activeConnections || '1,204'}</span>
          </div>
        </div>
        
        <div className="bg-red-50/50 dark:bg-red-500/[0.02] border border-red-200 dark:border-red-900/50 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-red-100 dark:from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-red-600 dark:text-red-400/80 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Error Rate (1h)</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-red-600 dark:text-red-500">0.05%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 relative z-10">
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col p-6 backdrop-blur-xl shadow-sm dark:shadow-none transition-colors duration-300">
          <h3 className="text-sm font-bold text-slate-900 dark:text-gray-200 mb-6">Server Resource Utilization</h3>
          
          <div className="space-y-8 flex-1 flex flex-col justify-center">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500 dark:text-gray-400 font-medium">CPU Load</span>
                <span className="text-slate-900 dark:text-white font-bold">68%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-[#111] rounded-full h-3 overflow-hidden border border-slate-200 dark:border-[#1f1f1f]">
                <div className="bg-indigo-500 dark:bg-[#444] h-3 rounded-full relative" style={{ width: '68%' }}>
                  <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse"></div>
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500 dark:text-gray-400 font-medium">Memory Usage (16GB)</span>
                <span className="text-slate-900 dark:text-white font-bold">12.4GB</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-[#111] rounded-full h-3 overflow-hidden border border-slate-200 dark:border-[#1f1f1f]">
                <div className="bg-amber-500 dark:bg-[#444] h-3 rounded-full" style={{ width: '78%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500 dark:text-gray-400 font-medium">Storage Capacity (1TB)</span>
                <span className="text-slate-900 dark:text-white font-bold">450GB</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-[#111] rounded-full h-3 overflow-hidden border border-slate-200 dark:border-[#1f1f1f]">
                <div className="bg-emerald-500 dark:bg-[#444] h-3 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col p-6 backdrop-blur-xl shadow-sm dark:shadow-none transition-colors duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-gray-200">Operational Alerts</h3>
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-500/20 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Auto-refreshing
            </span>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar pr-2">
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className="p-4 rounded-xl bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-[#1f1f1f] flex gap-4 items-start shadow-sm dark:shadow-none transition-all hover:shadow-md dark:hover:bg-white/5">
                  <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ${
                    alert.type === 'Critical' ? 'bg-red-500 shadow-red-500/50' : 
                    alert.type === 'Warning' ? 'bg-amber-500 shadow-amber-500/50' : 
                    'bg-indigo-500 shadow-indigo-500/50'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-900 dark:text-gray-200 font-bold">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        alert.type === 'Critical' ? 'text-red-600 dark:text-red-400' : 
                        alert.type === 'Warning' ? 'text-amber-600 dark:text-amber-400' : 
                        'text-indigo-600 dark:text-indigo-400'
                      }`}>{alert.type}</span>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-gray-500">{alert.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
