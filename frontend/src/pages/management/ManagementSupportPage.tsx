import React from "react";

export function ManagementSupportPage() {
  const tickets = [
    { id: "T-1049", company: "Nova Systems", subject: "API Integration Failure", priority: "High", status: "Open", time: "10 mins ago" },
    { id: "T-1048", company: "Global Tech", subject: "Billing calculation error", priority: "Critical", status: "In Progress", time: "1 hour ago" },
    { id: "T-1047", company: "ABC Technologies", subject: "Cannot add new seats", priority: "Medium", status: "Resolved", time: "Yesterday" },
  ];

  return (
    <div className="p-8 lg:p-10 h-full flex flex-col font-sans transition-colors duration-300 w-full">

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 relative z-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-600 dark:from-white dark:via-indigo-100 dark:to-gray-400 tracking-tight mb-2 transition-all duration-300">
            Global Support Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 font-medium transition-colors duration-300">
            Handle cross-tenant support tickets, technical escalations, and SLA monitoring.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.05)] hover:-translate-y-0.5">
            View Analytics
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 relative z-10">
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 dark:from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Open Tickets</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">42</span>
            <span className="text-sm font-bold text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md border border-slate-200 dark:border-white/10">12 Unassigned</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 dark:from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Avg Response Time</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">14m</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 dark:from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Resolution Rate</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-slate-900 dark:text-white">94%</span>
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-500/20">+2%</span>
          </div>
        </div>
        
        <div className="bg-red-50/50 dark:bg-red-500/[0.02] border border-red-200 dark:border-red-900/50 rounded-2xl p-6 relative group overflow-hidden backdrop-blur-xl shadow-sm hover:shadow-lg dark:shadow-none hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-red-100 dark:from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <h3 className="text-red-600 dark:text-red-400/80 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">SLA Breaches</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black text-red-600 dark:text-red-500">1</span>
            <span className="text-[11px] text-red-600 dark:text-red-400 font-bold bg-red-100 dark:bg-red-500/10 px-2 py-1 rounded border border-red-200 dark:border-red-500/20 uppercase tracking-widest">Critical</span>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col relative z-10 backdrop-blur-xl shadow-sm dark:shadow-none transition-colors duration-300 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.01]">
          <h3 className="text-sm font-bold text-slate-900 dark:text-gray-200">Active Technical Escalations</h3>
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search by ticket ID or subject..."
              className="block w-full px-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl leading-5 bg-white dark:bg-black/20 text-slate-900 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all shadow-sm dark:shadow-none"
            />
          </div>
        </div>
        
        <div className="p-0 overflow-auto flex-1 custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-white/5">
            <thead className="bg-slate-50/80 dark:bg-black/40 backdrop-blur-sm sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Ticket ID</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Tenant</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Subject</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Priority</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 text-sm font-mono font-medium text-slate-500 dark:text-gray-400">{ticket.id}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-gray-200">{ticket.company}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{ticket.subject}</div>
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 mt-0.5">Updated {ticket.time}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                      ticket.priority === 'Critical' ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-[#2a1111] dark:text-red-400 dark:border-red-900/50' : 
                      ticket.priority === 'High' ? 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-[#2a2a11] dark:text-amber-500 dark:border-amber-900/50' :
                      'bg-cyan-50 text-cyan-600 border border-cyan-200 dark:bg-[#112a2a] dark:text-cyan-400 dark:border-cyan-900/50'
                    }`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                      ticket.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-[#1a1a1a] dark:text-gray-300 dark:border-[#2a2a2a]' : 
                      ticket.status === 'In Progress' ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-[#11112a] dark:text-blue-400 dark:border-blue-900/50' :
                      'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                    }`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity hover:underline">Open Workspace</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
