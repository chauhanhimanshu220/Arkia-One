import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAppTheme } from "../hooks/useAppTheme";

const navigation = [
  { name: "Dashboard", href: "/management/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { name: "Companies", href: "/management/companies", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { name: "Subscriptions", href: "/management/subscriptions", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { name: "Billing", href: "/management/billing", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  { name: "Analytics", href: "/management/analytics", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { name: "System Health", href: "/management/system-health", icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" },
  { name: "Administration", href: "/management/administration", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { name: "Support", href: "/management/support", icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" },
];

export function ManagementLayout() {
  const { session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme } = useAppTheme();

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      setScrolled(target.scrollTop > 10);
    };
    
    const mainArea = document.getElementById("main-scroll-area");
    if (mainArea) {
      mainArea.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (mainArea) mainArea.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#030305] text-slate-800 dark:text-gray-200 font-sans selection:bg-indigo-500/30 overflow-hidden relative transition-colors duration-300">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-indigo-500/10 dark:bg-indigo-900/10 blur-[120px] transition-colors duration-300" />
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-violet-500/10 dark:bg-violet-900/10 blur-[120px] transition-colors duration-300" />
        <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-blue-500/10 dark:bg-blue-900/10 blur-[100px] transition-colors duration-300" />
      </div>

      {/* Sidebar Navigation */}
      <aside className="w-72 flex flex-col z-10 border-r border-slate-200/50 dark:border-white/5 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl relative transition-colors duration-300">
        <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-slate-300 dark:via-white/10 to-transparent"></div>
        
        <div className="flex items-center justify-center h-20 border-b border-slate-200/50 dark:border-white/5 px-6 transition-colors duration-300">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(99,102,241,0.4)]">
              A
            </div>
            <div className="flex flex-col">
              <span className="text-slate-900 dark:text-white font-bold tracking-wide uppercase text-sm leading-tight transition-colors duration-300">Arkia One</span>
              <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium uppercase tracking-widest transition-colors duration-300">Management</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar">
          <div className="text-[11px] font-bold text-slate-500 dark:text-gray-500/80 uppercase tracking-widest mb-4 px-3 transition-colors duration-300">Overview</div>
          <nav className="space-y-1.5">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 relative overflow-hidden ${
                    isActive
                      ? "text-slate-900 dark:text-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                      : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-slate-100/50 dark:hover:bg-white/5"
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-indigo-50/80 dark:bg-gradient-to-r dark:from-indigo-500/20 dark:to-violet-500/10 opacity-100 border border-indigo-100 dark:border-white/10 rounded-xl transition-colors duration-300" />
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)] dark:shadow-[0_0_10px_rgba(99,102,241,0.8)] transition-shadow duration-300" />
                  )}
                  <svg
                    className={`mr-3.5 h-5 w-5 flex-shrink-0 transition-transform duration-300 ${
                      isActive ? "text-indigo-600 dark:text-indigo-400 scale-110 drop-shadow-[0_0_5px_rgba(129,140,248,0.2)] dark:drop-shadow-[0_0_5px_rgba(129,140,248,0.5)]" : "text-slate-400 dark:text-gray-500 group-hover:text-slate-600 dark:group-hover:text-gray-300 group-hover:scale-110"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 2} d={item.icon} />
                  </svg>
                  <span className="relative z-10">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-5 border-t border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 backdrop-blur-md transition-colors duration-300">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="flex-shrink-0 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl blur-[8px] opacity-30 dark:opacity-50 group-hover:opacity-60 dark:group-hover:opacity-80 transition-opacity"></div>
              <div className="relative h-10 w-10 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-sm font-bold text-slate-800 dark:text-white shadow-inner transition-colors duration-300">
                {session?.user?.fullName?.charAt(0) || "S"}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate transition-colors duration-300">{session?.user?.fullName || "Super Admin"}</p>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate uppercase tracking-wider font-medium transition-colors duration-300">{session?.user?.role || "Owner"}</p>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              className="flex-shrink-0 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 p-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200 shadow-sm dark:shadow-none hover:-translate-y-0.5"
              title="Logout"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 z-10 relative">
        {/* Top Header */}
        <header className={`h-20 flex-shrink-0 flex items-center px-8 justify-between transition-all duration-300 z-20 ${
          scrolled ? "bg-white/70 dark:bg-black/40 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.1)]" : "bg-transparent border-b border-transparent"
        }`}>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 transition-colors duration-300">
              {navigation.find((n) => location.pathname.startsWith(n.href))?.name || "Portal"}
              <div className="h-5 w-[1px] bg-slate-300 dark:bg-white/20 mx-2 hidden md:block transition-colors duration-300"></div>
              <span className="text-sm font-medium text-slate-500 dark:text-gray-500 hidden md:block transition-colors duration-300">Workspace Command Center</span>
            </h2>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 backdrop-blur-md transition-colors duration-300">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold tracking-widest uppercase transition-colors duration-300">System Operational</span>
            </div>
            
            <div className="flex gap-3">
              {/* Theme Toggle Button */}
              <button 
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-all duration-200 shadow-sm dark:shadow-none"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>

              <button className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-all duration-200 shadow-sm dark:shadow-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div id="main-scroll-area" className="flex-1 overflow-y-auto custom-scrollbar relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
