import { WorkspacePageHero } from "../../components/WorkspacePageHero";
import { workspaceNotifications } from "../../config/notifications";

const toneClasses: Record<(typeof workspaceNotifications)[number]["tone"], string> = {
  amber: "bg-amber-500",
  sky: "bg-zinc-100 dark:bg-white/10",
  emerald: "bg-emerald-500",
};

export const NotificationsPage = () => (
  <section className="space-y-6">
    <WorkspacePageHero title="Notifications" />

    <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel dark:border-zinc-800 dark:bg-black/85">
      <div>
        <p className="text-lg font-semibold text-zinc-900 dark:text-white">Unread updates</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{workspaceNotifications.length} active</p>
      </div>

      {workspaceNotifications.length > 0 ? (
        <div className="mt-6 space-y-3">
          {workspaceNotifications.map((notification) => (
            <div key={notification.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-black/70">
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${toneClasses[notification.tone]}`} />
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{notification.title}</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{notification.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.75rem] border border-dashed border-zinc-300 px-6 py-14 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No notifications have been generated yet.
        </div>
      )}
    </div>
  </section>
);
