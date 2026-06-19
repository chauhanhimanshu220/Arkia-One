import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";

interface Company {
  id: number;
  company_name: string;
  license_owner: string;
  license_owner_email: string;
  plan_name: string;
  expiry_date: string;
  remaining_days: number;
  seat_limit: number;
  seats_used: number;
  total_active_employees: number;
  current_active_projects: number;
  workspace_status: string;
  billing_status: string;
  subscription_status: string;
  account_status: string;
}

export function ManagementCompaniesPage() {
  const { session } = useAuth();
  const token = session?.token;
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Table Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortField, setSortField] = useState<keyof Company>("created_at" as keyof Company);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Modal State
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch("/api/Management/companies", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to fetch companies");
        const data = await response.json();
        setCompanies(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCompanies();
  }, [token]);

  const handleSort = (field: keyof Company) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedCompanies = useMemo(() => {
    let result = [...companies];
    
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.company_name.toLowerCase().includes(q) || 
        (c.license_owner && c.license_owner.toLowerCase().includes(q)) ||
        (c.license_owner_email && c.license_owner_email.toLowerCase().includes(q))
      );
    }
    
    // Filter
    if (statusFilter !== "All") {
      result = result.filter(c => c.workspace_status === statusFilter);
    }
    
    // Sort
    if (sortField) {
      result.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        
        // Handle dates and strings safely
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [companies, searchQuery, statusFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCompanies.length / itemsPerPage);
  const paginatedCompanies = filteredAndSortedCompanies.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  return (
    <div className="p-8 lg:p-10 h-full flex flex-col relative font-sans transition-colors duration-300 w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 z-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-600 dark:from-white dark:via-indigo-100 dark:to-gray-400 tracking-tight mb-2 transition-all duration-300">
            Companies Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 font-medium transition-colors duration-300">
            Monitor all registered companies, license owners, and their SaaS usage
          </p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tenant or owner..."
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl leading-5 bg-white dark:bg-black/20 text-slate-900 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all shadow-sm dark:shadow-none"
            />
          </div>
          
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm dark:shadow-none transition-all"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
          
          <button className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg dark:hover:shadow-[0_4px_25px_rgba(99,102,241,0.4)] hover:-translate-y-0.5">
            Provision Tenant
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl flex-1 flex flex-col overflow-hidden backdrop-blur-xl shadow-sm dark:shadow-none z-10 transition-colors duration-300">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 rounded-xl text-red-600 dark:text-red-400 font-medium">
              Error: {error}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-white/5">
                <thead className="bg-slate-50/80 dark:bg-black/40 backdrop-blur-sm sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest cursor-pointer hover:text-slate-800 dark:hover:text-gray-300 transition-colors" onClick={() => handleSort('company_name')}>
                      Tenant {sortField === 'company_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest cursor-pointer hover:text-slate-800 dark:hover:text-gray-300 transition-colors" onClick={() => handleSort('plan_name')}>
                      Subscription {sortField === 'plan_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">
                      Seat Usage
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest cursor-pointer hover:text-slate-800 dark:hover:text-gray-300 transition-colors" onClick={() => handleSort('workspace_status')}>
                      Status {sortField === 'workspace_status' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-right text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {paginatedCompanies.map((company) => {
                    const limit = company.seat_limit || 10;
                    const usage = company.seats_used || 0;
                    const usagePercent = Math.min(100, Math.round((usage / limit) * 100));
                    
                    return (
                    <tr key={company.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => setSelectedCompany(company)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 shadow-inner dark:shadow-none">
                            {company.company_name.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-slate-900 dark:text-gray-200">{company.company_name}</div>
                            <div className="text-xs text-slate-500 dark:text-gray-500 flex items-center gap-1 mt-0.5" title={company.license_owner_email}>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {company.license_owner || 'Owner Unassigned'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700 dark:text-gray-300 font-bold">{company.plan_name}</div>
                        <div className="text-xs text-slate-500 dark:text-gray-500 mt-0.5 font-medium">
                          {company.remaining_days > 0 ? `${company.remaining_days} days left` : 'Expired'} 
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-48">
                          <div className="flex justify-between text-xs mb-1 font-medium">
                            <span className="text-slate-700 dark:text-gray-300">{usage} Used</span>
                            <span className="text-slate-500 dark:text-gray-500">{limit} Limit</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${usagePercent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                            company.workspace_status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                          }`}>
                            {company.workspace_status}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                            company.billing_status === 'Paid' ? 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-gray-800 dark:text-gray-400 dark:border-transparent' : 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20'
                          }`}>
                            {company.billing_status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {company.workspace_status === 'Active' ? (
                            <button 
                              className="text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-300 dark:bg-transparent dark:hover:bg-red-400/10 px-3 py-1.5 rounded-lg text-xs transition-colors font-bold"
                              onClick={(e) => { e.stopPropagation(); /* Suspend Logic */ }}
                            >
                              Suspend
                            </button>
                          ) : (
                            <button 
                              className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:text-emerald-300 dark:bg-transparent dark:hover:bg-emerald-400/10 px-3 py-1.5 rounded-lg text-xs transition-colors font-bold"
                              onClick={(e) => { e.stopPropagation(); /* Activate Logic */ }}
                            >
                              Activate
                            </button>
                          )}
                          <button 
                            className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:text-indigo-300 dark:bg-transparent dark:hover:bg-indigo-400/10 px-3 py-1.5 rounded-lg text-xs transition-colors font-bold"
                            onClick={(e) => { e.stopPropagation(); setSelectedCompany(company); }}
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              {paginatedCompanies.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-gray-500 font-medium">No companies found matching criteria.</p>
                </div>
              )}
            </div>
            
            {/* Pagination Controls */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.01]">
              <p className="text-xs font-medium text-slate-500 dark:text-gray-500">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredAndSortedCompanies.length)} to {Math.min(currentPage * itemsPerPage, filteredAndSortedCompanies.length)} of {filteredAndSortedCompanies.length} companies
              </p>
              <div className="flex gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-4 py-2 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-400 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 text-xs font-bold transition-colors shadow-sm dark:shadow-none"
                >
                  Previous
                </button>
                <button 
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-4 py-2 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-400 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 text-xs font-bold transition-colors shadow-sm dark:shadow-none"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Company Detail Slide-out Drawer */}
      {selectedCompany && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedCompany(null)}
          ></div>
          
          {/* Drawer */}
          <div className="relative w-full max-w-md bg-white dark:bg-[#0a0a0a] border-l border-slate-200 dark:border-[#1f1f1f] shadow-2xl h-full flex flex-col animate-[slideIn_0.3s_ease-out] transition-colors duration-300">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-[#1f1f1f] flex justify-between items-center bg-slate-50/80 dark:bg-[#050505] backdrop-blur-md">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Company Governance</h2>
              <button 
                onClick={() => setSelectedCompany(null)}
                className="text-slate-400 hover:text-slate-700 dark:text-gray-500 dark:hover:text-white transition-colors bg-white dark:bg-transparent border border-slate-200 dark:border-transparent p-1.5 rounded-lg shadow-sm dark:shadow-none"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
              {/* Header Info */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-2xl font-black shadow-inner dark:shadow-none">
                  {selectedCompany.company_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedCompany.company_name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest mt-2 ${
                    selectedCompany.workspace_status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                  }`}>
                    {selectedCompany.workspace_status}
                  </span>
                </div>
              </div>

              {/* Ownership */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">License Ownership</h4>
                <div className="bg-slate-50 dark:bg-[#111] p-5 rounded-xl border border-slate-200 dark:border-[#1f1f1f] shadow-sm dark:shadow-none">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedCompany.license_owner}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mt-1">{selectedCompany.license_owner_email}</p>
                  <div className="mt-4 flex gap-2">
                    <button className="text-xs font-bold bg-white hover:bg-slate-50 dark:bg-[#1a1a1a] dark:hover:bg-[#222] border border-slate-200 dark:border-[#2a2a2a] text-slate-700 dark:text-gray-300 px-4 py-2 rounded-lg transition-all shadow-sm dark:shadow-none hover:-translate-y-0.5">Reset Password</button>
                    <button className="text-xs font-bold bg-white hover:bg-slate-50 dark:bg-[#1a1a1a] dark:hover:bg-[#222] border border-slate-200 dark:border-[#2a2a2a] text-slate-700 dark:text-gray-300 px-4 py-2 rounded-lg transition-all shadow-sm dark:shadow-none hover:-translate-y-0.5">Contact Owner</button>
                  </div>
                </div>
              </div>

              {/* Subscription Details */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">Subscription Profile</h4>
                <div className="bg-slate-50 dark:bg-[#111] p-5 rounded-xl border border-slate-200 dark:border-[#1f1f1f] space-y-4 shadow-sm dark:shadow-none">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500 dark:text-gray-400">Active Plan</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedCompany.plan_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500 dark:text-gray-400">Billing Status</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedCompany.billing_status}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500 dark:text-gray-400">Renews In</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedCompany.remaining_days} days</span>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200 dark:border-[#1f1f1f]">
                    <div className="flex justify-between text-xs mb-2 font-medium">
                      <span className="text-slate-500 dark:text-gray-400">Seat Utilization</span>
                      <span className="text-slate-900 dark:text-gray-200 font-bold">{selectedCompany.seats_used} / {selectedCompany.seat_limit}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(100, Math.round((selectedCompany.seats_used / (selectedCompany.seat_limit || 1)) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-[#1f1f1f]">
                <h4 className="text-[11px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">Workspace Access</h4>
                <button className="w-full text-sm bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-4 py-3 rounded-xl transition-all shadow-md hover:shadow-lg dark:hover:shadow-[0_4px_25px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 text-center font-bold flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Monitor Workspace Console
                </button>
              </div>
              
              {/* Danger Zone */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-[#1f1f1f]">
                <h4 className="text-[11px] font-bold text-red-600 dark:text-red-500 uppercase tracking-widest">Danger Zone</h4>
                <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-xl border border-red-200 dark:border-red-900/20 space-y-3 shadow-sm dark:shadow-none">
                  <button className="w-full text-sm font-bold text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 bg-white hover:bg-red-100 dark:bg-transparent dark:hover:bg-red-900/20 border border-red-200 dark:border-red-900/30 px-4 py-2.5 rounded-lg transition-all shadow-sm dark:shadow-none text-left">
                    Suspend Workspace Access
                  </button>
                  <button className="w-full text-sm font-bold text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 bg-white hover:bg-red-100 dark:bg-transparent dark:hover:bg-red-900/20 border border-red-200 dark:border-red-900/30 px-4 py-2.5 rounded-lg transition-all shadow-sm dark:shadow-none text-left">
                    Cancel Subscription
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
