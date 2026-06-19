import type { ReactNode } from "react";

/** Shared surface for compact stats / meta blocks in page heroes */
export const workspaceHeroAsideClass =
  "rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-black";

export function WorkspaceHeroMeta({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <div className={workspaceHeroAsideClass}>
      <p className="font-semibold text-zinc-900 dark:text-white">{primary}</p>
      {secondary ? <p className="mt-1 text-zinc-500 dark:text-zinc-400">{secondary}</p> : null}
    </div>
  );
}

type WorkspacePageHeroProps = {
  title: string;
  belowTitle?: ReactNode;
  children?: ReactNode;
};

export function WorkspacePageHero({ title, belowTitle, children }: WorkspacePageHeroProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{title}</h1>
        {belowTitle ? <div className="mt-3">{belowTitle}</div> : null}
      </div>
      {children ? (
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">{children}</div>
      ) : null}
    </div>
  );
}
