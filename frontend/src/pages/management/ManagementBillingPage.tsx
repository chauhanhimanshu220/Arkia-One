import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";

interface Invoice {
  id: string;
  company: string;
  amount: number;
  date: string;
  status: string;
}

export function ManagementBillingPage() {
  const { session } = useAuth();
  const token = session?.token;

  const [mrr, setMrr] = useState(0);
  const [pendingReceivables, setPendingReceivables] = useState(0);
  const [failedPayments, setFailedPayments] = useState(0);
  const [arpu, setArpu] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const response = await fetch("/api/Management/billing", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error("Failed to fetch billing data");
        }

        const data = await response.json();
        setMrr(data.mrr || 0);
        setPendingReceivables(data.pendingReceivables || 0);
        setFailedPayments(data.failedPayments || 0);
        setArpu(data.arpu || 0);
        setInvoices(data.invoices || []);
      } catch (err) {
        console.error("Error fetching billing:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchBilling();
    }
  }, [token]);

  return (
    <div className="p-8 lg:p-10 h-full flex flex-col font-sans transition-colors duration-300 w-full">

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 relative z-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-600 dark:from-white dark:via-indigo-100 dark:to-gray-400 tracking-tight mb-2 transition-all duration-300">
            Financial Operations
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 font-medium transition-colors duration-300">
            Monitor revenue, process invoices, and track billing health.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.05)] hover:-translate-y-0.5">
            Download CSV
          </button>
          <button className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg dark:hover:shadow-[0_4px_25px_rgba(99,102,241,0.4)] hover:-translate-y-0.5">
            Generate Invoices
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 relative z-10">
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 dark:from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Monthly Recurring Revenue</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">₹{(mrr / 1000).toFixed(1)}k</span>
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-500/20">+4.2%</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 dark:from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Pending Receivables</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">₹{(pendingReceivables / 1000).toFixed(1)}k</span>
          </div>
        </div>
        
        <div className="bg-red-50/50 dark:bg-red-500/[0.02] border border-red-200 dark:border-red-900/50 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-red-100 dark:from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-red-600 dark:text-red-400/80 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Failed Payments</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-red-600 dark:text-red-500">{failedPayments}</span>
            <span className="text-[11px] text-red-600 dark:text-red-400 font-bold bg-red-100 dark:bg-red-500/10 px-2 py-1 rounded border border-red-200 dark:border-red-500/20 uppercase tracking-widest">Action Required</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 dark:from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Avg Revenue Per User</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">₹{arpu.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col relative z-10 backdrop-blur-xl shadow-sm dark:shadow-none overflow-hidden transition-colors duration-300">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.01]">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Transactions</h3>
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search invoice or company..."
              className="block w-full px-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl leading-5 bg-white dark:bg-black/20 text-slate-900 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all shadow-sm dark:shadow-none"
            />
          </div>
        </div>
        
        <div className="p-0 overflow-auto flex-1 custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-white/5">
            <thead className="bg-slate-50/80 dark:bg-black/40 backdrop-blur-sm sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Invoice ID</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Company</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-gray-400">{inv.id}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-gray-200">{inv.company}</td>
                  <td className="px-6 py-4 text-sm font-black text-slate-900 dark:text-white">₹{inv.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-gray-500">{inv.date}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                      inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 
                      inv.status === 'Failed' ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' :
                      'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity hover:underline">View PDF</button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-slate-500 dark:text-gray-500">
                    No invoices found.
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
