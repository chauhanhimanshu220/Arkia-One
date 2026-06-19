import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatTopbarButton } from "../modules/chat/components/ChatTopbarButton";
import { workspaceNotifications } from "../config/notifications";
import type { AuthUser } from "../types/auth";
import type { Employee } from "../types/employee";
import type { UserRole } from "../types/roles";
import { formatUserRoles } from "../types/roles";
import { Icon } from "./Icon";

interface TopNavbarProps {
  onMenuToggle: () => void;
  user: AuthUser;
  onRoleChange: (role: UserRole) => void;
  onLogout: () => void;
  employees: Employee[];
  searchLoading: boolean;
  onSelectEmployee: (employee: Employee) => void;
  theme: "light" | "dark";
  onThemeToggle: () => void;
}

const initialsFromName = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const TopNavbar = ({
  onMenuToggle,
  user,
  onRoleChange,
  onLogout,
  employees,
  searchLoading,
  onSelectEmployee,
  theme,
  onThemeToggle,
}: TopNavbarProps) => {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [debouncing, setDebouncing] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const searchRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);

  const notifications = useMemo(() => workspaceNotifications, []);
  const availableRoles = useMemo(
    () => Array.from(new Set(user.roles.length > 0 ? user.roles : [user.role])),
    [user.role, user.roles],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!searchValue.trim()) {
      setDebouncing(false);
      setDebouncedSearch("");
      return;
    }

    setDebouncing(true);
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim().toLowerCase());
      setDebouncing(false);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }

      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }

      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setRoleMenuOpen(false);
      }

      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchResults = useMemo(() => {
    if (!debouncedSearch) {
      return [];
    }

    return employees
      .filter((employee) => {
        const query = debouncedSearch;
        return (
          employee.fullName.toLowerCase().includes(query) ||
          employee.email.toLowerCase().includes(query) ||
          employee.id.toLowerCase().includes(query)
        );
      })
      .slice(0, 6);
  }, [debouncedSearch, employees]);

  const effectiveSearchLoading = searchLoading || debouncing;
  const showEmptyState = debouncedSearch.length > 0 && !effectiveSearchLoading && searchResults.length === 0;
  const clockTime = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(currentTime),
    [currentTime],
  );
  const toolbarButtonClass = "border border-zinc-200 bg-white/65 hover:bg-white/85 dark:border-white/10 dark:bg-black/45 dark:hover:bg-white/10 rounded-2xl px-4 py-3 text-sm font-semibold backdrop-blur transition-colors";
  const iconButtonClass =
    "border border-zinc-200 bg-white/65 hover:bg-white/85 dark:border-white/10 dark:bg-black/45 dark:hover:bg-white/10 relative inline-flex h-12 w-12 items-center justify-center rounded-2xl backdrop-blur transition-colors";
  const searchFieldClass = "border border-zinc-200 bg-white/55 focus-within:bg-white/80 focus-within:border-zinc-300 dark:border-white/10 dark:bg-black/45 dark:focus-within:bg-black/60 flex min-w-[280px] items-center gap-3 rounded-2xl px-4 py-3 backdrop-blur transition-colors";
  const sessionChipClass = "border border-zinc-200 bg-white/60 dark:border-white/10 dark:bg-black/45 flex items-center gap-3 rounded-2xl px-4 py-2.5 backdrop-blur";
  const floatingMenuClass = "border border-zinc-200 bg-white/85 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-black/80 dark:shadow-none absolute right-0 z-50 mt-3 overflow-hidden rounded-[1.5rem]";
  const profileMenuItemClass =
    "w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-white/60 dark:text-zinc-200 dark:hover:bg-white/5";

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/45 backdrop-blur-xl transition-colors dark:border-white/10 dark:bg-black/35">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white/65 text-zinc-600 backdrop-blur transition-colors hover:bg-white/85 dark:border-white/10 dark:bg-black/45 dark:text-zinc-300 dark:hover:bg-white/10 lg:inline-flex"
            aria-label="Go back"
            title="Go back"
          >
            <Icon name="chevron-left" className="h-[18px] w-[18px] stroke-[2.5px]" />
          </button>
          <button
            type="button"
            onClick={onMenuToggle}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white/65 text-zinc-600 backdrop-blur transition-colors hover:bg-white/85 dark:border-white/10 dark:bg-black/45 dark:text-zinc-200 dark:hover:bg-white/10 lg:hidden"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <div
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/60 px-4 py-2.5 backdrop-blur dark:border-white/10 dark:bg-black/45"
            aria-label={`Current time ${clockTime}`}
            aria-live="polite"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/60 text-zinc-700 dark:bg-white/10 dark:text-white">
              <Icon name="clock" className="h-5 w-5" />
            </span>
            <span className="block font-mono text-sm font-bold tabular-nums text-zinc-900 dark:text-white">{clockTime}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div ref={searchRef} className="relative">
            <label className={searchFieldClass}>
              <Icon name="search" className="h-5 w-5 text-zinc-400" />
              <input
                value={searchValue}
                onChange={(event) => {
                  setSearchValue(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search employees"
                aria-label="Global employee search"
                className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </label>

            {searchOpen && (searchValue || debouncedSearch) && (
              <div className={`${floatingMenuClass} w-full`}>
                {effectiveSearchLoading && (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="flex animate-pulse items-center gap-3 rounded-2xl border border-white/55 bg-white/50 px-3 py-3 dark:border-white/10 dark:bg-white/5">
                        <div className="h-10 w-10 rounded-2xl bg-zinc-200 dark:bg-zinc-700" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                          <div className="h-3 w-2/3 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!effectiveSearchLoading && searchResults.length > 0 && (
                  <div className="max-h-[360px] overflow-y-auto p-2">
                    {searchResults.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => {
                          onSelectEmployee(employee);
                          setSearchOpen(false);
                          setSearchValue("");
                          setDebouncedSearch("");
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-white/55 dark:hover:bg-white/5"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(255,255,255,0.52),rgba(160,160,160,0.34),rgba(0,0,0,0.94))] text-sm font-bold text-zinc-900 dark:text-white">
                          {initialsFromName(employee.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{employee.fullName}</p>
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{employee.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{formatUserRoles(employee.roles)}</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{employee.id}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showEmptyState && (
                  <div className="p-6 text-center">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">No employees found</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {availableRoles.length > 1 ? (
            <div ref={roleMenuRef} className={`${sessionChipClass} relative min-w-[210px] overflow-visible`}>
              <button
                type="button"
                onClick={() => setRoleMenuOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-haspopup="menu"
                aria-expanded={roleMenuOpen}
                aria-label="Switch active role"
              >
                <span className="rounded-[20px] border border-zinc-200 bg-white px-3 py-1 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-black dark:text-white">{user.role}</span>
                <Icon
                    name="chevron-down"
                    className={`h-4 w-4 text-zinc-400 transition ${roleMenuOpen ? "rotate-180" : ""}`}
                  />
              </button>

              {roleMenuOpen && (
                <div className={`${floatingMenuClass} left-0 right-0 top-full min-w-[240px]`}>
                  <div className="p-2">
                    {availableRoles.map((role) => {
                      const active = role === user.role;

                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            setRoleMenuOpen(false);
                            onRoleChange(role);
                          }}
                          className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition ${
                            active
                              ? "bg-white/70 text-zinc-900 dark:bg-white/10 dark:text-white"
                              : "text-zinc-700 hover:bg-white/55 dark:text-zinc-200 dark:hover:bg-white/5"
                          }`}
                          role="menuitemradio"
                          aria-checked={active}
                        >
                          <div>
                            <p className="text-sm font-semibold">{role}</p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {active ? "Current workspace" : "Switch to this workspace"}
                            </p>
                          </div>
                          {active ? (
                            <span className="rounded-full border border-zinc-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">
                              Active
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`${sessionChipClass} min-w-[210px] justify-center`}>
              <span className="rounded-[20px] border border-zinc-200 bg-white px-3 py-1 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-black dark:text-white">{user.role}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onThemeToggle}
            className={toolbarButtonClass}
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>

          <button
            type="button"
            onClick={() => setNotificationsOpen((current) => !current)}
            className={iconButtonClass}
            aria-label="Open notifications"
            aria-expanded={notificationsOpen}
          >
            <Icon name="bell" className="h-5 w-5" />
            {notifications.length > 0 ? (
              <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-white/85 dark:bg-white/70" />
            ) : null}
          </button>

          <div ref={notificationsRef} className="relative">
            {notificationsOpen && (
              <div className="absolute right-0 top-2 z-50 w-[340px] rounded-[1.5rem] border border-zinc-200 bg-white/85 p-3 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-black/80 dark:shadow-none">
                <div className="flex items-center justify-between px-2 pb-3">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">Notifications</p>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/10 dark:text-zinc-300"
                    aria-label="Close notifications"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                </div>

                {notifications.length > 0 ? (
                  <div className="space-y-2">
                    {notifications.map((notification) => (
                      <div key={notification.id} className="rounded-2xl border border-white/55 bg-white/50 p-3 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-start gap-3">
                          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-zinc-400 dark:bg-zinc-300" />
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{notification.title}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    No notifications
                  </div>
                )}
              </div>
            )}
          </div>

          <ChatTopbarButton />

          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((current) => !current)}
              className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/65 px-4 py-2.5 backdrop-blur transition-colors hover:bg-white/85 dark:border-white/10 dark:bg-black/45 dark:hover:bg-white/10"
            >
              {user.profilePhotoUrl ? (
                <img src={user.profilePhotoUrl} alt={`${user.fullName} profile`} className="h-11 w-11 rounded-2xl object-cover" />
              ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#378ADD] text-sm font-bold text-[#E6F1FB]">
                  {initialsFromName(user.fullName)}
                </div>
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{user.fullName}</p>
              </div>
              <Icon name="chevron-down" className="h-4 w-4 text-zinc-400" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 z-50 mt-3 w-56 rounded-2xl border border-zinc-200 bg-white/85 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-black/80 dark:shadow-none">
                <button
                  type="button"
                  onClick={() => {
                    navigate("/admin/settings/profile");
                    setProfileOpen(false);
                  }}
                  className={profileMenuItemClass}
                >
                  My Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate("/admin/settings/account");
                    setProfileOpen(false);
                  }}
                  className={profileMenuItemClass}
                >
                  Account Settings
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="mt-1 w-full rounded-xl border border-red-500/20 px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:border-red-500/10 dark:text-red-400 dark:hover:bg-red-500/5"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
