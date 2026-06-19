import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { normalizeUserRole } from "../types/roles";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAppTheme } from "../hooks/useAppTheme";
import { Icon } from "../components/Icon";
import { workspaceNotifications } from "../config/notifications";
import { ChatProvider } from "../modules/chat/context/ChatContext";
import { AmbientAuraBackground } from "../components/AmbientAuraBackground";

export const WorkspaceConsoleLayout = () => {
  const { session, loading, logout, setActiveRole } = useAuth();
  const { theme, toggleTheme } = useAppTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return <LoadingSpinner label="Verifying access..." />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const role = normalizeUserRole(session.user.role);
  if (role !== "License Owner") {
    return <Navigate to="/" replace />;
  }

  const isHome = location.pathname === "/workspace-console/console" || location.pathname === "/workspace-console";

  const initialsFromName = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const toolbarButtonClass =
    "border border-zinc-200 bg-white/70 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 rounded-2xl px-4 py-2.5 text-xs font-bold tracking-wider uppercase backdrop-blur transition-all duration-200 text-zinc-700 dark:text-zinc-300";
  const iconButtonClass =
    "border border-zinc-200 bg-white/70 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 relative inline-flex h-11 w-11 items-center justify-center rounded-2xl backdrop-blur transition-all duration-200 text-zinc-700 dark:text-zinc-300";
  const floatingMenuClass =
    "border border-zinc-200/85 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-zinc-800/85 dark:bg-zinc-950/95 absolute right-0 z-50 mt-3 overflow-hidden rounded-[1.5rem] w-64";
  const profileMenuItemClass =
    "w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900/60";

  return (
    <ChatProvider>
      <div className="relative min-h-screen bg-zinc-50 text-zinc-900 transition-colors duration-500 overflow-x-hidden selection:bg-zinc-200 selection:text-zinc-900 font-sans subtle-grid-dots dark:bg-zinc-950 dark:text-zinc-100">
        
        {/* Ambient mesh background */}
        <AmbientAuraBackground />

        {/* Executive Topbar */}
        <header className="sticky top-0 z-40 border-b border-zinc-200/40 bg-white/70 backdrop-blur-xl transition-colors dark:border-zinc-850/40 dark:bg-zinc-950/70 py-4 px-6 sm:px-12">
          <div className="flex items-center justify-between w-full max-w-[1600px] mx-auto relative font-sans">
            
            {/* Left: Branding or Back Button */}
            <div className="flex items-center gap-4 sm:gap-6">
              {!isHome ? (
                <button
                  onClick={() => navigate("/workspace-console/console")}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white/70 px-4 text-xs font-bold uppercase tracking-wider text-zinc-755 hover:bg-zinc-50 transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Icon name="chevron-left" className="h-[18px] w-[18px] stroke-[2.5px]" />
                  <span className="hidden sm:inline">Portal Hub</span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm transition duration-300 hover:rotate-12">
                    <Icon name="clock" className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100 font-mono">
                    {session.user.organization || "Arkia Console"}
                  </span>
                </div>
              )}
            </div>

            {/* Middle: Plan Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/5 dark:border-emerald-500/30 dark:bg-emerald-950/20 backdrop-blur transition-all duration-300 hover:border-emerald-500/55 hover:bg-emerald-500/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-mono text-[9px] font-extrabold tracking-widest text-emerald-700 dark:text-emerald-400 uppercase">
                {session.user.role}
              </span>
            </div>

            {/* Right Group */}
            <div className="flex items-center gap-3">
              {/* Theme Toggler */}
              <button
                type="button"
                onClick={toggleTheme}
                className={toolbarButtonClass}
              >
                {theme === "light" ? "Dark" : "Light"}
              </button>

              {/* Notifications */}
              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((current) => !current)}
                  className={iconButtonClass}
                  aria-label="Open notifications"
                >
                  <Icon name="bell" className="h-5 w-5" />
                  {workspaceNotifications.length > 0 && (
                    <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 top-full z-50 w-80 rounded-[1.5rem] border border-zinc-200/80 bg-white/95 p-4 mt-3 shadow-2xl backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/95">
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-200/60 dark:border-zinc-800/60 mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">Notifications</p>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white transition"
                      >
                        <Icon name="close" className="h-4 w-4" />
                      </button>
                    </div>

                    {workspaceNotifications.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {workspaceNotifications.map((notification) => (
                          <div key={notification.id} className="rounded-xl border border-zinc-200 bg-white/50 p-3 dark:border-zinc-800 dark:bg-white/5 text-left">
                            <p className="text-xs font-semibold text-zinc-900 dark:text-white leading-normal">{notification.title}</p>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">{notification.message || "System status update"}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-zinc-450 dark:text-zinc-400 font-mono">
                        No active notifications.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Profile Dropdown */}
              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((current) => !current)}
                  className="flex items-center gap-2.5 rounded-2xl border border-zinc-200 bg-white/70 px-3.5 py-2 backdrop-blur transition-all duration-200 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800"
                >
                  {session.user.profilePhotoUrl ? (
                    <img src={session.user.profilePhotoUrl} alt="profile" className="h-7 w-7 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500 text-[10px] font-black text-white uppercase">
                      {initialsFromName(session.user.fullName)}
                    </div>
                  )}
                  <span className="hidden sm:inline text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {session.user.fullName}
                  </span>
                  <Icon name="chevron-down" className="h-3.5 w-3.5 text-zinc-450 dark:text-zinc-400 transition-transform duration-200" />
                </button>

                {profileOpen && (
                  <div className={floatingMenuClass}>
                    <div className="p-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/workspace-console/account");
                          setProfileOpen(false);
                        }}
                        className={profileMenuItemClass}
                      >
                        Account Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/workspace-console/subscription");
                          setProfileOpen(false);
                        }}
                        className={profileMenuItemClass}
                      >
                        Subscription details
                      </button>
                      <div className="h-px bg-zinc-200 dark:bg-zinc-800/80 my-1.5" />
                      <button
                        type="button"
                        onClick={logout}
                        className="w-full rounded-xl border border-red-500/10 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-red-600 transition hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/5"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </header>

        {/* Main Content Area */}
        <main className="relative z-10 w-full max-w-[1600px] mx-auto px-6 lg:px-12 py-10 min-h-[calc(100vh-80px)]">
          <Outlet />
        </main>

      </div>
    </ChatProvider>
  );
};
