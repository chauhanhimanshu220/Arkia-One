import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";

interface PlanData {
  id: string;
  name: string;
  price: number;
  companies: number;
  mrr: number;
}

interface Renewal {
  company: string;
  plan: string;
  date: string;
  amount: string;
  status: string;
}

export function ManagementSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const { session } = useAuth();
  const token = session?.token;
  
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [recentRenewals, setRecentRenewals] = useState<Renewal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const response = await fetch("/api/Management/subscriptions", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error("Failed to fetch subscriptions");
        }

        const data = await response.json();
        setPlans(data.plans || []);
        setRecentRenewals(data.recentRenewals || []);
      } catch (err) {
        console.error("Error fetching subscriptions:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchSubscriptions();
    }
  }, [token]);

  return (
    <div className="p-8 lg:p-10 h-full flex flex-col font-sans transition-colors duration-300 w-full">

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 relative z-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-600 dark:from-white dark:via-indigo-100 dark:to-gray-400 tracking-tight mb-2 transition-all duration-300">
            Subscriptions
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 font-medium transition-colors duration-300">
            Govern and monitor active plans and lifecycles across the platform.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.05)] hover:-translate-y-0.5">
            Export Report
          </button>
          <button className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg dark:hover:shadow-[0_4px_25px_rgba(99,102,241,0.4)] hover:-translate-y-0.5">
            Create Plan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden transition-all hover:shadow-lg dark:hover:shadow-none hover:border-slate-300 dark:hover:border-white/20 hover:-translate-y-1 backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 dark:from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{plan.name}</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-gray-400">₹{plan.price} / month</p>
              </div>
              <span className="bg-slate-100 dark:bg-[#1a1a1a] text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-[#2a2a2a] px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                {plan.companies} Active
              </span>
            </div>
            <div className="relative z-10 mt-6 pt-4 border-t border-slate-100 dark:border-white/10 flex justify-between items-center">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-gray-500 uppercase font-bold tracking-widest">Total MRR</p>
                <p className="text-lg font-black text-slate-900 dark:text-gray-200">₹{plan.mrr?.toLocaleString() || '0'}</p>
              </div>
              <button className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors">Manage Plan →</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col relative z-10 backdrop-blur-xl shadow-sm dark:shadow-none transition-colors duration-300 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-transparent">
          <div className="flex gap-6 text-sm font-bold">
            <button className={`pb-4 -mb-4 px-1 transition-colors ${activeTab === 'all' ? 'text-indigo-600 dark:text-gray-200 border-b-2 border-indigo-600 dark:border-gray-400' : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`} onClick={() => setActiveTab('all')}>All Renewals</button>
            <button className={`pb-4 -mb-4 px-1 transition-colors ${activeTab === 'upcoming' ? 'text-indigo-600 dark:text-gray-200 border-b-2 border-indigo-600 dark:border-gray-400' : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`} onClick={() => setActiveTab('upcoming')}>Upcoming (30 days)</button>
            <button className={`pb-4 -mb-4 px-1 transition-colors ${activeTab === 'failed' ? 'text-indigo-600 dark:text-gray-200 border-b-2 border-indigo-600 dark:border-gray-400' : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`} onClick={() => setActiveTab('failed')}>Failed Payments</button>
          </div>
        </div>
        
        <div className="p-0 overflow-auto flex-1 custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-white/5">
            <thead className="bg-slate-50/80 dark:bg-black/40 backdrop-blur-sm sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Company</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Plan</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {recentRenewals.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-gray-200">{r.company}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-gray-400">{r.plan}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-gray-500">{r.date}</td>
                  <td className="px-6 py-4 text-sm font-black text-slate-900 dark:text-white">{r.amount}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                      r.status === 'Success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-[#1a1a1a] dark:text-gray-300 dark:border-[#2a2a2a]' : 'bg-red-50 text-red-600 border border-red-200 dark:bg-[#2a1111] dark:text-red-400 dark:border-red-900/50'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentRenewals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm font-medium text-slate-500 dark:text-gray-500">
                    No recent renewals found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
