import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { workspaceNotifications } from "../config/notifications";
import {
  canAccessWorkspaceRoute,
  getSidebarSectionsForUser,
  type SidebarBadgeKey,
  type WorkspaceRouteDefinition,
} from "../config/workspaceNavigation";
import { leaveService } from "../services/leaveService";
import { taskService } from "../services/taskService";
import type { AuthUser } from "../types/auth";
import { Icon } from "../components/Icon";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  user: AuthUser;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const formatSectionLabel = (label: string) => label.toUpperCase();

export const Sidebar = ({ open, onClose, user, collapsed, onToggleCollapsed }: SidebarProps) => {
  const [badges, setBadges] = useState<Record<SidebarBadgeKey, number>>({
    approvals: 0,
    leaveApprovals: 0,
    notifications: workspaceNotifications.length,
  });

  const sections = useMemo(() => getSidebarSectionsForUser(user), [user]);
  const primarySections = sections.filter((section) => section.title !== "Account");

  useEffect(() => {
    let active = true;

    const loadBadges = async () => {
      const nextBadges: Record<SidebarBadgeKey, number> = {
        approvals: 0,
        leaveApprovals: 0,
        notifications: workspaceNotifications.length,
      };

      if (canAccessWorkspaceRoute(user, "approval-inbox")) {
        const timesheets = await taskService.listDailyTimesheets();
        nextBadges.approvals = timesheets.filter((item) => item.status === "Submitted" || item.status === "Pending").length;
      }

      if (canAccessWorkspaceRoute(user, "leave-approval")) {
        const leaves = await leaveService.getLeaves();
        nextBadges.leaveApprovals = leaves.filter((item) => item.status === "Pending").length;
      }

      if (active) {
        setBadges(nextBadges);
      }
    };

    void loadBadges();

    return () => {
      active = false;
    };
  }, [user]);

  const renderBadge = (item: WorkspaceRouteDefinition) => {
    if (!item.badgeKey) {
      return null;
    }

    const count = badges[item.badgeKey];
    if (!count) {
      return null;
    }

    return (
      <span
        className={`inline-flex min-w-[1.4rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
          "bg-zinc-950/10 text-zinc-700 dark:bg-white/10 dark:text-zinc-100"
        }`}
      >
        {count > 99 ? "99+" : count}
      </span>
    );
  };

  const renderNavItem = (item: WorkspaceRouteDefinition) => (
    <NavLink
      key={item.id}
      to={item.path}
      end
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `group relative flex items-center py-3 text-sm font-medium transition ${
          collapsed ? "justify-center rounded-xl px-3" : "gap-3 px-3.5"
        } ${
          isActive
            ? collapsed
              ? "bg-[#E6F1FB] text-[#0C447C] dark:bg-[#0C447C] dark:text-[#B5D4F4]"
              : "rounded-none rounded-r-lg border-l-[3px] border-l-[#378ADD] bg-[#E6F1FB] text-[#0C447C] dark:bg-[#0C447C] dark:text-[#B5D4F4]"
            : "rounded-xl text-zinc-600 hover:bg-white/55 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} className={`h-5 w-5 shrink-0 ${isActive ? "text-[#0C447C] dark:text-[#B5D4F4]" : ""}`} />
          {!collapsed ? (
            <>
              <span className="flex-1">{item.label}</span>
              {renderBadge(item)}
            </>
          ) : renderBadge(item)}
        </>
      )}
    </NavLink>
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition dark:bg-black/50 lg:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex ${collapsed ? "w-[92px]" : "w-[304px]"} flex-col border-r border-white/55 bg-white/70 text-zinc-900 shadow-2xl shadow-black/5 backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-black/55 dark:text-white lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`absolute top-5 z-10 hidden h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-zinc-500 shadow-sm ring-1 ring-white/70 backdrop-blur transition hover:bg-white hover:text-zinc-900 dark:bg-white/10 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-white/15 dark:hover:text-zinc-100 lg:inline-flex ${
            collapsed ? "left-1/2 -translate-x-1/2" : "right-4"
          }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon name={collapsed ? "chevrons-right" : "chevrons-left"} className="h-4 w-4" />
        </button>

        <div className={`flex-1 overflow-y-auto ${collapsed ? "px-2 py-6 lg:pt-16" : "px-4 py-6 lg:pt-16"}`}>

          {primarySections.map((group) => (
            <div key={group.title} className="mb-7">
              {!collapsed && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500/90 dark:text-zinc-400">
                  {formatSectionLabel(group.title)}
                </p>
              )}
              <div className="mt-2.5 space-y-1">{group.items.map(renderNavItem)}</div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
};
