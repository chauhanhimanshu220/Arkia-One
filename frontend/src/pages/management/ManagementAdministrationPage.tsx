import React from "react";

export function ManagementAdministrationPage() {
  const admins = [
    { id: 1, name: "Sunil Kumar", email: "sunil.kumar@arkiatechnology.com", role: "Owner", lastActive: "Just now", status: "Active" },
    { id: 2, name: "John Doe", email: "john@arkiatechnology.com", role: "Super Admin", lastActive: "2 hours ago", status: "Active" },
    { id: 3, name: "Jane Smith", email: "jane@arkiatechnology.com", role: "Support Lead", lastActive: "1 day ago", status: "Inactive" },
  ];

  return (
    <div className="p-8 lg:p-10 h-full flex flex-col font-sans transition-colors duration-300 w-full">

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 relative z-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-600 dark:from-white dark:via-indigo-100 dark:to-gray-400 tracking-tight mb-2 transition-all duration-300">
            Internal Governance
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 font-medium transition-colors duration-300">
            Manage super admins, platform roles, and security policies.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg dark:hover:shadow-[0_4px_25px_rgba(99,102,241,0.4)] hover:-translate-y-0.5">
            Provision Admin
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col relative z-10 backdrop-blur-xl shadow-sm dark:shadow-none overflow-hidden transition-colors duration-300">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.01]">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-200">Platform Administrators</h3>
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search admins..."
              className="block w-full px-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl leading-5 bg-white dark:bg-black/20 text-slate-900 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all shadow-sm dark:shadow-none"
            />
          </div>
        </div>
        
        <div className="p-0 overflow-auto flex-1 custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-white/5">
            <thead className="bg-slate-50/80 dark:bg-black/40 backdrop-blur-sm sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Admin</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Last Active</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20 text-sm font-bold text-indigo-600 dark:text-indigo-400 shadow-inner dark:shadow-none">
                        {admin.name.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-slate-900 dark:text-gray-200">{admin.name}</div>
                        <div className="text-xs text-slate-500 dark:text-gray-500">{admin.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-gray-300">{admin.role}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-gray-500">{admin.lastActive}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                      admin.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                    }`}>
                      {admin.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity hover:underline">Edit Access</button>
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
