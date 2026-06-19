import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { getSidebarSectionsForUser } from "../../config/workspaceNavigation";
import type { AuthUser } from "../../types/auth";
import { normalizeUserRole } from "../../types/roles";
import { EmployeeDashboardPage } from "./EmployeeDashboardPage";

export const WorkspaceHomePage = ({ user }: { user: AuthUser }) => {
  if (normalizeUserRole(user.role) === "Employee") {
    return <EmployeeDashboardPage user={user} />;
  }

  const quickLinks = getSidebarSectionsForUser(user)
    .flatMap((section) => section.items)
    .filter((item) => item.id !== "dashboard" && item.id !== "profile-settings" && item.id !== "notifications")
    .slice(0, 6);

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(161,161,170,0.14),transparent_40%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.96))] p-6 text-white shadow-panel dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(161,161,170,0.10),transparent_40%),linear-gradient(135deg,rgba(0,0,0,0.98),rgba(0,0,0,0.96))] sm:p-8">
        <h2 className="text-3xl font-bold text-white">Welcome, {user.fullName}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickLinks.map((link) => (
          <Link
            key={link.id}
            to={link.path}
            className="group rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-panel transition hover:-translate-y-1 hover:border-brand-200 dark:border-zinc-800 dark:bg-black/85 dark:hover:border-brand-500/40"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white/10 dark:text-zinc-200">
              <Icon name={link.icon} className="h-5 w-5" />
            </div>
            <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">{link.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
};
